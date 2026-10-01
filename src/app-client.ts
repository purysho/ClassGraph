interface ProvenanceEntry {
  kind: string
  source?: string
  note?: string
  derivedFrom?: string[]
}

type MetricValue = number | string | boolean | null

interface MetricDefinition {
  key: string
  label: string
  kind: 'number' | 'ordinal' | 'category' | 'boolean' | 'text'
  description?: string
  numberScale?: { min?: number; max?: number; unit?: string }
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

type WorkspaceView = 'overview' | 'students' | 'graphs'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('ClassGraph could not find the application root.')

let project: ClassGraphProject | null = null
let activeView: WorkspaceView = 'overview'

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

function projectId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `class-${Date.now()}`
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse
    const prefix = body.error?.code ? `${body.error.code}: ` : ''
    return new Error(`${prefix}${body.error?.message ?? 'ClassGraph could not complete that action.'}`)
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

async function mutateProject(command: unknown, successMessage: string): Promise<void> {
  if (!project) return
  clearStatus()

  try {
    const response = await postJson<ProjectResponse>('/api/project/mutate', {
      project,
      command,
    })
    project = response.project
    renderWorkspace()
    showStatus(successMessage, 'success')
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

  document.querySelector<HTMLFormElement>('#synthetic-form')?.addEventListener('submit', (event) => {
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

function hasMetricValue(student: StudentRecord, metricKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(student.metrics, metricKey)
}

function metricState(student: StudentRecord, metricKey: string): 'unrecorded' | 'missing' | 'value' {
  if (!hasMetricValue(student, metricKey)) return 'unrecorded'
  return student.metrics[metricKey] === null ? 'missing' : 'value'
}

function selected(value: string, current: string): string {
  return value === current ? ' selected' : ''
}

function renderMetricValueControl(
  definition: MetricDefinition,
  value: MetricValue | undefined,
  enabled: boolean,
): string {
  const disabled = enabled ? '' : ' disabled'
  const stringValue = value === null || value === undefined ? '' : String(value)

  if (definition.kind === 'boolean') {
    return `
      <select class="metric-value" aria-label="${escapeHtml(definition.label)} value"${disabled}>
        <option value="true"${selected('true', stringValue)}>True</option>
        <option value="false"${selected('false', stringValue)}>False</option>
      </select>
    `
  }

  if (definition.kind === 'category' || definition.kind === 'ordinal') {
    const options =
      definition.kind === 'category' ? (definition.categories ?? []) : (definition.ordinalScale ?? [])
    return `
      <select class="metric-value" aria-label="${escapeHtml(definition.label)} value"${disabled}>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}"${selected(option, stringValue)}>${escapeHtml(option)}</option>`,
          )
          .join('')}
      </select>
    `
  }

  if (definition.kind === 'number') {
    const min =
      definition.numberScale?.min === undefined ? '' : ` min="${definition.numberScale.min}"`
    const max =
      definition.numberScale?.max === undefined ? '' : ` max="${definition.numberScale.max}"`
    return `<input class="metric-value" type="number" step="any"${min}${max} value="${escapeHtml(stringValue)}"${disabled} />`
  }

  return `<input class="metric-value" type="text" value="${escapeHtml(stringValue)}"${disabled} />`
}

function renderMetricEditor(student: StudentRecord, definition: MetricDefinition): string {
  const state = metricState(student, definition.key)
  const value = student.metrics[definition.key]

  return `
    <div
      class="metric-editor"
      data-student-id="${escapeHtml(student.id)}"
      data-metric-key="${escapeHtml(definition.key)}"
      data-metric-kind="${definition.kind}"
    >
      <select class="metric-state" aria-label="${escapeHtml(definition.label)} state">
        <option value="unrecorded"${selected('unrecorded', state)}>Unrecorded</option>
        <option value="missing"${selected('missing', state)}>Missing</option>
        <option value="value"${selected('value', state)}>Value</option>
      </select>
      ${renderMetricValueControl(definition, value, state === 'value')}
      <button class="ghost compact save-metric" type="button">Save</button>
    </div>
  `
}

function renderStudentsView(content: HTMLElement): void {
  if (!project) return

  const metricHeaders = project.metricDefinitions
    .map(
      (definition) =>
        `<th><span>${escapeHtml(definition.label)}</span><small>${escapeHtml(definition.kind)}</small></th>`,
    )
    .join('')

  const rows = project.students
    .map(
      (student) => `
        <tr>
          <td class="student-id-cell">
            <strong>${escapeHtml(student.id)}</strong>
          </td>
          <td>
            <input
              class="student-name"
              data-student-id="${escapeHtml(student.id)}"
              value="${escapeHtml(student.displayName ?? '')}"
              placeholder="Optional name"
            />
          </td>
          <td>
            <input
              class="student-tags"
              data-student-id="${escapeHtml(student.id)}"
              value="${escapeHtml((student.tags ?? []).join(', '))}"
              placeholder="group-a, support"
            />
          </td>
          <td>
            <input
              class="student-notes"
              data-student-id="${escapeHtml(student.id)}"
              value="${escapeHtml(student.notes ?? '')}"
              placeholder="Optional note"
            />
          </td>
          ${project?.metricDefinitions
            .map((definition) => `<td>${renderMetricEditor(student, definition)}</td>`)
            .join('')}
          <td class="row-actions">
            <button class="secondary compact save-student" data-student-id="${escapeHtml(student.id)}" type="button">
              Save
            </button>
            <button class="danger compact remove-student" data-student-id="${escapeHtml(student.id)}" type="button">
              Remove
            </button>
          </td>
        </tr>
      `,
    )
    .join('')

  content.innerHTML = `
    <div class="roster-toolbar">
      <article class="panel compact-panel">
        <p class="eyebrow">Add student</p>
        <form id="add-student-form" class="inline-form">
          <input name="id" required placeholder="Student ID" />
          <input name="displayName" placeholder="Display name (optional)" />
          <button class="primary compact" type="submit">Add student</button>
        </form>
      </article>

      <article class="panel compact-panel">
        <p class="eyebrow">Add metric</p>
        <form id="add-metric-form" class="metric-form">
          <input name="key" required placeholder="key e.g. assessment" />
          <input name="label" required placeholder="Label" />
          <select name="kind">
            <option value="number">Number</option>
            <option value="ordinal">Ordinal</option>
            <option value="category">Category</option>
            <option value="boolean">Boolean</option>
            <option value="text">Text</option>
          </select>
          <input name="options" placeholder="Category/ordinal values, comma-separated" />
          <input name="min" type="number" step="any" placeholder="Min" />
          <input name="max" type="number" step="any" placeholder="Max" />
          <button class="secondary compact" type="submit">Add metric</button>
        </form>
      </article>
    </div>

    <article class="panel roster-panel">
      <div class="panel-heading roster-heading">
        <div>
          <p class="eyebrow">Students</p>
          <h2>Roster and recorded fields</h2>
        </div>
        <p class="table-note">
          Missing means deliberately recorded as missing. Unrecorded means no value exists.
        </p>
      </div>

      <div class="table-scroll">
        <table class="roster-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Tags</th>
              <th>Notes</th>
              ${metricHeaders}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="empty-table">No students yet. Add the first student above.</td></tr>'}
          </tbody>
        </table>
      </div>
    </article>
  `

  document.querySelector<HTMLFormElement>('#add-student-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    void mutateProject(
      {
        type: 'add-student',
        student: {
          id: asString(data, 'id'),
          displayName: asString(data, 'displayName') || undefined,
        },
      },
      'Student added.',
    )
  })

  document.querySelector<HTMLFormElement>('#add-metric-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    void addMetricFromForm(data)
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('.save-student')) {
    button.addEventListener('click', () => {
      const studentId = button.dataset.studentId
      if (!studentId) return
      void saveStudentDetails(studentId)
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('.remove-student')) {
    button.addEventListener('click', () => {
      const studentId = button.dataset.studentId
      if (!studentId) return
      if (!window.confirm(`Remove ${studentId} from this ClassGraph project?`)) return
      void mutateProject({ type: 'remove-student', studentId }, 'Student removed.')
    })
  }

  for (const editor of document.querySelectorAll<HTMLElement>('.metric-editor')) {
    const state = editor.querySelector<HTMLSelectElement>('.metric-state')
    const value = editor.querySelector<HTMLInputElement | HTMLSelectElement>('.metric-value')
    state?.addEventListener('change', () => {
      if (value) value.disabled = state.value !== 'value'
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('.save-metric')) {
    button.addEventListener('click', () => {
      const editor = button.closest<HTMLElement>('.metric-editor')
      if (editor) void saveMetricEditor(editor)
    })
  }
}

async function addMetricFromForm(data: FormData): Promise<void> {
  const kind = asString(data, 'kind') as MetricDefinition['kind']
  const options = asString(data, 'options')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const minRaw = asString(data, 'min')
  const maxRaw = asString(data, 'max')

  const definition: MetricDefinition = {
    key: asString(data, 'key'),
    label: asString(data, 'label'),
    kind,
  }

  if (kind === 'category') {
    if (options.length === 0) {
      showStatus('Category metrics need at least one comma-separated value.')
      return
    }
    definition.categories = options
  } else if (kind === 'ordinal') {
    if (options.length === 0) {
      showStatus('Ordinal metrics need at least one ordered comma-separated value.')
      return
    }
    definition.ordinalScale = options
  } else if (kind === 'number' && (minRaw || maxRaw)) {
    definition.numberScale = {}
    if (minRaw) definition.numberScale.min = Number(minRaw)
    if (maxRaw) definition.numberScale.max = Number(maxRaw)
  }

  await mutateProject({ type: 'add-metric-definition', definition }, 'Metric added.')
}

async function saveStudentDetails(studentId: string): Promise<void> {
  const name = document.querySelector<HTMLInputElement>(
    `.student-name[data-student-id="${CSS.escape(studentId)}"]`,
  )
  const tags = document.querySelector<HTMLInputElement>(
    `.student-tags[data-student-id="${CSS.escape(studentId)}"]`,
  )
  const notes = document.querySelector<HTMLInputElement>(
    `.student-notes[data-student-id="${CSS.escape(studentId)}"]`,
  )

  const parsedTags = (tags?.value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  await mutateProject(
    {
      type: 'update-student',
      studentId,
      patch: {
        displayName: name?.value.trim() || null,
        tags: parsedTags,
        notes: notes?.value.trim() || null,
      },
    },
    'Student details saved.',
  )
}

function parseMetricEditorValue(
  editor: HTMLElement,
  definition: MetricDefinition,
): MetricValue | undefined {
  const state = editor.querySelector<HTMLSelectElement>('.metric-state')
  const input = editor.querySelector<HTMLInputElement | HTMLSelectElement>('.metric-value')
  if (!state || !input) throw new Error('Metric editor controls are missing.')

  if (state.value === 'unrecorded') return undefined
  if (state.value === 'missing') return null

  if (definition.kind === 'number') {
    const parsed = Number(input.value)
    if (!Number.isFinite(parsed)) throw new Error(`${definition.label} needs a numeric value.`)
    return parsed
  }

  if (definition.kind === 'boolean') return input.value === 'true'
  return input.value
}

async function saveMetricEditor(editor: HTMLElement): Promise<void> {
  if (!project) return
  const studentId = editor.dataset.studentId
  const metricKey = editor.dataset.metricKey
  if (!studentId || !metricKey) return

  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  if (!definition) {
    showStatus(`Metric definition not found: ${metricKey}`)
    return
  }

  try {
    const value = parseMetricEditorValue(editor, definition)
    if (value === undefined) {
      await mutateProject(
        { type: 'unset-metric-value', studentId, metricKey },
        'Metric marked unrecorded.',
      )
      return
    }

    await mutateProject(
      { type: 'set-metric-value', studentId, metricKey, value },
      value === null ? 'Metric marked missing.' : 'Metric value saved.',
    )
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not save the metric value.')
  }
}

function renderWorkspaceContent(): void {
  const content = document.querySelector<HTMLElement>('#workspace-content')
  if (!content || !project) return

  if (activeView === 'overview') {
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
          <p class="eyebrow">Next in this branch</p>
          <h2>Roster editing and analytical views</h2>
          <p>
            The Students tab now edits the real Exchange v1 project. Graphs remain the next
            analytical checkpoint.
          </p>
        </article>
      </div>
    `
    return
  }

  if (activeView === 'students') {
    renderStudentsView(content)
    return
  }

  content.innerHTML = `
    <article class="panel empty-state">
      <p class="eyebrow">Graphs</p>
      <h2>Descriptive analysis checkpoint</h2>
      <p>Distribution and comparison views are added in P1.6.</p>
    </article>
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
