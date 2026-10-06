# ClassGraph — Phase 10 Recovery Log

**Phase:** 10 — Comparisons in reports and exports  
**Branch:** `claude/intelligent-cerf-9dyifr` (restarted from `main` after v0.9.0)  
**Base:** `main` after v0.9.0  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Why this phase

Phase 9 added cross-tabs, scatter association and tag/group summaries to the Graphs view, but
they disappeared on reload and never reached the DOCX/PDF reports or the analysis JSON export.

## Rules

- Only the teacher's **selection** is persisted. Every result is recomputed from the current
  project at export time, so a report can never carry a stale or hand-edited figure.
- Selections are explicit: nothing is added to a report automatically.
- Report text keeps the Phase 9 rules: Missing and Not recorded stay distinct, withheld
  coefficients say why, the non-causation caveat is printed whenever an association is included,
  and overlapping tag segments are disclosed.
- The EduBoard hand-back is unchanged. Selected comparisons are teacher report choices, not
  source or planning data.

## Deliverables

### P10.1 — Persisted selections

- [x] Optional `reporting.comparisons` on the Exchange v1 project (additive; schema stays `1.0`).
- [x] Schema validation: metric exists, kind is eligible, two-metric comparisons use two different
      metrics, no duplicates, at most 24.
- [x] `add-report-comparison` / `remove-report-comparison` project mutations
      (`CG-3009` duplicate, `CG-3010` limit, `CG-3011` not selected).
- [x] `teacher-entered` provenance at `/reporting/comparisons`.
- [x] Removing a metric drops selections that reference it.

### P10.2 — Reports and exports

- [x] Report snapshot carries recomputed `comparisons`.
- [x] DOCX and PDF reports gain a **Selected comparisons** section after Metric summaries, only
      when at least one comparison is selected.
- [x] `classgraph-analysis` export v1.1 adds `comparisons`; all v1.0 fields unchanged.
- [x] `docs/INTERCHANGE.md` documents the `reporting` block and analysis v1.1.

### P10.3 — UI

- [x] **Include in report / Remove from report** under each scatter, cross-tab and tag/group
      result. Toggling saves without re-rendering, so the result stays on screen.
- [x] Reports view lists selected comparisons in order with **Remove** buttons.

### P10.4 — Verification

- [x] `npm run check`: format, lint, strict typecheck, 199 tests, build.
- [x] Browser development mode, end to end: included three comparisons, toggled one off and on,
      confirmed autosave wrote them to the project file, exported DOCX, PDF and Analysis JSON v1.1
      with all three comparisons, and removed one from the Reports view. No console errors.
- [ ] Native desktop self-test matrix on the PR.

## Not in scope

- Reordering selections (remove and re-add for now).
- Charts inside DOCX/PDF. Reports stay table-first.
