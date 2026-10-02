# ClassGraph

**ClassGraph** is a local-first classroom analysis and planning tool for turning explicit student/class information into teacher-facing tables, descriptive graphs, provenance views, and later seating/grouping plans and portable reports.

## Project status

**Phase 0 is merged. Phase 1 is complete on PR #3. Phase 2 is complete on PR #4 and has passed Gate 2.**

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

DOCX/PDF reporting and EduBoard hand-back adapters remain Phase 3 work.

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

## Input paths

- Import a ClassGraph Exchange v1 `.json` file.
- Enter/edit students and custom metrics manually.
- Generate a fully synthetic class from an explicit structured specification.
- Later: convert teacher-supplied aggregate constraints into an editable specification before generation.

## Current outputs

- Editable student/class table.
- Metric completeness views.
- Numeric distributions and descriptive statistics.
- Category/ordinal/boolean/text counts.
- Numeric scatter comparisons with table equivalents.
- Field-level provenance inspection.
- Validated ClassGraph Exchange JSON.

Planned later outputs include seating/grouping plans, analysis JSON, DOCX, and PDF reports.

## Product principles

- **Local first.** Student data stays on the teacher's device unless the teacher explicitly exports or shares it.
- **Observed, entered, imported, derived, and synthetic data remain distinguishable.**
- **Missing is not zero.** Explicitly missing and not-recorded values are distinct.
- **No black-box student labels.** ClassGraph supports teacher judgement; it does not diagnose personality, ability, behaviour, or future achievement.
- **Descriptive analysis before prediction.** Graphs show the data supplied; they do not claim causation or forecast student outcomes.
- **Explain recommendations.** Future seating/grouping suggestions must show the constraints and objectives that produced them.
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

For completed implementation history, see the phase logs above. New work proceeds from Phase 3 in `DESIGN.md`.

## Repository

https://github.com/purysho/ClassGraph
