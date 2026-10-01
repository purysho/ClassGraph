# ClassGraph — DESIGN.md

**Status:** Phase 3 implementation contract  
**Design revision:** 0.3  
**Target implementation:** TypeScript  
**Primary relationship:** Standalone companion to EduBoard  
**Primary data contract:** ClassGraph Exchange JSON v1

---

## 0. Design decision

ClassGraph is a **local-first classroom analysis and planning application**.

Its job is to help a teacher turn explicit class information into:

- understandable distributions and comparisons;
- sortable/filterable tables;
- room and seating views;
- grouping/seating alternatives;
- explainable observations and candidate changes;
- portable `.json`, `.docx`, and `.pdf` outputs.

ClassGraph is **not** a grading engine, psychological profiler, diagnostic system, or predictor of student success.

The core product claim is:

> **ClassGraph organises and visualises teacher-supplied or clearly marked synthetic class data, then evaluates planning alternatives against explicit teacher-selected objectives and constraints. It does not infer hidden truths about students.**

This claim governs the data model, analysis language, seating engine, exports, and future AI features.

---

## 1. Relationship to EduBoard

EduBoard and ClassGraph remain separate applications for now.

### EduBoard

- operational teacher dashboard;
- classes, attendance, grades, lesson planning, reporting and school workflows;
- teacher's operational source of truth.

### ClassGraph

- classroom analysis and visualisation;
- class-composition exploration;
- seating/grouping planning;
- explainable decision support;
- portable analytical reports.

### Integration boundary

Do not share a live database in V1.

Use a versioned JSON interchange contract instead:

```text
EduBoard
  → export ClassGraph-compatible JSON
  → ClassGraph analyses / plans
  → export ClassGraph Exchange JSON
  → EduBoard may import selected supported fields later
```

This keeps both apps independently testable and prevents one product's schema migrations from silently breaking the other.

---

## 2. Product principles

### 2.1 Local first

Student/class data stays on the teacher's device unless the teacher explicitly exports or shares it.

No cloud account is required for core operation.

### 2.2 Provenance is first-class data

Every important value should be distinguishable as one of:

```text
observed
teacher-entered
imported
derived
synthetic
```

Generated or derived values must never be presented as if they were observed facts.

### 2.3 No hidden profiling

Do not silently infer constructs such as intelligence, personality, motivation disorder, behaviour disorder, or future attainment.

If a teacher explicitly records a classroom-relevant descriptor, ClassGraph may store and visualise it with provenance.

### 2.4 Explain recommendations

A seating or grouping recommendation must be traceable to:

- the selected objective(s);
- the selected constraints;
- the input fields used;
- the trade-offs/violations that remain.

Avoid a single opaque "best class" or "best student" score.

### 2.5 Neutral descriptive analysis first

V1 analysis reports what the data contains:

- distributions;
- missingness;
- spread;
- category counts;
- balance/imbalance across groups or seats;
- explicit constraint violations.

Normative educational claims require an explicit rule authored by the teacher/product, and the report must state the rule.

### 2.6 Portable by design

JSON is the canonical interchange format.

`.docx` and `.pdf` are human-facing report formats, not the source of truth.

### 2.7 Reproducible synthetic data and optimisation

Randomly generated classes and stochastic search must be seeded.

Given the same app version, schema version, input data, configuration and seed, ClassGraph should reproduce the same synthetic dataset or candidate plan.

---

## 3. Input modes

ClassGraph must support four input paths.

### Mode A — JSON import

Import a ClassGraph Exchange v1 file or a supported EduBoard adapter export.

Requirements:

- runtime schema validation;
- readable validation errors;
- unknown future-compatible fields preserved where practical;
- no silent coercion of materially invalid values;
- provenance retained.

### Mode B — Manual entry

The teacher can create a class and add/edit students.

Minimum fields:

```text
student ID
optional display name
optional tags
optional custom metrics
```

Names are optional. Pseudonymous IDs are fully supported.

### Mode C — Fully synthetic generation

Generate a fictional class from an explicit specification.

Examples:

```text
36 students
metric "assessment" from 0–100
metric "participation" from 1–5
category "language support" with configured weights
```

Every generated field is marked `synthetic`.

### Mode D — Constraint-based synthetic generation

The teacher supplies aggregate information such as:

```text
40 students
roughly 25% need more language support
5 students are very confident public speakers
assessment scores cluster around 65–80
```

ClassGraph converts this into an explicit generation specification before generating records.

If a future AI feature converts natural language to that specification, the teacher must be able to inspect/edit the specification before generation.

---

## 4. Canonical ClassGraph Exchange v1 model

The first contract is intentionally flexible. Different schools track different things, so V1 should not hard-code one educational theory into the student schema.

```ts
interface ClassGraphProject {
  schemaVersion: '1.0'
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  classInfo: ClassInfo
  metricDefinitions: MetricDefinition[]
  students: StudentRecord[]
  relationships?: RelationshipRecord[]
  room?: RoomDefinition
  planning?: PlanningConfiguration
  provenance: FieldProvenanceMap
  extensions?: Record<string, unknown>
}
```

### 4.1 Students and metrics

```ts
interface StudentRecord {
  id: string
  displayName?: string
  tags?: string[]
  metrics: Record<string, MetricValue>
  notes?: string
}

type MetricKind = 'number' | 'ordinal' | 'category' | 'boolean' | 'text'
type MetricValue = number | string | boolean | null

interface MetricDefinition {
  key: string
  label: string
  kind: MetricKind
  description?: string
  numberScale?: { min?: number; max?: number; unit?: string }
  ordinalScale?: string[]
  categories?: string[]
  missingAllowed?: boolean
}
```

ClassGraph does not assign meaning to a metric beyond its authored definition.

### 4.2 Relationships

Relationship edges are optional and must be explicitly supplied or generated as synthetic data.

```ts
interface RelationshipRecord {
  id: string
  fromStudentId: string
  toStudentId: string
  type: 'works-well-with' | 'avoid-pairing' | 'support-pair' | 'friendship' | 'custom'
  label?: string
  directed?: boolean
  weight?: number
}
```

ClassGraph must not infer friendship or conflict from grades, participation, names, or demographics.

---

## 5. Provenance

Use field-level provenance, not a single project-wide confidence label.

```ts
type ProvenanceKind = 'observed' | 'teacher-entered' | 'imported' | 'derived' | 'synthetic'

interface ProvenanceEntry {
  kind: ProvenanceKind
  source?: string
  note?: string
  derivedFrom?: string[]
}

type FieldProvenanceMap = Record<string, ProvenanceEntry>
```

Keys use JSON Pointer or an equivalent stable path.

Derived fields must identify their source paths when practical.

---

## 6. Descriptive analysis

V1 should provide dependable descriptive statistics before predictive features.

Numeric/ordinal metrics:

- count recorded / missing;
- min/max;
- mean where appropriate;
- median;
- quartiles;
- configurable histogram/bands;
- outlier display as a descriptive signal, not an error label.

Categorical/boolean metrics:

- counts;
- percentages;
- missing count;
- cross-tabulations between explicitly selected fields.

Multi-metric views:

- scatter plots for two numeric metrics;
- heatmaps/cross-tabs;
- correlation display only for eligible numeric metrics, with an "association is not causation" note;
- selected metric summaries by group/tag.

Never silently treat missing values as zero, average, "normal", or false.

---

## 7. Graph and table views

The product name should be reflected in useful visual views, not only charts.

Initial graph families:

1. **Distribution graph** — histograms/box-style distributions.
2. **Comparison graph** — scatter/selected metric comparisons.
3. **Relationship graph** — teacher-supplied/synthetic student edges as a network.
4. **Room graph** — seats as nodes with selected metrics/flags overlaid.
5. **Grouping graph** — groups and cross-group balance/constraint status.

Network graphs use only explicit relationship records. They do not infer social relationships from unrelated data.

Required tables:

- roster/data table;
- metric completeness table;
- group assignment table;
- seating assignment table;
- constraint violation table;
- provenance inspection table.

All important graph views should have an accessible table equivalent.

---

## 8. Room, seating and grouping

```ts
interface RoomDefinition {
  layout: 'grid' | 'custom'
  rows?: number
  columns?: number
  seats: SeatDefinition[]
}

interface SeatDefinition {
  id: string
  row?: number
  column?: number
  x?: number
  y?: number
  enabled: boolean
  tags?: string[]
}
```

V1 planning rules should be explicit objects.

Examples:

- keep two students apart;
- prefer two students together;
- prefer a student in a seat tagged `front`;
- fix a student to one seat;
- avoid repeated neighbours;
- balance an explicitly chosen metric across rows/groups.

The engine must distinguish:

- **hard constraints** — must not be violated unless no feasible solution exists;
- **soft objectives** — may trade off against one another.

If no feasible arrangement exists, ClassGraph reports why instead of pretending success.

The planning engine should return multiple candidates with:

- hard-constraint status;
- objective-by-objective scores/penalties;
- remaining trade-offs;
- explanation of differences;
- seed/configuration for reproduction.

No composite score should be shown without also showing its components.

---

## 9. Feedback and recommendations

ClassGraph feedback is a **candidate planning suggestion**, not educational truth.

Good:

> Candidate change: rotate the two highest-dominance support pairs across different groups. Under the currently selected "balance participation" rule, this reduces the difference between groups while preserving both hard separation constraints.

Avoid:

> This is the best seating plan and will improve learning by 18%.

Every recommendation should expose:

- input fields used;
- selected rule/objective;
- before/after descriptive comparison;
- unresolved trade-offs;
- whether any source data was synthetic or derived.

---

## 10. Export formats

### JSON

Canonical machine-readable format.

Required exports:

```text
project.json
analysis.json
seating-plan.json
```

A combined `.classgraph.json` file may later package these into one portable project.

### DOCX and PDF

Human-readable reports should contain:

```text
Class overview
Data/provenance summary
Selected graphs
Selected tables
Seating/group plan
Planning rules
Candidate observations/changes
Limitations
```

PDF also needs a landscape seating-plan option.

### EduBoard hand-back

The JSON export must separate:

- original imported fields;
- ClassGraph-derived analysis;
- teacher-approved planning decisions.

EduBoard should never have to treat a ClassGraph recommendation as raw observed student data.

---

## 11. Privacy, security and errors

ClassGraph inherits EduBoard's local-first philosophy.

Requirements:

- no telemetry containing student data;
- no student data in crash/error reports;
- imports treated as data, never executable content;
- strict file-size and schema limits for imports;
- output filenames sanitised;
- no remote fonts/scripts required for core operation;
- future AI/network features are opt-in and explicitly show what data would leave the device;
- names optional throughout the product.

Encryption/password protection must be considered before a production release that persistently stores identifiable student data.

ClassGraph error codes use:

```text
CG-1xxx import/schema
CG-2xxx project/data
CG-3xxx analysis
CG-4xxx seating/grouping
CG-5xxx export
CG-9xxx unexpected/internal
```

A user-facing error should say what happened, what the teacher can do next, and the error code.

---

## 12. Architecture

Keep analysis and planning logic UI-independent.

Recommended structure:

```text
src/
  core/
    schema/
    import/
    provenance/
    synthetic/
    analysis/
    planning/
    export/
  shared/
  app/          # later React UI
  desktop/      # later Electron boundary
```

`src/core` must not depend on React or Electron.

Foundation technology:

- Node 22;
- TypeScript strict mode;
- Vitest;
- runtime schema validation;
- ESLint;
- Prettier;
- property/invariant tests where useful.

Phase 1–3 UI implementation:

- local Node 22 HTTP boundary bound to loopback by default;
- browser UI authored in TypeScript and compiled with the existing TypeScript build;
- plain local CSS and DOM APIs;
- no React, Electron, charting library, remote font, or remote script required for Phase 1–3;
- browser remains a thin client: schema/provenance/generation/analysis/planning rules stay in UI-independent TypeScript modules;
- candidate generation endpoints are read-only previews until the teacher explicitly accepts a candidate through a validated project mutation.

Framework rule for later phases:

- add React, Electron, a charting library, or another UI framework only when a concrete interaction/packaging requirement justifies its runtime/build footprint;
- do not migrate merely to match EduBoard's stack;
- a relationship/network library is allowed later only if explicit relationship views justify it.

Exports:

- `docx` for Word output;
- PDF via a tested local renderer/print pipeline;
- JSON via the canonical schema.

Avoid bringing EduBoard's Portal/server stack into ClassGraph unless a real requirement appears.

---

## 13. Quality-control framework inherited from EduBoard

On every pull request and push to `main`:

```text
install dependencies
format check
lint
typecheck
tests
build
```

Also:

- dependency audit on push/PR and weekly;
- deterministic fixtures;
- import round-trip tests;
- schema-version tests;
- no-network core tests;
- E2E smoke tests once UI exists;
- size/bloat budget once desktop packaging exists;
- release notes/changelog once public releases begin.

No phase passes because "the UI looks right".

---

## 14. Phased plan

### Phase 0 — Foundation

Deliver:

- ClassGraph Exchange v1 schema;
- field-level provenance types;
- deterministic synthetic generator;
- descriptive numeric/category analysis;
- validated JSON import/export;
- CI quality gates;
- tests for determinism, schema rejection, missing-data handling and round-trip export.

Acceptance:

```text
lint green
typecheck green
tests green
build green
same seed + same spec -> identical synthetic class
import(export(project)) -> equivalent validated project
synthetic values are provenance-marked
missing values are not coerced
```

### Phase 1 — Manual editor + analytical views

Implemented scope:

- create/open project;
- manual roster entry;
- metric-definition editor;
- editable data table;
- explicit recorded / missing / not-recorded states;
- descriptive completeness and summary statistics;
- distribution charts with table equivalents;
- numeric scatter comparison with a table equivalent;
- provenance inspector;
- reviewed structured synthetic-generation specification;
- JSON import/export;
- loopback-only local app boundary by default.

Phase 1 acceptance:

```text
format green
lint green
typecheck green
tests green
build green
dependency audit green
manual/imported/synthetic data provenance remains visible
zero and false remain valid recorded values
explicit missing remains distinct from absent
same seed + same structured spec -> identical synthetic student values
all significant graph views have table equivalents
no remote service required for core teacher workflow
```

### Phase 2 — Room, seating and grouping

Implemented scope:

- deterministic grid-room editor with explicit front orientation;
- enabled/disabled seats, stable seat IDs and teacher-authored tags;
- manual seating by drag/drop or assignment table;
- assignment locks and lock-preserving reruns;
- explicit typed hard constraints and soft objectives;
- deterministic seating candidate engine;
- visible hard-constraint results and objective-by-objective penalties;
- three-candidate comparison and explicit candidate acceptance;
- deterministic grouping candidates with optional numeric/ordinal metric balancing;
- group-member locks and reruns;
- Exchange v1 persistence for rooms, assignments, rules, locks, groups and seed.

Phase 2 acceptance:

```text
format green
lint green
typecheck green
tests green
build green
dependency audit green
hard and soft rules structurally distinct
infeasible/search-failure states explained
same project + rules + locks + seed -> reproducible candidates
total penalty never shown without components
missing balance values ignored and reported, never imputed
no hidden student traits inferred
important visual views retain table equivalents
```

### Phase 3 — Reports and portable exports

Implemented scope:

- deterministic canonical report snapshot;
- versioned analysis JSON;
- versioned approved seating-plan JSON;
- local DOCX report generated from shared report content;
- local portrait PDF descriptive report;
- landscape seating-plan PDF with orientation, disabled seats, assignments, locks, tags and assignment-table fallback;
- explicit `CG-5004` failure instead of silent PDF Unicode corruption;
- Reports workspace with project/analysis/seating/EduBoard JSON plus DOCX/PDF downloads;
- POST-only export endpoints with project revalidation, safe filenames and no persistent server-side copy;
- `classgraph-eduboard-handback` v1 envelope separating source-safe fields, derived analysis, synthetic paths and approved planning;
- EduBoard compatibility contract requiring explicit class selection, exact student-ID mapping and zero-based seat coordinates;
- representative fixtures and non-writing adapter tests in both repositories.

Phase 3 acceptance:

```text
format green
lint green
strict typecheck green
tests green
build green
shipped dependency audit green
DOCX OOXML structure tested
PDF signature/orientation and Unicode-failure behavior tested
analysis/seating/hand-back JSON versioned and deterministic
download filenames sanitised
export endpoints do not persist report files
synthetic/derived paths cannot masquerade as source-safe EduBoard values
EduBoard adapter plans writes only after explicit class + exact ID mapping
fixtures exist in both repositories
```

### Phase 4 — Relationship graph and advanced comparison

Implemented scope:

- explicit teacher/imported/synthetic relationship records only;
- deterministic relationship network with table equivalent;
- repeat-neighbour history from approved seating records;
- saved planning scenarios and deterministic comparisons;
- selected before/after planning/network views;
- no relationship inference from grades, demographics, names, attendance, or other unrelated metrics.

### Phase 5 — Optional assistance layer

Implemented scope:

- provider-independent request/proposal/disclosure contracts;
- deterministic offline synthetic-spec drafting from constrained teacher intent;
- descriptive analysis explanation with missing-data and non-causation caveats;
- report wording drafted from the canonical validated snapshot;
- planning-rule suggestions only from explicit supported relationship records;
- teacher-visible source paths, rationale, and soft/hard rule status;
- assistance workspace with provider status, exact-context disclosure, editable/copyable drafts, and explicit acceptance boundaries;
- optional direct-HTTPS provider configured only through process environment variables;
- explicit per-request network confirmation, timeout/response-size limits, and response validation;
- no provider enabled by default and no provider SDK dependency.

Assistance only proposes. Synthetic generation and planning mutations remain separate explicit teacher actions.

---

## 15. Go/no-go gates

### Gate 1 — foundation

Proceed to UI only when:

- schema is versioned and tested;
- synthetic generation is deterministic;
- provenance survives round trips;
- missing data semantics are correct;
- CI is green.

### Gate 2 — seating engine

Proceed to report polish only when:

- hard/soft rules are distinct;
- infeasible plans are explained;
- candidate plans are reproducible;
- score components are visible;
- no student trait is silently invented.

### Gate 3 — EduBoard integration

Proceed only when:

- the interchange schema is documented;
- fixtures exist in both repositories;
- unsupported fields are rejected or preserved explicitly;
- derived/synthetic values cannot overwrite observed EduBoard data without an explicit mapping/approval step.

---

## 16. Immediate implementation instruction

> Phase 0–5 are implemented. Preserve the lean local architecture, explicit provenance, missing-data semantics, and proposal-only assistance boundary. Any future phase must keep the core usable with no network provider, avoid hidden student-trait inference, and justify every new runtime dependency.
