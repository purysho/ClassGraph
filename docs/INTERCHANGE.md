# ClassGraph interchange contracts

ClassGraph uses versioned JSON as the machine-readable boundary between ClassGraph and companion applications such as EduBoard.

## ClassGraph Exchange v1

```text
schemaVersion: "1.0"
```

The canonical runtime validator lives in `src/schema.ts`.

### Exchange rules

1. Student IDs are required; names are optional.
2. Every metric value must have a matching metric definition.
3. Missing values are represented as `null`, never silently as zero/false/average.
4. Important fields may carry field-level provenance using stable JSON-pointer-like paths.
5. `derived` and `synthetic` values remain distinguishable from `observed`, `teacher-entered`, and `imported` values.
6. ClassGraph does not infer hidden social relationships. Relationship edges must be explicit or marked synthetic.
7. `extensions` may carry future application-specific data. Core readers must preserve or ignore unsupported extension data rather than reinterpret it as core data.

### Optional `reporting` block (v0.10+)

```text
reporting?: { comparisons?: ReportComparison[] }   // at most 24

ReportComparison =
  | { kind: "crosstab"; rowMetricKey; columnMetricKey }        // category / ordinal / boolean
  | { kind: "association"; xMetricKey; yMetricKey }            // number, two different metrics
  | { kind: "group-summary"; metricKey; basis: "tag" | "planning-group" }  // any kind except text
```

- Stores the teacher's choice of comparisons for reports. It never stores computed results.
- Every referenced metric must exist and be eligible for that comparison kind; duplicates are rejected.
- Removing a metric removes the selections that reference it.
- Selection changes record `teacher-entered` provenance at `/reporting/comparisons`.
- The field is additive and optional, so the Exchange schema stays `1.0`. Releases before v0.10
  ignore and drop it on save; no student data is affected.

## Phase 3 portable exports

### `classgraph-analysis` v1

Contains:

- project identity;
- descriptive analysis;
- completeness/missingness;
- provenance-kind summary;
- sorted synthetic provenance paths;
- explicit limitations.

It contains no imputed student values.

**v1.1** (v0.10+) adds `comparisons`: one entry per teacher-selected comparison, in selection
order, each with a stable `id`, the `selection`, and exactly one of `crossTab`, `association`
or `groupSummary`. Results are recomputed from the project at export time. Association entries
carry the coefficient (or a withheld reason), pair count, omitted count and the non-causation
caveat, but no per-student points. All v1.0 fields are unchanged.

### `classgraph-seating-plan` v1

Contains only persisted teacher-approved/current planning state:

- room geometry;
- approved/persisted seat assignments;
- planning rules;
- saved groups;
- relevant room/planning provenance;
- limitations.

Transient seating/grouping candidate search results are not part of the canonical project and therefore cannot leak into this export.

## EduBoard hand-back v1

```text
format: "classgraph-eduboard-handback"
version: "1.0"
targetApplication: "EduBoard"
targetContractVersion: "1"
```

The ClassGraph runtime contract lives in `src/eduboard-handback.ts`.

The envelope separates four data classes:

1. **sourceData**
   - student references;
   - values whose provenance is only `observed`, `teacher-entered`, or `imported`;
   - excludes planning/room paths.

2. **derivedAnalysis**
   - ClassGraph descriptive summaries;
   - never presented as raw observed EduBoard student data;
   - does not include the analysis export's teacher-selected `comparisons`.

3. **approvedPlanning**
   - persisted ClassGraph room/planning state;
   - grid assignments are converted to EduBoard-compatible zero-based `row` / `col` coordinates;
   - custom seats without row/column coordinates remain explicitly unmapped.

4. **syntheticPaths / derivedPaths / provenance**
   - retains the evidence needed to prevent synthetic or derived values from masquerading as observed fields.

### EduBoard compatibility rules

Current EduBoard contract evidence is based on EduBoard `main` at commit `fe04d196ddab8bf46d845156752c73b73af02849`:

- `Student.id` is the stable student identifier;
- `ClassSection` stores `seatingRows` and `seatingCols`;
- `SeatAssignment` uses `studentId`, zero-based `row`, and zero-based `col`;
- `assignSeat(classId, studentId, row, col)` is an explicit repository action.

The Phase 3 adapter therefore requires:

- an EduBoard target class selected explicitly;
- exact student-ID matches only;
- zero-based row/column seat coordinates;
- no name-based matching;
- no automatic overwrite of observed EduBoard data;
- no database write as part of the validation/parser contract.

The matching EduBoard parser/fixture tests live on isolated branch `feat/classgraph-handback-contract` / PR #62. That branch is intentionally non-writing: it validates and plans prospective writes but does not call EduBoard database/repository mutation functions.

## Unsupported or future fields

- ClassGraph `extensions` are preserved explicitly in the hand-back envelope.
- Source-safe fields are not accepted if their paths are also declared synthetic or derived.
- Planning values stay under `approvedPlanning`; they are never reclassified as source observations.
- A future hand-back version must change the explicit envelope version when compatibility semantics change.

## Human-readable formats

DOCX and PDF are presentation formats, not interchange sources of truth.

- DOCX supports full Unicode content through WordprocessingML.
- PDFs whose text fits the built-in Latin fonts use Helvetica, unchanged from earlier releases.
- Any other text (for example Chinese names) switches the whole PDF to the bundled Noto Sans SC
  subset. Only the glyphs a document uses are embedded, so a typical class PDF stays well under
  100 KB. Bold is drawn with a fill-and-outline effect because one weight is bundled.
- Characters the bundled font does not cover (for example emoji, Hangul, or CJK Extension A/B)
  make export fail with `CG-5004`, naming the characters, rather than substituting or dropping
  them. DOCX export still works for such text.
- Font: Noto Sans SC (SIL Open Font License 1.1), pinned upstream commit and checksums in
  `scripts/build-cjk-font.py`; licence text in `assets/fonts/OFL.txt`.
