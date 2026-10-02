import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, posix, win32 } from 'node:path'
import type { ClassGraphProject } from './model.js'
import { parseProjectJson, serializeProjectJson } from './json.js'

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
  studentCount: number
  fileName: string
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
  project: ClassGraphProject
}

function projectSummary(project: ClassGraphProject, fileName: string): ProjectSummary {
  const summary: ProjectSummary = {
    projectId: project.projectId,
    title: project.title,
    updatedAt: project.updatedAt,
    studentCount: project.students.length,
    fileName,
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
  const cleaned = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
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

export class FileProjectStore {
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
        const project = parseProjectJson(await readFile(path, 'utf8'))
        stored.push({ path, fileName: entry, project })
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

  async save(project: ClassGraphProject): Promise<ProjectSummary> {
    await this.initialize()
    const stored = await this.readStoredProjects()
    const existing = stored.find((item) => item.project.projectId === project.projectId)
    const target = existing?.path ?? (await this.uniqueProjectPath(project.title))
    const fileName = basename(target)
    const serialized = serializeProjectJson(project)

    let unchanged = false
    try {
      unchanged = (await readFile(target, 'utf8')) === serialized
    } catch {
      unchanged = false
    }

    if (!unchanged) {
      if (existing) await this.preservePrevious(existing.project, target)
      const temp = `${target}.next`
      await writeFile(temp, serialized, { encoding: 'utf8', mode: 0o600 })
      await rm(target, { force: true })
      await rename(temp, target)
    }

    await this.remember(project.projectId)
    return projectSummary(project, fileName)
  }

  async load(projectId: string): Promise<ClassGraphProject> {
    const stored = await this.readStoredProjects()
    const match = stored.find((item) => item.project.projectId === projectId)

    if (!match) {
      throw new Error('CG-2012 saved project could not be found in the ClassGraph Projects folder')
    }

    await this.remember(projectId)
    return match.project
  }

  async importFile(path: string): Promise<ClassGraphProject> {
    const project = parseProjectJson(await readFile(path, 'utf8'))
    await this.save(project)
    return project
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
          if (!current.some((item) => item.project.projectId === project.projectId)) {
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
      .map((item) => projectSummary(item.project, item.fileName))
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
