# ClassGraph Phase 1 Progress Log

**Branch:** `feat/phase-1-ui`  
**Phase:** 1 — Teacher-facing project, roster, analytics, and JSON workflow  
**Recovery instruction:** If work is interrupted, read this file first and continue from the first unchecked item.

## Architecture decision

Phase 1 starts with a **zero-new-runtime-dependency local app shell** using the existing TypeScript core and Node's standard library. This keeps ClassGraph small, offline-capable, and independently testable. A heavier desktop wrapper (for example Electron) is deferred until it provides enough value to justify the footprint.

The existing UI-independent core remains authoritative for schema validation, provenance, synthetic generation, descriptive analysis, and JSON interchange.

## Completion checklist

- [x] P1.0 — Recovery log and Phase 1 architecture checkpoint
- [x] P1.1 — Project workspace service: create, update metadata, add/remove/edit students
- [x] P1.2 — Metric-definition editing and safe typed value editing
- [x] P1.3 — Local app server + JSON import/export endpoints
- [x] P1.4 — Teacher-facing UI shell and project setup
- [x] P1.5 — Editable student roster + provenance inspection
- [x] P1.6 — Overview statistics + distribution/comparison views
- [x] P1.7 — Synthetic class creation from structured parameters
- [ ] P1.8 — Phase 1 quality pass, tests, documentation, PR

## Completed work

### P1.0 — Recovery log and architecture checkpoint

**Status:** Complete.

- Confirmed `feat/phase-1-ui` is based on the merged Phase 0 foundation.
- Preserved the separate-app boundary with EduBoard.
- Chose a lean local app architecture with no new runtime dependency for the first UI slice.
- Confirmed Phase 1 will not include seating optimisation, DOCX/PDF export, AI, a shared EduBoard database, or cloud services.

### P1.1 — Project workspace service

**Status:** Complete.

Implemented `src/workspace.ts` and `tests/workspace.test.ts`.

Completed behaviour:

- create an empty ClassGraph Exchange v1 project from explicit IDs/timestamps;
- update title and class metadata immutably;
- add students with optional display name, tags and notes;
- edit student details without inventing metrics;
- reject duplicate student IDs with a `CG-2xxx` error;
- remove a student and any relationships that reference them;
- remap index-based provenance paths after removals;
- mark manual project/student fields as `teacher-entered`;
- validate each produced project through the canonical runtime schema.

Public exports were updated through `src/index.ts`.

### P1.2 — Metric definitions and typed values

**Status:** Complete.

Implemented `src/metrics.ts` and `tests/metrics.test.ts`.

Completed behaviour:

- add/update/remove metric definitions through schema-validated immutable operations;
- prevent duplicate metric keys;
- keep metric keys immutable once created so existing data/provenance cannot be silently re-keyed;
- set typed student metric values with teacher-entered provenance;
- preserve `0` and `false` as real values;
- preserve explicit `null` as a deliberate missing value;
- support removing a value entirely when it was never/should no longer be recorded;
- reject invalid category/ordinal/type/range values through the canonical runtime schema;
- remove associated student metric data/provenance when a definition is deleted;
- remap metric-definition provenance indices after deletion.

### P1.3 — Local app server and JSON boundary

**Status:** Complete.

Implemented `src/server.ts`, `src/server-main.ts`, and `tests/server.test.ts`.

Completed behaviour:

- binds to `127.0.0.1` by default so student data is not exposed to the LAN automatically;
- supports an explicit `CLASSGRAPH_HOST` override and warns when a non-loopback host is used;
- provides `GET /api/health`;
- provides `POST /api/import`, validating input through `parseProjectJson`;
- provides `POST /api/export`, validating and serialising through `serializeProjectJson`;
- caps request bodies at 5 MiB by default;
- serves only an explicit allow-list of local UI assets rather than arbitrary filesystem paths;
- sends no CORS headers and uses `no-store`, `nosniff`, and no-referrer response headers;
- adds `npm run dev` and `npm start` commands without introducing a new package dependency.

### P1.4 — Teacher-facing UI shell and project setup

**Status:** Complete.

Implemented `src/app-client.ts`, `app/index.html`, and `app/styles.css`, plus local setup endpoints.

Completed behaviour:

- offline/manual class creation backed by `createEmptyProject`;
- validated ClassGraph Exchange v1 JSON import;
- basic seeded synthetic class generation backed by the deterministic core;
- main workspace shell with Overview, Students, and Graphs navigation;
- future Seating and Reports areas clearly disabled rather than pretending they are complete;
- local-only status and Exchange schema visibility;
- explicit JSON export from the current in-memory workspace;
- imported project metadata is HTML-escaped before rendering;
- browser remains a thin client: project creation/validation stays in the TypeScript core.

**Verification note:** Earlier PR test runs reached Prettier and exposed formatting-only failures. Those three original formatter blockers were corrected. Subsequent API-written commits have not received new GitHub check runs yet; P1.8 will force a fresh pull-request event and run the complete gate before merge.

### P1.5a — Core-backed project mutation API

**Status:** Complete.

Implemented `src/project-mutations.ts`, `tests/project-mutations.test.ts`, and `POST /api/project/mutate`.

Completed behaviour:

- validates the current project through the canonical ClassGraph Exchange v1 schema before mutation;
- validates mutation commands before they reach workspace/metric services;
- supports add/update/remove student commands;
- supports add/remove metric-definition commands;
- supports set/unset metric-value commands;
- preserves explicit `null`, `0`, and `false` semantics through the existing core;
- preserves core `CG-2xxx` error codes at the local HTTP boundary instead of flattening them into import errors;
- includes direct command-layer tests and an end-to-end local server mutation test.

### P1.5b — Editable student roster UI

**Status:** Complete.

Implemented the real Students workspace in `src/app-client.ts` with supporting styles in `app/styles.css`.

Completed behaviour:

- add a student with explicit ID and optional display name;
- edit display name, tags, and notes for existing students;
- remove students through the core mutation layer;
- add number, ordinal, category, boolean, or text metric definitions;
- edit every defined metric directly in the roster table;
- distinguish three cell states: `Value`, `Missing` (explicit `null`), and `Unrecorded` (property absent);
- parse number and boolean values without converting `0` or `false` into missing data;
- category/ordinal cells use the authored definition values;
- all saves route through `POST /api/project/mutate`; the browser does not directly rewrite Exchange v1 objects;
- horizontal roster layout supports larger classes and many custom metrics.

### P1.5c — Provenance inspection

**Status:** Complete.

The Students workspace now includes a field-level provenance inspector tied to the canonical project provenance map.

Completed behaviour:

- per-student `Sources` control opens the recorded provenance for that student index;
- inspector lists the exact field path, provenance kind, optional source, note, and `derivedFrom` paths;
- inspector states explicitly that displayed sources are recorded data, not ClassGraph guesses;
- absent provenance is shown as absent rather than inferred from neighbouring values;
- synthetic/imported/teacher-entered/derived/observed provenance remains visually distinguishable;
- provenance follows the index-remapping rules already enforced by the workspace core when students are removed.

P1.5 cleanup also removed an overlapping older roster CSS block so the current roster/provenance styling has a single authoritative implementation.

### P1.6 — Descriptive analysis views

**Status:** Complete.

Implemented `src/analysis-view.ts`, `tests/analysis-view.test.ts`, local analysis endpoints, and the Overview/Graphs workspace.

Completed behaviour:

- project completeness separates recorded cells, explicit missing values, and unrecorded cells;
- numeric metrics expose count, missing count, min/max, mean, median, quartiles, and deterministic histogram buckets;
- categorical/ordinal/boolean/text metrics expose descriptive counts;
- every graph has a table equivalent;
- scatter comparison accepts two distinct numeric metrics only;
- students without both selected numeric values are omitted and counted rather than filled;
- scatter UI states explicitly that association does not imply causation;
- no charting dependency was added; rendering stays lightweight and offline;
- analysis requests validate the full Exchange v1 project before calculations;
- tests cover completeness, zero preservation, histogram totals, scatter omission, and endpoint validation.

A later cleanup consolidated two overlapping client implementations created during the interrupted session into one authoritative analysis UI.

## Next exact step

Complete **P1.7 — Synthetic class creation from structured parameters**. The structured specification validator and `/api/synthetic/generate` endpoint already exist; finish the teacher-facing builder so metrics, distributions, weights, missing rates, and seed are explicit before generation.
