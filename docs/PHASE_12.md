# ClassGraph — Phase 12 Recovery Log

**Phase:** 12 — Import class lists from spreadsheets  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 11  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

Classes could only be created by typing students in, restoring ClassGraph JSON, or generating
a synthetic class. Most teachers already keep rosters and marks in Excel, WPS or Google Sheets.

## Rules

- The teacher decides what every column means; ClassGraph only suggests.
- Nothing is saved until the teacher has seen the preview and pressed **Create class** or
  **Update class**.
- Every imported value carries `imported` provenance naming the file
  (`spreadsheet:<file name>`).
- Blank cells become explicit **Missing** values, never zero, "no" or an empty string.
- When updating an existing class, a blank cell never erases a value that is already recorded,
  students missing from the file are left alone, and every value that would change is listed
  before applying.
- Any problem (a non-number in a number column, an unknown category, a duplicate or missing
  student ID) blocks the import and is listed by row and column.

## Supported files

- **CSV / TSV:** comma, semicolon or tab, quoted fields. UTF-8 (with or without BOM) or
  GB18030/GBK, which Chinese Excel often uses for CSV; the encoding is detected automatically.
- **.xlsx:** shared, inline and rich-text strings, numbers, booleans, and date-formatted cells
  (read as `YYYY-MM-DD`). Formulas use their saved value. Every sheet is offered.
- **.xls** (pre-2007 Excel) is refused with a message to save as .xlsx or CSV.
- Limits: 2,000 students and 100 columns per import.

## Column suggestions

- Headers such as `学号`, `编号`, `ID`, `Student number` become the student ID; `姓名`, `Name`
  become the name; `标签`, `Tags` become tags (split on `,` `;` `，` `；` `、` `|`).
- Other columns become metrics. The kind is inferred from the values: all numbers (including
  full-width digits and thousands separators) → number; yes/no, true/false, 是/否 → yes/no; a few
  repeated values → category; dates and everything else → text. The teacher can change any of
  these, and can turn a category into an ordinal scale and set its order.
- When updating a class, headers that match an existing metric's label or key map to it.
- Without an ID column, a new class gets IDs `s001`, `s002`… in row order. Updating an existing
  class requires an ID column.

## Deliverables

- [x] `src/table-read.ts`: CSV/TSV and .xlsx reader (no new spreadsheet library; uses `jszip`,
      now a runtime dependency).
- [x] `src/table-import.ts`: suggestions, preview plan, apply; request validated with zod.
- [x] `POST /api/import/table/read`, `/suggest`, `/preview`, `/apply` (apply autosaves).
- [x] Start screen card **Import a class list**; Students view **Update from spreadsheet**.
- [x] Error codes: `CG-1101` unreadable file, `CG-1102` import blocked by listed problems.

## Verification

- [x] `npm run check`: format, lint, strict typecheck, 219 tests, build.
- [x] Browser development mode with an openpyxl-written .xlsx (two sheets, Chinese headers,
      tags, blanks, a date column) and a GBK-encoded CSV update: class created, ordinal scale set
      in the UI, update listed both changes, added one student, kept a blank from erasing a
      recorded value, and wrote `imported` provenance naming each file. No console errors.
