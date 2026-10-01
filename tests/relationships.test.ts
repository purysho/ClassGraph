import { describe, expect, it } from 'vitest'
import type { ClassGraphProject, RelationshipRecord } from '../src/model.js'
import { applyProjectMutation } from '../src/project-mutations.js'
import { canonicalRelationshipKey } from '../src/relationship-semantics.js'
import {
  addRelationship,
  removeRelationship,
  updateRelationship,
} from '../src/relationships.js'
import { classGraphProjectSchema } from '../src/schema.js'
import { addStudent, createEmptyProject, removeStudent } from '../src/workspace.js'

const t0 = '2026-10-02T00:00:00.000Z'
const t1 = '2026-10-02T00:01:00.000Z'

function projectWithStudents(): ClassGraphProject {
  let project = createEmptyProject({
    projectId: 'relationships',
    title: 'Relationship Test',
    now: t0,
  })
  project = addStudent(project, { id: 's1', displayName: 'One' }, t0)
  project = addStudent(project, { id: 's2', displayName: 'Two' }, t0)
  project = addStudent(project, { id: 's3', displayName: 'Three' }, t0)
  return project
}

function edge(
  id: string,
  fromStudentId = 's1',
  toStudentId = 's2',
  patch: Partial<RelationshipRecord> = {},
): RelationshipRecord {
  return {
    id,
    fromStudentId,
    toStudentId,
    type: 'works-well-with',
    ...patch,
  }
}

describe('relationship semantics', () => {
  it('canonicalises undirected endpoints but preserves direction when directed', () => {
    expect(canonicalRelationshipKey(edge('a'))).toBe(
      canonicalRelationshipKey(edge('b', 's2', 's1')),
    )
    expect(
      canonicalRelationshipKey(edge('a', 's1', 's2', { directed: true })),
    ).not.toBe(canonicalRelationshipKey(edge('b', 's2', 's1', { directed: true })))
  })

  it('uses custom labels to distinguish explicit custom relationship meanings', () => {
    expect(
      canonicalRelationshipKey(edge('a', 's1', 's2', { type: 'custom', label: 'Mentor' })),
    ).not.toBe(
      canonicalRelationshipKey(edge('b', 's2', 's1', { type: 'custom', label: 'Project team' })),
    )
  })
})

describe('relationship CRUD', () => {
  it('adds an explicit teacher-entered relationship with provenance', () => {
    const project = addRelationship(projectWithStudents(), edge('r1'), t1)

    expect(project.relationships).toEqual([edge('r1')])
    expect(project.provenance['/relationships/0']).toEqual({
      kind: 'teacher-entered',
      source: 'manual-relationship-entry',
    })
  })

  it('rejects reversed duplicates for undirected relationships', () => {
    const project = addRelationship(projectWithStudents(), edge('r1'), t1)

    expect(() => addRelationship(project, edge('r2', 's2', 's1'), t1)).toThrow('CG-2023')
  })

  it('allows opposite directed edges', () => {
    let project = addRelationship(
      projectWithStudents(),
      edge('r1', 's1', 's2', { directed: true }),
      t1,
    )
    project = addRelationship(project, edge('r2', 's2', 's1', { directed: true }), t1)

    expect(project.relationships).toHaveLength(2)
  })

  it('updates a relationship and marks the edited record as teacher-entered', () => {
    let project = addRelationship(projectWithStudents(), edge('r1'), t1)
    project.provenance['/relationships/0'] = { kind: 'synthetic', source: 'fixture' }

    project = updateRelationship(
      project,
      'r1',
      { type: 'support-pair', label: 'Reading support', weight: 2 },
      t1,
    )

    expect(project.relationships?.[0]).toMatchObject({
      id: 'r1',
      type: 'support-pair',
      label: 'Reading support',
      weight: 2,
    })
    expect(project.provenance['/relationships/0']).toEqual({
      kind: 'teacher-entered',
      source: 'manual-relationship-edit',
    })
  })

  it('removes relationships and remaps later relationship provenance without changing its kind', () => {
    let project = addRelationship(projectWithStudents(), edge('r1'), t1)
    project = addRelationship(project, edge('r2', 's2', 's3'), t1)
    project.provenance['/relationships/1'] = { kind: 'imported', source: 'fixture' }

    project = removeRelationship(project, 'r1', t1)

    expect(project.relationships?.map((item) => item.id)).toEqual(['r2'])
    expect(project.provenance['/relationships/0']).toEqual({
      kind: 'imported',
      source: 'fixture',
    })
    expect(project.provenance['/relationships/1']).toBeUndefined()
  })

  it('removes student-linked relationships and remaps surviving relationship provenance', () => {
    let project = addRelationship(projectWithStudents(), edge('r1', 's1', 's2'), t1)
    project = addRelationship(project, edge('r2', 's2', 's3'), t1)
    project.provenance['/relationships/1'] = { kind: 'synthetic', source: 'fixture' }

    project = removeStudent(project, 's1', t1)

    expect(project.relationships?.map((item) => item.id)).toEqual(['r2'])
    expect(project.provenance['/relationships/0']).toEqual({
      kind: 'synthetic',
      source: 'fixture',
    })
  })

  it('rejects duplicate ids and duplicate semantic edges at schema validation', () => {
    const base = projectWithStudents()
    const duplicateId = {
      ...base,
      relationships: [edge('same'), edge('same', 's2', 's3')],
    }
    const duplicateSemantics = {
      ...base,
      relationships: [edge('r1'), edge('r2', 's2', 's1')],
    }

    expect(classGraphProjectSchema.safeParse(duplicateId).success).toBe(false)
    expect(classGraphProjectSchema.safeParse(duplicateSemantics).success).toBe(false)
  })

  it('supports add, edit and remove through the typed project mutation layer', () => {
    let project = applyProjectMutation(
      projectWithStudents(),
      { type: 'add-relationship', relationship: edge('r1') },
      t1,
    )
    project = applyProjectMutation(
      project,
      {
        type: 'update-relationship',
        relationshipId: 'r1',
        patch: { directed: true, label: 'Directed support' },
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      { type: 'remove-relationship', relationshipId: 'r1' },
      t1,
    )

    expect(project.relationships).toBeUndefined()
  })
})
