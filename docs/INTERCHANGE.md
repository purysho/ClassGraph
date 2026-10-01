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
   - never presented as raw observed EduBoard student data.

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
- The current lean PDF path uses PDF built-in fonts. If any rendered text cannot be encoded safely, ClassGraph fails with `CG-5004` rather than substituting or corrupting it.
- A future packaged Unicode PDF font requires a separate licensing/size review before bundling.
