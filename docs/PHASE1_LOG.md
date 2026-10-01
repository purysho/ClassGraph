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
- [ ] P1.3 — Local app server + JSON import/export endpoints
- [ ] P1.4 — Teacher-facing UI shell and project setup
- [ ] P1.5 — Editable student roster + provenance inspection
- [ ] P1.6 — Overview statistics + distribution/comparison views
- [ ] P1.7 — Synthetic class creation from structured parameters
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

## Next exact step

Implement **P1.3 — Local app server + JSON import/export endpoints** using only Node's standard library plus the existing ClassGraph core. It must bind to loopback by default, never expose student data to the LAN automatically, serve the local UI, validate imported JSON through `parseProjectJson`, and export through `serializeProjectJson`.
