import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultClassGraphDataDirectory,
  FileProjectStore,
} from '../src/project-store.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

describe('local project store', () => {
  it('uses platform-appropriate application data locations', () => {
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

    expect(
      defaultClassGraphDataDirectory({
        platform: 'linux',
        env: { XDG_DATA_HOME: '/home/teacher/.data' },
        homeDirectory: '/home/teacher',
      }),
    ).toBe('/home/teacher/.data/ClassGraph')
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
    expect(snapshot.projects).toEqual([
      expect.objectContaining({
        projectId: 'grade-5a',
        title: 'Grade 5A English',
        studentCount: 1,
      }),
    ])

    await expect(restarted.load('grade-5a')).resolves.toMatchObject({
      projectId: 'grade-5a',
      students: [{ id: 's-001', displayName: 'Student One' }],
    })
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

    const backupFolders = await readdir(join(directory, 'backups'))
    expect(backupFolders).toHaveLength(1)
    const backups = await readdir(join(directory, 'backups', backupFolders[0]!))
    expect(backups).toHaveLength(1)

    const backup = JSON.parse(
      await readFile(join(directory, 'backups', backupFolders[0]!, backups[0]!), 'utf8'),
    ) as { students: unknown[] }
    expect(backup.students).toHaveLength(0)
  })
})
