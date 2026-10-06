# Security and privacy

ClassGraph is designed as a local-first application that may contain student information.

## Current pre-release architecture

Phase 0 provides the UI-independent schema/generation/analysis core. Phase 1 adds a small local HTTP boundary and browser interface. Phase 2 adds UI-independent room/planning/grouping services and read-only candidate-generation endpoints; candidate data is not persisted until the teacher explicitly applies it through a validated project mutation. Phase 3 adds UI-independent report/export services and POST-only local download endpoints; export generation is a read-only snapshot and does not persist a server-side copy. Phase 4 adds explicit relationship, approved-history, and saved-scenario services without inferring relationship edges from unrelated data. Phase 5 adds an optional proposal-only assistance layer with deterministic offline drafts and a separately configured HTTPS provider boundary that is disabled unless the teacher deliberately enables it.

The local server binds to `127.0.0.1` by default. No internet connection is required for the core teacher workflow. A teacher can explicitly override `CLASSGRAPH_HOST`, but a non-loopback host may expose the app and student data to other devices on the network and should only be used deliberately on a trusted network.

## Security principles

- Student data is not telemetry.
- Error reports/logs should not contain student values by default.
- Imported JSON is treated only as data and is validated before use.
- Local HTTP request bodies are size-capped and project mutations are schema-validated before core operations run.
- Room geometry, seat assignments, locks, groups, and planning rules are validated against existing student/seat/metric references before persistence.
- Candidate-generation endpoints do not mutate the project; seating/grouping choices persist only after an explicit teacher action.
- Report/export endpoints validate the project again, generate bytes in memory, and return them directly; normal export does not write a persistent server-side report copy.
- Export filenames are sanitised and responses use explicit MIME types plus `no-store`, `nosniff`, and `no-referrer` protections.
- PDF export never silently transliterates, substitutes or drops characters. Text outside the built-in Latin fonts uses the bundled Noto Sans SC subset; anything that font cannot draw fails with `CG-5004`, naming the characters. DOCX remains the full-Unicode report option.
- Spreadsheet imports are parsed as data only (CSV text, or .xlsx cell values via a zip/XML reader; formulas are never evaluated), size-capped at 2,000 rows and 100 columns, validated, and previewed before anything is saved.
- EduBoard hand-back keeps source-safe values, derived analysis, synthetic paths, and approved planning in separate sections. It requires explicit target-class selection and exact student-ID mapping before any future EduBoard write path.
- UI assets are served from an explicit allow-list rather than arbitrary filesystem paths.
- Local responses use no-store, nosniff, and no-referrer protections; the app does not enable cross-origin access by default.
- Core operation must not require remote scripts, fonts, APIs, or accounts.
- Network assistance is disabled unless a provider URL and label are explicitly supplied through the process environment.
- Provider endpoints must use HTTPS, responses are size-capped, requests time out, and malformed/mismatched responses are rejected before reaching the workspace.
- Assistance previews show the exact context and disclosure flags before any network transmission; every send requires a separate explicit confirmation.
- Aggregate/redacted context is used for analysis/report tasks when student-level detail is unnecessary. Planning suggestions may include stable student IDs only for explicit relationship/rule records, with display names omitted.
- Provider bearer tokens are read from the process environment only and are not included in project state, browser storage, exports, or normal logs.
- Assistance results remain proposal-only. Synthetic-spec acceptance validates a specification without generating students; planning-rule acceptance returns validated selections before a separate project mutation.
- The core teacher workflow and offline assistance do not require remote scripts, accounts, APIs, or provider credentials.
- Names are optional; pseudonymous student IDs are supported throughout the data model.
- Optional per-class password protection encrypts the class file and its automatic safety copies at rest (AES-256-GCM; key from scrypt N=2^17, r=8, p=1; project ID authenticated as additional data). Only the random project ID is readable in a protected file.
- Keys for unlocked classes are held only in main-process memory; passwords and keys are never written to disk, project files, browser storage, logs or exports.
- A protected class whose key is not in memory is never rewritten as plain JSON; saving it fails with `CG-2016`.
- Turning protection on deletes that class's existing plain automatic safety copies; changing the password re-encrypts them. Backups of protected classes stay encrypted unless the teacher explicitly confirms a plain copy.
- There is no password recovery. Exported reports (DOCX, PDF, JSON) are not encrypted.
- Unprotected classes remain readable JSON by design, so teachers can copy and inspect them.

## Reporting a vulnerability

Do not include real student data in a public report. Use GitHub private vulnerability reporting for security issues in this repository.
