import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, posix, win32 } from 'node:path'
import type { ClassGraphProject } from './model.js'
import { parseProjectJson, serializeProjectJson } from './json.js'
import {
  assertAcceptablePassword,
  decryptProject,
  deriveProjectKey,
  encryptProject,
  parseProtectedFile,
  protectionError,
  unlockProtectedFile,
  type ProjectKey,
  type ProtectedProjectFile,
  type ScryptParams,
} from './project-crypto.js'

const LIBRARY_VERSION = '2.0'
const MAX_LOCAL_BACKUPS = 5
const PROJECT_SUFFIX = '.classgraph.json'
const MIGRATION_MARKER = '.migrated-v0.7'

interface LibraryManifest {
  version: typeof LIBRARY_VERSION
  lastProjectId?: string
}

export interface ProjectSummary {
  projectId: string
  title: string
  updatedAt: string
  /** Null while a password-protected class is locked. */
  studentCount: number | null
  fileName: string
  /** The file on disk is password protected. */
  protected: boolean
  /** Protected and not unlocked in this session; title and counts are unavailable. */
  locked: boolean
  subject?: string
  gradeOrLevel?: string
}

export interface ProjectLibrarySnapshot {
  enabled: true
  dataDirectory: string
  projectsDirectory: string
  backupsDirectory: string
  lastProjectId: string | null
  projects: ProjectSummary[]
}

export interface DataDirectoryInput {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  homeDirectory?: string
}

interface StoredProject {
  path: string
  fileName: string
  projectId: string
  /** Present for plain files and for protected files unlocked in this session. */
  project?: ClassGraphProject
  protectedFile?: ProtectedProjectFile
  modifiedAt: string
}

export interface ProjectProtectionStatus {
  protected: boolean
  unlocked: boolean
}

function projectSummary(
  project: ClassGraphProject,
  fileName: string,
  isProtected = false,
): ProjectSummary {
  const summary: ProjectSummary = {
    projectId: project.projectId,
    title: project.title,
    updatedAt: project.updatedAt,
    studentCount: project.students.length,
    fileName,
    protected: isProtected,
    locked: false,
  }
  if (project.classInfo.subject) summary.subject = project.classInfo.subject
  if (project.classInfo.gradeOrLevel) summary.gradeOrLevel = project.classInfo.gradeOrLevel
  return summary
}

function timestampKey(date = new Date()): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function shortProjectKey(projectId: string): string {
  return createHash('sha256').update(projectId).digest('hex').slice(0, 8)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export function safeProjectFileStem(title: string): string {
  const safeCharacters = [...title.normalize('NFKC')].map((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 32 || '<>:"/\\|?*'.includes(character) ? ' ' : character
  })

  const cleaned = safeCharacters
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 100)
    .trim()

  return cleaned || 'ClassGraph Project'
}

export function visibleClassGraphDirectory(documentsDirectory: string): string {
  return join(documentsDirectory, 'ClassGraph')
}

/**
 * Phase 7 legacy location. Kept only so the native desktop build can copy old
 * projects into the visible Documents library on first launch.
 */
export function defaultClassGraphDataDirectory(input: DataDirectoryInput = {}): string {
  const platform = input.platform ?? process.platform
  const env = input.env ?? process.env
  const home = input.homeDirectory ?? homedir()

  if (platform === 'win32') {
    const base = env.LOCALAPPDATA ?? env.APPDATA ?? win32.join(home, 'AppData', 'Local')
    return win32.join(base, 'ClassGraph')
  }
  if (platform === 'darwin') {
    return posix.join(home, 'Library', 'Application Support', 'ClassGraph')
  }
  return posix.join(env.XDG_DATA_HOME ?? posix.join(home, '.local', 'share'), 'ClassGraph')
}

function lockedSummary(stored: StoredProject): ProjectSummary {
  return {
    projectId: stored.projectId,
    title: stored.fileName.replace(/\.classgraph\.json$|\.json$/i, ''),
    updatedAt: stored.modifiedAt,
    studentCount: null,
    fileName: stored.fileName,
    protected: true,
    locked: true,
  }
}

function lockedError(): Error {
  return protectionError(
    'CG-2016',
    'this class is password protected; enter its password to open it',
  )
}

export class FileProjectStore {
  /** Keys for protected classes unlocked in this session. Never written to disk. */
  private readonly keys = new Map<string, ProjectKey>()
  /** Overridable for tests; production uses the default scrypt cost. */
  scryptParams: ScryptParams | undefined = undefined
  readonly dataDirectory: string
  readonly projectsDirectory: string
  readonly backupsDirectory: string
  private readonly manifestPath: string
  private readonly migrationMarkerPath: string

  constructor(dataDirectory = defaultClassGraphDataDirectory()) {
    this.dataDirectory = dataDirectory
    this.projectsDirectory = join(dataDirectory, 'Projects')
    this.backupsDirectory = join(dataDirectory, 'Backups')
    this.manifestPath = join(dataDirectory, 'library.json')
    this.migrationMarkerPath = join(dataDirectory, MIGRATION_MARKER)
  }

  async initialize(): Promise<void> {
    await mkdir(this.projectsDirectory, { recursive: true })
    await mkdir(this.backupsDirectory, { recursive: true })
  }

  private async readManifest(): Promise<LibraryManifest> {
    try {
      const raw = JSON.parse(await readFile(this.manifestPath, 'utf8')) as Partial<LibraryManifest>
      return {
        version: LIBRARY_VERSION,
        ...(typeof raw.lastProjectId === 'string' ? { lastProjectId: raw.lastProjectId } : {}),
      }
    } catch {
      return { version: LIBRARY_VERSION }
    }
  }

  private async writeManifest(manifest: LibraryManifest): Promise<void> {
    await this.initialize()
    const temp = `${this.manifestPath}.next`
    await writeFile(temp, JSON.stringify(manifest, null, 2) + '\n', {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rm(this.manifestPath, { force: true })
    await rename(temp, this.manifestPath)
  }

  private async remember(projectId: string): Promise<void> {
    const manifest = await this.readManifest()
    await this.writeManifest({ ...manifest, version: LIBRARY_VERSION, lastProjectId: projectId })
  }

  private async readStoredProjects(): Promise<StoredProject[]> {
    await this.initialize()
    const stored: StoredProject[] = []

    for (const entry of await readdir(this.projectsDirectory)) {
      const lower = entry.toLowerCase()
      if (!lower.endsWith('.json')) continue

      const path = join(this.projectsDirectory, entry)
      try {
        const text = await readFile(path, 'utf8')
        const modifiedAt = (await stat(path)).mtime.toISOString()
        const protectedFile = parseProtectedFile(text)
        if (protectedFile) {
          const key = this.keys.get(protectedFile.projectId)
          stored.push({
            path,
            fileName: entry,
            projectId: protectedFile.projectId,
            protectedFile,
            modifiedAt,
            ...(key ? { project: decryptProject(protectedFile, key) } : {}),
          })
        } else {
          const project = parseProjectJson(text)
          stored.push({ path, fileName: entry, projectId: project.projectId, project, modifiedAt })
        }
      } catch {
        // Invalid or unrelated JSON stays untouched and is not shown as a ClassGraph project.
      }
    }

    return stored
  }

  private async uniqueProjectPath(title: string): Promise<string> {
    const stem = safeProjectFileStem(title)
    let index = 1

    while (true) {
      const suffix = index === 1 ? '' : ` (${index})`
      const candidate = join(this.projectsDirectory, `${stem}${suffix}${PROJECT_SUFFIX}`)
      if (!(await exists(candidate))) return candidate
      index += 1
    }
  }

  private backupDirectory(project: ClassGraphProject): string {
    return join(
      this.backupsDirectory,
      `${safeProjectFileStem(project.title)} [${shortProjectKey(project.projectId)}]`,
    )
  }

  private async preservePrevious(project: ClassGraphProject, currentPath: string): Promise<void> {
    if (!(await exists(currentPath))) return

    const directory = this.backupDirectory(project)
    await mkdir(directory, { recursive: true })
    const backupPath = join(directory, `${timestampKey()}${PROJECT_SUFFIX}`)
    await copyFile(currentPath, backupPath)

    const entries = (await readdir(directory))
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .sort()
      .reverse()

    await Promise.all(
      entries.slice(MAX_LOCAL_BACKUPS).map((entry) => rm(join(directory, entry), { force: true })),
    )
  }

  private async writeAtomically(target: string, contents: string): Promise<void> {
    const temp = `${target}.next`
    await writeFile(temp, contents, { encoding: 'utf8', mode: 0o600 })
    await rm(target, { force: true })
    await rename(temp, target)
  }

  async save(project: ClassGraphProject): Promise<ProjectSummary> {
    await this.initialize()
    const stored = await this.readStoredProjects()
    const existing = stored.find((item) => item.projectId === project.projectId)
    const key = this.keys.get(project.projectId)

    // Never write a protected class back to disk as plain JSON.
    if (existing?.protectedFile && !key) throw lockedError()

    const target = existing?.path ?? (await this.uniqueProjectPath(project.title))
    const fileName = basename(target)
    const plain = serializeProjectJson(project)
    const unchanged =
      existing?.project !== undefined && serializeProjectJson(existing.project) === plain

    if (!unchanged || (key && !existing?.protectedFile)) {
      if (existing?.project) await this.preservePrevious(existing.project, target)
      await this.writeAtomically(target, key ? encryptProject(project, key) : plain)
    }

    await this.remember(project.projectId)
    return projectSummary(project, fileName, key !== undefined)
  }

  async load(projectId: string): Promise<ClassGraphProject> {
    const stored = await this.readStoredProjects()
    const match = stored.find((item) => item.projectId === projectId)

    if (!match) {
      throw new Error('CG-2012 saved project could not be found in the ClassGraph Projects folder')
    }
    if (!match.project) throw lockedError()

    await this.remember(projectId)
    return match.project
  }

  async protectionStatus(projectId: string): Promise<ProjectProtectionStatus> {
    const stored = (await this.readStoredProjects()).find((item) => item.projectId === projectId)
    return {
      protected: stored?.protectedFile !== undefined,
      unlocked: this.keys.has(projectId),
    }
  }

  async unlock(projectId: string, password: string): Promise<ClassGraphProject> {
    const stored = (await this.readStoredProjects()).find((item) => item.projectId === projectId)
    if (!stored) {
      throw new Error('CG-2012 saved project could not be found in the ClassGraph Projects folder')
    }
    if (!stored.protectedFile) return this.load(projectId)
    const { project, key } = await unlockProtectedFile(stored.protectedFile, password)
    this.keys.set(projectId, key)
    await this.remember(projectId)
    return project
  }

  /**
   * Turns on (or replaces) password protection. Existing plain safety copies of this class are
   * deleted, because they would otherwise leave the same data readable next to the protected file.
   */
  async protect(project: ClassGraphProject, password: string): Promise<ProjectSummary> {
    assertAcceptablePassword(password)
    const status = await this.protectionStatus(project.projectId)
    if (status.protected && !status.unlocked) throw lockedError()

    const previousKey = this.keys.get(project.projectId)
    const nextKey = await deriveProjectKey(password, undefined, this.scryptParams)
    this.keys.set(project.projectId, nextKey)
    await this.secureBackups(project.projectId, previousKey, nextKey)
    const stored = (await this.readStoredProjects()).find(
      (item) => item.projectId === project.projectId,
    )
    const target = stored?.path ?? (await this.uniqueProjectPath(project.title))
    await this.writeAtomically(target, encryptProject(project, nextKey))
    await this.remember(project.projectId)
    return projectSummary(project, basename(target), true)
  }

  async changePassword(
    projectId: string,
    currentPassword: string,
    nextPassword: string,
  ): Promise<ProjectSummary> {
    assertAcceptablePassword(nextPassword)
    const project = await this.verifyPassword(projectId, currentPassword)
    return this.protect(project, nextPassword)
  }

  /** Removes protection after checking the current password; the file becomes plain JSON. */
  async unprotect(projectId: string, currentPassword: string): Promise<ProjectSummary> {
    const project = await this.verifyPassword(projectId, currentPassword)
    const stored = (await this.readStoredProjects()).find((item) => item.projectId === projectId)
    const target = stored?.path ?? (await this.uniqueProjectPath(project.title))
    this.keys.delete(projectId)
    await this.writeAtomically(target, serializeProjectJson(project))
    return projectSummary(project, basename(target), false)
  }

  /** Forgets the in-memory key; the class must be unlocked again to open or save it. */
  lock(projectId: string): void {
    this.keys.delete(projectId)
  }

  /**
   * Serialises a backup copy. Protected classes stay encrypted unless `plain` is requested.
   */
  async serializeBackup(project: ClassGraphProject, plain: boolean): Promise<string> {
    const status = await this.protectionStatus(project.projectId)
    if (plain || !status.protected) return serializeProjectJson(project)
    const key = this.keys.get(project.projectId)
    if (!key) throw lockedError()
    return encryptProject(project, key)
  }

  /** Restores a protected backup file into the library, keeping it protected. */
  async importProtected(text: string, password: string): Promise<ClassGraphProject> {
    const file = parseProtectedFile(text)
    if (!file) return this.importText(text)
    const { project, key } = await unlockProtectedFile(file, password)
    this.keys.set(project.projectId, key)
    await this.save(project)
    return project
  }

  /** Restores a plain backup. A protected backup needs its password (CG-2015). */
  async importText(text: string): Promise<ClassGraphProject> {
    if (parseProtectedFile(text)) {
      throw protectionError(
        'CG-2015',
        'this backup is password protected; enter its password to restore it',
      )
    }
    const project = parseProjectJson(text)
    await this.save(project)
    return project
  }

  private async verifyPassword(projectId: string, password: string): Promise<ClassGraphProject> {
    const stored = (await this.readStoredProjects()).find((item) => item.projectId === projectId)
    if (!stored?.protectedFile) {
      throw protectionError('CG-2019', 'this class does not have a password')
    }
    const { project } = await unlockProtectedFile(stored.protectedFile, password)
    return project
  }

  /**
   * Makes every safety copy of this class match its protection: plain copies are deleted, and
   * copies encrypted with the previous password are re-encrypted with the new one. Copies are
   * found by project ID, so folders from before a rename are included.
   */
  private async secureBackups(
    projectId: string,
    previousKey: ProjectKey | undefined,
    nextKey: ProjectKey,
  ): Promise<void> {
    if (!(await exists(this.backupsDirectory))) return
    const marker = `[${shortProjectKey(projectId)}]`
    for (const folder of await readdir(this.backupsDirectory)) {
      if (!folder.endsWith(marker)) continue
      const directory = join(this.backupsDirectory, folder)
      for (const entry of await readdir(directory)) {
        const path = join(directory, entry)
        let file: ProtectedProjectFile | null
        try {
          file = parseProtectedFile(await readFile(path, 'utf8'))
        } catch {
          continue
        }
        if (!file) {
          await rm(path, { force: true })
          continue
        }
        if (!previousKey || file.projectId !== projectId) continue
        try {
          await this.writeAtomically(
            path,
            encryptProject(decryptProject(file, previousKey), nextKey),
          )
        } catch {
          // A copy made under some other earlier password is left as it is.
        }
      }
    }
  }

  async importFile(path: string): Promise<ClassGraphProject> {
    return this.importText(await readFile(path, 'utf8'))
  }

  async migrateFromLegacy(legacyDirectory: string): Promise<number> {
    await this.initialize()
    if (legacyDirectory === this.dataDirectory || (await exists(this.migrationMarkerPath))) return 0

    let migrated = 0
    const legacyProjects = [join(legacyDirectory, 'projects'), join(legacyDirectory, 'Projects')]

    for (const directory of legacyProjects) {
      if (!(await exists(directory))) continue

      for (const entry of await readdir(directory)) {
        if (!entry.toLowerCase().endsWith('.json')) continue
        try {
          const project = parseProjectJson(await readFile(join(directory, entry), 'utf8'))
          const current = await this.readStoredProjects()
          if (!current.some((item) => item.projectId === project.projectId)) {
            await this.save(project)
            migrated += 1
          }
        } catch {
          // Leave damaged legacy files untouched.
        }
      }
    }

    await writeFile(
      this.migrationMarkerPath,
      `ClassGraph v0.7 migration checked at ${new Date().toISOString()}\n`,
      'utf8',
    )
    return migrated
  }

  async list(): Promise<ProjectLibrarySnapshot> {
    const stored = await this.readStoredProjects()
    const summaries = stored
      .map((item) =>
        item.project
          ? projectSummary(item.project, item.fileName, item.protectedFile !== undefined)
          : lockedSummary(item),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    const manifest = await this.readManifest()
    const lastProjectId =
      manifest.lastProjectId && summaries.some((item) => item.projectId === manifest.lastProjectId)
        ? manifest.lastProjectId
        : null

    return {
      enabled: true,
      dataDirectory: this.dataDirectory,
      projectsDirectory: this.projectsDirectory,
      backupsDirectory: this.backupsDirectory,
      lastProjectId,
      projects: summaries,
    }
  }
}
