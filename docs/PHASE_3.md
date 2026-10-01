# ClassGraph Phase 3 Progress Log

**Branch:** `feat/phase-3-reports`  
**Phase:** 3 — Reports, portable exports, and EduBoard hand-back contract  
**Base:** completed Phase 2 head `ef55a36e7e920d2f3024dfaa250c26b3b45cf499`  
**Recovery instruction:** If work is interrupted, read this file first and continue from the first unchecked item.

## Phase 3 architecture decision

Phase 3 keeps the lean local architecture from Phases 1–2. Export construction remains UI-independent; the browser requests a preview/export from the loopback server and receives bytes or validated JSON.

No cloud document service, remote renderer, account, telemetry path, Electron migration, or live EduBoard database coupling is introduced.

### Export layers

1. **Canonical export view model**
   - builds a deterministic report snapshot from one validated ClassGraph project;
   - separates source data, descriptive/derived analysis, and teacher-approved planning decisions;
   - carries limitations and provenance summaries explicitly.

2. **Machine-readable exports**
   - `project.json` — existing canonical Exchange v1 project;
   - `analysis.json` — descriptive analysis only;
   - `seating-plan.json` — teacher-approved room/assignment/rule/group planning state only;
   - `eduboard-handback.json` — explicit hand-back envelope that never disguises derived/synthetic/planning values as observed source data.

3. **Human-readable exports**
   - DOCX report;
   - PDF report;
   - landscape seating-plan PDF/print view.

4. **Local export boundary**
   - validates the project again before export;
   - sanitises filenames;
   - uses explicit MIME/content-disposition headers;
   - never writes student data to a server-side persistent folder as part of normal export.

## Library decision

Phase 3 may add only export-specific runtime dependencies with a concrete need.

- `docx`: WordprocessingML generation for local DOCX output.
- `@cantoo/pdf-lib`: maintained TypeScript PDF generation fork for deterministic local PDFs.

PDF text safety rule:

- standard built-in PDF fonts may be used only when every rendered character is supported;
- if a report contains characters requiring a Unicode font, ClassGraph must embed a configured local font or fail with a readable `CG-5xxx` export error;
- names/text must never be silently replaced, dropped, romanised, or corrupted;
- no remote font download is allowed during export.

A later packaging phase may bundle an appropriately licensed Unicode font only after a size/licensing review.

## Phase 3 product rules

1. **Export is a snapshot, not a mutation.** Generating a report never changes project data.
2. **Teacher-approved planning is distinct from recommendations.** Only persisted assignments/groups are called approved planning decisions.
3. **Derived stays derived.** Analysis summaries are exported under a derived/analysis section, not merged into student source fields.
4. **Synthetic stays synthetic.** Provenance is retained and synthetic content cannot be presented as observed data.
5. **Missing stays missing.** Reports never fill absent values with zero/average/default.
6. **Names are optional.** IDs remain sufficient for every export.
7. **No hidden claims.** Reports describe recorded data and planning configuration; they do not predict attainment or claim a plan will improve learning.
8. **Portable JSON is versioned.** Analysis/seating/hand-back envelopes have their own explicit format versions.
9. **Safe filenames.** Project titles cannot create path traversal, control characters, or unsafe download names.
10. **Local only.** Core report generation needs no internet connection.

## Completion checklist

- [x] P3.0 — Phase 3 branch, recovery log, architecture/export contract
- [x] P3.1 — Canonical report snapshot, safe filenames, analysis/seating JSON exports
- [ ] P3.2 — DOCX report generator and structural tests
- [ ] P3.3 — PDF report generator and landscape seating-plan export
- [ ] P3.4 — Local export endpoints and Reports workspace UI
- [ ] P3.5 — EduBoard hand-back envelope, fixtures, compatibility/adapter tests
- [ ] P3.6 — Export privacy, interoperability, round-trip/documentation polish
- [ ] P3.7 — Gate 3 quality pass, dependency/size review, PR

## P3.0 — Phase 3 checkpoint

**Status:** Complete.

- created `feat/phase-3-reports` from the exact completed Phase 2 head;
- kept PR #3 and PR #4 unmerged;
- created this recovery log before implementation;
- confirmed Phase 3 scope from `DESIGN.md`;
- defined separation between source fields, derived analysis, and teacher-approved planning;
- selected local-only DOCX/PDF generation strategy;
- defined Unicode PDF failure behaviour so names/text are never silently corrupted.

## P3.1 — Portable export model and JSON

**Status:** Complete.

Implemented:

- `src/report-model.ts`
  - deterministic report snapshot;
  - roster references with optional names;
  - descriptive analysis reuse from the Phase 1 analysis core;
  - provenance-kind counts;
  - sorted synthetic provenance paths;
  - deterministic limitations based only on stored project state;
  - room/planning state copied without mutation.

- `src/export-json.ts`
  - `classgraph-analysis` v1 envelope;
  - `classgraph-seating-plan` v1 envelope;
  - deterministic pretty JSON serialization;
  - planning/room provenance subset;
  - persisted assignments/rules/groups only;
  - safe Unicode-preserving cross-platform filename stems;
  - traversal separators, control characters and Windows reserved names handled explicitly.

Important semantics verified:

- zero and `false` remain recorded values;
- explicit `null` remains missing;
- absent metric properties remain not-recorded;
- no missing value is imputed;
- synthetic provenance remains explicit;
- seating-plan export cannot contain transient candidate state because candidates are never part of the canonical project;
- leading traversal dots/path separators are removed from download names.

Verified P3.1 head: `c8f844783e1a81e28bc7bf9bf06361385601e3dd`.

Read-only Phase 3 check run `36902721626`:

- `npm ci`: **success**;
- `npm run format:check`: **success**;
- `npm run lint`: **success**;
- `npm run typecheck`: **success**;
- `npm test`: **success — 82/82 tests across 16 files**;
- `npm run build`: **success**;
- `npm audit --omit=dev --audit-level=high`: **success**.

## P3.2 — DOCX report

Report sections:

1. Class overview
2. Data/provenance summary
3. Metric completeness and descriptive summaries
4. Selected/current tables
5. Approved seating/group plan
6. Planning rules
7. Limitations and interpretation notes

Requirements:

- local generation;
- no remote images/fonts/templates;
- deterministic section ordering;
- optional names handled cleanly;
- explicit missing/not-recorded language;
- no predictive wording;
- structural tests inspect generated OOXML/ZIP entries and key report text.

## P3.3 — PDF and seating-plan export

PDF report mirrors the DOCX report content.

Landscape seating-plan output must include:

- class/project title;
- front-of-room marker;
- grid geometry;
- disabled seats;
- approved student-seat assignments;
- lock state where relevant;
- seat tags when space permits;
- table/legend fallback for IDs/names.

Requirements:

- no silent Unicode corruption;
- deterministic page dimensions/orientation;
- printable margins;
- clear `CG-5xxx` error when Unicode text requires a font that is unavailable;
- structural tests validate PDF signature/page count/landscape page dimensions and core text where practical.

## P3.4 — Reports workspace and endpoints

Replace the disabled `Reports` navigation item.

UI:

- export summary;
- JSON buttons:
  - Project JSON
  - Analysis JSON
  - Seating Plan JSON
  - EduBoard Hand-back JSON
- document buttons:
  - DOCX Report
  - PDF Report
  - Landscape Seating Plan PDF
- concise privacy/provenance notice;
- clear disabled-state explanation when no room/approved seating exists.

Server:

- export endpoints are POST-only;
- project validated on every export request;
- response uses no-store/nosniff/no-referrer;
- filenames sanitised;
- no persistent server-side copy.

## P3.5 — EduBoard hand-back contract

The hand-back envelope must make data class explicit, for example:

```ts
interface EduBoardHandbackV1 {
  format: 'classgraph-eduboard-handback'
  version: '1.0'
  project: { projectId: string; title: string; schemaVersion: '1.0' }
  sourceData: {/* source/imported/teacher/observed references */}
  derivedAnalysis: {/* descriptive summaries */}
  approvedPlanning: {/* persisted assignments/groups/rules */}
  syntheticPaths: string[]
  provenance: Record<string, ProvenanceEntry>
  extensions?: Record<string, unknown>
}
```

Gate 3 requires:

- interchange schema documented;
- ClassGraph fixtures;
- adapter/contract tests against the relevant EduBoard import expectations;
- unsupported fields rejected or preserved explicitly;
- derived/synthetic data cannot overwrite EduBoard observed data without explicit mapping/approval.

No live EduBoard database/API coupling is required for Gate 3.

## P3.6 — Privacy/interoperability polish

- update `docs/INTERCHANGE.md`;
- update `SECURITY.md`;
- update README and DESIGN status;
- document PDF Unicode-font configuration/failure behaviour;
- verify export endpoints never persist payloads;
- document MIME types and filenames;
- add representative fixtures without real student data.

## P3.7 — Gate 3 quality pass

Gate 3 passes only when:

- format/lint/strict typecheck/tests/build are green;
- shipped high/critical dependency audit is green;
- DOCX/PDF generation is local and tested;
- JSON export contracts are versioned and deterministic;
- filenames are sanitised;
- no silent Unicode corruption;
- EduBoard hand-back contract is documented and fixture-tested;
- derived/synthetic values cannot masquerade as observed data;
- temporary CI helpers are removed;
- this recovery document and PR are current.

## Out of scope for Phase 3

- live shared EduBoard database;
- automatic overwrite of EduBoard student records;
- cloud report rendering;
- email/share integrations;
- AI-written student evaluations;
- predictive outcome reports;
- relationship-network visualisation;
- advanced scenario history/comparison;
- desktop packaging/release work unless required for export correctness.

## Next exact step

Implement **P3.2 — DOCX report generation** from the canonical report snapshot. Add the export dependency only after lockfile/audit review, keep report wording descriptive, and structurally test generated OOXML rather than relying on visual inspection alone.
