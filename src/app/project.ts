import type {
  ClassGraphProject,
  MetricDefinition,
  MetricKind,
  MetricValue,
  StudentRecord,
} from '../model.js'

export function createBlankProject(title = 'Untitled class'): ClassGraphProject {
  const now = new Date().toISOString()
  return {
    schemaVersion: '1.0',
    projectId: `class-${crypto.randomUUID()}`,
    title,
    createdAt: now,
    updatedAt: now,
    classInfo: {},
    metricDefinitions: [],
    students: [],
    provenance: {
      '/title': { kind: 'teacher-entered' },
    },
  }
}

export function touchProject(project: ClassGraphProject): ClassGraphProject {
  return { ...project, updatedAt: new Date().toISOString() }
}

export function addStudent(project: ClassGraphProject): ClassGraphProject {
  const nextNumber = project.students.length + 1
  let id = `student-${String(nextNumber).padStart(3, '0')}`
  let suffix = nextNumber
  const ids = new Set(project.students.map((student) => student.id))
  while (ids.has(id)) {
    suffix += 1
    id = `student-${String(suffix).padStart(3, '0')}`
  }

  const metrics = Object.fromEntries(
    project.metricDefinitions.map((definition) => [definition.key, null]),
  ) as Record<string, MetricValue>

  const student: StudentRecord = {
    id,
    displayName: `Student ${String(nextNumber).padStart(3, '0')}`,
    metrics,
  }

  const nextIndex = project.students.length
  return touchProject({
    ...project,
    students: [...project.students, student],
    provenance: {
      ...project.provenance,
      [`/students/${nextIndex}/id`]: { kind: 'teacher-entered' },
      [`/students/${nextIndex}/displayName`]: { kind: 'teacher-entered' },
    },
  })
}

export function addMetricDefinition(
  project: ClassGraphProject,
  definition: MetricDefinition,
): ClassGraphProject {
  if (project.metricDefinitions.some((item) => item.key === definition.key)) {
    throw new Error(`A metric with key "${definition.key}" already exists.`)
  }

  return touchProject({
    ...project,
    metricDefinitions: [...project.metricDefinitions, definition],
    students: project.students.map((student) => ({
      ...student,
      metrics: { ...student.metrics, [definition.key]: null },
    })),
    provenance: {
      ...project.provenance,
      [`/metricDefinitions/${project.metricDefinitions.length}`]: {
        kind: 'teacher-entered',
      },
    },
  })
}

export function updateStudent(
  project: ClassGraphProject,
  index: number,
  update: (student: StudentRecord) => StudentRecord,
  provenancePaths: string[] = [],
): ClassGraphProject {
  const students = project.students.map((student, studentIndex) =>
    studentIndex === index ? update(student) : student,
  )
  const provenance = { ...project.provenance }
  for (const path of provenancePaths) {
    provenance[path] = { kind: 'teacher-entered' }
  }
  return touchProject({ ...project, students, provenance })
}

export function removeStudent(project: ClassGraphProject, index: number): ClassGraphProject {
  return touchProject({
    ...project,
    students: project.students.filter((_, studentIndex) => studentIndex !== index),
  })
}

export function parseManualValue(definition: MetricDefinition, raw: string): MetricValue {
  if (raw === '') return null

  switch (definition.kind) {
    case 'number': {
      const value = Number(raw)
      return Number.isFinite(value) ? value : null
    }
    case 'boolean':
      return raw === 'true'
    case 'ordinal':
    case 'category':
    case 'text':
      return raw
  }
}

export function makeMetricDefinition(
  key: string,
  label: string,
  kind: MetricKind,
  categoriesText?: string,
): MetricDefinition {
  const base: MetricDefinition = {
    key,
    label,
    kind,
    missingAllowed: true,
  }
  const values = categoriesText
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (kind === 'category') return { ...base, categories: values?.length ? values : ['A', 'B'] }
  if (kind === 'ordinal')
    return { ...base, ordinalScale: values?.length ? values : ['Low', 'Medium', 'High'] }
  return base
}
