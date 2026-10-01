# ClassGraph

**ClassGraph** is a local-first classroom analysis and planning tool for turning explicit student/class information into teacher-facing tables, descriptive graphs, provenance views, and later seating/grouping plans and portable reports.

## Project status

**Phase 0 is merged. Phase 1 is complete on PR #3. Phase 2 is complete on PR #4 and passed Gate 2. Phase 3 is complete on PR #5 and passed Gate 3. Phase 4 is complete on PR #6 and passed Gate 4. Phase 5 is complete on `feat/phase-5-assistance` and passed Gate 5.**

ClassGraph remains a **standalone companion to EduBoard**. The apps do not share a live database. ClassGraph Exchange JSON v1 is the portable boundary between them.

### Phase 1 capabilities

- Create an empty class manually.
- Import validated ClassGraph Exchange v1 JSON.
- Add, rename, and remove students.
- Define number, category, ordinal, boolean, and text metrics.
- Edit metric values without conflating zero, false, explicit missing, and not-recorded states.
- Inspect field-level provenance for student data.
- View descriptive completeness, distributions, summary statistics, and numeric scatter comparisons.
- Generate deterministic synthetic classes from a reviewed specification with explicit distributions, weights, missing rates, and seed.
- Export the current project as validated JSON.
- Run locally without cloud accounts, remote fonts, remote scripts, or telemetry.

### Phase 2 capabilities

- Build and resize deterministic classroom grids with front-of-room orientation.
- Enable/disable seats and add explicit seat tags.
- Manually seat students by drag/drop or assignment table.
- Lock assignments before rerunning candidates.
- Author distinct hard constraints and soft objectives.
- Generate deterministic seating candidates with visible hard-rule status and objective penalties.
- Explain capacity/tag/search infeasibility without silently breaking hard constraints.
- Generate deterministic grouping candidates with optional explicit metric balancing.
- Lock group members and rerun around those choices.
- Persist room/planning/grouping state in validated Exchange v1 JSON.

### Phase 3 capabilities

- Export deterministic descriptive analysis JSON.
- Export approved seating/grouping state as versioned seating-plan JSON.
- Generate a local DOCX report with provenance, missing-data notes, metric summaries, roster values, approved planning, rules, and limitations.
- Generate a local PDF report for built-in-font-compatible text.
- Export a landscape seating-plan PDF with room orientation, disabled seats, assignments, locks, tags, and assignment-table fallback.
- Refuse unsupported PDF Unicode with `CG-5004` instead of silently replacing or corrupting names.
- Export a versioned EduBoard hand-back envelope separating source-safe fields, derived analysis, synthetic paths, and approved planning.
- Generate all exports through POST-only local endpoints with safe filenames and `no-store` / `nosniff` / `no-referrer` headers.
- Use an explicit EduBoard compatibility contract: target class must be selected explicitly and students map by exact ID only.

The EduBoard adapter contract is validated on its own isolated EduBoard branch/PR; no live database coupling or automatic overwrite is part of Phase 3.

### Phase 4 capabilities

- Store only explicit teacher/imported/synthetic relationship edges.
- Inspect deterministic relationship-network views with accessible table equivalents.
- Track repeat-neighbour history from approved seating records.
- Save and compare planning scenarios.
- Compare relationship/network counts and planning changes without inventing social relationships.

### Phase 5 capabilities

- Draft editable synthetic-generation specifications from constrained teacher language without generating students automatically.
- Draft plain-language explanations from existing descriptive analysis, with explicit missing-data and non-causation caveats.
- Draft report wording from the canonical validated report snapshot.
- Suggest soft planning rules only from explicit supported relationship records, with source paths and rationale.
- Run the assistance layer fully offline with no provider configured.
- Optionally configure a direct HTTPS provider without adding a provider SDK.
- Preview the exact network context before transmission and require an explicit confirmation for every network request.
- Keep assistance output as a proposal until the teacher explicitly copies, validates, or applies it.
- Keep provider secrets in process environment only; they are not stored in ClassGraph projects or exports.

## Run locally

Requirements:

- Node.js 22 or newer
- npm

Install, verify, build, and start:

```bash
npm ci
npm run check
npm run build
npm start
```

ClassGraph binds to `127.0.0.1:4317` by default. Open:

```text
http://127.0.0.1:4317
```

For development after dependencies are installed:

```bash
npm run dev
```

`CLASSGRAPH_PORT` can change the local port. `CLASSGRAPH_HOST` can override the host, but using a non-loopback host may expose student data to other devices on the network and should only be done deliberately on a trusted network.

Phase 5 network assistance is **off by default**. Optional provider configuration uses environment variables only:

```text
CLASSGRAPH_ASSISTANCE_URL=https://provider.example/assist
CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL=Provider name
CLASSGRAPH_ASSISTANCE_TOKEN=optional-secret
```

The endpoint must be HTTPS. ClassGraph shows the exact context before transmission and requires a separate explicit send confirmation. The token is never stored in a ClassGraph project or exposed through the assistance status API.

### Optional network assistance provider

No network provider is enabled by default. Offline assistance remains available without configuration.

To enable the generic HTTPS provider boundary, set these process environment variables before starting ClassGraph:

```text
CLASSGRAPH_ASSISTANCE_URL=https://provider.example/assist
CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL=Example Provider
CLASSGRAPH_ASSISTANCE_TOKEN=optional-bearer-token
```

`CLASSGRAPH_ASSISTANCE_URL` must use HTTPS. The token is read from the environment for the running process; ClassGraph does not write it to project JSON, exports, browser storage, or source files. Network assistance still requires a local context preview and an explicit send confirmation for each request.

## Input paths

- Import a ClassGraph Exchange v1 `.json` file.
- Enter/edit students and custom metrics manually.
- Generate a fully synthetic class from an explicit structured specification.
- Convert teacher-supplied synthetic-class intent into an editable proposed specification before any generation.

## Current outputs

- Editable student/class table.
- Metric completeness views.
- Numeric distributions and descriptive statistics.
- Category/ordinal/boolean/text counts.
- Numeric scatter comparisons with table equivalents.
- Field-level provenance inspection.
- Manual and generated seating/grouping plans with table equivalents.
- Validated ClassGraph Exchange JSON.
- Versioned analysis JSON.
- Versioned approved seating-plan JSON.
- Versioned EduBoard hand-back JSON.
- Local DOCX descriptive report.
- Local PDF descriptive report.
- Landscape seating-plan PDF.
- Explicit relationship table and local relationship graph.
- Repeat-neighbour history and saved planning-scenario comparisons.
- Offline assistance proposals for synthetic specs, descriptive explanations, report wording, and planning rules.
- Optional network assistance with pre-send context disclosure and explicit confirmation.
- Optional offline/network assistance proposals that remain outside canonical project data until explicitly accepted or copied.

## Product principles

- **Local first.** Student data stays on the teacher's device unless the teacher explicitly exports or shares it.
- **Observed, entered, imported, derived, and synthetic data remain distinguishable.**
- **Missing is not zero.** Explicitly missing and not-recorded values are distinct.
- **No black-box student labels.** ClassGraph supports teacher judgement; it does not diagnose personality, ability, behaviour, or future achievement.
- **Descriptive analysis before prediction.** Graphs show the data supplied; they do not claim causation or forecast student outcomes.
- **Explain recommendations.** Seating/grouping suggestions show the constraints/objectives or explicit relationship records that produced them.
- **Assistance never silently applies itself.** Drafts remain proposals until the teacher explicitly copies, validates, or applies them.
- **Minimise network context.** Aggregate/redacted data is preferred; any student-level disclosure is visible before an optional send.
- **Portable by design.** The canonical interchange format is versioned JSON.
- **Quality gates before features.** Formatting, lint, strict typecheck, tests, build, schema validation, and dependency auditing are required before merge.
- **Keep the app lean.** New frameworks/dependencies need a concrete product benefit rather than being added by default.

## Relationship to EduBoard

EduBoard remains the operational teacher dashboard/source-of-truth product. ClassGraph focuses on **analysis, visualisation, layout/group planning, and decision support**.

Integration is through explicit import/export contracts rather than hidden coupling. Derived or synthetic ClassGraph values must never silently overwrite observed EduBoard data.

## Design and recovery documents

- `DESIGN.md` — product/architecture contract.
- `docs/INTERCHANGE.md` — Exchange v1 interoperability notes.
- `docs/PHASE1_LOG.md` — Phase 1 recovery/checkpoint log.
- `docs/PHASE_2.md` — Phase 2 seating/grouping recovery and Gate 2 log.
- `docs/PHASE_3.md` — Phase 3 exports/interchange recovery and Gate 3 log.
- `docs/PHASE3_LOG.md` — recovery alias pointing to the authoritative Phase 3 log.
- `docs/PHASE_4.md` — Phase 4 relationship/history/scenario recovery and Gate 4 log.
- `docs/PHASE_5.md` — Phase 5 assistance/provider recovery and Gate 5 log.
- `docs/PHASE_4.md` — Phase 4 relationship/history/scenario recovery log.
- `docs/PHASE_5.md` — Phase 5 optional-assistance recovery and Gate 5 log.

For completed implementation history, see the phase logs above. Phase 5 preserves the same local-first core and keeps network assistance optional.

## Repository

https://github.com/purysho/ClassGraph
