# ClassGraph

**ClassGraph** is a local-first classroom analysis and planning tool for turning explicit student/class information into teacher-facing tables, descriptive graphs, provenance views, and later seating/grouping plans and portable reports.

## Project status

**Phase 0 is merged. Phase 1 is implemented on the teacher-workspace branch and is undergoing its final quality gate.**

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

Seating/grouping optimisation, DOCX/PDF reporting, and EduBoard hand-back adapters remain later phases.

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

If work is interrupted during Phase 1, read `docs/PHASE1_LOG.md` and continue from the first unchecked item.

## Repository

https://github.com/purysho/ClassGraph
