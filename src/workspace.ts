import type {
  ClassGraphProject,
  ClassInfo,
  ProvenanceEntry,
  StudentRecord,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

export interface NewProjectInput {
  projectId: string
  title: string
  now: string
  classInfo?: ClassInfo
}

export interface StudentInput {
  id: string
  displayName?: string
  tags?: string[]
  notes?: string
}

export interface StudentPatch {
  displayName?: string | null
  tags?: string[]
  notes?: string | null
}

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`CG-2006 ${label} must not be empty`)
  }
}

function studentIndex(project: ClassGraphProject, studentId: string): number {
  return project.students.findIndex((student) => student.id === studentId)
}

function studentPath(index: number, field: string): string {
  return `/students/${index}/${field}`
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

export function createEmptyProject(input: NewProjectInput): ClassGraphProject {
  assertNonEmpty('projectId', input.projectId)
  assertNonEmpty('title', input.title)

  const project: ClassGraphProject = {
    schemaVersion: '1.0',
    projectId: input.projectId.trim(),
    title: input.title.trim(),
    createdAt: input.now,
    updatedAt: input.now,
    classInfo: input.classInfo ? structuredClone(input.classInfo) : {},
    metricDefinitions: [],
    students: [],
    provenance: {
      '/projectId': teacherEntered('manual-project-setup'),
      '/title': teacherEntered('manual-project-setup'),
      '/classInfo': teacherEntered('manual-project-setup'),
    },
  }

  return validate(project)
}

export function updateProjectMetadata(
  project: ClassGraphProject,
  patch: { title?: string; classInfo?: ClassInfo },
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)

  if (patch.title !== undefined) {
    assertNonEmpty('title', patch.title)
    next.title = patch.title.trim()
    next.provenance['/title'] = teacherEntered('manual-project-edit')
  }

  if (patch.classInfo !== undefined) {
    next.classInfo = structuredClone(patch.classInfo)
    next.provenance['/classInfo'] = teacherEntered('manual-project-edit')
  }

  next.updatedAt = now
  return validate(next)
}

export function addStudent(
  project: ClassGraphProject,
  input: StudentInput,
  now: string,
): ClassGraphProject {
  assertNonEmpty('student id', input.id)
  if (project.students.some((student) => student.id === input.id.trim())) {
    throw new Error(`CG-2007 duplicate student id: ${input.id.trim()}`)
  }

  const next = cloneProject(project)
  const student: StudentRecord = {
    id: input.id.trim(),
    metrics: {},
  }

  if (input.displayName?.trim()) student.displayName = input.displayName.trim()
  if (input.tags) student.tags = [...input.tags]
  if (input.notes !== undefined) student.notes = input.notes

  next.students.push(student)
  const index = next.students.length - 1
  next.provenance[studentPath(index, 'id')] = teacherEntered('manual-student-entry')
  if (student.displayName !== undefined) {
    next.provenance[studentPath(index, 'displayName')] = teacherEntered('manual-student-entry')
  }
  if (student.tags !== undefined) {
    next.provenance[studentPath(index, 'tags')] = teacherEntered('manual-student-entry')
  }
  if (student.notes !== undefined) {
    next.provenance[studentPath(index, 'notes')] = teacherEntered('manual-student-entry')
  }

  next.updatedAt = now
  return validate(next)
}

export function updateStudent(
  project: ClassGraphProject,
  studentId: string,
  patch: StudentPatch,
  now: string,
): ClassGraphProject {
  const index = studentIndex(project, studentId)
  if (index < 0) throw new Error(`CG-2008 unknown student: ${studentId}`)

  const next = cloneProject(project)
  const student = next.students[index]
  if (!student) throw new Error(`CG-9001 student index unexpectedly missing: ${studentId}`)

  if (patch.displayName !== undefined) {
    if (patch.displayName === null || !patch.displayName.trim()) {
      delete student.displayName
      delete next.provenance[studentPath(index, 'displayName')]
    } else {
      student.displayName = patch.displayName.trim()
      next.provenance[studentPath(index, 'displayName')] = teacherEntered('manual-student-edit')
    }
  }

  if (patch.tags !== undefined) {
    student.tags = [...patch.tags]
    next.provenance[studentPath(index, 'tags')] = teacherEntered('manual-student-edit')
  }

  if (patch.notes !== undefined) {
    if (patch.notes === null) {
      delete student.notes
      delete next.provenance[studentPath(index, 'notes')]
    } else {
      student.notes = patch.notes
      next.provenance[studentPath(index, 'notes')] = teacherEntered('manual-student-edit')
    }
  }

  next.updatedAt = now
  return validate(next)
}

function remapStudentProvenance(
  project: ClassGraphProject,
  removedIndex: number,
): ClassGraphProject['provenance'] {
  const result: ClassGraphProject['provenance'] = {}

  for (const [path, entry] of Object.entries(project.provenance)) {
    const match = /^\/students\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      result[path] = entry
      continue
    }

    const index = Number(match[1])
    if (index === removedIndex) continue
    const suffix = match[2] ?? ''
    const newIndex = index > removedIndex ? index - 1 : index
    result[`/students/${newIndex}${suffix}`] = entry
  }

  return result
}

export function removeStudent(
  project: ClassGraphProject,
  studentId: string,
  now: string,
): ClassGraphProject {
  const index = studentIndex(project, studentId)
  if (index < 0) throw new Error(`CG-2008 unknown student: ${studentId}`)

  const next = cloneProject(project)
  next.students.splice(index, 1)
  next.relationships = next.relationships?.filter(
    (relationship) =>
      relationship.fromStudentId !== studentId && relationship.toStudentId !== studentId,
  )
  next.provenance = remapStudentProvenance(next, index)
  next.updatedAt = now

  return validate(next)
}
