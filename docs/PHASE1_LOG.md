# ClassGraph Phase 1 Progress Log

**Branch:** `feat/phase-1-ui`  
**Phase:** 1 — Teacher-facing project, roster, analytics, and JSON workflow  
**Recovery instruction:** If work is interrupted, read this file first and continue from the first unchecked item.

## Architecture decision

Phase 1 starts with a **zero-new-runtime-dependency local app shell** using the existing TypeScript core and Node's standard library. This keeps ClassGraph small, offline-capable, and independently testable. A heavier desktop wrapper (for example Electron) is deferred until it provides enough value to justify the footprint.

The existing UI-independent core remains authoritative for schema validation, provenance, synthetic generation, descriptive analysis, and JSON interchange.

## Completion checklist

- [x] P1.0 — Recovery log and Phase 1 architecture checkpoint
- [ ] P1.1 — Project workspace service: create, clone, update metadata, add/remove/edit students
- [ ] P1.2 — Metric-definition editing and safe typed value editing
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

## Next exact step

Implement **P1.1 — Project workspace service** with tests. The service must preserve provenance, never coerce missing values, and keep project timestamps/IDs explicit.
