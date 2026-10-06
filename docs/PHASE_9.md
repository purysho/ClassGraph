# ClassGraph — Phase 9 Recovery Log

**Phase:** 9 — Multi-metric descriptive comparisons  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after v0.8.1  
**Status:** Implemented on branch — awaiting review, merge and release decision  
**Last updated:** 2026-10-06

## Why this phase

DESIGN.md §6 has always required three multi-metric views that earlier phases never built:

- cross-tabulations between explicitly selected fields;
- correlation display for eligible numeric metrics, with an "association is not causation" note;
- selected metric summaries by group/tag.

Phase 9 delivers them as descriptive views only. It adds no runtime dependency, schema change,
or new persisted data.

## Non-negotiable rules

- The teacher explicitly picks every metric pair or metric/segment combination. There is no
  automatic "all pairs" correlation matrix to fish through.
- Explicitly missing and not-recorded values remain separate levels. Nothing is imputed.
- `false` and `0` are recorded values, never missing.
- A correlation coefficient is only shown with at least 3 students who have both values recorded
  and non-zero variation on both axes; otherwise the UI says why it is withheld.
- Every coefficient carries the non-causation caveat in the data model, not only in the UI.
- Segment summaries say when tags overlap (one student counted in several segments) and describe
  differences between segments as descriptive, not explanatory.
- Heatmap shading repeats the printed counts; the table is the primary, accessible view.

## Deliverables

### P9.0 — Main branch repair

- [x] `docs/V0.8.1_HOTFIX.md` failed `prettier --check`, so the Tests workflow on `main` was red.
      Reformatted.
- [x] Browser development mode (`npm run dev`) rendered a blank page since v0.8.1: `app-client.js`
      imports `api-client-transport.js`, but the dev server only served `app-client.js`. The dev
      server now serves the transport module, and a regression test checks that every runtime
      import of the browser client is served.
- [x] Removed a stray literal `\n` text node from `app/index.html`.

### P9.1 — UI-independent comparison core (`src/analysis-compare.ts`)

- [x] `buildCrossTab(project, rowMetricKey, columnMetricKey)` for category, ordinal and yes/no
      metrics. Authored scale order first, then explicit Missing / Not recorded levels when present.
- [x] `computePearsonAssociation(pairs)` with `too-few-pairs` / `no-variation` withholding.
- [x] `buildScatterView` now includes `association` computed over pairwise-recorded students.
- [x] `buildGroupSummary(project, metricKey, 'tag' | 'planning-group')`:
      numeric metrics → recorded / missing / not-recorded counts plus min, median, mean, max;
      levelled metrics → counts per level. Remainder segment for untagged / ungrouped students.
- [x] Error codes: `CG-3006` ineligible cross-tab metric, `CG-3007` identical cross-tab metrics,
      `CG-3008` ineligible group-summary metric.

### P9.2 — API routes

- [x] `POST /api/analysis/crosstab` `{ project, rowMetricKey, columnMetricKey }`.
- [x] `POST /api/analysis/group-summary` `{ project, metricKey, basis }`.
- [x] Both routes go through the shared transport-independent dispatcher, so desktop IPC and
      development HTTP behave identically.

### P9.3 — Graphs workspace

- [x] Scatter view shows Pearson r, pair count, direction in plain language, and the caveat.
- [x] New **Cross-tabulation** panel with totals, shaded counts and explicit Missing / Not recorded
      levels.
- [x] New **By tag or group** panel for student tags or planning groups.

### P9.4 — Verification

- [x] `npm run check`: format, lint, strict typecheck, 187 tests, build.
- [x] Browser development mode exercised with a 24-student demo project: scatter association,
      cross-tab, numeric-by-tag and ordinal-by-group views render with no console errors, including
      at phone width.
- [ ] Native desktop self-test matrix (runs in the desktop workflow on the PR).

## Not in scope

- Adding these views to DOCX/PDF reports or the versioned analysis JSON export. That changes a
  versioned export contract and should be a deliberate follow-up.
- Rank correlations or significance tests. A class-sized sample makes p-values easy to over-read;
  if added later they need the same withholding and caveat rules.

## Release

No `.release/` trigger has been added. Publishing v0.9.0 is a separate, explicit step after merge.
