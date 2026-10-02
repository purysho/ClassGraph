# ClassGraph — Phase 7 Recovery Log

**Phase:** 7 — Desktop UX and Local Saves  
**Branch:** `feat/phase-7-desktop-saves`  
**Base:** `main` after v0.6.0 and README/branding refresh  
**Status:** Complete — Gate 7 passed; v0.7.0 released  
**Last updated:** 2026-10-02

## Purpose

Make the downloadable build behave like a normal desktop application while preserving ClassGraph's lightweight browser UI and local-first architecture.

Phase 7 must solve three concrete user problems:

1. Windows launch must not leave a PowerShell/console window on screen.
2. Packaged applications must use the ClassGraph CG mark as their operating-system icon.
3. ClassGraph projects must survive app restarts automatically, while portable `.json` backups remain easy to import after reinstalling ClassGraph or moving to another computer.

## Storage model

ClassGraph keeps each validated project as portable Exchange v1 JSON in a small local project library.

Default data folders:

- Windows: `%LOCALAPPDATA%\\ClassGraph` (falling back to `%APPDATA%\\ClassGraph`)
- macOS: `~/Library/Application Support/ClassGraph`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/ClassGraph`

The library contains current project files plus a small rolling local backup before overwrites. It is not a database and does not change the canonical ClassGraph JSON format.

Portable recovery remains explicit:

- **Backup JSON** downloads the current project as a `.classgraph.json` file.
- **Import / restore backup** accepts a valid ClassGraph JSON file from an older installation or another computer and saves it into the local library.
- An imported project keeps its original project ID and provenance.

## Phase 7 slices

### P7.0 — Recovery contract

- [x] Create Phase 7 branch and recovery log.
- [x] Preserve the Node SEA/browser architecture; no Electron migration.
- [x] Keep Exchange v1 JSON as the portable source of truth.

### P7.1 — Local project library

- [x] Add filesystem-backed project storage with platform-appropriate data directory.
- [x] Autosave validated projects after create, import, generation, and every accepted mutation.
- [x] List saved projects and reopen them after app restart.
- [x] Keep a rolling local safety copy before overwriting a project.
- [x] Test persistence across store re-instantiation.

### P7.2 — Restore and backup UX

- [x] Show saved projects on the start/projects screen.
- [x] Reopen the last project automatically on desktop startup.
- [x] Rename export action to Backup JSON.
- [x] Make import language explicitly cover restore/new-computer scenarios.
- [x] Keep imported JSON schema validation before any local save.

### P7.3 — Quiet desktop launch

- [x] Windows packaged executable uses GUI subsystem and does not create a console window.
- [x] A second launch reopens an already-running ClassGraph instance instead of starting a duplicate hidden server.
- [x] Native self-test still verifies the Windows GUI executable by process exit code.
- [x] Packaged UI exposes an explicit Quit control so the hidden local server can be stopped cleanly.

### P7.4 — OS branding

- [x] Windows executable embeds the CG icon.
- [x] macOS app bundle contains a CG `.icns` icon.
- [x] Linux package contains a CG PNG and desktop-entry file.
- [x] Keep icon-generation tooling build-time only.

### P7.5 — Release

- [x] Update README with autosave/restore behavior and data locations.
- [x] Bump to v0.7.0.
- [x] Pass normal tests, dependency audit, and four native desktop builds.
- [x] Merge Phase 7 to `main`.
- [x] Publish v0.7.0 and verify all platform downloads.

## Implementation checkpoint

Current branch implementation includes:

- `src/project-store.ts` — JSON-backed project library, last-project tracking, and bounded rolling backups.
- `src/server.ts` — project-library list/open APIs plus autosave hooks for create/import/generate/mutate.
- `src/app-client.ts` — recent projects, automatic reopen, Backup JSON, and Import / restore backup UX.
- `src/desktop-main.ts` — existing-instance detection plus desktop project-store enablement.
- `scripts/build-desktop.mjs` — CG Windows icon resources and PE GUI-subsystem patch.
- `.github/workflows/desktop-release.yml` — Windows GUI self-test, macOS `.icns`, and Linux desktop/icon packaging.
- `tests/project-store.test.ts` and `tests/project-store-server.test.ts` — filesystem persistence and API autosave/restore coverage.

## Gate 7 verification evidence

Phase 7 PR: #10  
Merged-main commit: `e630d7530002f9f56b03217b2f7fa780f63e1b40`

PR verification:

- Tests workflow `37025567739` — success, 159/159 tests across 31 files.
- Dependency check workflow `37025567444` — success.
- Desktop release workflow `37025567714` — success on Windows x64, Linux x64, macOS Intel, and macOS Apple Silicon.

Merged-main verification and release:

- Tests workflow `37025991125` — success.
- Dependency check workflow `37025991512` — success.
- Desktop/release workflow `37025990866` — success.
- Windows x64 — GUI-subsystem executable, CG branding/metadata, and executable self-test passed.
- Linux x64 — executable self-test and packaged desktop assets passed.
- macOS Intel — executable self-test, app bundle, and CG icon packaging passed.
- macOS Apple Silicon — executable self-test, app bundle, and CG icon packaging passed.
- Release job — success; `v0.7.0` published from the merged-main commit.
- Published assets verified:
  - `ClassGraph-Windows-x64.exe`
  - `ClassGraph-macOS-AppleSilicon.app.zip`
  - `ClassGraph-macOS-Intel.app.zip`
  - `ClassGraph-Linux-x64.tar.gz`
  - `SHA256SUMS.txt`
- No Electron or other desktop runtime framework was added.
- Project persistence remains ordinary validated ClassGraph JSON on disk, with portable backup/restore through the existing schema.

## Release evidence

- Phase 7 PR #10 merged to `main`.
- Release: `v0.7.0` — published 2026-10-02.
- Verified release assets:
  - `ClassGraph-Windows-x64.exe`
  - `ClassGraph-macOS-AppleSilicon.app.zip`
  - `ClassGraph-macOS-Intel.app.zip`
  - `ClassGraph-Linux-x64.tar.gz`
  - `SHA256SUMS.txt`
- README latest-download buttons automatically resolve to v0.7.0.
- Windows build no longer opens a console/PowerShell window during normal launch.
- Packaged UI exposes **Quit** so the hidden local server can be stopped cleanly.
- Desktop project library autosaves locally and portable `.classgraph.json` backups can be restored on a reinstall or another computer.

## Gate 7

Phase 7 passes only when:

- project persistence is validated with tests using real filesystem writes in temporary directories;
- malformed backup JSON is rejected before storage;
- create/import/generate/mutate flows autosave when the local library is enabled;
- saved projects can be listed and reopened after a fresh store instance;
- Windows native packaging/self-test succeeds after converting the executable to GUI subsystem;
- Windows, macOS, and Linux packages contain ClassGraph CG branding;
- no Electron/runtime desktop framework is introduced;
- existing provenance, missing-data, assistance, privacy, and export boundaries remain unchanged.
