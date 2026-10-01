# ClassGraph Phase 3 Progress Log

**Branch:** `feat/phase-3-reports`  
**Phase:** 3 — Reports, portable exports, and EduBoard hand-back contract  
**Base:** completed Phase 2 head `ef55a36e7e920d2f3024dfaa250c26b3b45cf499`  
**Status:** Complete — Gate 3 passed  
**Recovery instruction:** Phase 3 is closed. New implementation work begins at Phase 4 in `DESIGN.md`.

## Architecture outcome

Phase 3 preserves the lean local architecture from Phases 1–2:

- export construction is UI-independent TypeScript;
- the browser requests downloads from the loopback server;
- export endpoints revalidate the project and return bytes directly;
- normal export does not write a persistent server-side copy;
- no cloud document renderer, remote font, account, telemetry path, Electron migration, or live EduBoard database coupling was added.

Machine-readable exports:

- canonical ClassGraph Exchange v1 project JSON;
- `classgraph-analysis` v1;
- `classgraph-seating-plan` v1;
- `classgraph-eduboard-handback` v1.

Human-readable exports:

- DOCX descriptive report;
- PDF descriptive report;
- landscape seating-plan PDF.

## Dependency decision

Runtime dependencies added for Phase 3:

- `docx@9.7.1` — local WordprocessingML/DOCX generation;
- `pdf-lib@1.17.1` — local PDF generation.

Test-only dependency:

- `jszip@3.10.1` — structural inspection of generated DOCX OOXML packages.

The earlier proposal to use `@cantoo/pdf-lib` was not the final implementation. The shipped Phase 3 branch uses `pdf-lib@1.17.1` through the small adapter in `src/pdf-runtime.ts`.

PDF text safety rule:

- built-in PDF fonts are used only when every rendered character is encodable;
- unsupported Unicode fails with `CG-5004`;
- text is never silently replaced, dropped, romanised, or corrupted;
- DOCX remains the full-Unicode report option;
- no remote font is downloaded;
- bundling a Unicode PDF font remains a later packaging/licensing/size decision.

## Completion checklist

- [x] P3.0 — Phase 3 branch, recovery log, architecture/export contract
- [x] P3.1 — Canonical report snapshot, safe filenames, analysis/seating JSON exports
- [x] P3.2 — DOCX report generator and structural tests
- [x] P3.3 — PDF report generator and landscape seating-plan export
- [x] P3.4 — Local export endpoints and Reports workspace UI
- [x] P3.5 — EduBoard hand-back envelope, fixtures, compatibility/adapter tests
- [x] P3.6 — Export privacy, interoperability, round-trip/documentation polish
- [x] P3.7 — Gate 3 quality pass, dependency/size review, PR

## P3.0 — Branch and recovery contract

**Status:** Complete.

- created `feat/phase-3-reports` from the exact completed Phase 2 head;
- kept earlier phase PRs unmerged;
- retained the lean Node/TypeScript/local-browser architecture;
- created `docs/PHASE_3.md` before implementation;
- added `docs/PHASE3_LOG.md` as a stable alias so future recovery references cannot miss the authoritative log.

## P3.1 — Portable export model and JSON

**Status:** Complete.

Implemented `src/report-model.ts` and `src/export-json.ts`:

- deterministic report snapshot;
- provenance-kind counts;
- sorted synthetic provenance paths;
- deterministic limitations;
- safe Unicode-preserving cross-platform filename stems;
- `classgraph-analysis` v1;
- `classgraph-seating-plan` v1;
- persisted room/planning provenance subset.

Verified semantics:

- zero and `false` remain recorded;
- explicit `null` remains missing;
- absent properties remain not-recorded;
- missing values are never imputed;
- synthetic provenance remains explicit;
- transient candidate search state cannot leak because it is not part of the canonical project;
- path separators/control characters/reserved names cannot produce unsafe download paths.

Initial P3.1 verification: run `36902721626`, **82/82 tests across 16 files**.

## P3.2 — DOCX report

**Status:** Complete.

Implemented shared human-report content plus `src/report-docx.ts`.

Report sections:

1. Class overview
2. Data and provenance
3. Metric completeness/descriptive summaries
4. Roster values
5. Approved seating/groups
6. Planning rules
7. Limitations and interpretation

Properties:

- local generation only;
- deterministic section ordering;
- full Unicode text supported by WordprocessingML;
- explicit `Missing` vs `Not recorded`;
- no predictive outcome language;
- export does not mutate the project.

Structural tests use JSZip to inspect the generated OOXML package, `[Content_Types].xml`, `word/document.xml`, Unicode names, key headings, and missing-data wording.

## P3.3 — PDF report and seating-plan PDF

**Status:** Complete.

Implemented `src/report-pdf.ts`, `src/pdf-runtime.ts`, and coded export errors.

Descriptive PDF:

- portrait A4;
- same shared report content as DOCX;
- paginated locally.

Landscape seating-plan PDF:

- project/class title;
- front-of-room marker;
- grid geometry;
- disabled seats;
- approved student-seat assignments;
- lock state;
- seat tags where space allows;
- paginated grid chunks for larger rooms;
- landscape assignment-table fallback.

Tests verify:

- PDF signature;
- page count;
- portrait vs landscape dimensions;
- grid-room requirement;
- project immutability;
- `CG-5004` failure for unsupported Unicode.

P3.2/P3.3 core verification reached **89/89 tests across 18 files** on run `36906100773`.

## P3.4 — Reports workspace and local export boundary

**Status:** Complete.

The previously disabled Reports navigation item is now active.

Reports workspace provides:

- Project JSON;
- Analysis JSON;
- Seating Plan JSON;
- EduBoard Hand-back JSON;
- DOCX Report;
- PDF Report;
- Landscape Seating Plan PDF.

Teacher-facing behavior:

- summary of students, approved seats, groups, rules, synthetic paths, and derived paths;
- seating-plan exports disabled until room + persisted seating exist;
- privacy/local-generation notice;
- PDF Unicode limitation stated before download;
- download errors display their `CG-5xxx` code.

Server behavior:

- Phase 3 downloads are POST-only;
- project schema is revalidated for every request;
- safe Unicode-preserving filenames plus ASCII fallback;
- explicit MIME/content-disposition;
- `Cache-Control: no-store`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- generated bytes returned directly;
- no normal server-side persistent report copy.

A server-boundary regression discovered during testing was fixed so `ClassGraphExportError` codes such as `CG-5004` survive the HTTP boundary rather than becoming `CG-9001`.

## P3.5 — EduBoard hand-back contract

**Status:** Complete.

ClassGraph implementation:

- `src/eduboard-handback.ts`;
- versioned `classgraph-eduboard-handback` v1 envelope;
- representative fixture in `tests/fixtures/eduboard-handback-v1.json`;
- contract tests.

Envelope separates:

- `sourceData` — only observed / teacher-entered / imported source-safe values;
- `derivedAnalysis` — descriptive ClassGraph analysis;
- `approvedPlanning` — persisted room/seats/groups/rules only;
- `syntheticPaths`;
- `derivedPaths`;
- full provenance;
- explicit extensions passthrough.

EduBoard compatibility was checked against EduBoard `main` commit `fe04d196ddab8bf46d845156752c73b73af02849`:

- `Student.id` is the stable identifier;
- `ClassSection` exposes `seatingRows` / `seatingCols`;
- `SeatAssignment` uses `studentId`, zero-based `row`, zero-based `col`;
- seating writes are explicit repository actions.

Therefore hand-back v1 requires:

- explicit target EduBoard class selection;
- exact student-ID mapping only;
- zero-based grid row/column coordinates;
- no name-based matching;
- no automatic overwrite of observed EduBoard fields.

EduBoard companion contract:

- branch: `feat/classgraph-handback-contract`;
- PR #62: **Add non-writing ClassGraph hand-back contract**;
- parser + representative fixture + pure seat-write planning helper;
- no database/repository mutation call in the adapter.

EduBoard PR verification run `36907822822`:

- lint: success;
- typecheck: success;
- desktop tests: **476 passed, 1 skipped across 92 files**;
- Portal tests: **195 passed**;
- E2E smoke test: success;
- Lean Core build-size budget: success.

Additional EduBoard checks on the same head:

- Dependency check run `36907822663`: success;
- Private content guard run `36907822821`: success.

## P3.6 — Privacy, interoperability, documentation

**Status:** Complete.

Updated:

- `README.md`;
- `DESIGN.md`;
- `SECURITY.md`;
- `docs/INTERCHANGE.md`;
- recovery alias `docs/PHASE3_LOG.md`.

Documented:

- all versioned JSON envelopes;
- source/derived/synthetic separation;
- EduBoard mapping semantics;
- export MIME/privacy behavior;
- PDF Unicode failure behavior;
- no live database coupling;
- no automatic EduBoard write/apply path in Gate 3.

Representative fixtures contain fictional data only.

## P3.7 — Gate 3 verification and size review

**Status:** Complete.

ClassGraph implementation/docs verification run `36907854125`:

- `npm ci`: success;
- `npm run format:check`: success;
- `npm run lint`: success;
- `npm run typecheck`: success;
- `npm test`: **96/96 tests across 19 files**;
- `npm run build`: success;
- `npm audit --omit=dev --audit-level=high`: success.

Dependency-size review run `36907854453`:

- runtime direct dependencies:
  - `docx@9.7.1`;
  - `pdf-lib@1.17.1`;
  - `zod@4.6.5` resolved from the existing compatible range;
- installed directory sizes:
  - `docx`: **7,492 KiB**;
  - `pdf-lib`: **23,632 KiB**;
  - `zod`: **8,364 KiB**;
  - complete `node_modules`: **172,004 KiB** in CI;
- `npm pack --dry-run` application archive:
  - packed: **102,577 bytes**;
  - unpacked project files: **445,303 bytes**.

Interpretation:

- Phase 3 adds two justified runtime document libraries rather than a UI/document framework;
- JSZip is test-only;
- no Unicode font was bundled, avoiding an additional font asset/runtime dependency until a later packaging review;
- no React/Electron migration was introduced.

Gate 3 requirements satisfied:

- interchange schema documented;
- fixtures exist in ClassGraph and EduBoard;
- unsupported/future application data is preserved explicitly through extensions or rejected by contract validation;
- source-safe fields cannot also be declared synthetic/derived;
- derived/synthetic data cannot silently overwrite observed EduBoard data;
- target class selection and exact student-ID mapping are explicit;
- DOCX/PDF generation is local and tested;
- JSON contracts are versioned/deterministic;
- filenames are sanitised;
- PDF Unicode corruption is prevented;
- export endpoints do not persist report files;
- shipped high/critical dependency audit is green.

## Out of scope retained after Phase 3

- live shared EduBoard database;
- automatic application of the EduBoard hand-back file;
- cloud report rendering;
- email/share integrations;
- AI-written student evaluations;
- predictive outcome reports;
- inferred relationship networks;
- advanced scenario history/comparison;
- desktop packaging/release work unless required by a later phase.

## Next exact step

Proceed to **Phase 4 — Relationship graph and advanced comparison** from `DESIGN.md`.

Phase 4 must continue the existing rule: relationship/network edges are explicit teacher-supplied or clearly synthetic data only; ClassGraph must not infer friendships, conflicts, or other social relationships from unrelated metrics.
