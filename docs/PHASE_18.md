# ClassGraph — Phase 18 Recovery Log

**Phase:** 18 — Comparing terms side by side  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 17  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

Teachers keep one ClassGraph class per term, but they could not see two terms of the same class
together.

## Rules

- **Strictly descriptive.**
  - ClassGraph shows what was recorded in each term and how matched values differ.
  - It never labels a change as better or worse, ranks students, or suggests why a value changed.
  - Changes are described as _higher_, _lower_, _the same_ or _a different value_.
- **Matching.**
  - Students are matched by **student ID only**, never by name.
  - Metrics are matched by their **key**.
- **Missing values.**
  - Missing and not-recorded values are never filled in.
  - A student without a recorded value in both terms is counted as _not compared_ for that
    metric.
- **When a metric is not compared.** It is listed with the reason, in any of these cases:
  - it exists in only one term;
  - its type changed;
  - its scale or unit changed (number min/max/unit, or the ordinal scale);
  - it is a text metric.
- **Nothing is saved.** A comparison changes nothing and is not stored.

## What changed

- **Comparison** (`src/term-comparison.ts`, `compareTerms`):
  - roster overlap, plus who is only in the earlier or only in the later term;
  - for each comparable metric:
    - each term's counts (recorded, missing, not recorded);
    - numbers: median, mean, minimum and maximum;
    - ordinal, category and yes/no: a count for each value;
    - matched students: higher, lower and same counts;
    - numbers: median and mean change;
    - ordinal: change in scale steps;
    - ordinal, category and yes/no: a transition table of earlier value against later value.
- **CSV export** (`termComparisonCsv`):
  - one row per student, with earlier, later and change columns for each metric;
  - states are written as words (`missing`, `not-recorded`, `not-in-term`, `not-compared`), so a
    blank cell never stands in for a value;
  - text cells that would start a spreadsheet formula are prefixed with `'`;
  - the file starts with a UTF-8 BOM, so Excel shows Chinese names correctly.
- **Next term** (`startNextTerm`). It creates a new class with the same students (IDs, names, tags)
  and metric definitions, and nothing recorded.
  - Seating, groups, relationships and notes are not copied.
  - Copied fields have `derived` provenance with source `next-term:<projectId>`.
- **API:**
  - `POST /api/compare/terms` and `POST /api/export/term-comparison-csv` take the open class plus
    the other term, given as `otherProjectId` (a saved class; locks are respected) or `otherText`
    (a backup file).
  - A password-protected backup is decrypted in memory only when `otherPassword` is given;
    without it, the request fails with CG-2015.
  - `currentTerm: 'earlier'` makes the open class the earlier term.
  - Comparing a class with an identical copy of itself is refused with CG-3012.
  - `POST /api/project/next-term` creates and saves the next term.
- **Interface.** A new **Terms** view (学期对比) in the sidebar has:
  - a form to compare with a saved class or a backup file;
  - roster cards and a metric card for each compared metric, with expandable per-student
    values;
  - a **Not compared** list and **Download CSV**;
  - **Start the next term from this class**.

  It is fully translated into Chinese, and it passes axe in both themes.

## Tests

- **`tests/term-comparison.test.ts`** covers:
  - matching by ID;
  - numeric, ordinal and category descriptions;
  - missing values that are not compared;
  - the reasons a metric is not compared;
  - CSV states, formula guarding and the BOM;
  - the API with saved classes, backup files, protected backups, the open class as earlier term,
    and comparing a class with itself;
  - the next term.
- **`e2e/terms.e2e.ts`** restores two terms, compares them, checks the descriptions, runs axe on
  the results, downloads the CSV and starts a next term. The accessibility suite now also scans
  the Terms view.

## Limits

- Comparisons are not yet included in DOCX/PDF reports; the CSV is the export.
- Only two terms are compared at a time.
