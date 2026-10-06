# ClassGraph — Phase 14 Recovery Log

**Phase:** 14 — Browser end-to-end tests  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 13  
**Status:** Implemented — CI green  
**Last updated:** 2026-10-06

## Why

DESIGN.md §13 called for end-to-end smoke tests once a UI existed. `src/app-client.ts` is about
6,000 lines and had no automated coverage; every UI check so far was a manual Playwright script.

## What runs

`npm run test:e2e` builds the app, starts the development HTTP server on port 4427 with
`HOME`/`XDG_DATA_HOME` pointed at a fresh temporary folder, and runs `e2e/*.e2e.ts` in Chromium.
Any uncaught page error fails the test.

| Test                      | Covers                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Import → compare → export | .xlsx class list with Chinese headers, cross-tab, Include in report, Analysis JSON v1.1, PDF with Chinese names, DOCX contents |
| Update from GBK CSV       | encoding detection, preview of every change, merge applied                                                                     |
| Password protection       | enable with acknowledgement, lock, unlock screen at startup, wrong password, encrypted Backup JSON, remove protection          |
| Backup and restore        | Backup JSON download, Import / restore                                                                                         |

Fixtures: `e2e/fixtures/class-list.xlsx` (written by openpyxl) and `e2e/fixtures/update-gbk.csv`.

## CI

The Tests workflow gains an `e2e` job (Ubuntu): `npm ci`, `npx playwright install --with-deps
chromium`, `npm run test:e2e`. On failure it uploads the Playwright report and traces for 7 days.

New dev dependency: `@playwright/test` 1.56.1 (Apache-2.0). It is not shipped in the app.

## Verification

- [x] `npm run test:e2e` locally: 4 passed.
- [x] `npm run check` unaffected: Vitest still runs only `tests/`.
- [x] `e2e` job green in PR #15 (Tests run `37412057193`: Chromium installed, 4 passed).
