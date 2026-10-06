import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { serializeProjectJson } from '../src/json.js'
import {
  decryptProject,
  deriveProjectKey,
  encryptProject,
  parseProtectedFile,
  unlockProtectedFile,
} from '../src/project-crypto.js'
import { FileProjectStore } from '../src/project-store.js'
import { addStudent, createEmptyProject, updateProjectMetadata } from '../src/workspace.js'

const FAST = { N: 2 ** 10, r: 8, p: 1 }
const now = '2026-10-06T10:00:00.000Z'
const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function store(): Promise<FileProjectStore> {
  const directory = await mkdtemp(join(tmpdir(), 'classgraph-protect-'))
  directories.push(directory)
  const created = new FileProjectStore(directory)
  created.scryptParams = FAST
  return created
}

function classProject(id = 'secret-class', title = 'Grade 5A English') {
  let project = createEmptyProject({ projectId: id, title, now })
  project = addStudent(project, { id: 's1', displayName: '张喆' }, now)
  return project
}

async function projectFiles(target: FileProjectStore): Promise<string[]> {
  const names = await readdir(target.projectsDirectory)
  return Promise.all(names.map((name) => readFile(join(target.projectsDirectory, name), 'utf8')))
}

async function backupFiles(target: FileProjectStore): Promise<string[]> {
  const contents: string[] = []
  for (const folder of await readdir(target.backupsDirectory)) {
    for (const name of await readdir(join(target.backupsDirectory, folder))) {
      contents.push(await readFile(join(target.backupsDirectory, folder, name), 'utf8'))
    }
  }
  return contents
}

describe('protected project file format', () => {
  it('round-trips and keeps only the project ID readable', async () => {
    const key = await deriveProjectKey('correct horse', undefined, FAST)
    const text = encryptProject(classProject(), key)
    expect(text).not.toContain('张喆')
    expect(text).not.toContain('Grade 5A')

    const file = parseProtectedFile(text)
    expect(file?.projectId).toBe('secret-class')
    const { project } = await unlockProtectedFile(file!, 'correct horse')
    expect(project.students[0]?.displayName).toBe('张喆')
  })

  it('rejects a wrong password and a header moved onto another file', async () => {
    const key = await deriveProjectKey('correct horse', undefined, FAST)
    const file = parseProtectedFile(encryptProject(classProject(), key))!
    await expect(unlockProtectedFile(file, 'wrong horse')).rejects.toThrow('CG-2017')
    expect(() => decryptProject({ ...file, projectId: 'other-class' }, key)).toThrow('CG-2017')
  })

  it('ignores plain projects and reports damaged envelopes', () => {
    expect(parseProtectedFile(serializeProjectJson(classProject()))).toBeNull()
    expect(() =>
      parseProtectedFile(JSON.stringify({ format: 'classgraph-protected-project', version: '1' })),
    ).toThrow('CG-2020')
  })
})

describe('protected projects in the local library', () => {
  it('encrypts on protect, removes plain safety copies and lists the class as locked', async () => {
    const target = await store()
    let project = classProject()
    await target.save(project)
    project = updateProjectMetadata(project, { title: 'Grade 5A English (renamed)' }, now)
    await target.save(project) // creates a plain safety copy under the old title
    expect((await backupFiles(target)).length).toBe(1)

    await target.protect(project, 'correct horse')
    for (const text of [...(await projectFiles(target)), ...(await backupFiles(target))]) {
      expect(text).not.toContain('张喆')
    }
    expect(await backupFiles(target)).toHaveLength(0)

    target.lock(project.projectId)
    const library = await target.list()
    expect(library.projects).toEqual([
      expect.objectContaining({
        projectId: 'secret-class',
        protected: true,
        locked: true,
        studentCount: null,
      }),
    ])
    expect(JSON.stringify(library)).not.toContain('张喆')
  })

  it('refuses to open or save a locked class, then works after unlocking', async () => {
    const target = await store()
    const project = classProject()
    await target.protect(project, 'correct horse')
    target.lock(project.projectId)

    await expect(target.load(project.projectId)).rejects.toThrow('CG-2016')
    await expect(target.save(project)).rejects.toThrow('CG-2016')
    await expect(target.unlock(project.projectId, 'nope nope')).rejects.toThrow('CG-2017')

    const unlocked = await target.unlock(project.projectId, 'correct horse')
    expect(unlocked.students).toHaveLength(1)
    const edited = addStudent(unlocked, { id: 's2' }, now)
    await target.save(edited)
    for (const text of await projectFiles(target))
      expect(text).toContain('classgraph-protected-project')
    // Safety copies of a protected class stay encrypted.
    for (const text of await backupFiles(target))
      expect(text).toContain('classgraph-protected-project')
  })

  it('re-encrypts safety copies when the password changes', async () => {
    const target = await store()
    const project = classProject()
    await target.protect(project, 'first password')
    await target.save(addStudent(project, { id: 's2' }, now))
    expect(await backupFiles(target)).toHaveLength(1)

    await expect(
      target.changePassword(project.projectId, 'wrong one!', 'second password'),
    ).rejects.toThrow('CG-2017')
    await target.changePassword(project.projectId, 'first password', 'second password')
    const backup = parseProtectedFile((await backupFiles(target))[0]!)!
    await expect(unlockProtectedFile(backup, 'first password')).rejects.toThrow('CG-2017')
    expect((await unlockProtectedFile(backup, 'second password')).project.projectId).toBe(
      project.projectId,
    )
  })

  it('removes protection only with the current password', async () => {
    const target = await store()
    const project = classProject()
    await target.protect(project, 'correct horse')
    await expect(target.unprotect(project.projectId, 'wrong horse')).rejects.toThrow('CG-2017')
    await target.unprotect(project.projectId, 'correct horse')
    expect((await projectFiles(target))[0]).toContain('张喆')
    expect(await target.protectionStatus(project.projectId)).toEqual({
      protected: false,
      unlocked: false,
    })
  })

  it('rejects short passwords', async () => {
    const target = await store()
    await expect(target.protect(classProject(), 'short')).rejects.toThrow('CG-2018')
  })

  it('keeps backups encrypted unless a plain copy is explicitly requested', async () => {
    const target = await store()
    const project = classProject()
    await target.protect(project, 'correct horse')
    expect(await target.serializeBackup(project, false)).not.toContain('张喆')
    expect(await target.serializeBackup(project, true)).toContain('张喆')
  })

  it('restores a protected backup only with its password and keeps it protected', async () => {
    const source = await store()
    const project = classProject()
    await source.protect(project, 'correct horse')
    const backup = await source.serializeBackup(project, false)

    const fresh = await store()
    await expect(fresh.importText(backup)).rejects.toThrow('CG-2015')
    await expect(fresh.importProtected(backup, 'wrong horse')).rejects.toThrow('CG-2017')
    const restored = await fresh.importProtected(backup, 'correct horse')
    expect(restored.students[0]?.displayName).toBe('张喆')
    expect((await projectFiles(fresh))[0]).not.toContain('张喆')
  })

  it('exposes protection through the shared API dispatcher', async () => {
    const target = await store()
    const project = classProject()
    await target.save(project)
    const call = (path: string, body: unknown) =>
      dispatchClassGraphApi(
        { method: 'POST', path, body: JSON.stringify(body) },
        { projectStore: target },
      )

    expect(
      (await call('/api/protection/enable', { project, password: 'correct horse' })).status,
    ).toBe(200)
    expect((await call('/api/protection/lock', { projectId: project.projectId })).status).toBe(200)

    const locked = await call('/api/projects/open', { projectId: project.projectId })
    expect(locked.status).toBe(400)
    expect((JSON.parse(locked.body as string) as { error: { code: string } }).error.code).toBe(
      'CG-2016',
    )

    const mutate = await call('/api/project/mutate', {
      project,
      command: { type: 'add-student', student: { id: 's9' } },
    })
    expect((JSON.parse(mutate.body as string) as { error: { code: string } }).error.code).toBe(
      'CG-2016',
    )

    const unlocked = await call('/api/projects/unlock', {
      projectId: project.projectId,
      password: 'correct horse',
    })
    expect(unlocked.status).toBe(200)

    const backup = await call('/api/export/backup', { project })
    expect(String(backup.body)).not.toContain('张喆')
    const plain = await call('/api/export/backup', { project, plain: true })
    expect(String(plain.body)).toContain('张喆')
  })

  it('still lists plain projects and skips unrelated JSON', async () => {
    const target = await store()
    await target.save(classProject('plain-class', 'Plain'))
    await writeFile(join(target.projectsDirectory, 'notes.json'), '{"hello":1}')
    const library = await target.list()
    expect(library.projects.map((item) => [item.projectId, item.protected, item.locked])).toEqual([
      ['plain-class', false, false],
    ])
  })
})
