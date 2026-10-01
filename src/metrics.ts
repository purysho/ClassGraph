import type {
  ClassGraphProject,
  MetricDefinition,
  MetricValue,
  ProvenanceEntry,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

function findStudentIndex(project: ClassGraphProject, studentId: string): number {
  const index = project.students.findIndex((student) => student.id === studentId)
  if (index < 0) throw new Error(`CG-2008 unknown student: ${studentId}`)
  return index
}

function findMetricIndex(project: ClassGraphProject, metricKey: string): number {
  const index = project.metricDefinitions.findIndex((definition) => definition.key === metricKey)
  if (index < 0) throw new Error(`CG-2009 unknown metric definition: ${metricKey}`)
  return index
}

function metricValuePath(studentIndex: number, metricKey: string): string {
  return `/students/${studentIndex}/metrics/${metricKey}`
}

function removeMetricProvenance(
  provenance: ClassGraphProject['provenance'],
  metricKey: string,
): ClassGraphProject['provenance'] {
  const result: ClassGraphProject['provenance'] = {}
  const suffix = `/metrics/${metricKey}`

  for (const [path, entry] of Object.entries(provenance)) {
    if (path.startsWith('/students/') && path.endsWith(suffix)) continue
    result[path] = entry
  }

  return result
}

export function addMetricDefinition(
  project: ClassGraphProject,
  definition: MetricDefinition,
  now: string,
): ClassGraphProject {
  if (project.metricDefinitions.some((item) => item.key === definition.key)) {
    throw new Error(`CG-2010 duplicate metric key: ${definition.key}`)
  }

  const next = cloneProject(project)
  next.metricDefinitions.push(structuredClone(definition))
  const index = next.metricDefinitions.length - 1
  next.provenance[`/metricDefinitions/${index}`] = teacherEntered('manual-metric-definition')
  next.updatedAt = now

  return validate(next)
}

export function updateMetricDefinition(
  project: ClassGraphProject,
  metricKey: string,
  definition: MetricDefinition,
  now: string,
): ClassGraphProject {
  const index = findMetricIndex(project, metricKey)
  if (definition.key !== metricKey) {
    throw new Error('CG-2011 metric keys are immutable; create a new metric to use a different key')
  }

  const next = cloneProject(project)
  next.metricDefinitions[index] = structuredClone(definition)
  next.provenance[`/metricDefinitions/${index}`] = teacherEntered('manual-metric-definition-edit')
  next.updatedAt = now

  return validate(next)
}

export function removeMetricDefinition(
  project: ClassGraphProject,
  metricKey: string,
  now: string,
): ClassGraphProject {
  const index = findMetricIndex(project, metricKey)
  const next = cloneProject(project)

  next.metricDefinitions.splice(index, 1)
  for (const student of next.students) {
    delete student.metrics[metricKey]
  }

  const provenanceWithoutValues = removeMetricProvenance(next.provenance, metricKey)
  const remapped: ClassGraphProject['provenance'] = {}

  for (const [path, entry] of Object.entries(provenanceWithoutValues)) {
    const match = /^\/metricDefinitions\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      remapped[path] = entry
      continue
    }

    const definitionIndex = Number(match[1])
    if (definitionIndex === index) continue
    const suffix = match[2] ?? ''
    const newIndex = definitionIndex > index ? definitionIndex - 1 : definitionIndex
    remapped[`/metricDefinitions/${newIndex}${suffix}`] = entry
  }

  next.provenance = remapped
  next.updatedAt = now
  return validate(next)
}

export function setStudentMetricValue(
  project: ClassGraphProject,
  studentId: string,
  metricKey: string,
  value: MetricValue,
  now: string,
): ClassGraphProject {
  findMetricIndex(project, metricKey)
  const index = findStudentIndex(project, studentId)
  const next = cloneProject(project)
  const student = next.students[index]

  if (!student) throw new Error(`CG-9001 student index unexpectedly missing: ${studentId}`)

  student.metrics[metricKey] = value
  next.provenance[metricValuePath(index, metricKey)] = teacherEntered('manual-metric-value')
  next.updatedAt = now

  return validate(next)
}

export function unsetStudentMetricValue(
  project: ClassGraphProject,
  studentId: string,
  metricKey: string,
  now: string,
): ClassGraphProject {
  findMetricIndex(project, metricKey)
  const index = findStudentIndex(project, studentId)
  const next = cloneProject(project)
  const student = next.students[index]

  if (!student) throw new Error(`CG-9001 student index unexpectedly missing: ${studentId}`)

  delete student.metrics[metricKey]
  delete next.provenance[metricValuePath(index, metricKey)]
  next.updatedAt = now

  return validate(next)
}
