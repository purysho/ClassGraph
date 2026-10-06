# Contributing to ClassGraph

ClassGraph follows a small, test-first foundation while the data contract is still young.

Before opening a pull request, run:

```bash
npm install
npm run check
npm run test:e2e   # browser end-to-end tests (Playwright + Chromium)
```

The first time, install the browser with `npx playwright install chromium`. The end-to-end tests
build the app, start the development server against a temporary data folder, and drive the real
UI: spreadsheet import, comparisons, report exports, password protection, and backup/restore.

House rules:

- **Student data stays local by default.** Do not add network transmission of class/student data to core flows.
- **Provenance is not optional.** Derived or synthetic values must remain distinguishable from teacher-entered/imported/observed values.
- **No hidden profiling.** Do not infer psychological, diagnostic, social, or future-achievement labels from unrelated metrics.
- **Explain planning logic.** Seating/grouping decisions must be decomposable into visible rules and constraints.
- **Plain-language errors.** User-facing failures should say what happened, what to do next, and include a `CG-xxxx` code.
- **Core stays UI-independent.** React/Electron code must not leak into the analysis/planning core.
