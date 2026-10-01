interface ProvenanceEntry {
  kind: string
  source?: string
  note?: string
  derivedFrom?: string[]
}

type MetricValue = number | string | boolean | null
type MetricKind = 'number' | 'ordinal' | 'category' | 'boolean' | 'text'

interface MetricDefinition {
  key: string
  label: string
  kind: MetricKind
  description?: string
  numberScale?: {
    min?: number
    max?: number
    unit?: string
  }
  ordinalScale?: string[]
  categories?: string[]
  missingAllowed?: boolean
}

interface StudentRecord {
  id: string
  displayName?: string
  tags?: string[]
  notes?: string
  metrics: Record<string, MetricValue>
}

interface ClassGraphProject {
  schemaVersion: string
  projectId: string
  title: string
  classInfo: {
    subject?: string
    gradeOrLevel?: string
    term?: string
    teacherLabel?: string
  }
  metricDefinitions: MetricDefinition[]
  students: StudentRecord[]
  provenance: Record<string, ProvenanceEntry>
}

interface ProjectResponse {
  project: ClassGraphProject
}

interface ErrorResponse {
  error?: {
    code?: string
    message?: string
  }
}


interface NumericSummary {
  metricKey: string
  recordedCount: number
  missingCount: number
  min: number | null
  max: number | null
  mean: number | null
  median: number | null
  q1: number | null
  q3: number | null
}

interface HistogramBucket {
  min: number
  max: number
  count: number
}

interface NumericMetricAnalysis {
  kind: 'number'
  key: string
  label: string
  summary: NumericSummary
  histogram: HistogramBucket[]
}

interface CategoryMetricAnalysis {
  kind: 'category'
  key: string
  label: string
  sourceKind: 'category' | 'ordinal' | 'boolean' | 'text'
  summary: {
    metricKey: string
    recordedCount: number
    missingCount: number
    counts: Record<string, number>
  }
}

type MetricAnalysis = NumericMetricAnalysis | CategoryMetricAnalysis

interface ProjectAnalysis {
  studentCount: number
  metricCount: number
  completeness: {
    totalCells: number
    recordedCount: number
    explicitMissingCount: number
    unrecordedCount: number
  }
  metrics: MetricAnalysis[]
}

interface ScatterView {
  xMetricKey: string
  yMetricKey: string
  xLabel: string
  yLabel: string
  points: Array<{
    studentId: string
    displayName?: string
    x: number
    y: number
  }>
  omittedCount: number
}

type WorkspaceView = 'overview' | 'students' | 'graphs'
type MetricState = 'recorded' | 'missing' | 'unrecorded'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('ClassGraph could not find the application root.')

let project: ClassGraphProject | null = null
let activeView: WorkspaceView = 'overview'
let selectedProvenanceStudentId: string | null = null
let selectedGraphMetricKey: string | null = null
let selectedScatterX: string | null = null
let selectedScatterY: string | null = null

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function asString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalNumber(value: string): number | undefined {
  if (!value) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function projectId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `class-${Date.now()}`
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse
    const prefix = body.error?.code ? `${body.error.code}: ` : ''
    return new Error(
      `${prefix}${body.error?.message ?? 'ClassGraph could not complete that action.'}`,
    )
  } catch {
    return new Error(`ClassGraph request failed with status ${response.status}.`)
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as T
}

async function postText<T>(path: string, body: string): Promise<T> {
  const response = await fetch(path, { method: 'POST', body })
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as T
}

async function mutateProject(command: Record<string, unknown>): Promise<void> {
  if (!project) return
  clearStatus()

  try {
    const response = await postJson<ProjectResponse>('/api/project/mutate', {
      project,
      command,
    })
    project = response.project
    renderWorkspace()
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not update the project.')
  }
}

function showStatus(message: string, tone: 'error' | 'success' = 'error'): void {
  const status = document.querySelector<HTMLElement>('#status')
  if (!status) return
  status.textContent = message
  status.dataset.tone = tone
  status.hidden = false
}

function clearStatus(): void {
  const status = document.querySelector<HTMLElement>('#status')
  if (status) status.hidden = true
}

function renderSetup(): void {
  root.innerHTML = `
    <main class="setup-shell">
      <section class="brand-panel">
        <div class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <p class="eyebrow">Local-first classroom planning</p>
        <h1>ClassGraph</h1>
        <p class="lede">
          Turn explicit class information into useful views without sending student data to a cloud service.
        </p>
        <div class="privacy-pill">Runs on this device · Exchange v1</div>
      </section>

      <section class="setup-panel">
        <div class="setup-heading">
          <div>
            <p class="eyebrow">Start a workspace</p>
            <h2>Create, import, or generate a class</h2>
          </div>
          <p class="setup-note">Nothing is uploaded. Export JSON when you want a portable copy.</p>
        </div>

        <div id="status" class="status" hidden></div>

        <div class="setup-grid">
          <article class="setup-card">
            <div class="card-number">01</div>
            <h3>Manual class</h3>
            <p>Start with an empty roster and add only the information you choose to record.</p>
            <form id="manual-form" class="stack-form">
              <label>
                Class name
                <input name="title" required placeholder="Grade 5A English" />
              </label>
              <div class="two-col">
                <label>
                  Subject
                  <input name="subject" placeholder="English" />
                </label>
                <label>
                  Grade / level
                  <input name="gradeOrLevel" placeholder="Grade 5" />
                </label>
              </div>
              <button class="primary" type="submit">Create class</button>
            </form>
          </article>

          <article class="setup-card">
            <div class="card-number">02</div>
            <h3>Import JSON</h3>
            <p>Open a validated ClassGraph Exchange v1 project without changing its recorded provenance.</p>
            <form id="import-form" class="stack-form">
              <label class="file-input">
                Choose .json file
                <input id="json-file" name="file" type="file" accept=".json,application/json" required />
              </label>
              <button class="secondary" type="submit">Import project</button>
            </form>
          </article>

          <article class="setup-card">
            <div class="card-number">03</div>
            <h3>Generate a class</h3>
            <p>Create a reproducible fictional roster for testing, planning, or demonstrations.</p>
            <form id="synthetic-form" class="stack-form">
              <label>
                Class name
                <input name="title" required value="Synthetic Class" />
              </label>
              <div class="two-col">
                <label>
                  Students
                  <input name="studentCount" type="number" min="1" max="500" value="36" required />
                </label>
                <label>
                  Seed
                  <input name="seed" value="classgraph-demo" required />
                </label>
              </div>
              <button class="secondary" type="submit">Generate class</button>
            </form>
          </article>
        </div>
      </section>
    </main>
  `

  document.querySelector<HTMLFormElement>('#manual-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    void createManualClass(new FormData(form))
  })

  document.querySelector<HTMLFormElement>('#import-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    void importProject()
  })

  document
    .querySelector<HTMLFormElement>('#synthetic-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      void createSyntheticClass(new FormData(form))
    })
}

async function createManualClass(formData: FormData): Promise<void> {
  clearStatus()
  try {
    const response = await postJson<ProjectResponse>('/api/project/create', {
      projectId: projectId(),
      title: asString(formData, 'title'),
      classInfo: {
        subject: asString(formData, 'subject'),
        gradeOrLevel: asString(formData, 'gradeOrLevel'),
      },
    })
    openProject(response.project)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not create the class.')
  }
}

async function importProject(): Promise<void> {
  clearStatus()
  const input = document.querySelector<HTMLInputElement>('#json-file')
  const file = input?.files?.[0]
  if (!file) {
    showStatus('Choose a ClassGraph JSON file first.')
    return
  }

  try {
    const response = await postText<ProjectResponse>('/api/import', await file.text())
    openProject(response.project)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not import the project.')
  }
}

async function createSyntheticClass(formData: FormData): Promise<void> {
  clearStatus()
  const count = Number(asString(formData, 'studentCount'))

  try {
    const response = await postJson<ProjectResponse>('/api/synthetic/basic', {
      projectId: projectId(),
      title: asString(formData, 'title'),
      studentCount: count,
      seed: asString(formData, 'seed'),
    })
    openProject(response.project)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not generate the class.')
  }
}

function openProject(nextProject: ClassGraphProject): void {
  project = nextProject
  activeView = 'overview'
  selectedProvenanceStudentId = null
  renderWorkspace()
}

function renderWorkspace(): void {
  if (!project) {
    renderSetup()
    return
  }

  root.innerHTML = `
    <div class="workspace-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark small" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <strong>ClassGraph</strong>
        </div>

        <nav class="workspace-nav" aria-label="Workspace">
          <button data-view="overview">Overview</button>
          <button data-view="students">Students</button>
          <button data-view="graphs">Graphs</button>
          <button disabled title="Phase 2">Seating</button>
          <button disabled title="Phase 3">Reports</button>
        </nav>

        <div class="sidebar-footer">
          <span class="local-dot"></span>
          Local workspace
        </div>
      </aside>

      <main class="workspace-main">
        <header class="workspace-header">
          <div>
            <p class="eyebrow">Class workspace</p>
            <h1>${escapeHtml(project.title)}</h1>
            <p class="workspace-meta">${workspaceMeta(project)}</p>
          </div>
          <div class="header-actions">
            <button id="export-json" class="secondary compact">Export JSON</button>
            <button id="new-project" class="ghost compact">New class</button>
          </div>
        </header>

        <div id="status" class="status" hidden></div>
        <section id="workspace-content"></section>
      </main>
    </div>
  `

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.classList.toggle('active', button.dataset.view === activeView)
    button.addEventListener('click', () => {
      const nextView = button.dataset.view
      if (nextView === 'overview' || nextView === 'students' || nextView === 'graphs') {
        activeView = nextView
        renderWorkspace()
      }
    })
  }

  document.querySelector<HTMLButtonElement>('#export-json')?.addEventListener('click', () => {
    void exportProject()
  })
  document.querySelector<HTMLButtonElement>('#new-project')?.addEventListener('click', () => {
    project = null
    selectedProvenanceStudentId = null
    renderSetup()
  })

  renderWorkspaceContent()
}

function workspaceMeta(current: ClassGraphProject): string {
  const parts = [
    current.classInfo.subject,
    current.classInfo.gradeOrLevel,
    `${current.students.length} students`,
  ].filter((item): item is string => Boolean(item))
  return parts.map(escapeHtml).join(' · ')
}

function renderWorkspaceContent(): void {
  const content = document.querySelector<HTMLElement>('#workspace-content')
  if (!content || !project) return

  if (activeView === 'overview') {
    renderOverview(content)
    return
  }

  if (activeView === 'students') {
    renderStudents(content)
    return
  }

  renderGraphs(content)
}

function renderOverview(content: HTMLElement): void {
  if (!project) return
  const provenanceKinds = Object.values(project.provenance).reduce<Record<string, number>>(
    (counts, entry) => {
      counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
      return counts
    },
    {},
  )

  content.innerHTML = `
    <div class="metric-cards">
      <article class="metric-card">
        <span>Students</span>
        <strong>${project.students.length}</strong>
        <small>Current roster size</small>
      </article>
      <article class="metric-card">
        <span>Metrics</span>
        <strong>${project.metricDefinitions.length}</strong>
        <small>Explicitly defined fields</small>
      </article>
      <article class="metric-card">
        <span>Provenance records</span>
        <strong>${Object.keys(project.provenance).length}</strong>
        <small>Tracked source paths</small>
      </article>
    </div>

    <div class="content-grid">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Project state</p>
            <h2>Ready for teacher input</h2>
          </div>
          <span class="schema-badge">Exchange ${escapeHtml(project.schemaVersion)}</span>
        </div>
        <p>
          Phase 1 keeps the browser as a thin local client. Student information stays in this
          workspace until you explicitly export it.
        </p>
        <div class="provenance-row">
          ${Object.entries(provenanceKinds)
            .map(
              ([kind, count]) =>
                `<span class="provenance-chip"><b>${count}</b> ${escapeHtml(kind)}</span>`,
            )
            .join('')}
        </div>
      </article>

      <article class="panel quiet">
        <p class="eyebrow">Data discipline</p>
        <h2>Source remains visible</h2>
        <p>
          Manual edits, imported fields, derived values and synthetic data remain distinguishable.
          Open Students → Sources to inspect field-level provenance.
        </p>
      </article>
    </div>
  `
}

function metricDefinitionForm(): string {
  return `
    <form id="add-metric-form" class="metric-form">
      <div class="form-heading">
        <div>
          <p class="eyebrow">Metric definition</p>
          <h3>Add a field</h3>
        </div>
        <small>Meaning comes from your definition, not ClassGraph.</small>
      </div>
      <div class="metric-form-grid">
        <label>
          Key
          <input name="key" required placeholder="assessment" pattern="[A-Za-z0-9][A-Za-z0-9._-]*" />
        </label>
        <label>
          Label
          <input name="label" required placeholder="Assessment" />
        </label>
        <label>
          Type
          <select name="kind">
            <option value="number">Number</option>
            <option value="category">Category</option>
            <option value="ordinal">Ordinal</option>
            <option value="boolean">Yes / No</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label>
          Values / scale
          <input name="values" placeholder="low, medium, high" />
        </label>
        <label>
          Minimum
          <input name="min" type="number" step="any" placeholder="0" />
        </label>
        <label>
          Maximum
          <input name="max" type="number" step="any" placeholder="100" />
        </label>
      </div>
      <button class="secondary compact" type="submit">Add metric</button>
    </form>
  `
}

function renderStudents(content: HTMLElement): void {
  if (!project) return

  const metricHeaders = project.metricDefinitions
    .map(
      (definition) =>
        `<th title="${escapeHtml(definition.kind)}">${escapeHtml(definition.label)}</th>`,
    )
    .join('')

  const rows = project.students
    .map((student, index) => renderStudentRow(student, index))
    .join('')

  const metricChips = project.metricDefinitions.length
    ? project.metricDefinitions
        .map(
          (definition) => `
            <span class="metric-chip">
              <span>
                <b>${escapeHtml(definition.label)}</b>
                <small>${escapeHtml(definition.key)} · ${escapeHtml(definition.kind)}</small>
              </span>
              <button
                class="icon-button danger-text"
                type="button"
                data-remove-metric="${escapeHtml(definition.key)}"
                title="Remove metric and its values"
              >×</button>
            </span>
          `,
        )
        .join('')
    : '<span class="muted">No custom metrics yet.</span>'

  content.innerHTML = `
    <div class="roster-layout">
      <article class="panel roster-tools">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Roster</p>
            <h2>Students</h2>
          </div>
          <span class="schema-badge">${project.students.length} records</span>
        </div>

        <form id="add-student-form" class="inline-form">
          <label>
            Student ID
            <input name="id" required placeholder="s-001" />
          </label>
          <label>
            Display name
            <input name="displayName" placeholder="Optional" />
          </label>
          <button class="primary compact" type="submit">Add student</button>
        </form>

        ${metricDefinitionForm()}

        <div class="metric-chip-list">
          ${metricChips}
        </div>
      </article>

      <article class="panel roster-table-panel">
        <div class="table-note">
          <span><b>Not recorded</b> = no value stored.</span>
          <span><b>Missing</b> = explicitly recorded as unavailable.</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                ${metricHeaders}
                <th>Sources</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows || renderEmptyRosterRow(project.metricDefinitions.length)}
            </tbody>
          </table>
        </div>
      </article>

      ${renderProvenanceInspector()}
    </div>
  `

  bindStudentViewEvents()
}

function renderEmptyRosterRow(metricCount: number): string {
  return `
    <tr>
      <td colspan="${metricCount + 4}" class="empty-cell">
        No students yet. Add a student above or import a project.
      </td>
    </tr>
  `
}

function renderStudentRow(student: StudentRecord, index: number): string {
  if (!project) return ''

  const metricCells = project.metricDefinitions
    .map((definition) => renderMetricCell(student, definition, index))
    .join('')

  return `
    <tr>
      <td class="id-cell">${escapeHtml(student.id)}</td>
      <td>
        <div class="name-editor">
          <input
            class="cell-input"
            data-student-name="${escapeHtml(student.id)}"
            value="${escapeHtml(student.displayName ?? '')}"
            placeholder="Optional name"
          />
          <button
            class="icon-button"
            type="button"
            data-save-student="${escapeHtml(student.id)}"
            title="Save name"
          >✓</button>
        </div>
      </td>
      ${metricCells}
      <td>
        <button
          class="ghost compact"
          type="button"
          data-sources="${escapeHtml(student.id)}"
        >Sources</button>
      </td>
      <td>
        <button
          class="icon-button danger-text"
          type="button"
          data-remove-student="${escapeHtml(student.id)}"
          title="Remove student"
        >×</button>
      </td>
    </tr>
  `
}

function metricState(student: StudentRecord, metricKey: string): MetricState {
  if (!(metricKey in student.metrics)) return 'unrecorded'
  return student.metrics[metricKey] === null ? 'missing' : 'recorded'
}

function renderMetricCell(
  student: StudentRecord,
  definition: MetricDefinition,
  index: number,
): string {
  const state = metricState(student, definition.key)
  const value = student.metrics[definition.key]

  if (
    definition.kind === 'category' ||
    definition.kind === 'ordinal' ||
    definition.kind === 'boolean'
  ) {
    return renderSelectMetricCell(student, definition, state, value, index)
  }

  const displayedValue =
    state === 'recorded' && value !== null && value !== undefined ? String(value) : ''
  const inputType = definition.kind === 'number' ? 'number' : 'text'
  const step = definition.kind === 'number' ? ' step="any"' : ''
  const min =
    definition.kind === 'number' && definition.numberScale?.min !== undefined
      ? ` min="${definition.numberScale.min}"`
      : ''
  const max =
    definition.kind === 'number' && definition.numberScale?.max !== undefined
      ? ` max="${definition.numberScale.max}"`
      : ''

  return `
    <td>
      <div class="metric-editor" data-metric-editor="${index}:${escapeHtml(definition.key)}">
        <select
          class="state-select"
          data-metric-state="${escapeHtml(student.id)}:${escapeHtml(definition.key)}"
        >
          ${stateOptions(state)}
        </select>
        <input
          class="cell-input metric-value-input"
          type="${inputType}"${step}${min}${max}
          data-metric-value="${escapeHtml(student.id)}:${escapeHtml(definition.key)}"
          value="${escapeHtml(displayedValue)}"
          ${state === 'recorded' ? '' : 'disabled'}
        />
        <button
          class="icon-button"
          type="button"
          data-save-metric="${escapeHtml(student.id)}:${escapeHtml(definition.key)}"
          title="Save metric"
        >✓</button>
      </div>
    </td>
  `
}

function renderSelectMetricCell(
  student: StudentRecord,
  definition: MetricDefinition,
  state: MetricState,
  value: MetricValue | undefined,
  _index: number,
): string {
  let options: string[] = []

  if (definition.kind === 'boolean') {
    options = ['true', 'false']
  } else if (definition.kind === 'category') {
    options = definition.categories ?? []
  } else {
    options = definition.ordinalScale ?? []
  }

  const specialOptions = [
    optionHtml('__unrecorded__', 'Not recorded', state === 'unrecorded'),
    optionHtml('__missing__', 'Missing', state === 'missing'),
  ]

  const valueOptions = options.map((option) =>
    optionHtml(option, option, state === 'recorded' && String(value) === option),
  )

  return `
    <td>
      <select
        class="cell-select"
        data-select-metric="${escapeHtml(student.id)}:${escapeHtml(definition.key)}"
      >
        ${[...specialOptions, ...valueOptions].join('')}
      </select>
    </td>
  `
}

function stateOptions(selected: MetricState): string {
  return [
    optionHtml('recorded', 'Recorded', selected === 'recorded'),
    optionHtml('missing', 'Missing', selected === 'missing'),
    optionHtml('unrecorded', 'Not recorded', selected === 'unrecorded'),
  ].join('')
}

function optionHtml(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`
}

function renderProvenanceInspector(): string {
  if (!project || !selectedProvenanceStudentId) return ''

  const index = project.students.findIndex(
    (student) => student.id === selectedProvenanceStudentId,
  )
  if (index < 0) return ''

  const student = project.students[index]
  if (!student) return ''

  const prefix = `/students/${index}/`
  const entries = Object.entries(project.provenance)
    .filter(([path]) => path.startsWith(prefix))
    .sort(([left], [right]) => left.localeCompare(right))

  const rows = entries.length
    ? entries
        .map(([path, entry]) => {
          const field = path.slice(prefix.length)
          const details = [
            entry.source ? `source: ${entry.source}` : '',
            entry.note ?? '',
            entry.derivedFrom?.length ? `derived from: ${entry.derivedFrom.join(', ')}` : '',
          ]
            .filter(Boolean)
            .map(escapeHtml)
            .join(' · ')

          return `
            <tr>
              <td><code>${escapeHtml(field)}</code></td>
              <td><span class="source-kind">${escapeHtml(entry.kind)}</span></td>
              <td>${details || '<span class="muted">No extra source note</span>'}</td>
            </tr>
          `
        })
        .join('')
    : '<tr><td colspan="3" class="empty-cell">No field-level provenance is recorded for this student.</td></tr>'

  return `
    <article class="panel provenance-inspector">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Field provenance</p>
          <h2>${escapeHtml(student.displayName ?? student.id)}</h2>
        </div>
        <button id="close-provenance" class="ghost compact" type="button">Close</button>
      </div>
      <p>
        These are recorded sources, not ClassGraph guesses. A missing entry means no field-level
        source record exists for that path.
      </p>
      <div class="data-table-wrap">
        <table class="source-table">
          <thead>
            <tr><th>Field</th><th>Kind</th><th>Source detail</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `
}

function bindStudentViewEvents(): void {
  document.querySelector<HTMLFormElement>('#add-student-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const id = asString(data, 'id')
    const displayName = asString(data, 'displayName')
    void mutateProject({
      type: 'add-student',
      student: {
        id,
        ...(displayName ? { displayName } : {}),
      },
    })
  })

  document.querySelector<HTMLFormElement>('#add-metric-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const definition = metricDefinitionFromForm(data)
    void mutateProject({ type: 'add-metric-definition', definition })
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-student]')) {
    button.addEventListener('click', () => {
      const studentId = button.dataset.saveStudent
      if (!studentId) return
      const input = document.querySelector<HTMLInputElement>(
        `[data-student-name="${CSS.escape(studentId)}"]`,
      )
      void mutateProject({
        type: 'update-student',
        studentId,
        patch: { displayName: input?.value.trim() || null },
      })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-student]')) {
    button.addEventListener('click', () => {
      const studentId = button.dataset.removeStudent
      if (!studentId) return
      if (!window.confirm(`Remove student ${studentId}? This also removes their relationships.`)) {
        return
      }
      if (selectedProvenanceStudentId === studentId) selectedProvenanceStudentId = null
      void mutateProject({ type: 'remove-student', studentId })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-metric]')) {
    button.addEventListener('click', () => {
      const metricKey = button.dataset.removeMetric
      if (!metricKey) return
      if (!window.confirm(`Remove metric "${metricKey}" and all of its recorded values?`)) {
        return
      }
      void mutateProject({ type: 'remove-metric-definition', metricKey })
    })
  }

  for (const select of document.querySelectorAll<HTMLSelectElement>('[data-select-metric]')) {
    select.addEventListener('change', () => {
      const parsed = parseMetricTarget(select.dataset.selectMetric)
      if (!parsed) return
      const definition = project?.metricDefinitions.find((item) => item.key === parsed.metricKey)
      if (!definition) return
      void saveSelectMetric(parsed.studentId, definition, select.value)
    })
  }

  for (const select of document.querySelectorAll<HTMLSelectElement>('[data-metric-state]')) {
    select.addEventListener('change', () => {
      const target = select.dataset.metricState
      if (!target) return
      const input = document.querySelector<HTMLInputElement>(
        `[data-metric-value="${CSS.escape(target)}"]`,
      )
      if (input) input.disabled = select.value !== 'recorded'
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-metric]')) {
    button.addEventListener('click', () => {
      const parsed = parseMetricTarget(button.dataset.saveMetric)
      if (!parsed) return
      const definition = project?.metricDefinitions.find((item) => item.key === parsed.metricKey)
      if (!definition) return
      void saveInputMetric(parsed.studentId, definition)
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sources]')) {
    button.addEventListener('click', () => {
      selectedProvenanceStudentId = button.dataset.sources ?? null
      renderWorkspace()
    })
  }

  document.querySelector<HTMLButtonElement>('#close-provenance')?.addEventListener('click', () => {
    selectedProvenanceStudentId = null
    renderWorkspace()
  })
}

function metricDefinitionFromForm(data: FormData): MetricDefinition {
  const kind = asString(data, 'kind') as MetricKind
  const key = asString(data, 'key')
  const label = asString(data, 'label')
  const values = asString(data, 'values')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const definition: MetricDefinition = { key, label, kind }

  if (kind === 'number') {
    const min = optionalNumber(asString(data, 'min'))
    const max = optionalNumber(asString(data, 'max'))
    if (min !== undefined || max !== undefined) {
      definition.numberScale = {
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      }
    }
  }

  if (kind === 'category') definition.categories = values
  if (kind === 'ordinal') definition.ordinalScale = values

  return definition
}

function parseMetricTarget(value: string | undefined): {
  studentId: string
  metricKey: string
} | null {
  if (!value) return null
  const separator = value.indexOf(':')
  if (separator < 1) return null
  return {
    studentId: value.slice(0, separator),
    metricKey: value.slice(separator + 1),
  }
}

async function saveSelectMetric(
  studentId: string,
  definition: MetricDefinition,
  selectedValue: string,
): Promise<void> {
  if (selectedValue === '__unrecorded__') {
    await mutateProject({
      type: 'unset-metric-value',
      studentId,
      metricKey: definition.key,
    })
    return
  }

  if (selectedValue === '__missing__') {
    await mutateProject({
      type: 'set-metric-value',
      studentId,
      metricKey: definition.key,
      value: null,
    })
    return
  }

  const value: MetricValue =
    definition.kind === 'boolean' ? selectedValue === 'true' : selectedValue

  await mutateProject({
    type: 'set-metric-value',
    studentId,
    metricKey: definition.key,
    value,
  })
}

async function saveInputMetric(
  studentId: string,
  definition: MetricDefinition,
): Promise<void> {
  const target = `${studentId}:${definition.key}`
  const stateSelect = document.querySelector<HTMLSelectElement>(
    `[data-metric-state="${CSS.escape(target)}"]`,
  )
  const input = document.querySelector<HTMLInputElement>(
    `[data-metric-value="${CSS.escape(target)}"]`,
  )
  const state = stateSelect?.value as MetricState | undefined

  if (state === 'unrecorded') {
    await mutateProject({
      type: 'unset-metric-value',
      studentId,
      metricKey: definition.key,
    })
    return
  }

  if (state === 'missing') {
    await mutateProject({
      type: 'set-metric-value',
      studentId,
      metricKey: definition.key,
      value: null,
    })
    return
  }

  const raw = input?.value ?? ''
  let value: MetricValue = raw

  if (definition.kind === 'number') {
    if (!raw.trim()) {
      showStatus('Enter a number, or choose Missing / Not recorded.')
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      showStatus('Enter a valid number.')
      return
    }
    value = parsed
  }

  await mutateProject({
    type: 'set-metric-value',
    studentId,
    metricKey: definition.key,
    value,
  })
}


function renderGraphs(content: HTMLElement): void {
  if (!project) return

  content.innerHTML = `
    <article class="panel analysis-loading">
      <p class="eyebrow">Descriptive analysis</p>
      <h2>Reading the current class data…</h2>
      <p>No prediction or hidden student scoring is performed.</p>
    </article>
  `

  void loadProjectAnalysis(content)
}

async function loadProjectAnalysis(content: HTMLElement): Promise<void> {
  if (!project) return

  try {
    const response = await postJson<{ analysis: ProjectAnalysis }>('/api/analysis/project', {
      project,
    })
    if (activeView !== 'graphs') return
    renderAnalysisResults(content, response.analysis)
  } catch (error) {
    content.innerHTML = `
      <article class="panel empty-state">
        <p class="eyebrow">Analysis unavailable</p>
        <h2>ClassGraph could not build this view.</h2>
        <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown analysis error.')}</p>
      </article>
    `
  }
}

function renderAnalysisResults(content: HTMLElement, analysis: ProjectAnalysis): void {
  const current = project
  if (!current) return

  if (!selectedGraphMetricKey || !analysis.metrics.some((item) => item.key === selectedGraphMetricKey)) {
    selectedGraphMetricKey = analysis.metrics[0]?.key ?? null
  }

  const numericMetrics = analysis.metrics.filter(
    (metric): metric is NumericMetricAnalysis => metric.kind === 'number',
  )

  if (!selectedScatterX || !numericMetrics.some((item) => item.key === selectedScatterX)) {
    selectedScatterX = numericMetrics[0]?.key ?? null
  }
  if (!selectedScatterY || !numericMetrics.some((item) => item.key === selectedScatterY)) {
    selectedScatterY = numericMetrics[1]?.key ?? numericMetrics[0]?.key ?? null
  }

  const selectedMetric = analysis.metrics.find((item) => item.key === selectedGraphMetricKey)
  const completeness = analysis.completeness
  const completenessPercent =
    completeness.totalCells > 0
      ? Math.round((completeness.recordedCount / completeness.totalCells) * 100)
      : 0

  content.innerHTML = `
    <div class="metric-cards">
      <article class="metric-card">
        <span>Recorded cells</span>
        <strong>${completeness.recordedCount}</strong>
        <small>${completenessPercent}% of defined student × metric cells</small>
      </article>
      <article class="metric-card">
        <span>Explicitly missing</span>
        <strong>${completeness.explicitMissingCount}</strong>
        <small>Stored as unavailable, not zero</small>
      </article>
      <article class="metric-card">
        <span>Not recorded</span>
        <strong>${completeness.unrecordedCount}</strong>
        <small>No value is stored for these cells</small>
      </article>
    </div>

    <article class="panel analysis-panel">
      <div class="analysis-toolbar">
        <div>
          <p class="eyebrow">Distribution</p>
          <h2>One metric at a time</h2>
        </div>
        <label class="compact-label">
          Metric
          <select id="graph-metric-select">
            ${analysis.metrics
              .map((metric) =>
                optionHtml(metric.key, metric.label, metric.key === selectedGraphMetricKey),
              )
              .join('')}
          </select>
        </label>
      </div>
      ${selectedMetric ? renderMetricAnalysis(selectedMetric) : renderNoMetrics()}
    </article>

    <article class="panel analysis-panel">
      <div class="analysis-toolbar">
        <div>
          <p class="eyebrow">Numeric comparison</p>
          <h2>Scatter view</h2>
        </div>
        <div class="scatter-controls">
          <label class="compact-label">
            X axis
            <select id="scatter-x">
              ${numericMetrics
                .map((metric) =>
                  optionHtml(metric.key, metric.label, metric.key === selectedScatterX),
                )
                .join('')}
            </select>
          </label>
          <label class="compact-label">
            Y axis
            <select id="scatter-y">
              ${numericMetrics
                .map((metric) =>
                  optionHtml(metric.key, metric.label, metric.key === selectedScatterY),
                )
                .join('')}
            </select>
          </label>
          <button id="load-scatter" class="secondary compact" type="button">Compare</button>
        </div>
      </div>
      <div id="scatter-result">
        ${numericMetrics.length < 2 ? renderScatterUnavailable(numericMetrics.length) : '<p class="muted">Choose two numeric metrics and compare them.</p>'}
      </div>
    </article>
  `

  document
    .querySelector<HTMLSelectElement>('#graph-metric-select')
    ?.addEventListener('change', (event) => {
      selectedGraphMetricKey = (event.currentTarget as HTMLSelectElement).value
      renderAnalysisResults(content, analysis)
    })

  document.querySelector<HTMLSelectElement>('#scatter-x')?.addEventListener('change', (event) => {
    selectedScatterX = (event.currentTarget as HTMLSelectElement).value
  })
  document.querySelector<HTMLSelectElement>('#scatter-y')?.addEventListener('change', (event) => {
    selectedScatterY = (event.currentTarget as HTMLSelectElement).value
  })
  document.querySelector<HTMLButtonElement>('#load-scatter')?.addEventListener('click', () => {
    void loadScatter()
  })
}

function renderNoMetrics(): string {
  return `
    <div class="empty-analysis">
      <p>No metric definitions exist yet. Add fields in the Students view first.</p>
    </div>
  `
}

function renderMetricAnalysis(metric: MetricAnalysis): string {
  return metric.kind === 'number'
    ? renderNumericAnalysis(metric)
    : renderCategoryAnalysis(metric)
}

function renderNumericAnalysis(metric: NumericMetricAnalysis): string {
  const maxCount = Math.max(1, ...metric.histogram.map((bucket) => bucket.count))
  const bars = metric.histogram
    .map(
      (bucket) => `
        <div class="chart-bar-item">
          <div class="chart-bar-track">
            <div
              class="chart-bar"
              style="height: ${Math.max(4, (bucket.count / maxCount) * 100)}%"
              title="${bucket.count} students"
            ></div>
          </div>
          <span>${numberLabel(bucket.min)}–${numberLabel(bucket.max)}</span>
          <b>${bucket.count}</b>
        </div>
      `,
    )
    .join('')

  const tableRows = metric.histogram
    .map(
      (bucket) => `
        <tr>
          <td>${numberLabel(bucket.min)}</td>
          <td>${numberLabel(bucket.max)}</td>
          <td>${bucket.count}</td>
        </tr>
      `,
    )
    .join('')

  const summary = metric.summary
  return `
    <div class="analysis-summary-strip">
      ${summaryStat('Recorded', summary.recordedCount)}
      ${summaryStat('Missing / absent', summary.missingCount)}
      ${summaryStat('Min', summary.min)}
      ${summaryStat('Median', summary.median)}
      ${summaryStat('Mean', summary.mean)}
      ${summaryStat('Max', summary.max)}
    </div>
    <div class="analysis-split">
      <div>
        <h3>${escapeHtml(metric.label)} distribution</h3>
        <div
          class="bar-chart"
          role="img"
          aria-label="Histogram for ${escapeHtml(metric.label)}"
        >
          ${bars || '<p class="muted">No recorded numeric values.</p>'}
        </div>
      </div>
      <div>
        <h3>Table equivalent</h3>
        <div class="data-table-wrap">
          <table class="source-table">
            <thead><tr><th>From</th><th>To</th><th>Count</th></tr></thead>
            <tbody>
              ${tableRows || '<tr><td colspan="3" class="empty-cell">No recorded values.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <p class="analysis-footnote">
      Quartiles: Q1 ${numberLabel(summary.q1)} · Q3 ${numberLabel(summary.q3)}.
      This is descriptive only; ClassGraph does not label students from these values.
    </p>
  `
}

function renderCategoryAnalysis(metric: CategoryMetricAnalysis): string {
  const entries = Object.entries(metric.summary.counts).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const maxCount = Math.max(1, ...entries.map(([, count]) => count))
  const bars = entries
    .map(
      ([label, count]) => `
        <div class="horizontal-bar-row">
          <span>${escapeHtml(label)}</span>
          <div class="horizontal-bar-track">
            <div class="horizontal-bar" style="width: ${(count / maxCount) * 100}%"></div>
          </div>
          <b>${count}</b>
        </div>
      `,
    )
    .join('')

  const tableRows = entries
    .map(
      ([label, count]) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${count}</td>
          <td>${metric.summary.recordedCount ? Math.round((count / metric.summary.recordedCount) * 100) : 0}%</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div class="analysis-summary-strip">
      ${summaryStat('Recorded', metric.summary.recordedCount)}
      ${summaryStat('Missing / absent', metric.summary.missingCount)}
      ${summaryStat('Categories seen', entries.length)}
    </div>
    <div class="analysis-split">
      <div>
        <h3>${escapeHtml(metric.label)} counts</h3>
        <div class="horizontal-chart" role="img" aria-label="Counts for ${escapeHtml(metric.label)}">
          ${bars || '<p class="muted">No recorded values.</p>'}
        </div>
      </div>
      <div>
        <h3>Table equivalent</h3>
        <div class="data-table-wrap">
          <table class="source-table">
            <thead><tr><th>Value</th><th>Count</th><th>Recorded %</th></tr></thead>
            <tbody>
              ${tableRows || '<tr><td colspan="3" class="empty-cell">No recorded values.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
}

function summaryStat(label: string, value: number | null): string {
  return `
    <span>
      <small>${escapeHtml(label)}</small>
      <b>${numberLabel(value)}</b>
    </span>
  `
}

function numberLabel(value: number | null): string {
  if (value === null) return '—'
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

function renderScatterUnavailable(numericCount: number): string {
  return `
    <div class="empty-analysis">
      <p>
        ${numericCount === 0 ? 'No numeric metrics exist yet.' : 'Add a second numeric metric to compare two axes.'}
      </p>
    </div>
  `
}

async function loadScatter(): Promise<void> {
  if (!project || !selectedScatterX || !selectedScatterY) return
  const target = document.querySelector<HTMLElement>('#scatter-result')
  if (!target) return

  target.innerHTML = '<p class="muted">Building scatter view…</p>'

  try {
    const response = await postJson<{ scatter: ScatterView }>('/api/analysis/scatter', {
      project,
      xMetricKey: selectedScatterX,
      yMetricKey: selectedScatterY,
    })
    target.innerHTML = renderScatter(response.scatter)
  } catch (error) {
    target.innerHTML = `<p class="status">${escapeHtml(
      error instanceof Error ? error.message : 'Could not build scatter view.',
    )}</p>`
  }
}

function renderScatter(scatter: ScatterView): string {
  if (scatter.points.length === 0) {
    return `
      <div class="empty-analysis">
        <p>No students have recorded numeric values for both selected metrics.</p>
        <p class="muted">${scatter.omittedCount} students omitted because one or both values are unavailable.</p>
      </div>
    `
  }

  const xs = scatter.points.map((point) => point.x)
  const ys = scatter.points.map((point) => point.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1

  const dots = scatter.points
    .map((point) => {
      const left = 5 + ((point.x - xMin) / xSpan) * 90
      const bottom = 5 + ((point.y - yMin) / ySpan) * 90
      const label = point.displayName ?? point.studentId
      return `
        <span
          class="scatter-dot"
          style="left: ${left}%; bottom: ${bottom}%"
          title="${escapeHtml(label)}: ${point.x}, ${point.y}"
        ></span>
      `
    })
    .join('')

  const tableRows = scatter.points
    .map(
      (point) => `
        <tr>
          <td>${escapeHtml(point.displayName ?? point.studentId)}</td>
          <td>${numberLabel(point.x)}</td>
          <td>${numberLabel(point.y)}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div class="analysis-split scatter-split">
      <div>
        <div class="scatter-axis-title">${escapeHtml(scatter.yLabel)} ↑</div>
        <div
          class="scatter-plot"
          role="img"
          aria-label="Scatter plot comparing ${escapeHtml(scatter.xLabel)} and ${escapeHtml(scatter.yLabel)}"
        >
          ${dots}
        </div>
        <div class="scatter-x-title">→ ${escapeHtml(scatter.xLabel)}</div>
        <p class="analysis-footnote">
          ${scatter.omittedCount} students omitted because one or both selected values are not recorded.
          Position shows association only; it does not imply causation.
        </p>
      </div>
      <div>
        <h3>Table equivalent</h3>
        <div class="data-table-wrap">
          <table class="source-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>${escapeHtml(scatter.xLabel)}</th>
                <th>${escapeHtml(scatter.yLabel)}</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `
}

async function exportProject(): Promise<void> {
  if (!project) return
  clearStatus()

  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      body: JSON.stringify(project),
    })
    if (!response.ok) throw await responseError(response)

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeTitle = project.title.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '')
    link.href = url
    link.download = `${safeTitle || 'classgraph-project'}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showStatus('JSON export created.', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not export the project.')
  }
}

renderSetup()
