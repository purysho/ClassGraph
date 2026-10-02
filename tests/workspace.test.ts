import { describe, expect, it } from 'vitest'
import {
  addStudent,
  createEmptyProject,
  removeStudent,
  updateProjectMetadata,
  updateStudent,
} from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'
const t1 = '2026-10-01T10:01:00.000Z'
const t2 = '2026-10-01T10:02:00.000Z'

describe('workspace', () => {
  it('creates a valid empty teacher-entered project', () => {
    const project = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: t0,
      classInfo: { subject: 'English' },
    })

    expect(project.students).toEqual([])
    expect(project.provenance['/title']?.kind).toBe('teacher-entered')
    expect(project.updatedAt).toBe(t0)
  })

  it('adds and edits a student without inventing metrics', () => {
    const initial = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: t0,
    })
    const added = addStudent(
      initial,
      { id: 's-001', displayName: 'Student 1', tags: ['group-a'] },
      t1,
    )
    const edited = updateStudent(added, 's-001', { displayName: 'Student One' }, t2)

    expect(initial.students).toHaveLength(0)
    expect(edited.students[0]?.metrics).toEqual({})
    expect(edited.students[0]?.displayName).toBe('Student One')
    expect(edited.provenance['/students/0/displayName']?.kind).toBe('teacher-entered')
  })

  it('rejects duplicate student IDs', () => {
    const initial = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: t0,
    })
    const once = addStudent(initial, { id: 's-001' }, t1)

    expect(() => addStudent(once, { id: 's-001' }, t2)).toThrow('CG-2007')
  })

  it('removes relationships and remaps indexed provenance when a student is removed', () => {
    let project = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: t0,
    })
    project = addStudent(project, { id: 's-001', displayName: 'One' }, t1)
    project = addStudent(project, { id: 's-002', displayName: 'Two' }, t1)
    project.relationships = [
      {
        id: 'r1',
        fromStudentId: 's-001',
        toStudentId: 's-002',
        type: 'works-well-with',
      },
    ]

    const removed = removeStudent(project, 's-001', t2)

    expect(removed.students.map((student) => student.id)).toEqual(['s-002'])
    expect(removed.relationships).toEqual([])
    expect(removed.provenance['/students/0/displayName']?.kind).toBe('teacher-entered')
    expect(removed.provenance['/students/1/displayName']).toBeUndefined()
  })

  it('updates project metadata immutably', () => {
    const initial = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: t0,
    })
    const changed = updateProjectMetadata(initial, { title: 'Grade 5A English' }, t1)

    expect(initial.title).toBe('Grade 5A')
    expect(changed.title).toBe('Grade 5A English')
    expect(changed.updatedAt).toBe(t1)
  })
})
