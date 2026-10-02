import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultClassGraphDataDirectory,
  FileProjectStore,
  safeProjectFileStem,
  visibleClassGraphDirectory,
} from '../src/project-store.js'
import { serializeProjectJson } from '../src/json.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

describe('local project store', () => {
  it('keeps the Phase 7 legacy path available only for migration', () => {
    expect(
      defaultClassGraphDataDirectory({
        platform: 'win32',
        env: { LOCALAPPDATA: 'C:\\Users\\Teacher\\AppData\\Local' },
        homeDirectory: 'C:\\Users\\Teacher',
      }),
    ).toBe('C:\\Users\\Teacher\\AppData\\Local\\ClassGraph')

    expect(
      defaultClassGraphDataDirectory({
        platform: 'darwin',
        env: {},
        homeDirectory: '/Users/teacher',
      }),
    ).toBe('/Users/teacher/Library/Application Support/ClassGraph')
  })

  it('places native desktop data beneath the operating-system Documents folder', () => {
    expect(visibleClassGraphDirectory('C:\\Users\\Teacher\\Documents')).toBe(
      'C:\\Users\\Teacher\\Documents/ClassGraph',
    )
    expect(visibleClassGraphDirectory('/Users/teacher/Documents')).toBe(
      '/Users/teacher/Documents/ClassGraph',
    )
  })

  it('creates readable title-based project files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'classgraph-readable-'))
    const store = new FileProjectStore(directory)
    const project = createEmptyProject({
      projectId: 'grade-5a',
      title: 'Grade 5A English',
      now: '2026-10-02T10:00:00.000Z',
    })

    await store.save(project)
    const files = await readdir(join(directory, 'Projects'))

    expect(files).toEqual(['Grade 5A English.classgraph.json'])
    expect(safeProjectFileStem('Grade 5A: English / Term 1')).toBe('Grade 5A English Term 1')
  })

  it('persists projects across store instances and remembers the most recent project', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'classgraph-store-'))
    const first = new FileProjectStore(directory)
    const project = addStudent(
      createEmptyProject({
        projectId: 'grade-5a',
        title: 'Grade 5A English',
        now: '2026-10-02T10:00:00.000Z',
      }),
      { id: 's-001', displayName: 'Student One' },
      '2026-10-02T10:05:00.000Z',
    )

    await first.save(project)

    const restarted = new FileProjectStore(directory)
    const snapshot = await restarted.list()
    expect(snapshot.lastProjectId).toBe('grade-5a')
    expect(snapshot.projectsDirectory).toBe(join(directory, 'Projects'))
    expect(snapshot.projects).toEqual([
      expect.objectContaining({
        projectId: 'grade-5a',
        title: 'Grade 5A English',
        studentCount: 1,
        fileName: 'Grade 5A English.classgraph.json',
      }),
    ])

    await expect(restarted.load('grade-5a')).resolves.toMatchObject({
      projectId: 'grade-5a',
      students: [{ id: 's-001', displayName: 'Student One' }],
    })
  })

  it('still discovers a valid project after the user manually renames its file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'classgraph-rename-'))
    const store = new FileProjectStore(directory)
    const project = createEmptyProject({
      projectId: 'renamed-class',
      title: 'Original Name',
      now: '2026-10-02T10:00:00.000Z',
    })
    await store.save(project)

    const from = join(directory, 'Projects', 'Original Name.classgraph.json')
    const to = join(directory, 'Projects', 'My Cloud Copy.classgraph.json')
    await rename(from, to)

    const restarted = new FileProjectStore(directory)
    await expect(restarted.load('renamed-class')).resolves.toMatchObject({
      projectId: 'renamed-class',
      title: 'Original Name',
    })

    const snapshot = await restarted.list()
    expect(snapshot.projects[0]?.fileName).toBe('My Cloud Copy.classgraph.json')
  })

  it('keeps a local safety copy before overwriting a saved project', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'classgraph-backup-'))
    const store = new FileProjectStore(directory)
    const initial = createEmptyProject({
      projectId: 'class-a',
      title: 'Class A',
      now: '2026-10-02T10:00:00.000Z',
    })
    await store.save(initial)

    const updated = addStudent(initial, { id: 's-001' }, '2026-10-02T11:00:00.000Z')
    await store.save(updated)

    const backupFolders = await readdir(join(directory, 'Backups'))
    expect(backupFolders).toHaveLength(1)
    const backups = await readdir(join(directory, 'Backups', backupFolders[0]!))
    expect(backups).toHaveLength(1)

    const backup = JSON.parse(
      await readFile(join(directory, 'Backups', backupFolders[0]!, backups[0]!), 'utf8'),
    ) as { students: unknown[] }
    expect(backup.students).toHaveLength(0)
  })

  it('migrates valid Phase 7 hidden projects into the visible library once', async () => {
    const visible = await mkdtemp(join(tmpdir(), 'classgraph-visible-'))
    const legacy = await mkdtemp(join(tmpdir(), 'classgraph-legacy-'))
    await mkdir(join(legacy, 'projects'), { recursive: true })

    const project = createEmptyProject({
      projectId: 'legacy-class',
      title: 'Legacy Grade 4',
      now: '2026-09-30T10:00:00.000Z',
    })
    await writeFile(
      join(legacy, 'projects', '8d2f6f3d.classgraph.json'),
      serializeProjectJson(project),
      'utf8',
    )

    const store = new FileProjectStore(visible)
    await expect(store.migrateFromLegacy(legacy)).resolves.toBe(1)
    await expect(store.migrateFromLegacy(legacy)).resolves.toBe(0)

    expect(await readdir(join(visible, 'Projects'))).toEqual(['Legacy Grade 4.classgraph.json'])
  })

  it('can import a copied project file into a fresh library', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'classgraph-copy-source-'))
    const targetDirectory = await mkdtemp(join(tmpdir(), 'classgraph-copy-target-'))
    const sourceStore = new FileProjectStore(sourceDirectory)
    const project = createEmptyProject({
      projectId: 'portable-class',
      title: 'Portable Class',
      now: '2026-10-02T10:00:00.000Z',
    })
    await sourceStore.save(project)

    const cloudCopy = join(targetDirectory, 'downloaded-old-edition.json')
    await copyFile(join(sourceDirectory, 'Projects', 'Portable Class.classgraph.json'), cloudCopy)

    const targetStore = new FileProjectStore(join(targetDirectory, 'library'))
    await expect(targetStore.importFile(cloudCopy)).resolves.toMatchObject({
      projectId: 'portable-class',
    })
    expect(await readdir(join(targetDirectory, 'library', 'Projects'))).toEqual([
      'Portable Class.classgraph.json',
    ])
  })
})
