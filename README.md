<p align="center">
  <img src="docs/branding/classgraph-mark.svg" width="112" alt="ClassGraph logo">
</p>

<h1 align="center">ClassGraph</h1>

<p align="center">
  <strong>Local-first classroom analysis, visualisation, seating and grouping.</strong><br>
  Turn explicit class data into useful views and explainable plans without sending it to a cloud service.
</p>

<p align="center">
  <img alt="Release" src="https://img.shields.io/github/v/release/purysho/ClassGraph?style=flat-square">
  <img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/purysho/ClassGraph/tests.yml?branch=main&label=tests&style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/data-local--first-4f46e5?style=flat-square">
  <img alt="Desktop app" src="https://img.shields.io/badge/app-native%20desktop-17212a?style=flat-square">
</p>

## Download

<p>
  <a href="https://github.com/purysho/ClassGraph/releases/latest/download/ClassGraph-Setup.exe"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white"></a>
  <a href="https://github.com/purysho/ClassGraph/releases/latest/download/ClassGraph-macOS-AppleSilicon.dmg"><img alt="Download for macOS Apple Silicon" src="https://img.shields.io/badge/Download-macOS%20(Apple%20Silicon)-000000?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/purysho/ClassGraph/releases/latest/download/ClassGraph-macOS-Intel.dmg"><img alt="Download for macOS Intel" src="https://img.shields.io/badge/Download-macOS%20(Intel)-555555?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/purysho/ClassGraph/releases/latest/download/ClassGraph-Linux-x64.AppImage"><img alt="Download for Linux" src="https://img.shields.io/badge/Download-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black"></a>
</p>

No Node.js installation is needed. These are normal desktop builds: ClassGraph opens in its own window and the packaged app does **not** start a localhost server or open your browser.

- **Windows** — install with `ClassGraph-Setup.exe`. The installer creates a ClassGraph desktop shortcut using the CG icon. A `ClassGraph-Portable.exe` download is also available if you prefer not to install it.
- **macOS Apple Silicon** — use `ClassGraph-macOS-AppleSilicon.dmg` for Apple-chip Macs.
- **macOS Intel** — use `ClassGraph-macOS-Intel.dmg` for Intel Macs.
- **Linux** — use `ClassGraph-Linux-x64.AppImage`.
- **Verify a download** — compare it with [`SHA256SUMS.txt`](https://github.com/purysho/ClassGraph/releases/latest/download/SHA256SUMS.txt).

**Updates:** from v0.10.0, use **Check for updates** on the start screen. The Windows installer and Linux AppImage can update themselves; macOS and the portable build link to the new download. ClassGraph never checks unless you ask or tick _Check automatically_.

> Windows builds are currently unsigned and macOS builds are ad-hoc signed rather than notarised. Windows SmartScreen or macOS Gatekeeper may therefore show a first-run warning.

![ClassGraph workspace overview](docs/screenshots/classgraph-overview.png)

## What ClassGraph does

| Understand the class                                                                  | Plan the room                                                                                                  | Keep decisions explainable                                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Descriptive distributions, completeness, scatter comparisons and accessible tables.   | Manual or generated seating and grouping with hard constraints, soft objectives, locks and reproducible seeds. | Provenance stays attached to data, missing values stay distinct, and candidate plans expose their rules and trade-offs. |
| Import or enter the data you actually use rather than adopting a fixed student model. | Track explicit relationship records, repeat neighbours and saved planning scenarios.                           | Export portable JSON, DOCX and PDF reports without turning derived or synthetic data into observed facts.               |

ClassGraph is designed to support teacher judgement. It does **not** diagnose students, infer hidden personality or ability traits, claim causation from correlations, or predict future attainment.

## Screenshots

| Start a workspace                                                 | Explore class data                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![ClassGraph start screen](docs/screenshots/classgraph-start.png) | ![ClassGraph graphs view](docs/screenshots/classgraph-graphs.png) |

## A local-first workflow

ClassGraph **saves projects automatically as ordinary files in your Documents folder**. The packaged app opens in its own desktop window; closing the window closes ClassGraph.

1. **Create, import from a spreadsheet, restore, or generate** a class.
2. **Record the metrics you choose** and keep observed, entered, imported, derived, and synthetic values distinguishable.
3. **Explore descriptive views** before making planning changes.
4. **Build seating or grouping candidates** against explicit constraints and objectives.
5. **Review the explanation**, then accept, change, or ignore the suggestion.
6. **Copy or back up the project file** whenever you want an extra copy in OneDrive, iCloud Drive, Google Drive, USB storage, or another computer.

The packaged desktop app does not bind to `127.0.0.1`, does not open a browser, and does not require a background PowerShell/terminal window.

### Password protection

Choose **Password…** in a class to encrypt its file and automatic safety copies. You will be asked for the password each time ClassGraph opens that class. **There is no way to recover a forgotten password**, so keep it somewhere safe. Reports you export (DOCX, PDF, JSON) are not encrypted.

### Saving, backups, and moving computers

Your projects are readable JSON files in:

`Documents/ClassGraph/Projects`

A class called **Grade 5A English** is saved as:

`Grade 5A English.classgraph.json`

You can see those files in File Explorer/Finder, copy them, sync them, or rename a valid ClassGraph project file. ClassGraph discovers projects by the project ID stored inside the file rather than relying on an opaque filename.

Each accepted edit autosaves. Before overwriting an existing project, ClassGraph keeps a small rolling safety copy under:

`Documents/ClassGraph/Backups`

Use **Backup JSON** when you want to choose a separate location for an extra copy. To recover after reinstalling ClassGraph or moving to a new computer, choose **Import / restore backup** and select a supported `.classgraph.json` or older ClassGraph `.json` file. Existing v0.7 projects are migrated from the old hidden local library into the visible Documents library when possible.

## Optional assistance

The assistance layer is optional and remains proposal-only.

- Draft a structured synthetic-class specification from teacher language.
- Explain existing descriptive analysis in plain language.
- Draft report wording from a validated report snapshot.
- Suggest candidate planning rules from explicit supported relationship records.
- Preview the exact context before any optional network request.
- Keep provider credentials outside project files, exports, and browser storage.

With no provider configured, the core app and offline assistance remain usable.

## Key principles

- **Local first.** Student data stays on the device unless the teacher explicitly exports or sends it.
- **Missing is not zero.** Explicitly missing and not-recorded values remain distinct.
- **Provenance is visible.** Observed, teacher-entered, imported, derived, and synthetic data are not collapsed together.
- **No black-box student labels.** ClassGraph does not silently infer intelligence, personality, motivation, behaviour diagnoses, or future outcomes.
- **Explain the plan.** Seating and grouping candidates show the constraints, objectives, penalties, and remaining trade-offs.
- **Accessible equivalents.** Important visual views retain table-based alternatives.
- **Portable by design.** Versioned JSON is the machine-readable source of truth.
- **Normal desktop packaging.** Windows, macOS and Linux builds use a native Electron shell with isolated IPC; the renderer has no Node integration and the packaged app does not run a localhost server.

## Run from source

Requirements:

- Node.js 22 or newer
- npm

For the desktop app:

```bash
npm ci
npm run build:desktop
npm start
```

A browser-served development mode is still available for source-level testing only:

```bash
npm run dev
```

That development mode uses the loopback server; the downloadable desktop builds do not.

Browser end-to-end tests (needs `npx playwright install chromium` once):

```bash
npm run test:e2e
```

### Optional network provider

Network assistance is **off by default**. To enable the generic HTTPS provider boundary, set:

```text
CLASSGRAPH_ASSISTANCE_URL=https://provider.example/assist
CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL=Example Provider
CLASSGRAPH_ASSISTANCE_TOKEN=optional-bearer-token
```

`CLASSGRAPH_ASSISTANCE_URL` must use HTTPS. Every network request still requires a visible context preview and explicit send confirmation.

## Current outputs

- Class lists imported from Excel (.xlsx) or CSV, with column mapping and a preview
- Editable student/class table
- Metric completeness views
- Numeric distributions and descriptive statistics
- Category, ordinal, boolean and text counts
- Numeric scatter comparisons with table equivalents and a caveated Pearson association
- Cross-tabulations of two category, ordinal or yes/no metrics
- Metric summaries by student tag or planning group
- Teacher-selected comparisons saved with the project and included in DOCX/PDF reports and Analysis JSON
- Field-level provenance inspection
- Manual and generated seating/grouping plans
- Explicit relationship table and relationship graph
- Repeat-neighbour history
- Saved planning-scenario comparisons
- Versioned project, analysis and seating-plan JSON
- Local DOCX descriptive reports
- Local PDF descriptive reports, including Chinese names and titles
- Landscape seating-plan PDFs, including Chinese names
- Offline assistance proposals
- Optional network assistance with pre-send disclosure

<details>
<summary><strong>Implementation history — Phases 1–15</strong></summary>

### Phase 1 — Workspace and analysis

Manual projects, Exchange JSON import/export, roster and metric editing, provenance inspection, descriptive completeness/distributions/statistics, scatter comparisons, and deterministic synthetic classes.

### Phase 2 — Seating and grouping

Grid rooms, enabled/disabled seats, seat tags, manual assignments, locks, hard constraints, soft objectives, deterministic seating/grouping candidates, explanations, and persisted planning state.

### Phase 3 — Reports and portable exports

Versioned analysis/seating exports, DOCX/PDF reports, landscape seating-plan PDF, safe local download endpoints, and portable interchange contracts.

### Phase 4 — Relationships and scenario comparison

Explicit relationship records, deterministic relationship network/table views, repeat-neighbour history, saved scenarios, and descriptive before/after comparisons.

### Phase 5 — Optional assistance

Offline proposal generation plus an optional direct-HTTPS provider boundary with exact-context preview, explicit confirmation, response validation, and no automatic project mutation.

### Phase 6 — Desktop releases

Self-contained Windows, macOS Apple Silicon, macOS Intel, and Linux builds using Node 22 Single Executable Applications, native executable self-tests, release automation, and SHA-256 checksums.

### Phase 7 — First desktop wrapper and local saves

Introduced filesystem-backed autosave, recent-project reopening, rolling local safety copies, and portable Backup JSON / Import restore flows. The browser/localhost wrapper from this phase is superseded by Phase 8.

### Phase 8 — Native desktop correction

ClassGraph now opens in its own desktop window with isolated IPC and no localhost server in packaged builds. Projects are readable title-based files in `Documents/ClassGraph/Projects`; Windows uses a normal installer/desktop shortcut with the CG icon, with macOS DMG and Linux AppImage packages.

### Phase 9 — Multi-metric comparisons

Teacher-selected cross-tabulations, a caveated Pearson association on the scatter view, and metric summaries by student tag or planning group. Missing and not-recorded values stay distinct, and correlation is withheld when there are too few complete pairs.

### Phase 10 — Comparisons in reports

**Include in report** saves a comparison with the project. Selected comparisons are recalculated at export time and appear in DOCX/PDF reports and Analysis JSON v1.1.

### Phase 11 — Chinese text in PDFs

PDF reports and seating plans embed a bundled Noto Sans SC subset when they contain Chinese or other non-Latin text, carrying only the characters each document uses. Characters the font cannot draw stop the export with `CG-5004` and are named, never dropped.

### Phase 12 — Spreadsheet import

Create a class from an `.xlsx` or CSV file (including GBK-encoded Chinese CSVs), or update an existing class from one. Teachers map each column, see every change and problem before saving, and blank cells stay Missing.

### Phase 13 — Password protection

Any class can be protected with a password. Its file and automatic safety copies are encrypted (AES-256-GCM, scrypt), backups stay encrypted unless a plain copy is explicitly chosen, and a forgotten password cannot be recovered.

### Phase 14 — End-to-end tests

A Playwright suite drives the real interface in CI: spreadsheet import, comparisons, report exports with Chinese names, password protection, and backup/restore.

### Phase 15 — In-app updates

**Check for updates** on the start screen. The Windows installer and Linux AppImage download and install new versions in the app; macOS and the portable build link to the download page. Nothing is checked unless you ask or opt in.

</details>

## Design and recovery documents

- [`DESIGN.md`](DESIGN.md) — product and architecture contract
- [`docs/INTERCHANGE.md`](docs/INTERCHANGE.md) — Exchange v1 interoperability notes
- [`docs/PHASE1_LOG.md`](docs/PHASE1_LOG.md) — Phase 1 recovery log
- [`docs/PHASE_2.md`](docs/PHASE_2.md) — Phase 2 recovery and Gate 2
- [`docs/PHASE_3.md`](docs/PHASE_3.md) — Phase 3 recovery and Gate 3
- [`docs/PHASE_4.md`](docs/PHASE_4.md) — Phase 4 recovery and Gate 4
- [`docs/PHASE_5.md`](docs/PHASE_5.md) — Phase 5 recovery and Gate 5
- [`docs/PHASE_6.md`](docs/PHASE_6.md) — Phase 6 recovery and Gate 6
- [`docs/PHASE_7.md`](docs/PHASE_7.md) — Phase 7 recovery and Gate 7
- [`docs/PHASE_8.md`](docs/PHASE_8.md) — Phase 8 native desktop correction and Gate 8
- [`docs/V0.8.1_HOTFIX.md`](docs/V0.8.1_HOTFIX.md) — v0.8.1 desktop transport hotfix
- [`docs/PHASE_9.md`](docs/PHASE_9.md) — Phase 9 multi-metric comparisons and Gate 9
- [`docs/PHASE_10.md`](docs/PHASE_10.md) — Phase 10 comparisons in reports and Gate 10
- [`docs/PHASE_11.md`](docs/PHASE_11.md) — Phase 11 Chinese text in PDFs and Gate 11
- [`docs/PHASE_12.md`](docs/PHASE_12.md) — Phase 12 spreadsheet import and Gate 12
- [`docs/PHASE_13.md`](docs/PHASE_13.md) — Phase 13 password protection and Gate 13
- [`docs/PHASE_14.md`](docs/PHASE_14.md) — Phase 14 browser end-to-end tests
- [`docs/PHASE_15.md`](docs/PHASE_15.md) — Phase 15 in-app updates

## Branding

- [ClassGraph mark](docs/branding/classgraph-mark.svg)
- [ClassGraph lockup](docs/branding/classgraph-lockup.svg)

## Third-party fonts

PDF exports bundle a subset of [Noto Sans SC](https://github.com/notofonts/noto-cjk) under the
SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).

## License and security

See [`SECURITY.md`](SECURITY.md) for the current security boundary and responsible-use notes.

---

<p align="center">
  <img src="docs/branding/classgraph-lockup.svg" width="620" alt="ClassGraph">
</p>
