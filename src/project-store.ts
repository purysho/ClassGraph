import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import type { ClassGraphProject } from './model.js'
import { parseProjectJson, serializeProjectJson } from './json.js'

const LIBRARY_VERSION = '1.0'
const MAX_LOCAL_BACKUPS = 5

interface LibraryManifest {
  version: typeof LIBRARY_VERSION
  lastProjectId?: string
}

export interface ProjectSummary {
  projectId: string
  title: string
  updatedAt: string
  studentCount: number
  subject?: string
  gradeOrLevel?: string
}

export interface ProjectLibrarySnapshot {
  enabled: true
  dataDirectory: string
  lastProjectId: string | null
  projects: ProjectSummary[]
}

export interface DataDirectoryInput {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  homeDirectory?: string
}

function projectSummary(project: ClassGraphProject): ProjectSummary {
  const summary: ProjectSummary = {
    projectId: project.projectId,
    title: project.title,
    updatedAt: project.updatedAt,
    studentCount: project.students.length,
  }
  if (project.classInfo.subject) summary.subject = project.classInfo.subject
  if (project.classInfo.gradeOrLevel) summary.gradeOrLevel = project.classInfo.gradeOrLevel
  return summary
}

function projectKey(projectId: string): string {
  return createHash('sha256').update(projectId).digest('hex').slice(0, 32)
}

function timestampKey(date = new Date()): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

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
  private readonly projectsDirectory: string
  private readonly backupsDirectory: string
  private readonly manifestPath: string

  constructor(dataDirectory = defaultClassGraphDataDirectory()) {
    this.dataDirectory = dataDirectory
    this.projectsDirectory = join(dataDirectory, 'projects')
    this.backupsDirectory = join(dataDirectory, 'backups')
    this.manifestPath = join(dataDirectory, 'library.json')
  }

  async initialize(): Promise<void> {
    await mkdir(this.projectsDirectory, { recursive: true })
    await mkdir(this.backupsDirectory, { recursive: true })
  }

  private currentPath(projectId: string): string {
    return join(this.projectsDirectory, \`\${projectKey(projectId)}.classgraph.json\`)
  }

  private backupDirectory(projectId: string): string {
    return join(this.backupsDirectory, projectKey(projectId))
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
    const temp = \`\${this.manifestPath}.next\`
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

  private async preservePrevious(projectId: string, currentPath: string): Promise<void> {
    if (!(await exists(currentPath))) return

    const directory = this.backupDirectory(projectId)
    await mkdir(directory, { recursive: true })
    const backupPath = join(directory, \`\${timestampKey()}.classgraph.json\`)
    await copyFile(currentPath, backupPath)

    const entries = (await readdir(directory))
      .filter((entry) => entry.endsWith('.classgraph.json'))
      .sort()
      .reverse()

    await Promise.all(
      entries.slice(MAX_LOCAL_BACKUPS).map((entry) => rm(join(directory, entry), { force: true })),
    )
  }

  async save(project: ClassGraphProject): Promise<ProjectSummary> {
    await this.initialize()
    const serialized = serializeProjectJson(project)
    const target = this.currentPath(project.projectId)

    let unchanged = false
    try {
      unchanged = (await readFile(target, 'utf8')) === serialized
    } catch {
      unchanged = false
    }

    if (!unchanged) {
      await this.preservePrevious(project.projectId, target)
      const temp = \`\${target}.next\`
      await writeFile(temp, serialized, { encoding: 'utf8', mode: 0o600 })
      await rm(target, { force: true })
      await rename(temp, target)
    }

    await this.remember(project.projectId)
    return projectSummary(project)
  }

  async load(projectId: string): Promise<ClassGraphProject> {
    await this.initialize()
    const path = this.currentPath(projectId)
    let project: ClassGraphProject

    try {
      project = parseProjectJson(await readFile(path, 'utf8'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(\`CG-2012 saved project could not be opened: \${message}\`)
    }

    if (project.projectId !== projectId) {
      throw new Error('CG-2012 saved project ID did not match the requested project')
    }

    await this.remember(projectId)
    return project
  }

  async list(): Promise<ProjectLibrarySnapshot> {
    await this.initialize()
    const summaries: ProjectSummary[] = []

    for (const entry of await readdir(this.projectsDirectory)) {
      if (!entry.endsWith('.classgraph.json')) continue
      try {
        const project = parseProjectJson(await readFile(join(this.projectsDirectory, entry), 'utf8'))
        summaries.push(projectSummary(project))
      } catch {
        // Damaged or unrelated files remain untouched and are omitted from the usable project list.
      }
    }

    summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const manifest = await this.readManifest()
    const lastProjectId =
      manifest.lastProjectId && summaries.some((item) => item.projectId === manifest.lastProjectId)
        ? manifest.lastProjectId
        : null

    return {
      enabled: true,
      dataDirectory: this.dataDirectory,
      lastProjectId,
      projects: summaries,
    }
  }
}
