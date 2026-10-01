import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { summarizeCategoryMetric, summarizeNumericMetric } from '../analysis.js'
import { ClassGraphImportError, parseProjectJson, serializeProjectJson } from '../json.js'
import type {
  ClassGraphProject,
  MetricDefinition,
  MetricKind,
  MetricValue,
  StudentRecord,
} from '../model.js'
import { generateSyntheticProject } from '../synthetic.js'
import {
  addMetricDefinition,
  addStudent,
  createBlankProject,
  makeMetricDefinition,
  parseManualValue,
  removeStudent,
  touchProject,
  updateStudent,
} from './project.js'

type View = 'data' | 'analysis'

interface HistogramRow {
  label: string
  count: number
}

function metricKeyFromLabel(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'metric'
  )
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildHistogram(project: ClassGraphProject, metricKey: string): HistogramRow[] {
  const values = project.students
    .map((student) => student.metrics[metricKey])
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)

  if (values.length === 0) return []
  const min = values[0]
  const max = values.at(-1)
  if (min === undefined || max === undefined) return []
  if (min === max) return [{ label: String(min), count: values.length }]

  const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(values.length))))
  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * width,
    end: index === binCount - 1 ? max : min + (index + 1) * width,
    count: 0,
  }))

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width)
    const index = Math.min(binCount - 1, Math.max(0, rawIndex))
    const bin = bins[index]
    if (bin) bin.count += 1
  }

  return bins.map((bin) => ({
    label: `${bin.start.toFixed(0)}–${bin.end.toFixed(0)}`,
    count: bin.count,
  }))
}

function valueForInput(value: MetricValue): string {
  if (value === null) return ''
  return String(value)
}

function MetricInput({
  definition,
  value,
  onChange,
}: {
  definition: MetricDefinition
  value: MetricValue
  onChange: (value: MetricValue) => void
}) {
  if (definition.kind === 'category' || definition.kind === 'ordinal') {
    const options =
      definition.kind === 'category'
        ? (definition.categories ?? [])
        : (definition.ordinalScale ?? [])
    return (
      <select
        value={valueForInput(value)}
        onChange={(event) => onChange(parseManualValue(definition, event.target.value))}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (definition.kind === 'boolean') {
    return (
      <select
        value={valueForInput(value)}
        onChange={(event) => onChange(parseManualValue(definition, event.target.value))}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  return (
    <input
      type={definition.kind === 'number' ? 'number' : 'text'}
      value={valueForInput(value)}
      min={definition.numberScale?.min}
      max={definition.numberScale?.max}
      onChange={(event) => onChange(parseManualValue(definition, event.target.value))}
      aria-label={definition.label}
    />
  )
}

function SourcePanel({
  project,
  onProject,
  onError,
}: {
  project: ClassGraphProject
  onProject: (project: ClassGraphProject) => void
  onError: (message: string) => void
}) {
  const [studentCount, setStudentCount] = useState(36)
  const [seed, setSeed] = useState('classgraph-demo')
  const [scoreMean, setScoreMean] = useState(72)
  const [scoreSpread, setScoreSpread] = useState(12)

  function generate(): void {
    try {
      const generated = generateSyntheticProject({
        seed,
        projectId: `synthetic-${seed}`,
        title: 'Synthetic class',
        studentCount,
        generatedAt: new Date().toISOString(),
        metricDefinitions: [
          {
            key: 'assessment',
            label: 'Assessment',
            kind: 'number',
            numberScale: { min: 0, max: 100 },
            missingAllowed: true,
          },
          {
            key: 'participation',
            label: 'Participation',
            kind: 'ordinal',
            ordinalScale: ['Low', 'Medium', 'High'],
            missingAllowed: true,
          },
          {
            key: 'support',
            label: 'Support',
            kind: 'category',
            categories: ['Light', 'Standard', 'High'],
            missingAllowed: true,
          },
        ],
        metrics: [
          {
            key: 'assessment',
            kind: 'number',
            distribution: {
              type: 'normal',
              mean: scoreMean,
              standardDeviation: scoreSpread,
              min: 0,
              max: 100,
              decimals: 0,
            },
          },
          {
            key: 'participation',
            kind: 'ordinal',
            values: [
              { value: 'Low', weight: 2 },
              { value: 'Medium', weight: 5 },
              { value: 'High', weight: 3 },
            ],
          },
          {
            key: 'support',
            kind: 'category',
            values: [
              { value: 'Light', weight: 2 },
              { value: 'Standard', weight: 6 },
              { value: 'High', weight: 2 },
            ],
          },
        ],
      })
      onProject(generated)
      onError('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not generate the class.')
    }
  }

  return (
    <aside className="source-panel">
      <div className="side-heading">
        <span className="eyebrow">Class source</span>
        <strong>{project.students.length} students</strong>
      </div>

      <button className="primary wide" onClick={() => onProject(addStudent(project))}>
        + Add student
      </button>

      <div className="divider" />

      <span className="eyebrow">Synthetic class</span>
      <label>
        Students
        <input
          type="number"
          min={1}
          max={500}
          value={studentCount}
          onChange={(event) => setStudentCount(Number(event.target.value))}
        />
      </label>
      <label>
        Seed
        <input value={seed} onChange={(event) => setSeed(event.target.value)} />
      </label>
      <label>
        Assessment mean
        <input
          type="number"
          min={0}
          max={100}
          value={scoreMean}
          onChange={(event) => setScoreMean(Number(event.target.value))}
        />
      </label>
      <label>
        Assessment spread
        <input
          type="number"
          min={1}
          max={50}
          value={scoreSpread}
          onChange={(event) => setScoreSpread(Number(event.target.value))}
        />
      </label>
      <button className="secondary wide" onClick={generate}>
        Generate from settings
      </button>
      <p className="side-note">
        Generated values are marked <strong>synthetic</strong> in the project JSON.
      </p>
    </aside>
  )
}

function DataView({
  project,
  onProject,
  onError,
}: {
  project: ClassGraphProject
  onProject: (project: ClassGraphProject) => void
  onError: (message: string) => void
}) {
  const [metricLabel, setMetricLabel] = useState('')
  const [metricKey, setMetricKey] = useState('')
  const [metricKind, setMetricKind] = useState<MetricKind>('number')
  const [categories, setCategories] = useState('Low, Medium, High')

  function submitMetric(event: FormEvent): void {
    event.preventDefault()
    const label = metricLabel.trim()
    const key = (metricKey.trim() || metricKeyFromLabel(label)).toLowerCase()
    if (!label || !key) {
      onError('Add a metric label before creating the metric.')
      return
    }

    try {
      const definition = makeMetricDefinition(key, label, metricKind, categories)
      onProject(addMetricDefinition(project, definition))
      setMetricLabel('')
      setMetricKey('')
      onError('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not add the metric.')
    }
  }

  function editStudent(
    index: number,
    path: string,
    update: (student: StudentRecord) => StudentRecord,
  ): void {
    onProject(updateStudent(project, index, update, [path]))
  }

  return (
    <section className="workspace">
      <div className="panel metric-builder">
        <div>
          <span className="eyebrow">Data model</span>
          <h2>Add a metric</h2>
          <p>
            Create only the fields that are useful for this class. ClassGraph does not impose a
            fixed learner profile.
          </p>
        </div>
        <form onSubmit={submitMetric}>
          <input
            placeholder="Metric label"
            value={metricLabel}
            onChange={(event) => {
              setMetricLabel(event.target.value)
              if (!metricKey) setMetricKey(metricKeyFromLabel(event.target.value))
            }}
          />
          <input
            placeholder="metric-key"
            value={metricKey}
            onChange={(event) => setMetricKey(metricKeyFromLabel(event.target.value))}
          />
          <select
            value={metricKind}
            onChange={(event) => setMetricKind(event.target.value as MetricKind)}
          >
            <option value="number">Number</option>
            <option value="ordinal">Ordered category</option>
            <option value="category">Category</option>
            <option value="boolean">Yes / no</option>
            <option value="text">Text</option>
          </select>
          {(metricKind === 'ordinal' || metricKind === 'category') && (
            <input
              placeholder="Low, Medium, High"
              value={categories}
              onChange={(event) => setCategories(event.target.value)}
            />
          )}
          <button className="secondary" type="submit">
            Add metric
          </button>
        </form>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Roster</span>
            <h2>Student data</h2>
          </div>
          <span className="muted">
            {project.metricDefinitions.length} metrics · {project.students.length} students
          </span>
        </div>

        {project.students.length === 0 ? (
          <div className="empty-state">
            <strong>No students yet</strong>
            <span>Add students manually, import JSON, or generate a synthetic class.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {project.metricDefinitions.map((definition) => (
                    <th key={definition.key}>{definition.label}</th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {project.students.map((student, studentIndex) => (
                  <tr key={student.id}>
                    <td className="student-cell">
                      <input
                        value={student.displayName ?? ''}
                        onChange={(event) =>
                          editStudent(
                            studentIndex,
                            `/students/${studentIndex}/displayName`,
                            (current) => ({
                              ...current,
                              displayName: event.target.value || undefined,
                            }),
                          )
                        }
                      />
                      <span>{student.id}</span>
                    </td>
                    {project.metricDefinitions.map((definition) => (
                      <td key={definition.key}>
                        <MetricInput
                          definition={definition}
                          value={student.metrics[definition.key] ?? null}
                          onChange={(value) =>
                            editStudent(
                              studentIndex,
                              `/students/${studentIndex}/metrics/${definition.key}`,
                              (current) => ({
                                ...current,
                                metrics: { ...current.metrics, [definition.key]: value },
                              }),
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="icon-button"
                        title="Remove student"
                        aria-label={`Remove ${student.displayName ?? student.id}`}
                        onClick={() => onProject(removeStudent(project, studentIndex))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function AnalysisView({ project }: { project: ClassGraphProject }) {
  const [selectedMetric, setSelectedMetric] = useState(project.metricDefinitions[0]?.key ?? '')
  const activeMetric =
    project.metricDefinitions.find((definition) => definition.key === selectedMetric) ??
    project.metricDefinitions[0]

  const chartData = useMemo(() => {
    if (!activeMetric) return []
    if (activeMetric.kind === 'number') return buildHistogram(project, activeMetric.key)

    const summary = summarizeCategoryMetric(project, activeMetric.key)
    return Object.entries(summary.counts).map(([label, count]) => ({ label, count }))
  }, [activeMetric, project])

  if (!activeMetric) {
    return (
      <section className="workspace">
        <div className="panel empty-state tall">
          <strong>No metrics to analyse</strong>
          <span>Add a metric in Data first.</span>
        </div>
      </section>
    )
  }

  const numeric =
    activeMetric.kind === 'number' ? summarizeNumericMetric(project, activeMetric.key) : null
  const category =
    activeMetric.kind === 'number' ? null : summarizeCategoryMetric(project, activeMetric.key)

  const missingCount = numeric?.missingCount ?? category?.missingCount ?? 0
  const recordedCount = numeric?.recordedCount ?? category?.recordedCount ?? 0

  return (
    <section className="workspace">
      <div className="analysis-toolbar panel">
        <div>
          <span className="eyebrow">Analysis</span>
          <h2>Describe what is in the class</h2>
          <p>These are descriptive summaries of the current data, not predictions or diagnoses.</p>
        </div>
        <label className="metric-picker">
          Metric
          <select
            value={activeMetric.key}
            onChange={(event) => setSelectedMetric(event.target.value)}
          >
            {project.metricDefinitions.map((definition) => (
              <option key={definition.key} value={definition.key}>
                {definition.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Recorded</span>
          <strong>{recordedCount}</strong>
        </div>
        <div className="stat-card">
          <span>Missing</span>
          <strong>{missingCount}</strong>
        </div>
        {numeric && (
          <>
            <div className="stat-card">
              <span>Median</span>
              <strong>{numeric.median?.toFixed(1) ?? '—'}</strong>
            </div>
            <div className="stat-card">
              <span>Middle 50%</span>
              <strong>
                {numeric.q1?.toFixed(1) ?? '—'}–{numeric.q3?.toFixed(1) ?? '—'}
              </strong>
            </div>
          </>
        )}
        {category && (
          <div className="stat-card">
            <span>Categories shown</span>
            <strong>{Object.keys(category.counts).length}</strong>
          </div>
        )}
      </div>

      <div className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{activeMetric.kind}</span>
            <h2>{activeMetric.label}</h2>
          </div>
          <span className="muted">{activeMetric.key}</span>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <strong>No recorded values</strong>
            <span>Enter values in the Data view to populate this graph.</span>
          </div>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <Tooltip cursor={{ opacity: 0.08 }} />
                <Bar dataKey="count" radius={[8, 8, 2, 2]} fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel data-note">
        <span className="eyebrow">Data note</span>
        {missingCount > 0 ? (
          <p>
            {missingCount} of {project.students.length} student records are missing this metric.
            Missing values remain missing and are excluded from the chart; ClassGraph does not
            replace them with zero or an average.
          </p>
        ) : (
          <p>All {project.students.length} student records contain a value for this metric.</p>
        )}
      </div>
    </section>
  )
}

export function App() {
  const [project, setProject] = useState<ClassGraphProject>(() => createBlankProject())
  const [view, setView] = useState<View>('data')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function applyProject(next: ClassGraphProject): void {
    setProject(next)
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = parseProjectJson(await file.text())
      setProject(imported)
      setError('')
      setView('data')
    } catch (importError) {
      if (importError instanceof ClassGraphImportError) {
        setError(`${importError.code}: ${importError.message}`)
      } else {
        setError('CG-1001: Could not import that file.')
      }
    } finally {
      event.target.value = ''
    }
  }

  function exportJson(): void {
    try {
      const safeTitle = project.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      downloadText(
        `${safeTitle || 'classgraph'}.classgraph.json`,
        serializeProjectJson(project),
        'application/json',
      )
      setError('')
    } catch (exportError) {
      setError(
        `CG-5001: ${exportError instanceof Error ? exportError.message : 'Could not export the project.'}`,
      )
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>ClassGraph</strong>
            <span>Classroom analysis & planning</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="local-pill">Local only</span>
          <button
            className="ghost"
            onClick={() => {
              setProject(createBlankProject())
              setError('')
              setView('data')
            }}
          >
            New
          </button>
          <button className="ghost" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <button className="primary" onClick={exportJson}>
            Export JSON
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,.classgraph.json,application/json"
            onChange={(event) => void importFile(event)}
          />
        </div>
      </header>

      <div className="project-bar">
        <div>
          <span className="eyebrow">Project</span>
          <input
            className="title-input"
            value={project.title}
            onChange={(event) =>
              setProject(
                touchProject({
                  ...project,
                  title: event.target.value,
                  provenance: {
                    ...project.provenance,
                    '/title': { kind: 'teacher-entered' },
                  },
                }),
              )
            }
          />
        </div>
        <nav className="view-tabs" aria-label="ClassGraph views">
          <button className={view === 'data' ? 'active' : ''} onClick={() => setView('data')}>
            Data
          </button>
          <button
            className={view === 'analysis' ? 'active' : ''}
            onClick={() => setView('analysis')}
          >
            Analysis
          </button>
        </nav>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <strong>ClassGraph needs attention</strong>
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      <main className="main-grid">
        <SourcePanel project={project} onProject={applyProject} onError={setError} />
        {view === 'data' ? (
          <DataView project={project} onProject={applyProject} onError={setError} />
        ) : (
          <AnalysisView project={project} />
        )}
      </main>
    </div>
  )
}
