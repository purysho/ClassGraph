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

type RelationshipType =
  'works-well-with' | 'avoid-pairing' | 'support-pair' | 'friendship' | 'custom'

interface RelationshipRecord {
  id: string
  fromStudentId: string
  toStudentId: string
  type: RelationshipType
  label?: string
  directed?: boolean
  weight?: number
}

interface SeatRecord {
  id: string
  row?: number
  column?: number
  x?: number
  y?: number
  enabled: boolean
  tags?: string[]
}

interface RoomRecord {
  layout: 'grid' | 'custom'
  rows?: number
  columns?: number
  front?: 'top' | 'bottom' | 'left' | 'right'
  seats: SeatRecord[]
}

interface PlanningSeatAssignment {
  studentId: string
  seatId: string
  locked: boolean
}

interface PlanningGroup {
  id: string
  label?: string
  studentIds: string[]
  lockedStudentIds?: string[]
}

interface ApprovedSeatingHistoryEntryView {
  version: '1.0'
  id: string
  label?: string
  approvedAt: string
  neighbourMode: 'orthogonal' | 'king'
  room: RoomRecord
  assignments: PlanningSeatAssignment[]
}

interface PlanningScenarioView {
  version: '1.0'
  id: string
  label: string
  savedAt: string
  room?: RoomRecord
  seed?: string
  selectedMetricKeys?: string[]
  assignments: PlanningSeatAssignment[]
  rules: PlanningRule[]
  groups: PlanningGroup[]
  approvedCandidateId?: string
}

type PlanningRule =
  | {
      id: string
      label?: string
      strength: 'hard'
      kind: 'fixed-seat'
      studentId: string
      seatId: string
    }
  | {
      id: string
      label?: string
      strength: 'hard'
      kind: 'keep-apart'
      studentAId: string
      studentBId: string
      neighbourMode?: 'orthogonal' | 'king'
    }
  | {
      id: string
      label?: string
      strength: 'hard'
      kind: 'seat-tag-required'
      studentId: string
      tag: string
    }
  | {
      id: string
      label?: string
      strength: 'soft'
      kind: 'prefer-together' | 'prefer-apart'
      studentAId: string
      studentBId: string
      weight?: number
    }
  | {
      id: string
      label?: string
      strength: 'soft'
      kind: 'prefer-seat-tag'
      studentId: string
      tag: string
      weight?: number
    }
  | {
      id: string
      label?: string
      strength: 'soft'
      kind: 'balance-metric-by-row'
      metricKey: string
      weight?: number
    }

interface PlanningRecord {
  ruleSchemaVersion?: '1.0'
  seed?: string
  selectedMetricKeys?: string[]
  assignments?: PlanningSeatAssignment[]
  rules?: PlanningRule[]
  groups?: PlanningGroup[]
  approvedCandidateId?: string
  history?: ApprovedSeatingHistoryEntryView[]
  scenarios?: PlanningScenarioView[]
}

interface HardConstraintView {
  ruleId: string
  kind: string
  satisfied: boolean
  message: string
}

interface ObjectiveView {
  ruleId: string
  kind: string
  penalty: number
  weight: number
  details: string
}

interface SeatingCandidateView {
  id: string
  seed: string
  assignments: PlanningSeatAssignment[]
  feasible: boolean
  hardConstraintResults: HardConstraintView[]
  objectiveResults: ObjectiveView[]
  totalPenalty: number
  explanation: string[]
}

interface SeatingGenerationView {
  seed: string
  candidates: SeatingCandidateView[]
  infeasibleReasons: string[]
  attempts: number
}

interface GroupObjectiveView {
  kind: 'size-balance' | 'metric-balance'
  penalty: number
  details: string
}

interface GroupingCandidateView {
  id: string
  seed: string
  groups: PlanningGroup[]
  objectiveResults: GroupObjectiveView[]
  totalPenalty: number
  explanation: string[]
}

interface GroupingGenerationView {
  seed: string
  candidates: GroupingCandidateView[]
  attempts: number
}

interface RelationshipGraphNodeView {
  studentId: string
  label: string
  x: number
  y: number
  focused: boolean
  connectedToFocus: boolean
}

interface RelationshipGraphEdgeView {
  relationshipId: string
  fromStudentId: string
  toStudentId: string
  type: RelationshipType
  label?: string
  directed: boolean
  weight?: number
  provenance?: ProvenanceEntry
}

interface RelationshipGraphView {
  focusStudentId?: string
  nodes: RelationshipGraphNodeView[]
  edges: RelationshipGraphEdgeView[]
}

interface RepeatNeighbourHistoryView {
  historyRecordCount: number
  usableRecordCount: number
  skippedRecordIds: string[]
  pairs: Array<{
    studentAId: string
    studentBId: string
    count: number
    historyIds: string[]
  }>
}

interface NetworkCountComparisonView {
  key: string
  label: string
  left: number
  right: number
  delta: number
}

interface PlanningScenarioComparisonView {
  leftScenarioId: string
  rightScenarioId: string
  assignments: {
    leftCount: number
    rightCount: number
    unchangedStudents: string[]
    movedStudents: string[]
    addedStudents: string[]
    removedStudents: string[]
  }
  groups: {
    leftCount: number
    rightCount: number
    unchangedStudents: string[]
    changedStudents: string[]
    addedStudents: string[]
    removedStudents: string[]
  }
  rules: {
    leftCount: number
    rightCount: number
    addedRuleIds: string[]
    removedRuleIds: string[]
  }
  network: {
    counts: NetworkCountComparisonView[]
    byType: NetworkCountComparisonView[]
  }
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
  relationships?: RelationshipRecord[]
  room?: RoomRecord
  planning?: PlanningRecord
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

type AssistanceTaskView =
  | 'synthetic-spec-draft'
  | 'analysis-explanation'
  | 'report-wording-draft'
  | 'planning-rule-suggestions'

interface AssistanceStatusView {
  offlineAvailable: true
  network: {
    enabled: boolean
    mode: 'network'
    label?: string
    endpointHost?: string
  }
}

interface AssistanceContextItemView {
  id: string
  label: string
  scope: string
  content: unknown
  containsStudentIds: boolean
  containsDisplayNames: boolean
  containsFreeText: boolean
  syntheticOnly: boolean
}

interface AssistanceDisclosureView {
  mode: 'offline' | 'network'
  providerLabel?: string
  items: AssistanceContextItemView[]
  containsStudentLevelData: boolean
  containsRealStudentData: boolean
  containsStudentIds: boolean
  containsDisplayNames: boolean
  containsFreeText: boolean
  requiresExplicitSend: boolean
}

interface AssistanceRequestView {
  version: '1.0'
  requestId: string
  task: AssistanceTaskView
  disclosure: AssistanceDisclosureView
  payload: unknown
}

type AssistanceProposalView =
  | {
      version: '1.0'
      proposalId: string
      requestId: string
      task: 'synthetic-spec-draft'
      status: 'proposal'
      providerLabel?: string
      warnings: string[]
      assumptions: string[]
      specification: unknown
    }
  | {
      version: '1.0'
      proposalId: string
      requestId: string
      task: 'analysis-explanation'
      status: 'proposal'
      providerLabel?: string
      warnings: string[]
      assumptions: string[]
      text: string
      sourceMetricKeys: string[]
      caveats: string[]
    }
  | {
      version: '1.0'
      proposalId: string
      requestId: string
      task: 'report-wording-draft'
      status: 'proposal'
      providerLabel?: string
      warnings: string[]
      assumptions: string[]
      sections: Array<{ heading: string; text: string }>
    }
  | {
      version: '1.0'
      proposalId: string
      requestId: string
      task: 'planning-rule-suggestions'
      status: 'proposal'
      providerLabel?: string
      warnings: string[]
      assumptions: string[]
      suggestions: Array<{
        rule: PlanningRule
        rationale: string
        inputPaths: string[]
      }>
    }

interface AssistanceRunResponseView {
  request: AssistanceRequestView
  proposal: AssistanceProposalView
}

type WorkspaceView =
  'overview' | 'students' | 'graphs' | 'relationships' | 'seating' | 'assistance' | 'reports'
type MetricState = 'recorded' | 'missing' | 'unrecorded'
type SyntheticDraftMetric =
  | {
      key: string
      label: string
      kind: 'number'
      missingRate: number
      distribution: 'normal' | 'uniform'
      min: number
      max: number
      mean: number
      standardDeviation: number
    }
  | {
      key: string
      label: string
      kind: 'category' | 'ordinal'
      missingRate: number
      values: Array<{ value: string; weight: number }>
    }
  | {
      key: string
      label: string
      kind: 'boolean'
      missingRate: number
      trueRate: number
    }
  | {
      key: string
      label: string
      kind: 'text'
      missingRate: number
      value: string
    }

function findAppRoot(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#app')
  if (!element) throw new Error('ClassGraph could not find the application root.')
  return element
}

const root = findAppRoot()

let project: ClassGraphProject | null = null
let activeView: WorkspaceView = 'overview'
let selectedProvenanceStudentId: string | null = null
let selectedGraphMetricKey: string | null = null
let selectedScatterX: string | null = null
let selectedScatterY: string | null = null
let selectedRelationshipTypeFilter: RelationshipType | 'all' = 'all'
let selectedRelationshipFocusStudentId: string | null = null
let selectedScenarioLeftId: string | null = null
let selectedScenarioRightId: string | null = null
let seatingGeneration: SeatingGenerationView | null = null
let groupingGeneration: GroupingGenerationView | null = null
let assistanceTask: AssistanceTask = 'analysis-explanation'
let assistanceMode: AssistanceMode = 'offline'
let assistancePrompt = ''
let assistancePreview: AssistanceRequestView | null = null
let assistanceProposalText = ''
let assistanceAccepted: unknown = null
let assistanceSelectedIndexes = ''
let assistanceStatusView: AssistanceStatusView | null = null
let assistanceRequestView: AssistanceRequestView | null = null
let assistanceProposalView: AssistanceProposalView | null = null
let assistanceSelectedTask: AssistanceTaskView = 'analysis-explanation'
let assistancePrompt = ''
let syntheticDraftProjectId = ''
let syntheticDraftTitle = 'Synthetic Class'
let syntheticDraftStudentCount = 36
let syntheticDraftSeed = 'classgraph-demo'
const syntheticDraftMetrics: SyntheticDraftMetric[] = [
  {
    key: 'assessment',
    label: 'Assessment',
    kind: 'number',
    missingRate: 0.05,
    distribution: 'normal',
    min: 0,
    max: 100,
    mean: 70,
    standardDeviation: 12,
  },
  {
    key: 'participation',
    label: 'Participation',
    kind: 'ordinal',
    missingRate: 0.05,
    values: [
      { value: '1', weight: 1 },
      { value: '2', weight: 2 },
      { value: '3', weight: 4 },
      { value: '4', weight: 2 },
      { value: '5', weight: 1 },
    ],
  },
]

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
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
    seatingGeneration = null
    groupingGeneration = null
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

        <div id="status" class="status" role="status" aria-live="polite" hidden></div>

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
            <p>
              Build a reviewed synthetic specification with explicit distributions, value weights,
              missing rates, and a reproducible seed.
            </p>
            <div class="stack-form">
              <div class="generator-summary">
                <span><b>Seeded</b> reproducibility</span>
                <span><b>Explicit</b> metric rules</span>
                <span><b>Synthetic</b> provenance</span>
              </div>
              <button id="configure-synthetic" class="secondary" type="button">
                Configure generator
              </button>
            </div>
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
    .querySelector<HTMLButtonElement>('#configure-synthetic')
    ?.addEventListener('click', () => {
      syntheticDraftProjectId = projectId()
      renderSyntheticBuilder()
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

function renderSyntheticBuilder(): void {
  root.innerHTML = `
    <main class="generator-shell">
      <header class="generator-header">
        <div>
          <p class="eyebrow">Structured synthetic generation</p>
          <h1>Build the class specification</h1>
          <p>
            Nothing here describes real students. Review the full deterministic specification
            before ClassGraph creates fictional records.
          </p>
        </div>
        <button id="back-to-setup" class="ghost compact" type="button">Back</button>
      </header>

      <div id="status" class="status" role="status" aria-live="polite" hidden></div>

      <section class="generator-grid">
        <article class="panel generator-config">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Class</p>
              <h2>Generation settings</h2>
            </div>
            <span class="schema-badge">Synthetic only</span>
          </div>

          <div class="generator-base-grid">
            <label>
              Class name
              <input id="synthetic-title" value="${escapeHtml(syntheticDraftTitle)}" />
            </label>
            <label>
              Students
              <input
                id="synthetic-count"
                type="number"
                min="1"
                max="500"
                value="${syntheticDraftStudentCount}"
              />
            </label>
            <label>
              Seed
              <input id="synthetic-seed" value="${escapeHtml(syntheticDraftSeed)}" />
            </label>
          </div>

          <div class="draft-metric-list">
            ${syntheticDraftMetrics.map((metric, index) => renderSyntheticDraftMetric(metric, index)).join('')}
          </div>

          <form id="add-synthetic-metric" class="synthetic-metric-form">
            <div class="form-heading">
              <div>
                <p class="eyebrow">Add synthetic metric</p>
                <h3>Define how fictional values are generated</h3>
              </div>
            </div>

            <div class="metric-form-grid synthetic-common-grid">
              <label>
                Key
                <input name="key" required placeholder="engagement" />
              </label>
              <label>
                Label
                <input name="label" required placeholder="Engagement" />
              </label>
              <label>
                Type
                <select id="synthetic-kind" name="kind">
                  <option value="number">Number</option>
                  <option value="category">Category</option>
                  <option value="ordinal">Ordinal</option>
                  <option value="boolean">Yes / No</option>
                  <option value="text">Text</option>
                </select>
              </label>
              <label>
                Missing rate
                <input name="missingRate" type="number" min="0" max="1" step="0.01" value="0" />
              </label>
            </div>

            <div id="synthetic-number-fields" class="synthetic-kind-fields">
              <label>
                Distribution
                <select name="distribution">
                  <option value="normal">Normal</option>
                  <option value="uniform">Uniform</option>
                </select>
              </label>
              <label>
                Minimum
                <input name="min" type="number" step="any" value="0" />
              </label>
              <label>
                Maximum
                <input name="max" type="number" step="any" value="100" />
              </label>
              <label>
                Mean
                <input name="mean" type="number" step="any" value="70" />
              </label>
              <label>
                Standard deviation
                <input name="standardDeviation" type="number" min="0.000001" step="any" value="12" />
              </label>
            </div>

            <div id="synthetic-values-fields" class="synthetic-kind-fields" hidden>
              <label class="wide-label">
                Values and weights
                <input name="values" placeholder="low:1, medium:3, high:1" />
                <small>Use value:weight pairs. Weight must be greater than zero.</small>
              </label>
            </div>

            <div id="synthetic-boolean-fields" class="synthetic-kind-fields" hidden>
              <label>
                True rate
                <input name="trueRate" type="number" min="0" max="1" step="0.01" value="0.5" />
              </label>
            </div>

            <div id="synthetic-text-fields" class="synthetic-kind-fields" hidden>
              <label class="wide-label">
                Generated text
                <input name="textValue" placeholder="Optional fixed synthetic text" />
              </label>
            </div>

            <button class="secondary compact" type="submit">Add metric to specification</button>
          </form>
        </article>

        <aside class="panel generator-preview">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Review before generation</p>
              <h2>Exact specification</h2>
            </div>
          </div>
          <p>
            This is the machine-readable input ClassGraph will use. The same seed and specification
            reproduce the same student values.
          </p>
          <pre id="synthetic-preview"></pre>
          <button id="generate-structured-class" class="primary" type="button">
            Generate synthetic class
          </button>
        </aside>
      </section>
    </main>
  `

  bindSyntheticBuilder()
  refreshSyntheticPreview()
}

function renderSyntheticDraftMetric(metric: SyntheticDraftMetric, index: number): string {
  let description = ''

  switch (metric.kind) {
    case 'number':
      description =
        metric.distribution === 'normal'
          ? `normal · mean ${metric.mean} · SD ${metric.standardDeviation} · ${metric.min}–${metric.max}`
          : `uniform · ${metric.min}–${metric.max}`
      break
    case 'category':
    case 'ordinal':
      description = metric.values.map((item) => `${item.value}×${item.weight}`).join(', ')
      break
    case 'boolean':
      description = `true rate ${metric.trueRate}`
      break
    case 'text':
      description = metric.value ? `fixed text: ${metric.value}` : 'empty text'
      break
  }

  return `
    <div class="draft-metric">
      <div>
        <b>${escapeHtml(metric.label)}</b>
        <span>${escapeHtml(metric.key)} · ${escapeHtml(metric.kind)}</span>
        <small>${escapeHtml(description)} · missing rate ${metric.missingRate}</small>
      </div>
      <button
        type="button"
        class="icon-button danger-text"
        data-remove-synthetic-metric="${index}"
        title="Remove synthetic metric"
      >×</button>
    </div>
  `
}

function bindSyntheticBuilder(): void {
  document.querySelector<HTMLButtonElement>('#back-to-setup')?.addEventListener('click', () => {
    renderSetup()
  })

  const title = document.querySelector<HTMLInputElement>('#synthetic-title')
  const count = document.querySelector<HTMLInputElement>('#synthetic-count')
  const seed = document.querySelector<HTMLInputElement>('#synthetic-seed')

  const syncBase = () => {
    syntheticDraftTitle = title?.value.trim() || 'Synthetic Class'
    syntheticDraftStudentCount = Number(count?.value ?? 36)
    syntheticDraftSeed = seed?.value.trim() || 'classgraph-demo'
    refreshSyntheticPreview()
  }

  title?.addEventListener('input', syncBase)
  count?.addEventListener('input', syncBase)
  seed?.addEventListener('input', syncBase)

  const kindSelect = document.querySelector<HTMLSelectElement>('#synthetic-kind')
  kindSelect?.addEventListener('change', () => {
    updateSyntheticFieldVisibility(kindSelect.value as MetricKind)
  })
  updateSyntheticFieldVisibility((kindSelect?.value as MetricKind | undefined) ?? 'number')

  document
    .querySelector<HTMLFormElement>('#add-synthetic-metric')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      try {
        const metric = syntheticDraftMetricFromForm(new FormData(form))
        if (syntheticDraftMetrics.some((item) => item.key === metric.key)) {
          throw new Error(`Metric key already exists: ${metric.key}`)
        }
        syntheticDraftMetrics.push(metric)
        renderSyntheticBuilder()
      } catch (error) {
        showStatus(error instanceof Error ? error.message : 'Could not add synthetic metric.')
      }
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-remove-synthetic-metric]',
  )) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeSyntheticMetric)
      if (!Number.isInteger(index)) return
      syntheticDraftMetrics.splice(index, 1)
      renderSyntheticBuilder()
    })
  }

  document
    .querySelector<HTMLButtonElement>('#generate-structured-class')
    ?.addEventListener('click', () => {
      void generateStructuredClass()
    })
}

function updateSyntheticFieldVisibility(kind: MetricKind): void {
  const numberFields = document.querySelector<HTMLElement>('#synthetic-number-fields')
  const valueFields = document.querySelector<HTMLElement>('#synthetic-values-fields')
  const booleanFields = document.querySelector<HTMLElement>('#synthetic-boolean-fields')
  const textFields = document.querySelector<HTMLElement>('#synthetic-text-fields')

  if (numberFields) numberFields.hidden = kind !== 'number'
  if (valueFields) valueFields.hidden = kind !== 'category' && kind !== 'ordinal'
  if (booleanFields) booleanFields.hidden = kind !== 'boolean'
  if (textFields) textFields.hidden = kind !== 'text'
}

function syntheticDraftMetricFromForm(data: FormData): SyntheticDraftMetric {
  const key = asString(data, 'key')
  const label = asString(data, 'label')
  const kind = asString(data, 'kind') as MetricKind
  const missingRate = Number(asString(data, 'missingRate') || '0')

  if (!key || !/^[a-z0-9][a-z0-9._-]*$/i.test(key)) {
    throw new Error('Metric key must use letters, numbers, dots, underscores, or hyphens.')
  }
  if (!label) throw new Error('Metric label is required.')
  if (!Number.isFinite(missingRate) || missingRate < 0 || missingRate > 1) {
    throw new Error('Missing rate must be between 0 and 1.')
  }

  if (kind === 'number') {
    const distribution = asString(data, 'distribution') as 'normal' | 'uniform'
    const min = Number(asString(data, 'min'))
    const max = Number(asString(data, 'max'))
    const mean = Number(asString(data, 'mean'))
    const standardDeviation = Number(asString(data, 'standardDeviation'))

    if (![min, max, mean, standardDeviation].every(Number.isFinite)) {
      throw new Error('Numeric generator settings must be valid numbers.')
    }
    if (min > max) throw new Error('Minimum cannot be greater than maximum.')
    if (distribution === 'normal' && standardDeviation <= 0) {
      throw new Error('Standard deviation must be greater than zero.')
    }

    return {
      key,
      label,
      kind,
      missingRate,
      distribution,
      min,
      max,
      mean,
      standardDeviation,
    }
  }

  if (kind === 'category' || kind === 'ordinal') {
    const values = parseWeightedValues(asString(data, 'values'))
    return { key, label, kind, missingRate, values }
  }

  if (kind === 'boolean') {
    const trueRate = Number(asString(data, 'trueRate'))
    if (!Number.isFinite(trueRate) || trueRate < 0 || trueRate > 1) {
      throw new Error('True rate must be between 0 and 1.')
    }
    return { key, label, kind, missingRate, trueRate }
  }

  return {
    key,
    label,
    kind: 'text',
    missingRate,
    value: asString(data, 'textValue'),
  }
}

function parseWeightedValues(input: string): Array<{ value: string; weight: number }> {
  const values = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.lastIndexOf(':')
      const value = separator >= 0 ? part.slice(0, separator).trim() : part
      const weightText = separator >= 0 ? part.slice(separator + 1).trim() : '1'
      const weight = Number(weightText)
      if (!value || !Number.isFinite(weight) || weight <= 0) {
        throw new Error('Values must use value:weight pairs with positive weights.')
      }
      return { value, weight }
    })

  if (values.length === 0) {
    throw new Error('Category and ordinal metrics require at least one value.')
  }

  return values
}

function buildSyntheticSpecification(): Record<string, unknown> {
  if (!syntheticDraftProjectId) syntheticDraftProjectId = projectId()
  if (
    !Number.isInteger(syntheticDraftStudentCount) ||
    syntheticDraftStudentCount < 1 ||
    syntheticDraftStudentCount > 500
  ) {
    throw new Error('Student count must be an integer from 1 to 500.')
  }
  if (!syntheticDraftTitle.trim()) throw new Error('Class name is required.')
  if (!syntheticDraftSeed.trim()) throw new Error('Seed is required.')

  const metricDefinitions = syntheticDraftMetrics.map((metric) => {
    if (metric.kind === 'number') {
      return {
        key: metric.key,
        label: metric.label,
        kind: metric.kind,
        numberScale: { min: metric.min, max: metric.max },
      }
    }
    if (metric.kind === 'category') {
      return {
        key: metric.key,
        label: metric.label,
        kind: metric.kind,
        categories: metric.values.map((item) => item.value),
      }
    }
    if (metric.kind === 'ordinal') {
      return {
        key: metric.key,
        label: metric.label,
        kind: metric.kind,
        ordinalScale: metric.values.map((item) => item.value),
      }
    }
    return { key: metric.key, label: metric.label, kind: metric.kind }
  })

  const metrics = syntheticDraftMetrics.map((metric) => {
    switch (metric.kind) {
      case 'number': {
        const distribution =
          metric.distribution === 'uniform'
            ? {
                type: 'uniform' as const,
                min: metric.min,
                max: metric.max,
              }
            : {
                type: 'normal' as const,
                mean: metric.mean,
                standardDeviation: metric.standardDeviation,
                min: metric.min,
                max: metric.max,
              }
        return {
          key: metric.key,
          kind: metric.kind,
          distribution,
          missingRate: metric.missingRate,
        }
      }
      case 'category':
      case 'ordinal':
        return {
          key: metric.key,
          kind: metric.kind,
          values: metric.values,
          missingRate: metric.missingRate,
        }
      case 'boolean':
        return {
          key: metric.key,
          kind: metric.kind,
          trueRate: metric.trueRate,
          missingRate: metric.missingRate,
        }
      case 'text':
        return {
          key: metric.key,
          kind: metric.kind,
          value: metric.value,
          missingRate: metric.missingRate,
        }
    }
  })

  return {
    projectId: syntheticDraftProjectId,
    title: syntheticDraftTitle,
    studentCount: syntheticDraftStudentCount,
    seed: syntheticDraftSeed,
    metricDefinitions,
    metrics,
  }
}

function refreshSyntheticPreview(): void {
  const preview = document.querySelector<HTMLElement>('#synthetic-preview')
  if (!preview) return

  try {
    preview.textContent = JSON.stringify(buildSyntheticSpecification(), null, 2)
  } catch (error) {
    preview.textContent = error instanceof Error ? error.message : 'Specification is incomplete.'
  }
}

async function generateStructuredClass(): Promise<void> {
  clearStatus()

  try {
    const specification = buildSyntheticSpecification()
    const response = await postJson<ProjectResponse>('/api/synthetic/generate', specification)
    openProject(response.project)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not generate the synthetic class.')
  }
}

function openProject(nextProject: ClassGraphProject): void {
  project = nextProject
  activeView = 'overview'
  selectedProvenanceStudentId = null
  assistanceRequestView = null
  assistanceProposalView = null
  assistanceStatusView = null
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
          <button data-view="relationships">Relationships</button>
          <button data-view="seating">Seating</button>
          <button data-view="assistance">Assistance</button>
          <button data-view="reports">Reports</button>
          <button data-view="assistance">Assistance</button>
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

        <div id="status" class="status" role="status" aria-live="polite" hidden></div>
        <section id="workspace-content"></section>
      </main>
    </div>
  `

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.classList.toggle('active', button.dataset.view === activeView)
    button.addEventListener('click', () => {
      const nextView = button.dataset.view
      if (
        nextView === 'overview' ||
        nextView === 'students' ||
        nextView === 'graphs' ||
        nextView === 'relationships' ||
        nextView === 'seating' ||
        nextView === 'assistance' ||
        nextView === 'reports'
      ) {
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
    resetAssistanceWorkspace()
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
    void renderOverview(content)
    return
  }

  if (activeView === 'students') {
    renderStudents(content)
    return
  }

  if (activeView === 'relationships') {
    renderRelationships(content)
    return
  }

  if (activeView === 'seating') {
    renderSeating(content)
    return
  }

  if (activeView === 'assistance') {
    void renderAssistance(content)
    return
  }

  if (activeView === 'reports') {
    renderReports(content)
    return
  }

  if (activeView === 'assistance') {
    void renderAssistance(content)
    return
  }

  renderGraphs(content)
}

function resetAssistanceWorkspace(): void {
  assistanceTask = 'analysis-explanation'
  assistanceMode = 'offline'
  assistancePrompt = ''
  assistancePreview = null
  assistanceProposalText = ''
  assistanceAccepted = null
  assistanceSelectedIndexes = ''
}

function assistanceTaskLabel(task: AssistanceTask): string {
  switch (task) {
    case 'synthetic-spec-draft':
      return 'Draft synthetic specification'
    case 'analysis-explanation':
      return 'Explain descriptive analysis'
    case 'report-wording-draft':
      return 'Draft report wording'
    case 'planning-rule-suggestions':
      return 'Suggest planning rules'
  }
}

function assistanceTaskHelp(task: AssistanceTask): string {
  switch (task) {
    case 'synthetic-spec-draft':
      return 'Describe a synthetic class. ClassGraph returns an editable specification only; generation is a separate explicit action.'
    case 'analysis-explanation':
      return 'Draft plain-language wording from existing descriptive summaries. Missing-data and non-causation caveats stay visible.'
    case 'report-wording-draft':
      return 'Draft wording from the canonical report snapshot without adding prose to project data.'
    case 'planning-rule-suggestions':
      return 'Suggest soft rules only from explicit relationship records. Nothing is inferred from names, notes, or metrics.'
  }
}

function assistanceSuggestionCount(value: unknown): number {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 0
  const suggestions = (value as Record<string, unknown>).suggestions
  return Array.isArray(suggestions) ? suggestions.length : 0
}

function assistanceDisclosureHtml(request: AssistanceRequestView | null): string {
  if (!request) {
    return `
      <div class="assistance-empty">
        <p>Preview context before running network assistance. Previewing is local and does not contact the configured provider.</p>
      </div>
    `
  }

  const disclosure = request.disclosure
  const flags = [
    disclosure.containsStudentLevelData
      ? 'student-level data'
      : 'aggregate / non-student-level context',
    disclosure.containsStudentIds ? 'student IDs' : 'no student IDs',
    disclosure.containsDisplayNames ? 'display names' : 'no display names',
    disclosure.containsFreeText ? 'free text' : 'no free text',
  ]

  const items = disclosure.items
    .map(
      (item) => `
        <details class="assistance-context-item">
          <summary>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.scope)}</span>
          </summary>
          <pre>${escapeHtml(JSON.stringify(item.content, null, 2))}</pre>
        </details>
      `,
    )
    .join('')

  return `
    <div class="assistance-disclosure-summary">
      <div>
        <span class="schema-badge">${escapeHtml(disclosure.mode)}</span>
        ${
          disclosure.providerLabel
            ? `<span class="schema-badge">${escapeHtml(disclosure.providerLabel)}</span>`
            : ''
        }
      </div>
      <p>${flags.map(escapeHtml).join(' · ')}</p>
      ${
        disclosure.requiresExplicitSend
          ? '<p><strong>Explicit send required.</strong> ClassGraph will not contact the provider until you confirm the send action.</p>'
          : '<p>Offline mode keeps this context on this device.</p>'
      }
    </div>
    <div class="assistance-context-list">
      ${items || '<p class="muted">No context items are required for this task.</p>'}
    </div>
  `
}

function assistanceAcceptedHtml(): string {
  if (assistanceAccepted === null) return ''

  const action =
    assistanceTask === 'synthetic-spec-draft'
      ? '<button id="generate-accepted-synthetic" class="primary" type="button">Generate accepted synthetic class</button>'
      : assistanceTask === 'planning-rule-suggestions'
        ? '<button id="apply-accepted-planning" class="primary" type="button">Apply accepted planning rules</button>'
        : ''

  return `
    <article class="panel assistance-accepted">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Accepted, not yet applied</p>
          <h2>Explicit action boundary</h2>
        </div>
      </div>
      <p>
        Acceptance validates the edited proposal. The project remains unchanged until you use the action below.
      </p>
      <pre>${escapeHtml(JSON.stringify(assistanceAccepted, null, 2))}</pre>
      <div class="assistance-actions">${action}</div>
    </article>
  `
}

async function renderAssistance(content: HTMLElement): Promise<void> {
  if (!project) return
  const sourceProject = project
  content.innerHTML = `
    <article class="panel analysis-loading">
      <p class="eyebrow">Assistance</p>
      <h2>Checking local assistance status…</h2>
    </article>
  `

  try {
    const status = await getJson<AssistanceStatusView>('/api/assistance/status')
    if (project !== sourceProject || activeView !== 'assistance') return
    if (!status.network.enabled && assistanceMode === 'network') assistanceMode = 'offline'
    renderAssistanceWorkspace(content, status)
  } catch (error) {
    if (project !== sourceProject || activeView !== 'assistance') return
    content.innerHTML = `
      <article class="panel empty-state">
        <p class="eyebrow">Assistance unavailable</p>
        <h2>The core ClassGraph workspace is still available</h2>
        <p>${escapeHtml(error instanceof Error ? error.message : 'Could not read assistance status.')}</p>
      </article>
    `
  }
}

function renderAssistanceWorkspace(content: HTMLElement, status: AssistanceStatusView): void {
  const networkText = status.network.enabled
    ? `${status.network.label ?? 'Configured provider'}${status.network.endpointHost ? ` · ${status.network.endpointHost}` : ''}`
    : 'Not configured — network assistance is off'

  const networkConfirmation =
    assistanceMode === 'network'
      ? `
        <label class="assistance-confirm">
          <input id="assistance-confirm-send" type="checkbox" />
          I reviewed the context above and explicitly approve sending it for this request.
        </label>
      `
      : ''

  const proposalPanel = assistanceProposalText
    ? `
      <article class="panel assistance-proposal">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Editable proposal</p>
            <h2>Review before accepting or copying</h2>
          </div>
          <span class="schema-badge">proposal only</span>
        </div>
        <p>
          This JSON is temporary workspace state. Editing it does not change the ClassGraph project.
        </p>
        <label>
          Proposal JSON
          <textarea id="assistance-proposal-editor" rows="20" spellcheck="false">${escapeHtml(assistanceProposalText)}</textarea>
        </label>
        ${
          assistanceTask === 'planning-rule-suggestions'
            ? `
              <label>
                Suggestion indexes to accept
                <input id="assistance-selected-indexes" value="${escapeHtml(assistanceSelectedIndexes)}" placeholder="0,1" />
                <small>Only these validated suggestions can cross the acceptance boundary.</small>
              </label>
            `
            : ''
        }
        <div class="assistance-actions">
          <button id="copy-assistance-proposal" class="secondary" type="button">Copy edited proposal</button>
          ${
            assistanceTask === 'synthetic-spec-draft'
              ? '<button id="accept-synthetic-proposal" class="primary" type="button">Accept specification</button>'
              : assistanceTask === 'planning-rule-suggestions'
                ? '<button id="accept-planning-proposal" class="primary" type="button">Accept selected rules</button>'
                : ''
          }
        </div>
      </article>
    `
    : ''

  content.innerHTML = `
    <div class="assistance-stack">
      <div class="metric-cards assistance-status-cards">
        <article class="metric-card">
          <span>Offline assistance</span>
          <strong>${status.offlineAvailable ? 'Ready' : 'Off'}</strong>
          <small>Deterministic local drafts</small>
        </article>
        <article class="metric-card">
          <span>Network provider</span>
          <strong>${status.network.enabled ? 'Configured' : 'Off'}</strong>
          <small>${escapeHtml(networkText)}</small>
        </article>
        <article class="metric-card">
          <span>Project mutation</span>
          <strong>Manual</strong>
          <small>Drafts never apply themselves</small>
        </article>
      </div>

      <div class="content-grid assistance-grid">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Teacher-controlled assistance</p>
              <h2>Draft, inspect, then decide</h2>
            </div>
            <span class="schema-badge">Phase 5</span>
          </div>

          <div class="stack-form">
            <label>
              Task
              <select id="assistance-task">
                ${(
                  [
                    'analysis-explanation',
                    'report-wording-draft',
                    'synthetic-spec-draft',
                    'planning-rule-suggestions',
                  ] as AssistanceTask[]
                )
                  .map(
                    (task) =>
                      `<option value="${task}" ${task === assistanceTask ? 'selected' : ''}>${escapeHtml(assistanceTaskLabel(task))}</option>`,
                  )
                  .join('')}
              </select>
            </label>

            <p class="assistance-help">${escapeHtml(assistanceTaskHelp(assistanceTask))}</p>

            <label>
              Optional teacher instruction
              <textarea id="assistance-prompt" rows="5" placeholder="For synthetic drafting, describe only the fields and distributions you want.">${escapeHtml(assistancePrompt)}</textarea>
            </label>

            <label>
              Execution mode
              <select id="assistance-mode">
                <option value="offline" ${assistanceMode === 'offline' ? 'selected' : ''}>Offline — no network</option>
                <option value="network" ${assistanceMode === 'network' ? 'selected' : ''} ${status.network.enabled ? '' : 'disabled'}>Network — configured provider</option>
              </select>
            </label>

            <div class="assistance-actions">
              <button id="preview-assistance-context" class="secondary" type="button">Preview exact context</button>
              <button
                id="run-assistance"
                class="primary"
                type="button"
                ${assistanceMode === 'network' && !assistancePreview ? 'disabled' : ''}
              >
                ${assistanceMode === 'network' ? 'Send context and draft' : 'Run local draft'}
              </button>
            </div>
            ${networkConfirmation}
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Disclosure preview</p>
              <h2>Exactly what is in context</h2>
            </div>
          </div>
          ${assistanceDisclosureHtml(assistancePreview)}
        </article>
      </div>

      ${proposalPanel}
      ${assistanceAcceptedHtml()}

      <article class="panel quiet">
        <p class="eyebrow">Safety boundary</p>
        <h2>Core ClassGraph does not depend on assistance</h2>
        <p>
          Assistance is optional. Offline analysis, planning, exports, synthetic generation and project editing continue to work when no provider is configured. Provider credentials come from the process environment and are never stored in project JSON.
        </p>
      </article>
    </div>
  `

  document
    .querySelector<HTMLSelectElement>('#assistance-task')
    ?.addEventListener('change', (event) => {
      assistanceTask = (event.currentTarget as HTMLSelectElement).value as AssistanceTask
      assistancePreview = null
      assistanceProposalText = ''
      assistanceAccepted = null
      assistanceSelectedIndexes = ''
      void renderAssistance(content)
    })

  document
    .querySelector<HTMLTextAreaElement>('#assistance-prompt')
    ?.addEventListener('input', (event) => {
      assistancePrompt = (event.currentTarget as HTMLTextAreaElement).value
      assistancePreview = null
    })

  document
    .querySelector<HTMLSelectElement>('#assistance-mode')
    ?.addEventListener('change', (event) => {
      assistanceMode = (event.currentTarget as HTMLSelectElement).value as AssistanceMode
      assistancePreview = null
      assistanceProposalText = ''
      assistanceAccepted = null
      void renderAssistance(content)
    })

  document
    .querySelector<HTMLButtonElement>('#preview-assistance-context')
    ?.addEventListener('click', () => {
      void previewAssistanceContext()
    })
  document.querySelector<HTMLButtonElement>('#run-assistance')?.addEventListener('click', () => {
    void runAssistanceDraft()
  })
  document
    .querySelector<HTMLTextAreaElement>('#assistance-proposal-editor')
    ?.addEventListener('input', (event) => {
      assistanceProposalText = (event.currentTarget as HTMLTextAreaElement).value
      assistanceAccepted = null
    })
  document
    .querySelector<HTMLInputElement>('#assistance-selected-indexes')
    ?.addEventListener('input', (event) => {
      assistanceSelectedIndexes = (event.currentTarget as HTMLInputElement).value
      assistanceAccepted = null
    })
  document
    .querySelector<HTMLButtonElement>('#copy-assistance-proposal')
    ?.addEventListener('click', () => {
      void copyAssistanceProposal()
    })
  document
    .querySelector<HTMLButtonElement>('#accept-synthetic-proposal')
    ?.addEventListener('click', () => {
      void acceptSyntheticProposal()
    })
  document
    .querySelector<HTMLButtonElement>('#accept-planning-proposal')
    ?.addEventListener('click', () => {
      void acceptPlanningProposal()
    })
  document
    .querySelector<HTMLButtonElement>('#generate-accepted-synthetic')
    ?.addEventListener('click', () => {
      void generateAcceptedSynthetic()
    })
  document
    .querySelector<HTMLButtonElement>('#apply-accepted-planning')
    ?.addEventListener('click', () => {
      void applyAcceptedPlanning()
    })
}

async function previewAssistanceContext(): Promise<void> {
  if (!project) return
  clearStatus()

  try {
    const response = await postJson<{ request: AssistanceRequestView }>('/api/assistance/preview', {
      project,
      task: assistanceTask,
      mode: assistanceMode,
      prompt: assistancePrompt || undefined,
    })
    assistancePreview = response.request
    assistanceProposalText = ''
    assistanceAccepted = null
    const content = document.querySelector<HTMLElement>('#workspace-content')
    if (content) await renderAssistance(content)
    showStatus('Context preview refreshed. Nothing was sent to a provider.', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not preview assistance context.')
  }
}

async function runAssistanceDraft(): Promise<void> {
  if (!project) return
  clearStatus()

  if (assistanceMode === 'network' && !assistancePreview) {
    showStatus('Preview the exact context before using network assistance.')
    return
  }

  const confirmSend =
    assistanceMode === 'network'
      ? (document.querySelector<HTMLInputElement>('#assistance-confirm-send')?.checked ?? false)
      : false

  if (assistanceMode === 'network' && !confirmSend) {
    showStatus('Explicit confirmation is required before sending context to the provider.')
    return
  }

  try {
    const response = await postJson<AssistanceRunResponseView>('/api/assistance/run', {
      project,
      task: assistanceTask,
      mode: assistanceMode,
      prompt: assistancePrompt || undefined,
      requestId: assistancePreview?.requestId,
      confirmSend,
    })
    assistancePreview = response.request
    assistanceProposalText = JSON.stringify(response.proposal, null, 2)
    assistanceAccepted = null
    const count = assistanceSuggestionCount(response.proposal)
    assistanceSelectedIndexes = Array.from({ length: count }, (_, index) => index).join(',')
    const content = document.querySelector<HTMLElement>('#workspace-content')
    if (content) await renderAssistance(content)
    showStatus(
      'Proposal created. Review or edit it before any acceptance or copy action.',
      'success',
    )
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not create assistance proposal.')
  }
}

function editedAssistanceProposal(): unknown {
  const editor = document.querySelector<HTMLTextAreaElement>('#assistance-proposal-editor')
  const text = editor?.value ?? assistanceProposalText
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Proposal JSON is not valid. Fix the edit before accepting it.')
  }
}

async function copyAssistanceProposal(): Promise<void> {
  const editor = document.querySelector<HTMLTextAreaElement>('#assistance-proposal-editor')
  const text = editor?.value ?? assistanceProposalText
  if (!text) {
    showStatus('There is no proposal to copy.')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    showStatus('Edited proposal copied. The project was not changed.', 'success')
  } catch {
    showStatus(
      'The browser could not copy the proposal. Select the proposal text and copy it manually.',
    )
  }
}

async function acceptSyntheticProposal(): Promise<void> {
  clearStatus()
  try {
    const proposal = editedAssistanceProposal()
    const response = await postJson<{ specification: unknown }>(
      '/api/assistance/accept-synthetic',
      {
        proposal,
      },
    )
    assistanceAccepted = response.specification
    const content = document.querySelector<HTMLElement>('#workspace-content')
    if (content) await renderAssistance(content)
    showStatus(
      'Specification accepted. Generation still requires the separate button below.',
      'success',
    )
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not accept the synthetic proposal.')
  }
}

function planningIndexesFromEditor(): number[] {
  const source =
    document.querySelector<HTMLInputElement>('#assistance-selected-indexes')?.value ??
    assistanceSelectedIndexes
  if (!source.trim()) return []
  const values = source.split(',').map((part) => Number(part.trim()))
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Planning suggestion indexes must be comma-separated non-negative integers.')
  }
  return [...new Set(values)]
}

async function acceptPlanningProposal(): Promise<void> {
  clearStatus()
  try {
    const proposal = editedAssistanceProposal()
    const selectedIndexes = planningIndexesFromEditor()
    const response = await postJson<{ accepted: unknown[] }>('/api/assistance/accept-planning', {
      proposal,
      selectedIndexes,
    })
    assistanceAccepted = response.accepted
    const content = document.querySelector<HTMLElement>('#workspace-content')
    if (content) await renderAssistance(content)
    showStatus('Selected rules accepted. Applying them is still a separate action.', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not accept planning suggestions.')
  }
}

async function generateAcceptedSynthetic(): Promise<void> {
  if (assistanceAccepted === null) return
  clearStatus()

  try {
    const response = await postJson<ProjectResponse>('/api/synthetic/generate', assistanceAccepted)
    openProject(response.project)
    showStatus('Accepted synthetic specification generated as a new project.', 'success')
  } catch (error) {
    showStatus(
      error instanceof Error ? error.message : 'Could not generate the accepted specification.',
    )
  }
}

async function applyAcceptedPlanning(): Promise<void> {
  if (!project || !Array.isArray(assistanceAccepted)) return
  clearStatus()

  try {
    let nextProject = project
    for (const rule of assistanceAccepted) {
      const response = await postJson<ProjectResponse>('/api/project/mutate', {
        project: nextProject,
        command: { type: 'add-planning-rule', rule },
      })
      nextProject = response.project
    }
    project = nextProject
    assistanceAccepted = null
    assistancePreview = null
    assistanceProposalText = ''
    renderWorkspace()
    showStatus('Accepted planning rules were applied explicitly.', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not apply accepted planning rules.')
  }
}

function formatNumber(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

function completenessPercent(completeness: ProjectAnalysis['completeness']): string {
  if (completeness.totalCells === 0) return '—'
  return `${Math.round((completeness.recordedCount / completeness.totalCells) * 100)}%`
}

async function loadOverviewAnalysis(): Promise<ProjectAnalysis> {
  if (!project) throw new Error('No ClassGraph project is open.')
  const response = await postJson<{ analysis: ProjectAnalysis }>('/api/analysis/project', {
    project,
  })
  return response.analysis
}

async function renderOverview(content: HTMLElement): Promise<void> {
  if (!project) return
  const sourceProject = project
  content.innerHTML = `
    <article class="panel analysis-loading">
      <p class="eyebrow">Overview</p>
      <h2>Calculating descriptive summaries…</h2>
    </article>
  `

  try {
    const analysis = await loadOverviewAnalysis()
    if (project !== sourceProject || activeView !== 'overview') return

    const provenanceKinds = Object.values(project.provenance).reduce<Record<string, number>>(
      (counts, entry) => {
        counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
        return counts
      },
      {},
    )

    const metricRows = analysis.metrics
      .map((metric) => {
        const summary = metric.summary
        const detail =
          metric.kind === 'number'
            ? `median ${formatNumber(metric.summary.median)} · mean ${formatNumber(metric.summary.mean)}`
            : `${Object.keys(metric.summary.counts).length} recorded categories/values`
        return `
          <tr>
            <td><strong>${escapeHtml(metric.label)}</strong><small>${escapeHtml(metric.key)}</small></td>
            <td>${summary.recordedCount}</td>
            <td>${summary.missingCount}</td>
            <td>${escapeHtml(detail)}</td>
          </tr>
        `
      })
      .join('')

    content.innerHTML = `
      <div class="metric-cards overview-cards">
        <article class="metric-card">
          <span>Students</span>
          <strong>${analysis.studentCount}</strong>
          <small>Current roster size</small>
        </article>
        <article class="metric-card">
          <span>Recorded cells</span>
          <strong>${analysis.completeness.recordedCount}</strong>
          <small>${completenessPercent(analysis.completeness)} of defined metric cells</small>
        </article>
        <article class="metric-card">
          <span>Explicit missing</span>
          <strong>${analysis.completeness.explicitMissingCount}</strong>
          <small>Deliberately stored as missing</small>
        </article>
        <article class="metric-card">
          <span>Unrecorded</span>
          <strong>${analysis.completeness.unrecordedCount}</strong>
          <small>No value stored</small>
        </article>
      </div>

      <div class="content-grid analysis-overview-grid">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Metric overview</p>
              <h2>Descriptive only</h2>
            </div>
            <span class="schema-badge">Exchange ${escapeHtml(project.schemaVersion)}</span>
          </div>
          <p>
            These summaries describe recorded project data. Missing values are not replaced with
            zero, averages, or inferred values.
          </p>
          <div class="data-table-wrap">
            <table class="source-table metric-summary-table">
              <thead>
                <tr><th>Metric</th><th>Recorded</th><th>Missing / unrecorded</th><th>Summary</th></tr>
              </thead>
              <tbody>
                ${metricRows || '<tr><td colspan="4" class="empty-cell">Add a metric to begin descriptive analysis.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel quiet">
          <p class="eyebrow">Provenance</p>
          <h2>Source remains visible</h2>
          <p>
            Manual edits, imported fields, derived values and synthetic data remain distinguishable.
            Open Students → Sources to inspect field-level provenance.
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
      </div>
    `
  } catch (error) {
    if (project !== sourceProject || activeView !== 'overview') return
    content.innerHTML = `
      <article class="panel empty-state">
        <p class="eyebrow">Overview unavailable</p>
        <h2>ClassGraph could not build the descriptive summary</h2>
        <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown analysis error.')}</p>
      </article>
    `
  }
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

  const rows = project.students.map((student, index) => renderStudentRow(student, index)).join('')

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
    return renderSelectMetricCell(student, definition, state, value)
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

  const index = project.students.findIndex((student) => student.id === selectedProvenanceStudentId)
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
  document
    .querySelector<HTMLFormElement>('#add-student-form')
    ?.addEventListener('submit', (event) => {
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

  document
    .querySelector<HTMLFormElement>('#add-metric-form')
    ?.addEventListener('submit', (event) => {
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

async function saveInputMetric(studentId: string, definition: MetricDefinition): Promise<void> {
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

function studentLabel(studentId: string): string {
  const student = project?.students.find((item) => item.id === studentId)
  return student?.displayName ?? studentId
}

function roomCapacityClient(room: RoomRecord | undefined): number {
  return room?.seats.filter((seat) => seat.enabled).length ?? 0
}

function assignmentForStudent(studentId: string): PlanningSeatAssignment | undefined {
  return project?.planning?.assignments?.find((item) => item.studentId === studentId)
}

function assignmentForSeat(seatId: string): PlanningSeatAssignment | undefined {
  return project?.planning?.assignments?.find((item) => item.seatId === seatId)
}

function renderSeating(content: HTMLElement): void {
  if (!project) return
  const current = project
  const room = current.room
  const capacity = roomCapacityClient(room)
  const shortfall = current.students.length - capacity
  const seed = current.planning?.seed ?? 'classgraph-seating'

  content.innerHTML = `
    <div class="phase2-stack">
      <article class="panel room-editor-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Room</p>
            <h2>Classroom grid</h2>
          </div>
          <span class="schema-badge">${capacity} enabled seats</span>
        </div>

        <form id="room-form" class="phase2-form-grid">
          <label>
            Rows
            <input name="rows" type="number" min="1" max="1000" value="${room?.rows ?? 5}" required />
          </label>
          <label>
            Columns
            <input name="columns" type="number" min="1" max="1000" value="${room?.columns ?? 8}" required />
          </label>
          <label>
            Front of room
            <select name="front">
              ${['top', 'bottom', 'left', 'right']
                .map((value) =>
                  optionHtml(
                    value,
                    value[0]!.toUpperCase() + value.slice(1),
                    (room?.front ?? 'top') === value,
                  ),
                )
                .join('')}
            </select>
          </label>
          <button class="primary compact" type="submit">${room ? 'Update room' : 'Create room'}</button>
        </form>

        ${shortfall > 0 ? `<p class="capacity-warning">Enabled capacity is ${capacity} for ${current.students.length} students. Add/enable at least ${shortfall} more seat(s) before generating a complete seating plan.</p>` : ''}

        ${room ? renderRoomGrid(room) : '<div class="empty-analysis"><p>Create a room grid to begin seating.</p></div>'}
      </article>

      ${room ? renderSeatTable(room) : ''}
      ${room ? renderManualAssignments() : ''}
      ${room ? renderRuleEditor() : ''}
      ${room ? renderSeatingGenerator(seed) : ''}
      ${renderGroupingGenerator(seed)}
    </div>
  `

  bindSeatingEvents()
}

function renderRoomGrid(room: RoomRecord): string {
  if (room.layout !== 'grid' || !room.columns) {
    return '<div class="empty-analysis"><p>Custom room editing is not part of Phase 2 yet.</p></div>'
  }

  const seatCards = room.seats
    .map((seat) => {
      const assignment = assignmentForSeat(seat.id)
      const label = assignment ? studentLabel(assignment.studentId) : 'Empty'
      return `
        <button
          class="seat-card ${seat.enabled ? '' : 'disabled'} ${assignment ? 'occupied' : ''}"
          type="button"
          data-toggle-seat="${escapeHtml(seat.id)}"
          data-seat-drop="${escapeHtml(seat.id)}"
          ${assignment ? `draggable="true" data-drag-student="${escapeHtml(assignment.studentId)}"` : ''}
          title="${seat.enabled ? 'Disable seat' : 'Enable seat'}"
        >
          <b>${escapeHtml(label)}</b>
          <span>R${(seat.row ?? 0) + 1} · C${(seat.column ?? 0) + 1}</span>
          <small>${seat.tags?.length ? escapeHtml(seat.tags.join(', ')) : seat.enabled ? 'Enabled' : 'Disabled'}</small>
        </button>
      `
    })
    .join('')

  return `
    <div class="room-stage front-${escapeHtml(room.front ?? 'top')}">
      <div class="front-marker">Front of room</div>
      <div class="seat-grid" style="grid-template-columns: repeat(${room.columns}, minmax(72px, 1fr))">
        ${seatCards}
      </div>
    </div>
  `
}

function renderSeatTable(room: RoomRecord): string {
  const rows = room.seats
    .map(
      (seat) => `
        <tr>
          <td><code>${escapeHtml(seat.id)}</code></td>
          <td>R${(seat.row ?? 0) + 1} / C${(seat.column ?? 0) + 1}</td>
          <td>${seat.enabled ? 'Enabled' : 'Disabled'}</td>
          <td>
            <div class="inline-editor">
              <input data-seat-tags="${escapeHtml(seat.id)}" value="${escapeHtml((seat.tags ?? []).join(', '))}" placeholder="front, aisle" />
              <button class="ghost compact" type="button" data-save-seat-tags="${escapeHtml(seat.id)}">Save</button>
            </div>
          </td>
          <td>
            <button class="secondary compact" type="button" data-seat-enabled="${escapeHtml(seat.id)}" data-next-enabled="${seat.enabled ? 'false' : 'true'}">
              ${seat.enabled ? 'Disable' : 'Enable'}
            </button>
          </td>
        </tr>
      `,
    )
    .join('')

  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Table equivalent</p><h2>Seat geometry</h2></div>
      </div>
      <div class="data-table-wrap">
        <table class="source-table">
          <thead><tr><th>Seat</th><th>Position</th><th>Status</th><th>Tags</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `
}

function renderManualAssignments(): string {
  if (!project) return ''
  const enabledSeats = project.room?.seats.filter((seat) => seat.enabled) ?? []
  const rows = project.students
    .map((student) => {
      const assignment = assignmentForStudent(student.id)
      const occupiedByOthers = new Set(
        (project?.planning?.assignments ?? [])
          .filter((item) => item.studentId !== student.id)
          .map((item) => item.seatId),
      )
      const options = [
        '<option value="">Unassigned</option>',
        ...enabledSeats
          .filter((seat) => !occupiedByOthers.has(seat.id))
          .map((seat) =>
            optionHtml(
              seat.id,
              `R${(seat.row ?? 0) + 1} C${(seat.column ?? 0) + 1}${seat.tags?.length ? ` · ${seat.tags.join('/')}` : ''}`,
              assignment?.seatId === seat.id,
            ),
          ),
      ].join('')

      return `
        <tr>
          <td>${escapeHtml(student.displayName ?? student.id)}</td>
          <td><select data-assignment-seat="${escapeHtml(student.id)}">${options}</select></td>
          <td>
            <label class="lock-toggle">
              <input type="checkbox" data-assignment-lock="${escapeHtml(student.id)}" ${assignment?.locked ? 'checked' : ''} ${assignment ? '' : 'disabled'} />
              Locked
            </label>
          </td>
        </tr>
      `
    })
    .join('')

  const assigned = project.planning?.assignments?.length ?? 0
  const assignedIds = new Set((project.planning?.assignments ?? []).map((item) => item.studentId))
  const unassigned = project.students.filter((student) => !assignedIds.has(student.id))
  const unassignedHtml = unassigned.length
    ? `<div class="unassigned-strip">${unassigned
        .map(
          (student) =>
            `<span class="student-drag-chip" draggable="true" data-drag-student="${escapeHtml(student.id)}">${escapeHtml(student.displayName ?? student.id)}</span>`,
        )
        .join('')}</div>`
    : '<p class="muted">All students are assigned.</p>'

  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Manual seating</p><h2>Assignments and locks</h2></div>
        <span class="schema-badge">${assigned}/${project.students.length} assigned</span>
      </div>
      <p>Manual assignments are teacher decisions. Drag a student onto an enabled seat or use the table. Lock any assignment that candidate generation must preserve.</p>
      ${unassignedHtml}
      <div class="data-table-wrap">
        <table class="source-table">
          <thead><tr><th>Student</th><th>Seat</th><th>Lock</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="empty-cell">No students in the roster.</td></tr>'}</tbody>
        </table>
      </div>
    </article>
  `
}

function ruleDescription(rule: PlanningRule): string {
  switch (rule.kind) {
    case 'fixed-seat':
      return `${studentLabel(rule.studentId)} fixed to ${rule.seatId}`
    case 'keep-apart':
      return `${studentLabel(rule.studentAId)} apart from ${studentLabel(rule.studentBId)} (${rule.neighbourMode ?? 'orthogonal'})`
    case 'seat-tag-required':
      return `${studentLabel(rule.studentId)} requires tag "${rule.tag}"`
    case 'prefer-together':
      return `Prefer ${studentLabel(rule.studentAId)} near ${studentLabel(rule.studentBId)}`
    case 'prefer-apart':
      return `Prefer ${studentLabel(rule.studentAId)} away from ${studentLabel(rule.studentBId)}`
    case 'prefer-seat-tag':
      return `Prefer ${studentLabel(rule.studentId)} in tag "${rule.tag}"`
    case 'balance-metric-by-row':
      return `Balance ${rule.metricKey} across rows`
  }
}

function renderRuleEditor(): string {
  if (!project) return ''
  const rules = project.planning?.rules ?? []
  const studentOptions = project.students
    .map(
      (student) =>
        `<option value="${escapeHtml(student.id)}">${escapeHtml(student.displayName ?? student.id)}</option>`,
    )
    .join('')
  const seatOptions = (project.room?.seats ?? [])
    .filter((seat) => seat.enabled)
    .map((seat) => `<option value="${escapeHtml(seat.id)}">${escapeHtml(seat.id)}</option>`)
    .join('')
  const metricOptions = project.metricDefinitions
    .filter((metric) => metric.kind === 'number' || metric.kind === 'ordinal')
    .map(
      (metric) => `<option value="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</option>`,
    )
    .join('')

  const ruleRows = rules
    .map(
      (rule) => `
        <tr>
          <td><span class="rule-strength ${rule.strength}">${rule.strength}</span></td>
          <td><code>${escapeHtml(rule.kind)}</code></td>
          <td>${escapeHtml(ruleDescription(rule))}</td>
          <td>${rule.strength === 'soft' ? String(rule.weight ?? 1) : '—'}</td>
          <td><button class="icon-button danger-text" type="button" data-remove-rule="${escapeHtml(rule.id)}">×</button></td>
        </tr>
      `,
    )
    .join('')

  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Planning rules</p><h2>Hard constraints and soft objectives</h2></div>
        <span class="schema-badge">${rules.length} rules</span>
      </div>
      <p>Hard constraints determine feasibility. Soft objectives may trade off; their penalties remain visible.</p>
      <form id="planning-rule-form" class="rule-form">
        <label>
          Rule
          <select name="kind">
            <option value="fixed-seat">Hard · fixed seat</option>
            <option value="keep-apart">Hard · keep apart</option>
            <option value="seat-tag-required">Hard · seat tag required</option>
            <option value="prefer-together">Soft · prefer together</option>
            <option value="prefer-apart">Soft · prefer apart</option>
            <option value="prefer-seat-tag">Soft · prefer seat tag</option>
            <option value="balance-metric-by-row">Soft · balance metric by row</option>
          </select>
        </label>
        <label>Student A<select name="studentAId">${studentOptions}</select></label>
        <label>Student B<select name="studentBId">${studentOptions}</select></label>
        <label>Seat<select name="seatId">${seatOptions}</select></label>
        <label>Tag<input name="tag" placeholder="front" /></label>
        <label>Metric<select name="metricKey"><option value="">—</option>${metricOptions}</select></label>
        <label>Weight<input name="weight" type="number" min="0.01" step="0.25" value="1" /></label>
        <label>Neighbour<select name="neighbourMode"><option value="orthogonal">Orthogonal</option><option value="king">Including diagonal</option></select></label>
        <button class="secondary compact" type="submit">Add rule</button>
      </form>
      <div class="data-table-wrap">
        <table class="source-table">
          <thead><tr><th>Strength</th><th>Rule</th><th>Meaning</th><th>Weight</th><th></th></tr></thead>
          <tbody>${ruleRows || '<tr><td colspan="5" class="empty-cell">No planning rules yet.</td></tr>'}</tbody>
        </table>
      </div>
    </article>
  `
}

function renderSeatingGenerator(seed: string): string {
  const result = seatingGeneration
  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Candidate seating</p><h2>Generate and compare three plans</h2></div>
      </div>
      <form id="seating-generator-form" class="candidate-controls">
        <label>Seed<input name="seed" value="${escapeHtml(seed)}" required /></label>
        <button class="primary compact" type="submit">Generate candidates</button>
      </form>
      ${result ? renderSeatingGeneration(result) : '<p class="muted">Generate candidates to compare hard-constraint status and objective-by-objective penalties.</p>'}
    </article>
  `
}

function renderSeatingGeneration(result: SeatingGenerationView): string {
  if (!result.candidates.length) {
    return `
      <div class="infeasible-panel">
        <h3>No feasible candidate produced</h3>
        <ul>${result.infeasibleReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
        <p>ClassGraph does not silently violate hard constraints. Change the room, locks, or hard rules and rerun.</p>
      </div>
    `
  }

  return `
    <div class="candidate-grid">
      ${result.candidates.map(renderSeatingCandidate).join('')}
    </div>
  `
}

function renderSeatingCandidate(candidate: SeatingCandidateView): string {
  const hardResults = candidate.hardConstraintResults
    .map(
      (item) => `
        <tr><td>${escapeHtml(item.kind)}</td><td>${item.satisfied ? 'Satisfied' : 'Violated'}</td><td>${escapeHtml(item.message)}</td></tr>
      `,
    )
    .join('')
  const objectives = candidate.objectiveResults
    .map(
      (item) => `
        <tr><td>${escapeHtml(item.kind)}</td><td>${numberLabel(item.penalty)}</td><td>${escapeHtml(item.details)}</td></tr>
      `,
    )
    .join('')
  const assignments = candidate.assignments
    .map(
      (item) => `
        <tr><td>${escapeHtml(studentLabel(item.studentId))}</td><td>${escapeHtml(item.seatId)}</td><td>${item.locked ? 'Locked' : ''}</td></tr>
      `,
    )
    .join('')

  return `
    <section class="candidate-card">
      <div class="candidate-heading">
        <div><b>${escapeHtml(candidate.id)}</b><small>Seed ${escapeHtml(candidate.seed)}</small></div>
        <span class="candidate-penalty">Penalty ${numberLabel(candidate.totalPenalty)}</span>
      </div>
      <ul class="candidate-explanation">${candidate.explanation.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      <details>
        <summary>Hard constraints</summary>
        <table class="mini-table"><thead><tr><th>Rule</th><th>Status</th><th>Detail</th></tr></thead><tbody>${hardResults || '<tr><td colspan="3">No hard constraints.</td></tr>'}</tbody></table>
      </details>
      <details>
        <summary>Objective components</summary>
        <table class="mini-table"><thead><tr><th>Objective</th><th>Penalty</th><th>Detail</th></tr></thead><tbody>${objectives || '<tr><td colspan="3">No soft objectives.</td></tr>'}</tbody></table>
      </details>
      <details>
        <summary>Assignments</summary>
        <table class="mini-table"><thead><tr><th>Student</th><th>Seat</th><th></th></tr></thead><tbody>${assignments}</tbody></table>
      </details>
      <button class="secondary compact" type="button" data-apply-seat-candidate="${escapeHtml(candidate.id)}">Apply candidate</button>
    </section>
  `
}

function renderGroupingGenerator(seed: string): string {
  if (!project) return ''
  const numericOptions = project.metricDefinitions
    .filter((metric) => metric.kind === 'number' || metric.kind === 'ordinal')
    .map(
      (metric) => `<option value="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</option>`,
    )
    .join('')

  return `
    <article class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Grouping</p><h2>Deterministic group candidates</h2></div>
      </div>
      <p>Optional metric balancing uses only the selected recorded field; missing values are ignored and reported.</p>
      <form id="grouping-generator-form" class="candidate-controls">
        <label>Groups<input name="groupCount" type="number" min="2" max="${Math.max(2, project.students.length)}" value="${Math.min(4, Math.max(2, project.students.length))}" /></label>
        <label>Balance metric<select name="metricKey"><option value="">None</option>${numericOptions}</select></label>
        <label>Seed<input name="seed" value="${escapeHtml(seed)}" required /></label>
        <button class="primary compact" type="submit">Generate groups</button>
      </form>
      ${groupingGeneration ? renderGroupingGeneration(groupingGeneration) : renderCurrentGroups()}
    </article>
  `
}

function renderCurrentGroups(): string {
  const groups = project?.planning?.groups ?? []
  if (!groups.length) return '<p class="muted">No saved groups yet.</p>'
  return `<div class="candidate-grid">${groups.map((group) => renderSavedGroup(group)).join('')}</div>`
}

function renderSavedGroup(group: PlanningGroup): string {
  return `
    <section class="candidate-card">
      <div class="candidate-heading"><b>${escapeHtml(group.label ?? group.id)}</b><span>${group.studentIds.length} students</span></div>
      <ul class="group-member-list">
        ${group.studentIds
          .map((studentId) => {
            const locked = group.lockedStudentIds?.includes(studentId) ?? false
            return `<li><span>${escapeHtml(studentLabel(studentId))}</span><label><input type="checkbox" data-group-lock="${escapeHtml(group.id)}:${escapeHtml(studentId)}" ${locked ? 'checked' : ''}/> lock</label></li>`
          })
          .join('')}
      </ul>
    </section>
  `
}

function renderGroupingGeneration(result: GroupingGenerationView): string {
  return `
    <div class="candidate-grid">
      ${result.candidates
        .map(
          (candidate) => `
            <section class="candidate-card">
              <div class="candidate-heading"><div><b>${escapeHtml(candidate.id)}</b><small>Penalty ${numberLabel(candidate.totalPenalty)}</small></div></div>
              <ul class="candidate-explanation">${candidate.explanation.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
              <div class="group-columns">
                ${candidate.groups
                  .map(
                    (group) => `
                      <div class="group-column">
                        <b>${escapeHtml(group.label ?? group.id)}</b>
                        <ul>${group.studentIds.map((id) => `<li>${escapeHtml(studentLabel(id))}${group.lockedStudentIds?.includes(id) ? ' · locked' : ''}</li>`).join('')}</ul>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
              <details>
                <summary>Group assignment table</summary>
                <table class="mini-table">
                  <thead><tr><th>Group</th><th>Student</th><th>Lock</th></tr></thead>
                  <tbody>${candidate.groups
                    .flatMap((group) =>
                      group.studentIds.map(
                        (id) =>
                          `<tr><td>${escapeHtml(group.label ?? group.id)}</td><td>${escapeHtml(studentLabel(id))}</td><td>${group.lockedStudentIds?.includes(id) ? 'Locked' : ''}</td></tr>`,
                      ),
                    )
                    .join('')}</tbody>
                </table>
              </details>
              <button class="secondary compact" type="button" data-apply-group-candidate="${escapeHtml(candidate.id)}">Apply groups</button>
            </section>
          `,
        )
        .join('')}
    </div>
  `
}

function newRuleId(): string {
  if (typeof crypto.randomUUID === 'function') return `rule-${crypto.randomUUID()}`
  return `rule-${Date.now()}`
}

function planningRuleFromForm(data: FormData): PlanningRule | null {
  const kind = asString(data, 'kind')
  const studentAId = asString(data, 'studentAId')
  const studentBId = asString(data, 'studentBId')
  const seatId = asString(data, 'seatId')
  const tag = asString(data, 'tag')
  const metricKey = asString(data, 'metricKey')
  const weight = Number(asString(data, 'weight') || '1')
  const id = newRuleId()

  if (kind === 'fixed-seat') return { id, strength: 'hard', kind, studentId: studentAId, seatId }
  if (kind === 'keep-apart') {
    return {
      id,
      strength: 'hard',
      kind,
      studentAId,
      studentBId,
      neighbourMode: asString(data, 'neighbourMode') === 'king' ? 'king' : 'orthogonal',
    }
  }
  if (kind === 'seat-tag-required') {
    if (!tag) {
      showStatus('Enter a seat tag for this hard rule.')
      return null
    }
    return { id, strength: 'hard', kind, studentId: studentAId, tag }
  }
  if (kind === 'prefer-together' || kind === 'prefer-apart') {
    return { id, strength: 'soft', kind, studentAId, studentBId, weight }
  }
  if (kind === 'prefer-seat-tag') {
    if (!tag) {
      showStatus('Enter a seat tag for this objective.')
      return null
    }
    return { id, strength: 'soft', kind, studentId: studentAId, tag, weight }
  }
  if (kind === 'balance-metric-by-row') {
    if (!metricKey) {
      showStatus('Choose a numeric or ordinal metric to balance.')
      return null
    }
    return { id, strength: 'soft', kind, metricKey, weight }
  }
  return null
}

function bindSeatingEvents(): void {
  for (const draggable of document.querySelectorAll<HTMLElement>('[data-drag-student]')) {
    draggable.addEventListener('dragstart', (event) => {
      const studentId = draggable.dataset.dragStudent
      if (studentId) event.dataTransfer?.setData('text/plain', studentId)
    })
  }

  for (const target of document.querySelectorAll<HTMLElement>('[data-seat-drop]')) {
    target.addEventListener('dragover', (event) => {
      const seatId = target.dataset.seatDrop
      const seat = project?.room?.seats.find((item) => item.id === seatId)
      if (seat?.enabled && !assignmentForSeat(seat.id)) event.preventDefault()
    })
    target.addEventListener('drop', (event) => {
      event.preventDefault()
      const seatId = target.dataset.seatDrop
      const studentId = event.dataTransfer?.getData('text/plain')
      if (!seatId || !studentId) return
      const occupant = assignmentForSeat(seatId)
      if (occupant && occupant.studentId !== studentId) {
        showStatus('That seat is already occupied.')
        return
      }
      const locked = assignmentForStudent(studentId)?.locked ?? false
      void mutateProject({ type: 'set-seat-assignment', studentId, seatId, locked })
    })
  }

  document.querySelector<HTMLFormElement>('#room-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    void mutateProject({
      type: 'set-grid-room',
      rows: Number(asString(data, 'rows')),
      columns: Number(asString(data, 'columns')),
      front: asString(data, 'front'),
    })
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-toggle-seat]')) {
    button.addEventListener('click', () => {
      const seatId = button.dataset.toggleSeat
      const seat = project?.room?.seats.find((item) => item.id === seatId)
      if (!seatId || !seat) return
      if (seat.enabled && assignmentForSeat(seatId)) {
        showStatus('Unassign the student before disabling this seat.')
        return
      }
      void mutateProject({ type: 'set-seat-enabled', seatId, enabled: !seat.enabled })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-seat-enabled]')) {
    button.addEventListener('click', () => {
      const seatId = button.dataset.seatEnabled
      if (!seatId) return
      const enabled = button.dataset.nextEnabled === 'true'
      if (!enabled && assignmentForSeat(seatId)) {
        showStatus('Unassign the student before disabling this seat.')
        return
      }
      void mutateProject({ type: 'set-seat-enabled', seatId, enabled })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-seat-tags]')) {
    button.addEventListener('click', () => {
      const seatId = button.dataset.saveSeatTags
      if (!seatId) return
      const input = document.querySelector<HTMLInputElement>(
        `[data-seat-tags="${CSS.escape(seatId)}"]`,
      )
      const tags = (input?.value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      void mutateProject({ type: 'set-seat-tags', seatId, tags })
    })
  }

  for (const select of document.querySelectorAll<HTMLSelectElement>('[data-assignment-seat]')) {
    select.addEventListener('change', () => {
      const studentId = select.dataset.assignmentSeat
      if (!studentId) return
      if (!select.value) {
        void mutateProject({ type: 'unassign-student', studentId })
        return
      }
      const locked = assignmentForStudent(studentId)?.locked ?? false
      void mutateProject({ type: 'set-seat-assignment', studentId, seatId: select.value, locked })
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('[data-assignment-lock]')) {
    input.addEventListener('change', () => {
      const studentId = input.dataset.assignmentLock
      if (!studentId) return
      void mutateProject({ type: 'set-assignment-locked', studentId, locked: input.checked })
    })
  }

  document
    .querySelector<HTMLFormElement>('#planning-rule-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const rule = planningRuleFromForm(new FormData(event.currentTarget as HTMLFormElement))
      if (rule) void mutateProject({ type: 'add-planning-rule', rule })
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-rule]')) {
    button.addEventListener('click', () => {
      const ruleId = button.dataset.removeRule
      if (ruleId) void mutateProject({ type: 'remove-planning-rule', ruleId })
    })
  }

  document
    .querySelector<HTMLFormElement>('#seating-generator-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      void generateSeating(new FormData(event.currentTarget as HTMLFormElement))
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-apply-seat-candidate]',
  )) {
    button.addEventListener('click', () => {
      const candidate = seatingGeneration?.candidates.find(
        (item) => item.id === button.dataset.applySeatCandidate,
      )
      if (!candidate) return
      void mutateProject({
        type: 'replace-seat-assignments',
        assignments: candidate.assignments,
        source: 'accepted-seating-candidate',
      })
    })
  }

  document
    .querySelector<HTMLFormElement>('#grouping-generator-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      void generateGrouping(new FormData(event.currentTarget as HTMLFormElement))
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-apply-group-candidate]',
  )) {
    button.addEventListener('click', () => {
      const candidate = groupingGeneration?.candidates.find(
        (item) => item.id === button.dataset.applyGroupCandidate,
      )
      if (!candidate) return
      void mutateProject({
        type: 'replace-planning-groups',
        groups: candidate.groups,
        source: 'accepted-grouping-candidate',
      })
    })
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('[data-group-lock]')) {
    input.addEventListener('change', () => {
      const target = input.dataset.groupLock
      if (!target) return
      const separator = target.indexOf(':')
      if (separator < 1) return
      void mutateProject({
        type: 'set-group-student-locked',
        groupId: target.slice(0, separator),
        studentId: target.slice(separator + 1),
        locked: input.checked,
      })
    })
  }
}

async function generateSeating(data: FormData): Promise<void> {
  if (!project) return
  clearStatus()
  try {
    const seed = asString(data, 'seed')
    const response = await postJson<{ result: SeatingGenerationView }>('/api/planning/seating', {
      project,
      seed,
      candidateCount: 3,
      attempts: 750,
    })
    seatingGeneration = response.result
    groupingGeneration = null
    renderWorkspace()
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not generate seating candidates.')
  }
}

async function generateGrouping(data: FormData): Promise<void> {
  if (!project) return
  clearStatus()
  try {
    const metricKey = asString(data, 'metricKey')
    const response = await postJson<{ result: GroupingGenerationView }>('/api/planning/grouping', {
      project,
      groupCount: Number(asString(data, 'groupCount')),
      seed: asString(data, 'seed'),
      ...(metricKey ? { metricKey } : {}),
      candidateCount: 3,
      attempts: 400,
    })
    groupingGeneration = response.result
    seatingGeneration = null
    renderWorkspace()
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not generate grouping candidates.')
  }
}

function reportDownloadName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return fallback
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(disposition)
  return quoted?.[1] ?? fallback
}

async function downloadReportExport(path: string, fallback: string): Promise<void> {
  if (!project) return
  clearStatus()

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
    if (!response.ok) throw await responseError(response)

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = reportDownloadName(response, fallback)
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    showStatus('Export created locally.', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not create the export.')
  }
}

function renderReports(content: HTMLElement): void {
  if (!project) return
  const assignmentCount = project.planning?.assignments?.length ?? 0
  const groupCount = project.planning?.groups?.length ?? 0
  const ruleCount = project.planning?.rules?.length ?? 0
  const hasSeatingPlan = Boolean(project.room && assignmentCount > 0)
  const syntheticCount = Object.values(project.provenance).filter(
    (entry) => entry.kind === 'synthetic',
  ).length
  const derivedCount = Object.values(project.provenance).filter(
    (entry) => entry.kind === 'derived',
  ).length

  content.innerHTML = `
    <div class="reports-stack">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Portable exports</p>
            <h2>Reports and hand-back files</h2>
          </div>
          <span class="schema-badge">Phase 3 · local only</span>
        </div>
        <p>
          Exports are generated on this device from the currently validated project. ClassGraph
          does not upload the class or keep a server-side copy of these files.
        </p>
        <div class="report-summary-grid">
          <div><b>${project.students.length}</b><span>students</span></div>
          <div><b>${assignmentCount}</b><span>approved seats</span></div>
          <div><b>${groupCount}</b><span>saved groups</span></div>
          <div><b>${ruleCount}</b><span>planning rules</span></div>
          <div><b>${syntheticCount}</b><span>synthetic paths</span></div>
          <div><b>${derivedCount}</b><span>derived paths</span></div>
        </div>
      </article>

      <div class="report-card-grid">
        <article class="panel report-card">
          <p class="eyebrow">Machine-readable</p>
          <h2>Portable JSON</h2>
          <p>Versioned files for backup, analysis interchange, seating hand-off, and EduBoard mapping.</p>
          <div class="report-actions">
            <button class="secondary" type="button" data-report-export="/api/export/project-json" data-fallback="classgraph-project.json">Project JSON</button>
            <button class="secondary" type="button" data-report-export="/api/export/analysis-json" data-fallback="classgraph-analysis.json">Analysis JSON</button>
            <button class="secondary" type="button" data-report-export="/api/export/seating-json" data-fallback="classgraph-seating-plan.json" ${hasSeatingPlan ? '' : 'disabled'}>Seating Plan JSON</button>
            <button class="secondary" type="button" data-report-export="/api/export/eduboard-json" data-fallback="classgraph-eduboard-handback.json">EduBoard Hand-back JSON</button>
          </div>
          ${hasSeatingPlan ? '' : '<p class="report-note">Create a room and persist at least one seating assignment to enable seating-plan exports.</p>'}
        </article>

        <article class="panel report-card">
          <p class="eyebrow">Human-readable</p>
          <h2>DOCX and PDF</h2>
          <p>Descriptive reports include provenance, missing-data notes, current tables, approved planning, rules, and limitations.</p>
          <div class="report-actions">
            <button class="primary" type="button" data-report-export="/api/export/docx" data-fallback="classgraph-report.docx">DOCX Report</button>
            <button class="secondary" type="button" data-report-export="/api/export/pdf" data-fallback="classgraph-report.pdf">PDF Report</button>
            <button class="secondary" type="button" data-report-export="/api/export/seating-pdf" data-fallback="classgraph-seating-plan.pdf" ${hasSeatingPlan ? '' : 'disabled'}>Landscape Seating PDF</button>
          </div>
          <p class="report-note">
            DOCX supports Unicode names such as Chinese characters. The current lean PDF renderer
            uses a built-in Latin font and refuses unsupported Unicode with CG-5004 rather than
            replacing or corrupting text.
          </p>
        </article>
      </div>

      <article class="panel quiet">
        <p class="eyebrow">EduBoard hand-back</p>
        <h2>Explicit mapping, never silent overwrite</h2>
        <p>
          The hand-back file keeps source-safe values, derived analysis, synthetic paths, and
          teacher-approved planning in separate sections. EduBoard must still choose the target
          class explicitly and match students by exact ID before applying zero-based row/column
          seat coordinates.
        </p>
      </article>
    </div>
  `

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-report-export]')) {
    button.addEventListener('click', () => {
      const path = button.dataset.reportExport
      const fallback = button.dataset.fallback
      if (!path || !fallback) return
      void downloadReportExport(path, fallback)
    })
  }
}

function assistanceTaskLabel(task: AssistanceTaskView): string {
  switch (task) {
    case 'synthetic-spec-draft':
      return 'Draft synthetic specification'
    case 'analysis-explanation':
      return 'Explain descriptive analysis'
    case 'report-wording-draft':
      return 'Draft report wording'
    case 'planning-rule-suggestions':
      return 'Suggest planning rules'
  }
}

function assistanceRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return `assist-${crypto.randomUUID()}`
  return `assist-${Date.now()}`
}

function assistanceWarningList(title: string, items: string[]): string {
  if (items.length === 0) return ''
  return `
    <div class="assistance-note">
      <b>${escapeHtml(title)}</b>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
  `
}

function renderAssistanceDisclosure(request: AssistanceRequestView): string {
  const disclosure = request.disclosure
  const flags = [
    disclosure.containsStudentLevelData ? 'Student-level context' : 'No student-level context',
    disclosure.containsStudentIds ? 'Student IDs included' : 'No student IDs',
    disclosure.containsDisplayNames ? 'Display names included' : 'No display names',
    disclosure.containsFreeText ? 'Free text included' : 'No free text',
  ]

  const items = disclosure.items
    .map(
      (item) => `
        <details class="assistance-context-item">
          <summary>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.scope)}</span>
          </summary>
          <pre>${escapeHtml(JSON.stringify(item.content, null, 2))}</pre>
        </details>
      `,
    )
    .join('')

  return `
    <article class="panel assistance-disclosure">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">${disclosure.mode === 'network' ? 'Transmission preview' : 'Local context'}</p>
          <h2>${disclosure.mode === 'network' ? 'Exactly what would leave this device' : 'Context used by the offline draft'}</h2>
        </div>
        <span class="schema-badge">${escapeHtml(
          disclosure.mode === 'network'
            ? (disclosure.providerLabel ?? 'Network provider')
            : 'Offline · no send',
        )}</span>
      </div>
      <div class="assistance-flags">
        ${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join('')}
      </div>
      <div class="assistance-context-list">${items || '<p>No project context is included.</p>'}</div>
      ${
        disclosure.mode === 'network'
          ? `
            <label class="confirmation-row">
              <input id="assistance-confirm-send" type="checkbox" />
              I reviewed the context above and want to send it to
              ${escapeHtml(disclosure.providerLabel ?? 'the configured provider')}.
            </label>
            <button id="assistance-send-network" class="primary" type="button" disabled>
              Send to provider
            </button>
          `
          : ''
      }
    </article>
  `
}

function assistanceDraftText(proposal: AssistanceProposalView): string {
  if (proposal.task === 'synthetic-spec-draft') {
    return JSON.stringify(proposal.specification, null, 2)
  }
  if (proposal.task === 'analysis-explanation') {
    return [proposal.text, '', 'Caveats:', ...proposal.caveats.map((item) => `- ${item}`)].join(
      '\n',
    )
  }
  if (proposal.task === 'report-wording-draft') {
    return proposal.sections.map((section) => `${section.heading}\n${section.text}`).join('\n\n')
  }
  return JSON.stringify(proposal.suggestions, null, 2)
}

function renderAssistanceProposal(proposal: AssistanceProposalView): string {
  const provider = proposal.providerLabel
    ? ` · ${escapeHtml(proposal.providerLabel)}`
    : ' · offline'
  let body = ''

  if (proposal.task === 'planning-rule-suggestions') {
    const suggestions = proposal.suggestions
      .map(
        (suggestion, index) => `
          <label class="assistance-suggestion">
            <input type="checkbox" data-assistance-rule-index="${index}" checked />
            <span>
              <strong>${escapeHtml(suggestion.rule.strength)} · ${escapeHtml(suggestion.rule.kind)}</strong>
              <small>${escapeHtml(suggestion.rationale)}</small>
              <code>${escapeHtml(suggestion.inputPaths.join(', '))}</code>
            </span>
          </label>
        `,
      )
      .join('')

    body = `
      <div class="assistance-suggestions">
        ${suggestions || '<p>No planning-rule suggestions were produced.</p>'}
      </div>
      ${
        proposal.suggestions.length > 0
          ? '<button id="assistance-apply-rules" class="primary" type="button">Apply selected rules</button>'
          : ''
      }
    `
  } else {
    body = `
      <label class="wide-label">
        Editable draft
        <textarea id="assistance-draft-editor" class="assistance-editor" rows="16">${escapeHtml(
          assistanceDraftText(proposal),
        )}</textarea>
      </label>
      <div class="assistance-actions">
        <button id="assistance-copy-draft" class="secondary" type="button">Copy edited draft</button>
        ${
          proposal.task === 'synthetic-spec-draft'
            ? '<button id="assistance-validate-synthetic" class="secondary" type="button">Validate edited specification</button>'
            : ''
        }
      </div>
    `
  }

  return `
    <article class="panel assistance-proposal">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Proposal only</p>
          <h2>${escapeHtml(assistanceTaskLabel(proposal.task))}</h2>
        </div>
        <span class="schema-badge">proposal${provider}</span>
      </div>
      ${assistanceWarningList('Warnings', proposal.warnings)}
      ${assistanceWarningList('Assumptions', proposal.assumptions)}
      ${body}
    </article>
  `
}

async function copyAssistanceDraft(): Promise<void> {
  if (!assistanceProposalView) return
  const editor = document.querySelector<HTMLTextAreaElement>('#assistance-draft-editor')
  const text = editor?.value ?? assistanceDraftText(assistanceProposalView)
  try {
    await navigator.clipboard.writeText(text)
    showStatus('Assistance draft copied. No project data was changed.', 'success')
  } catch {
    showStatus('Could not access the clipboard. Select the draft text and copy it manually.')
  }
}

async function validateEditedSyntheticSpecification(): Promise<void> {
  if (assistanceProposalView?.task !== 'synthetic-spec-draft') return
  const editor = document.querySelector<HTMLTextAreaElement>('#assistance-draft-editor')
  if (!editor) return

  clearStatus()
  try {
    const specification = JSON.parse(editor.value) as unknown
    const result = await postJson<{ specification: unknown }>('/api/assistance/accept-synthetic', {
      proposal: { ...assistanceProposalView, specification },
    })
    editor.value = JSON.stringify(result.specification, null, 2)
    showStatus(
      'Edited synthetic specification is valid. It remains a draft and no students were generated.',
      'success',
    )
  } catch (error) {
    showStatus(
      error instanceof Error ? error.message : 'The edited synthetic specification is not valid.',
    )
  }
}

async function applyAssistanceRuleSuggestions(): Promise<void> {
  if (!project || assistanceProposalView?.task !== 'planning-rule-suggestions') return
  const selected = [...document.querySelectorAll<HTMLInputElement>('[data-assistance-rule-index]')]
    .filter((input) => input.checked)
    .map((input) => Number(input.dataset.assistanceRuleIndex))
    .filter((index) => Number.isInteger(index))

  if (selected.length === 0) {
    showStatus('Select at least one suggested rule before applying.')
    return
  }

  clearStatus()
  try {
    const acceptance = await postJson<{
      accepted: Array<{ rule: PlanningRule; rationale: string; inputPaths: string[] }>
    }>('/api/assistance/accept-planning', {
      proposal: assistanceProposalView,
      selectedIndexes: selected,
    })

    let nextProject = project
    for (const suggestion of acceptance.accepted) {
      const response = await postJson<ProjectResponse>('/api/project/mutate', {
        project: nextProject,
        command: { type: 'add-planning-rule', rule: suggestion.rule },
      })
      nextProject = response.project
    }
    project = nextProject
    assistanceProposalView = null
    assistanceRequestView = null
    seatingGeneration = null
    groupingGeneration = null
    renderWorkspace()
    showStatus(
      `Applied ${acceptance.accepted.length} explicitly selected planning rule(s).`,
      'success',
    )
  } catch (error) {
    showStatus(
      error instanceof Error ? error.message : 'Could not apply the selected rule suggestions.',
    )
  }
}

async function runAssistanceFromWorkspace(
  mode: 'offline' | 'network',
  confirmSend = false,
): Promise<void> {
  if (!project) return
  const sourceProject = project
  clearStatus()

  const taskSelect = document.querySelector<HTMLSelectElement>('#assistance-task')
  const promptInput = document.querySelector<HTMLTextAreaElement>('#assistance-prompt')
  if (taskSelect) assistanceSelectedTask = taskSelect.value as AssistanceTaskView
  if (promptInput) assistancePrompt = promptInput.value

  try {
    const result = await postJson<AssistanceRunResponseView>('/api/assistance/run', {
      project,
      task: assistanceSelectedTask,
      mode,
      prompt: assistancePrompt,
      requestId:
        mode === 'network' && assistanceRequestView?.disclosure.mode === 'network'
          ? assistanceRequestView.requestId
          : assistanceRequestId(),
      confirmSend,
    })
    if (project !== sourceProject || activeView !== 'assistance') return
    assistanceRequestView = result.request
    assistanceProposalView = result.proposal
    await renderAssistance(document.querySelector<HTMLElement>('#workspace-content')!)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not create the assistance draft.')
  }
}

async function previewNetworkAssistance(): Promise<void> {
  if (!project) return
  const sourceProject = project
  clearStatus()
  const taskSelect = document.querySelector<HTMLSelectElement>('#assistance-task')
  const promptInput = document.querySelector<HTMLTextAreaElement>('#assistance-prompt')
  if (taskSelect) assistanceSelectedTask = taskSelect.value as AssistanceTaskView
  if (promptInput) assistancePrompt = promptInput.value

  try {
    const result = await postJson<{ request: AssistanceRequestView }>('/api/assistance/preview', {
      project,
      task: assistanceSelectedTask,
      mode: 'network',
      prompt: assistancePrompt,
      requestId: assistanceRequestId(),
    })
    if (project !== sourceProject || activeView !== 'assistance') return
    assistanceRequestView = result.request
    assistanceProposalView = null
    await renderAssistance(document.querySelector<HTMLElement>('#workspace-content')!)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not build the network preview.')
  }
}

async function renderAssistance(content: HTMLElement): Promise<void> {
  if (!project) return
  const sourceProject = project

  if (!assistanceStatusView) {
    content.innerHTML = `
      <article class="panel analysis-loading">
        <p class="eyebrow">Optional assistance</p>
        <h2>Checking local assistance status…</h2>
      </article>
    `
    try {
      assistanceStatusView = await getJson<AssistanceStatusView>('/api/assistance/status')
    } catch (error) {
      if (project !== sourceProject || activeView !== 'assistance') return
      content.innerHTML = `
        <article class="panel">
          <p class="eyebrow">Optional assistance</p>
          <h2>Assistance status unavailable</h2>
          <p>${escapeHtml(error instanceof Error ? error.message : 'Could not read assistance status.')}</p>
        </article>
      `
      return
    }
  }

  if (project !== sourceProject || activeView !== 'assistance') return
  const status = assistanceStatusView
  const networkLabel = status.network.enabled
    ? `${status.network.label ?? 'Configured provider'}${status.network.endpointHost ? ` · ${status.network.endpointHost}` : ''}`
    : 'Not configured'

  content.innerHTML = `
    <div class="assistance-stack">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Phase 5 · optional assistance</p>
            <h2>Draft and explain without silent changes</h2>
          </div>
          <span class="schema-badge">Offline first</span>
        </div>
        <p>
          Assistance creates proposals only. Core ClassGraph remains available without a provider,
          and nothing is sent over the network until you preview the exact context and confirm a
          second send action.
        </p>
        <div class="assistance-status-grid">
          <div><b>Offline drafts</b><span>${status.offlineAvailable ? 'Available' : 'Unavailable'}</span></div>
          <div><b>Network provider</b><span>${escapeHtml(networkLabel)}</span></div>
        </div>
      </article>

      <article class="panel">
        <form id="assistance-form" class="stack-form">
          <div class="two-col">
            <label>
              Assistance task
              <select id="assistance-task" name="task">
                ${(
                  [
                    'synthetic-spec-draft',
                    'analysis-explanation',
                    'report-wording-draft',
                    'planning-rule-suggestions',
                  ] as AssistanceTaskView[]
                )
                  .map(
                    (task) =>
                      `<option value="${task}" ${task === assistanceSelectedTask ? 'selected' : ''}>${escapeHtml(
                        assistanceTaskLabel(task),
                      )}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>
              Execution
              <input value="Offline local draft by default" disabled />
            </label>
          </div>
          <label class="wide-label">
            Teacher prompt
            <textarea id="assistance-prompt" name="prompt" rows="5" placeholder="For synthetic drafting, use explicit clauses such as: 36 students; metric Assessment mean 70 sd 10 range 0-100 missing 5%">${escapeHtml(
              assistancePrompt,
            )}</textarea>
            <small>
              Analysis, report, and planning tasks use validated project context. Synthetic drafting
              treats this prompt only as editable draft intent.
            </small>
          </label>
          <div class="assistance-actions">
            <button class="primary" type="submit">Run offline draft</button>
            <button id="assistance-preview-network" class="secondary" type="button" ${
              status.network.enabled ? '' : 'disabled'
            }>
              Preview network context
            </button>
          </div>
        </form>
      </article>

      ${assistanceRequestView ? renderAssistanceDisclosure(assistanceRequestView) : ''}
      ${assistanceProposalView ? renderAssistanceProposal(assistanceProposalView) : ''}
    </div>
  `

  document
    .querySelector<HTMLFormElement>('#assistance-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      void runAssistanceFromWorkspace('offline')
    })

  document
    .querySelector<HTMLButtonElement>('#assistance-preview-network')
    ?.addEventListener('click', () => {
      void previewNetworkAssistance()
    })

  const confirmation = document.querySelector<HTMLInputElement>('#assistance-confirm-send')
  const sendButton = document.querySelector<HTMLButtonElement>('#assistance-send-network')
  confirmation?.addEventListener('change', () => {
    if (sendButton) sendButton.disabled = !confirmation.checked
  })
  sendButton?.addEventListener('click', () => {
    if (confirmation?.checked) void runAssistanceFromWorkspace('network', true)
  })

  document
    .querySelector<HTMLButtonElement>('#assistance-copy-draft')
    ?.addEventListener('click', () => {
      void copyAssistanceDraft()
    })
  document
    .querySelector<HTMLButtonElement>('#assistance-validate-synthetic')
    ?.addEventListener('click', () => {
      void validateEditedSyntheticSpecification()
    })
  document
    .querySelector<HTMLButtonElement>('#assistance-apply-rules')
    ?.addEventListener('click', () => {
      void applyAssistanceRuleSuggestions()
    })
}

function relationshipTypeOptions(selected?: RelationshipType): string {
  const types: Array<{ value: RelationshipType; label: string }> = [
    { value: 'works-well-with', label: 'Works well with' },
    { value: 'avoid-pairing', label: 'Avoid pairing' },
    { value: 'support-pair', label: 'Support pair' },
    { value: 'friendship', label: 'Friendship' },
    { value: 'custom', label: 'Custom' },
  ]

  return types.map((item) => optionHtml(item.value, item.label, item.value === selected)).join('')
}

function studentOptionLabel(student: StudentRecord): string {
  return student.displayName ? `${student.displayName} (${student.id})` : student.id
}

function relationshipRecordId(): string {
  if (typeof crypto.randomUUID === 'function') return `rel-${crypto.randomUUID()}`
  return `rel-${Date.now()}`
}

function relationshipProvenance(index: number): ProvenanceEntry | undefined {
  if (!project) return undefined
  const basePath = `/relationships/${index}`
  const direct = project.provenance[basePath]
  if (direct) return direct

  const nested = Object.entries(project.provenance)
    .filter(([path]) => path.startsWith(`${basePath}/`))
    .sort(([left], [right]) => left.localeCompare(right))[0]

  return nested?.[1]
}

function renderRelationshipSource(index: number): string {
  const provenance = relationshipProvenance(index)
  if (!provenance) return '<span class="muted">Not recorded</span>'

  const source = provenance.source ? ` · ${escapeHtml(provenance.source)}` : ''
  return `<span class="source-kind">${escapeHtml(provenance.kind)}</span><small>${source}</small>`
}

function renderRelationshipRows(): string {
  if (!project) return ''

  const relationships = (project.relationships ?? [])
    .map((relationship, index) => ({ relationship, index }))
    .filter(
      ({ relationship }) =>
        selectedRelationshipTypeFilter === 'all' ||
        relationship.type === selectedRelationshipTypeFilter,
    )

  if (relationships.length === 0) {
    return `
      <tr>
        <td colspan="8" class="empty-cell">
          ${
            selectedRelationshipTypeFilter === 'all'
              ? 'No explicit relationship records yet.'
              : 'No relationship records match this type.'
          }
        </td>
      </tr>
    `
  }

  return relationships
    .map(({ relationship, index }) => {
      const fromOptions = project!.students
        .map((student) =>
          optionHtml(
            student.id,
            studentOptionLabel(student),
            student.id === relationship.fromStudentId,
          ),
        )
        .join('')
      const toOptions = project!.students
        .map((student) =>
          optionHtml(
            student.id,
            studentOptionLabel(student),
            student.id === relationship.toStudentId,
          ),
        )
        .join('')

      return `
        <tr>
          <td class="id-cell"><code>${escapeHtml(relationship.id)}</code></td>
          <td>
            <select data-relationship-from="${escapeHtml(relationship.id)}">${fromOptions}</select>
          </td>
          <td>
            <select data-relationship-to="${escapeHtml(relationship.id)}">${toOptions}</select>
          </td>
          <td>
            <select data-relationship-type="${escapeHtml(relationship.id)}">
              ${relationshipTypeOptions(relationship.type)}
            </select>
            <input
              class="cell-input relationship-label-input"
              data-relationship-label="${escapeHtml(relationship.id)}"
              value="${escapeHtml(relationship.label ?? '')}"
              placeholder="Optional label"
            />
          </td>
          <td>
            <label class="lock-toggle">
              <input
                type="checkbox"
                data-relationship-directed="${escapeHtml(relationship.id)}"
                ${relationship.directed ? 'checked' : ''}
              />
              Directed
            </label>
          </td>
          <td>
            <input
              class="cell-input relationship-weight-input"
              type="number"
              step="any"
              data-relationship-weight="${escapeHtml(relationship.id)}"
              value="${relationship.weight === undefined ? '' : escapeHtml(String(relationship.weight))}"
              placeholder="—"
            />
          </td>
          <td class="relationship-source">${renderRelationshipSource(index)}</td>
          <td>
            <div class="relationship-actions">
              <button
                class="icon-button"
                type="button"
                data-save-relationship="${escapeHtml(relationship.id)}"
                title="Save relationship"
              >✓</button>
              <button
                class="icon-button danger-text"
                type="button"
                data-remove-relationship="${escapeHtml(relationship.id)}"
                title="Remove relationship"
              >×</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function formatSavedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function renderHistoryRecords(): string {
  const history = project?.planning?.history ?? []
  if (history.length === 0) {
    return '<p class="muted">No approved seating history has been recorded.</p>'
  }

  return history
    .map(
      (entry) => `
        <div class="snapshot-row">
          <div>
            <b>${escapeHtml(entry.label ?? 'Approved seating')}</b>
            <small>
              ${escapeHtml(formatSavedDate(entry.approvedAt))} ·
              ${escapeHtml(entry.neighbourMode)} neighbours ·
              ${entry.assignments.length} assignments
            </small>
          </div>
          <button
            class="icon-button danger-text"
            type="button"
            data-remove-history="${escapeHtml(entry.id)}"
            title="Remove history record"
          >×</button>
        </div>
      `,
    )
    .join('')
}

function renderScenarioRecords(): string {
  const scenarios = project?.planning?.scenarios ?? []
  if (scenarios.length === 0) return '<p class="muted">No saved planning scenarios yet.</p>'

  return scenarios
    .map(
      (scenario) => `
        <div class="snapshot-row">
          <div>
            <b>${escapeHtml(scenario.label)}</b>
            <small>
              ${escapeHtml(formatSavedDate(scenario.savedAt))} ·
              ${scenario.assignments.length} seats ·
              ${scenario.groups.length} groups ·
              ${scenario.rules.length} rules
            </small>
          </div>
          <button
            class="icon-button danger-text"
            type="button"
            data-remove-scenario="${escapeHtml(scenario.id)}"
            title="Remove planning scenario"
          >×</button>
        </div>
      `,
    )
    .join('')
}

function normalizeScenarioSelections(): void {
  const scenarios = project?.planning?.scenarios ?? []
  const ids = scenarios.map((scenario) => scenario.id)

  if (!selectedScenarioLeftId || !ids.includes(selectedScenarioLeftId)) {
    selectedScenarioLeftId = ids[0] ?? null
  }
  if (
    !selectedScenarioRightId ||
    !ids.includes(selectedScenarioRightId) ||
    selectedScenarioRightId === selectedScenarioLeftId
  ) {
    selectedScenarioRightId = ids.find((id) => id !== selectedScenarioLeftId) ?? null
  }
}

function renderRelationships(content: HTMLElement): void {
  if (!project) return
  normalizeScenarioSelections()

  const fromStudentOptions = project.students
    .map((student, index) => optionHtml(student.id, studentOptionLabel(student), index === 0))
    .join('')
  const toStudentOptions = project.students
    .map((student, index) => optionHtml(student.id, studentOptionLabel(student), index === 1))
    .join('')
  const canAdd = project.students.length >= 2

  content.innerHTML = `
    <div class="relationship-stack">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Explicit relationship records</p>
            <h2>Relationships</h2>
          </div>
          <span class="schema-badge">${project.relationships?.length ?? 0} edges</span>
        </div>
        <p>
          This workspace shows only relationships explicitly supplied by a teacher/import or clearly
          marked synthetic data. ClassGraph does not infer friendship, conflict, compatibility,
          social status, or peer influence from grades, participation, demographics, attendance,
          names, or seating history.
        </p>

        <form id="add-relationship-form" class="relationship-form">
          <label>
            From
            <select name="fromStudentId" ${canAdd ? '' : 'disabled'}>${fromStudentOptions}</select>
          </label>
          <label>
            To
            <select name="toStudentId" ${canAdd ? '' : 'disabled'}>${toStudentOptions}</select>
          </label>
          <label>
            Type
            <select name="type" ${canAdd ? '' : 'disabled'}>
              ${relationshipTypeOptions('works-well-with')}
            </select>
          </label>
          <label>
            Label
            <input name="label" placeholder="Optional" ${canAdd ? '' : 'disabled'} />
          </label>
          <label>
            Weight
            <input name="weight" type="number" step="any" placeholder="Optional" ${canAdd ? '' : 'disabled'} />
          </label>
          <label class="lock-toggle relationship-directed-control">
            <input name="directed" type="checkbox" ${canAdd ? '' : 'disabled'} />
            Directed
          </label>
          <button class="primary compact" type="submit" ${canAdd ? '' : 'disabled'}>
            Add relationship
          </button>
        </form>
        ${canAdd ? '' : '<p class="report-note">Add at least two students before recording a relationship.</p>'}
      </article>

      <article class="panel relationship-graph-panel">
        <div class="analysis-toolbar">
          <div>
            <p class="eyebrow">Deterministic network</p>
            <h2>Explicit edges only</h2>
          </div>
          <label class="compact-label">
            Focus student
            <select id="relationship-focus">
              ${optionHtml('', 'Whole class', selectedRelationshipFocusStudentId === null)}
              ${project.students
                .map((student) =>
                  optionHtml(
                    student.id,
                    studentOptionLabel(student),
                    student.id === selectedRelationshipFocusStudentId,
                  ),
                )
                .join('')}
            </select>
          </label>
        </div>
        <p>
          Node positions are deterministic. Focusing a student only rearranges the same explicit
          edges so direct recorded neighbours are easier to inspect; it does not infer new links.
        </p>
        <div id="relationship-graph-stage" class="relationship-graph-stage">
          <div class="empty-analysis">Building the explicit relationship graph…</div>
        </div>
      </article>

      <article class="panel">
        <div class="analysis-toolbar">
          <div>
            <p class="eyebrow">Accessible table</p>
            <h2>Recorded edges and sources</h2>
          </div>
          <label class="compact-label">
            Type filter
            <select id="relationship-type-filter">
              ${optionHtml('all', 'All types', selectedRelationshipTypeFilter === 'all')}
              ${relationshipTypeOptions(
                selectedRelationshipTypeFilter === 'all'
                  ? undefined
                  : selectedRelationshipTypeFilter,
              )}
            </select>
          </label>
        </div>
        <div class="data-table-wrap">
          <table class="data-table relationship-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>From</th>
                <th>To</th>
                <th>Type / label</th>
                <th>Direction</th>
                <th>Weight</th>
                <th>Provenance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${renderRelationshipRows()}
            </tbody>
          </table>
        </div>
        <p class="analysis-footnote">
          Undirected A↔B and B↔A records with the same relationship meaning are treated as duplicates.
          Directed A→B and B→A are distinct. Missing relationship records are never reconstructed.
        </p>
      </article>

      <div class="relationship-history-grid">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Approved seating history</p>
              <h2>Repeat-neighbour record</h2>
            </div>
            <span class="schema-badge">${project.planning?.history?.length ?? 0} snapshots</span>
          </div>
          <p>
            History is added only when you explicitly record the current persisted seating plan.
            Current candidates and missing past plans are never reconstructed.
          </p>
          <form id="record-history-form" class="snapshot-form">
            <label>
              Label
              <input name="label" placeholder="e.g. Week 4 approved plan" />
            </label>
            <label>
              Neighbour rule
              <select name="neighbourMode">
                <option value="orthogonal">Side-by-side only</option>
                <option value="king">Side or diagonal</option>
              </select>
            </label>
            <button
              class="secondary compact"
              type="submit"
              ${project.room && (project.planning?.assignments?.length ?? 0) > 0 ? '' : 'disabled'}
            >Record current seating</button>
          </form>
          ${renderHistoryRecords()}
          <div id="repeat-neighbour-stage" class="snapshot-analysis">
            <div class="empty-analysis">Reading stored seating history…</div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Saved planning scenarios</p>
              <h2>Before / after comparison</h2>
            </div>
            <span class="schema-badge">${project.planning?.scenarios?.length ?? 0} saved</span>
          </div>
          <p>
            A scenario snapshots the exact persisted room, seating, groups, rules and planning seed.
            It does not save transient generated candidates.
          </p>
          <form id="save-scenario-form" class="snapshot-form">
            <label>
              Scenario label
              <input name="label" required placeholder="e.g. Before museum project" />
            </label>
            <button class="secondary compact" type="submit">Save current planning</button>
          </form>
          ${renderScenarioRecords()}
          <div class="scenario-controls">
            <label>
              Before
              <select id="scenario-left" ${(project.planning?.scenarios?.length ?? 0) < 2 ? 'disabled' : ''}>
                ${(project.planning?.scenarios ?? [])
                  .map((scenario) =>
                    optionHtml(scenario.id, scenario.label, scenario.id === selectedScenarioLeftId),
                  )
                  .join('')}
              </select>
            </label>
            <label>
              After
              <select id="scenario-right" ${(project.planning?.scenarios?.length ?? 0) < 2 ? 'disabled' : ''}>
                ${(project.planning?.scenarios ?? [])
                  .map((scenario) =>
                    optionHtml(
                      scenario.id,
                      scenario.label,
                      scenario.id === selectedScenarioRightId,
                    ),
                  )
                  .join('')}
              </select>
            </label>
          </div>
          <div id="scenario-comparison-stage" class="snapshot-analysis">
            <div class="empty-analysis">
              ${
                (project.planning?.scenarios?.length ?? 0) >= 2
                  ? 'Comparing saved planning snapshots…'
                  : 'Save at least two planning scenarios to compare them.'
              }
            </div>
          </div>
        </article>
      </div>
    </div>
  `

  bindRelationshipEvents()
  void loadRelationshipGraph()
  void loadRepeatNeighbourHistory()
  void loadScenarioComparison()
}

function readRelationshipField<T extends HTMLInputElement | HTMLSelectElement>(
  selector: string,
  relationshipId: string,
): T | null {
  return document.querySelector<T>(`[${selector}="${CSS.escape(relationshipId)}"]`)
}

function relationshipGraphClass(type: RelationshipType): string {
  return `relationship-edge-${type}`
}

function renderRelationshipGraphSvg(graph: RelationshipGraphView): string {
  if (graph.nodes.length === 0) {
    return '<div class="empty-analysis">Add students to display the relationship graph.</div>'
  }

  const coordinates = new Map(
    graph.nodes.map((node) => [node.studentId, { x: node.x * 1000, y: node.y * 600 }]),
  )

  const edges = graph.edges
    .map((edge) => {
      const from = coordinates.get(edge.fromStudentId)
      const to = coordinates.get(edge.toStudentId)
      if (!from || !to) return ''
      const titleParts = [
        edge.label || edge.type,
        edge.directed ? 'directed' : 'undirected',
        edge.provenance?.kind ? `source: ${edge.provenance.kind}` : '',
      ].filter(Boolean)
      return `
        <line
          class="relationship-edge ${relationshipGraphClass(edge.type)}"
          x1="${from.x}"
          y1="${from.y}"
          x2="${to.x}"
          y2="${to.y}"
          ${edge.directed ? 'marker-end="url(#relationship-arrow)"' : ''}
        >
          <title>${escapeHtml(titleParts.join(' · '))}</title>
        </line>
      `
    })
    .join('')

  const nodes = graph.nodes
    .map((node) => {
      const x = node.x * 1000
      const y = node.y * 600
      const classes = [
        'relationship-node',
        node.focused ? 'focused' : '',
        node.connectedToFocus ? 'connected' : '',
      ]
        .filter(Boolean)
        .join(' ')
      return `
        <g class="${classes}" transform="translate(${x} ${y})">
          <circle r="${node.focused ? 29 : 23}"></circle>
          <text y="42" text-anchor="middle">${escapeHtml(node.label)}</text>
          <title>${escapeHtml(node.studentId)}</title>
        </g>
      `
    })
    .join('')

  return `
    <svg
      class="relationship-graph"
      viewBox="0 0 1000 600"
      role="img"
      aria-label="Explicit relationship network. A table equivalent appears below."
    >
      <defs>
        <marker
          id="relationship-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L7,3 z"></path>
        </marker>
      </defs>
      ${edges}
      ${nodes}
    </svg>
  `
}

async function loadRelationshipGraph(): Promise<void> {
  if (!project || activeView !== 'relationships') return
  const sourceProject = project
  const stage = document.querySelector<HTMLElement>('#relationship-graph-stage')
  if (!stage) return

  try {
    const response = await postJson<{ graph: RelationshipGraphView }>('/api/relationships/graph', {
      project,
      ...(selectedRelationshipFocusStudentId
        ? { focusStudentId: selectedRelationshipFocusStudentId }
        : {}),
    })
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = renderRelationshipGraphSvg(response.graph)
  } catch (error) {
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = `
      <div class="empty-analysis">
        ${escapeHtml(error instanceof Error ? error.message : 'Could not build the relationship graph.')}
      </div>
    `
  }
}

function studentDisplay(studentId: string): string {
  const student = project?.students.find((item) => item.id === studentId)
  return student?.displayName ? `${student.displayName} (${studentId})` : studentId
}

function renderRepeatNeighbourHistory(history: RepeatNeighbourHistoryView): string {
  const rows = history.pairs
    .map(
      (pair) => `
        <tr>
          <td>${escapeHtml(studentDisplay(pair.studentAId))}</td>
          <td>${escapeHtml(studentDisplay(pair.studentBId))}</td>
          <td>${pair.count}</td>
          <td>${pair.historyIds.length}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div class="snapshot-summary-grid">
      <div><b>${history.historyRecordCount}</b><span>stored snapshots</span></div>
      <div><b>${history.usableRecordCount}</b><span>grid snapshots analysed</span></div>
      <div><b>${history.pairs.length}</b><span>recorded neighbour pairs</span></div>
    </div>
    <div class="data-table-wrap">
      <table class="mini-table">
        <thead><tr><th>Student A</th><th>Student B</th><th>Times adjacent</th><th>Snapshots</th></tr></thead>
        <tbody>
          ${rows || '<tr><td colspan="4" class="empty-cell">No neighbour pairs exist in the stored approved history.</td></tr>'}
        </tbody>
      </table>
    </div>
    ${
      history.skippedRecordIds.length
        ? `<p class="report-note">Custom-layout history is preserved but not used for grid-neighbour counts: ${escapeHtml(history.skippedRecordIds.join(', '))}</p>`
        : ''
    }
  `
}

async function loadRepeatNeighbourHistory(): Promise<void> {
  if (!project || activeView !== 'relationships') return
  const sourceProject = project
  const stage = document.querySelector<HTMLElement>('#repeat-neighbour-stage')
  if (!stage) return

  try {
    const response = await postJson<{ history: RepeatNeighbourHistoryView }>(
      '/api/planning/history-analysis',
      { project },
    )
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = renderRepeatNeighbourHistory(response.history)
  } catch (error) {
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = `<div class="empty-analysis">${escapeHtml(
      error instanceof Error ? error.message : 'Could not analyse seating history.',
    )}</div>`
  }
}

function deltaLabel(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

function renderScenarioComparison(comparison: PlanningScenarioComparisonView): string {
  const planningRows = [
    {
      label: 'Persisted seat assignments',
      left: comparison.assignments.leftCount,
      right: comparison.assignments.rightCount,
      delta: comparison.assignments.rightCount - comparison.assignments.leftCount,
      detail: `${comparison.assignments.movedStudents.length} moved · ${comparison.assignments.addedStudents.length} added · ${comparison.assignments.removedStudents.length} removed`,
    },
    {
      label: 'Saved groups',
      left: comparison.groups.leftCount,
      right: comparison.groups.rightCount,
      delta: comparison.groups.rightCount - comparison.groups.leftCount,
      detail: `${comparison.groups.changedStudents.length} students changed group`,
    },
    {
      label: 'Planning rules',
      left: comparison.rules.leftCount,
      right: comparison.rules.rightCount,
      delta: comparison.rules.rightCount - comparison.rules.leftCount,
      detail: `${comparison.rules.addedRuleIds.length} added · ${comparison.rules.removedRuleIds.length} removed`,
    },
  ]

  const allRows = [
    ...planningRows,
    ...comparison.network.counts.map((item) => ({
      label: item.label,
      left: item.left,
      right: item.right,
      delta: item.delta,
      detail: 'Descriptive explicit-edge count',
    })),
  ]

  const rows = allRows
    .map(
      (row) => `
        <tr>
          <td><b>${escapeHtml(row.label)}</b><small>${escapeHtml(row.detail)}</small></td>
          <td>${row.left}</td>
          <td>${row.right}</td>
          <td>${escapeHtml(deltaLabel(row.delta))}</td>
        </tr>
      `,
    )
    .join('')

  const typeRows = comparison.network.byType
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${row.left}</td>
          <td>${row.right}</td>
          <td>${escapeHtml(deltaLabel(row.delta))}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <p class="report-note">
      Deltas are descriptive only. ClassGraph does not treat more or fewer relationship edges as
      educationally better. Network counts use the current explicit relationship records against
      each saved scenario's exact group membership.
    </p>
    <div class="data-table-wrap">
      <table class="mini-table scenario-comparison-table">
        <thead><tr><th>Dimension</th><th>Before</th><th>After</th><th>Δ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <details class="scenario-type-details">
      <summary>Relationship counts by recorded type</summary>
      <div class="data-table-wrap">
        <table class="mini-table">
          <thead><tr><th>Type</th><th>Before</th><th>After</th><th>Δ</th></tr></thead>
          <tbody>${typeRows}</tbody>
        </table>
      </div>
    </details>
  `
}

async function loadScenarioComparison(): Promise<void> {
  if (
    !project ||
    activeView !== 'relationships' ||
    !selectedScenarioLeftId ||
    !selectedScenarioRightId ||
    selectedScenarioLeftId === selectedScenarioRightId
  ) {
    return
  }

  const sourceProject = project
  const stage = document.querySelector<HTMLElement>('#scenario-comparison-stage')
  if (!stage) return

  try {
    const response = await postJson<{ comparison: PlanningScenarioComparisonView }>(
      '/api/planning/scenario-comparison',
      {
        project,
        leftScenarioId: selectedScenarioLeftId,
        rightScenarioId: selectedScenarioRightId,
      },
    )
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = renderScenarioComparison(response.comparison)
  } catch (error) {
    if (project !== sourceProject || activeView !== 'relationships') return
    stage.innerHTML = `<div class="empty-analysis">${escapeHtml(
      error instanceof Error ? error.message : 'Could not compare planning scenarios.',
    )}</div>`
  }
}

function bindRelationshipEvents(): void {
  document
    .querySelector<HTMLFormElement>('#record-history-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget as HTMLFormElement)
      const label = asString(data, 'label')
      const neighbourMode =
        asString(data, 'neighbourMode') === 'king' ? ('king' as const) : ('orthogonal' as const)
      void mutateProject({
        type: 'record-seating-history',
        ...(label ? { label } : {}),
        neighbourMode,
      })
    })

  document
    .querySelector<HTMLFormElement>('#save-scenario-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget as HTMLFormElement)
      const label = asString(data, 'label')
      if (!label) return
      void mutateProject({ type: 'save-planning-scenario', label })
    })

  document
    .querySelector<HTMLSelectElement>('#scenario-left')
    ?.addEventListener('change', (event) => {
      selectedScenarioLeftId = (event.currentTarget as HTMLSelectElement).value || null
      if (selectedScenarioLeftId === selectedScenarioRightId) {
        selectedScenarioRightId =
          (project?.planning?.scenarios ?? []).find(
            (scenario) => scenario.id !== selectedScenarioLeftId,
          )?.id ?? null
        renderWorkspace()
        return
      }
      void loadScenarioComparison()
    })

  document
    .querySelector<HTMLSelectElement>('#scenario-right')
    ?.addEventListener('change', (event) => {
      selectedScenarioRightId = (event.currentTarget as HTMLSelectElement).value || null
      if (selectedScenarioRightId === selectedScenarioLeftId) {
        selectedScenarioLeftId =
          (project?.planning?.scenarios ?? []).find(
            (scenario) => scenario.id !== selectedScenarioRightId,
          )?.id ?? null
        renderWorkspace()
        return
      }
      void loadScenarioComparison()
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-history]')) {
    button.addEventListener('click', () => {
      const historyId = button.dataset.removeHistory
      if (!historyId || !window.confirm('Remove this approved seating history record?')) return
      void mutateProject({ type: 'remove-seating-history', historyId })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-scenario]')) {
    button.addEventListener('click', () => {
      const scenarioId = button.dataset.removeScenario
      if (!scenarioId || !window.confirm('Remove this saved planning scenario?')) return
      if (scenarioId === selectedScenarioLeftId) selectedScenarioLeftId = null
      if (scenarioId === selectedScenarioRightId) selectedScenarioRightId = null
      void mutateProject({ type: 'remove-planning-scenario', scenarioId })
    })
  }

  document
    .querySelector<HTMLSelectElement>('#relationship-focus')
    ?.addEventListener('change', (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value
      selectedRelationshipFocusStudentId = value || null
      void loadRelationshipGraph()
    })

  document
    .querySelector<HTMLSelectElement>('#relationship-type-filter')
    ?.addEventListener('change', (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value
      selectedRelationshipTypeFilter = value === 'all' ? 'all' : (value as RelationshipType)
      renderWorkspace()
    })

  document
    .querySelector<HTMLFormElement>('#add-relationship-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget as HTMLFormElement)
      const fromStudentId = asString(data, 'fromStudentId')
      const toStudentId = asString(data, 'toStudentId')
      const type = asString(data, 'type') as RelationshipType
      const label = asString(data, 'label')
      const weight = optionalNumber(asString(data, 'weight'))
      const directed = data.get('directed') === 'on'

      void mutateProject({
        type: 'add-relationship',
        relationship: {
          id: relationshipRecordId(),
          fromStudentId,
          toStudentId,
          type,
          ...(label ? { label } : {}),
          ...(directed ? { directed: true } : {}),
          ...(weight !== undefined ? { weight } : {}),
        },
      })
    })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-relationship]')) {
    button.addEventListener('click', () => {
      const relationshipId = button.dataset.saveRelationship
      if (!relationshipId) return

      const from = readRelationshipField<HTMLSelectElement>(
        'data-relationship-from',
        relationshipId,
      )
      const to = readRelationshipField<HTMLSelectElement>('data-relationship-to', relationshipId)
      const typeSelect = readRelationshipField<HTMLSelectElement>(
        'data-relationship-type',
        relationshipId,
      )
      const label = readRelationshipField<HTMLInputElement>(
        'data-relationship-label',
        relationshipId,
      )
      const directed = readRelationshipField<HTMLInputElement>(
        'data-relationship-directed',
        relationshipId,
      )
      const weight = readRelationshipField<HTMLInputElement>(
        'data-relationship-weight',
        relationshipId,
      )

      void mutateProject({
        type: 'update-relationship',
        relationshipId,
        patch: {
          fromStudentId: from?.value ?? '',
          toStudentId: to?.value ?? '',
          type: (typeSelect?.value ?? 'custom') as RelationshipType,
          label: label?.value.trim() || null,
          directed: directed?.checked ?? false,
          weight: weight?.value.trim() ? Number(weight.value) : null,
        },
      })
    })
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-relationship]')) {
    button.addEventListener('click', () => {
      const relationshipId = button.dataset.removeRelationship
      if (!relationshipId) return
      if (!window.confirm(`Remove relationship ${relationshipId}?`)) return
      void mutateProject({ type: 'remove-relationship', relationshipId })
    })
  }
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

  if (
    !selectedGraphMetricKey ||
    !analysis.metrics.some((item) => item.key === selectedGraphMetricKey)
  ) {
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
          <button id="load-scatter" class="secondary compact" type="button" ${numericMetrics.length < 2 ? 'disabled' : ''}>Compare</button>
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
  return metric.kind === 'number' ? renderNumericAnalysis(metric) : renderCategoryAnalysis(metric)
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

  if (selectedScatterX === selectedScatterY) {
    target.innerHTML =
      '<p class="muted">Choose two different numeric metrics for a useful comparison.</p>'
    return
  }

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
