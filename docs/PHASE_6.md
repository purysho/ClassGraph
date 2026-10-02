# ClassGraph — Phase 6 Recovery Log

**Phase:** 6 — Cross-platform Desktop Releases  
**Branch:** `feat/phase-6-desktop-releases`  
**Base:** consolidated `main` after Phases 1–5  
**Status:** Complete — Gate 6 passed; v0.6.0 released  
**Last updated:** 2026-10-02

## Purpose

Phase 6 ships ClassGraph as downloadable desktop builds while preserving the existing lean local-first architecture. It must not introduce Electron, a cloud dependency, telemetry, or any requirement for a separately installed Node.js runtime.

## Deliverables

- Windows x64 single-file `.exe`.
- macOS Apple Silicon `.app.zip`.
- macOS Intel `.app.zip`.
- Linux x64 `.tar.gz` containing a self-contained executable.
- Embedded local UI assets so packaged builds do not need an adjacent resource directory.
- Default-browser launch on desktop startup while binding only to loopback.
- Executable `--self-test` that verifies the embedded UI and local health endpoint.
- GitHub Actions matrix builds on native Windows, macOS arm64, macOS Intel, and Linux runners.
- Tagged releases attach all four downloads plus SHA-256 checksums.
- Unsigned/unnotarized status remains explicit until signing credentials are intentionally supplied.

## Architecture

Use Node 22 Single Executable Applications (SEA), the official Node mechanism for distributing an application to machines that do not have Node installed.

Packaging-only tools are pinned and invoked by the build script:

- `esbuild@0.28.2` bundles the TypeScript/server dependency graph into one CommonJS entry script for Node 22 SEA.
- `postject@1.0.0-alpha.6` injects the generated SEA blob into the platform's Node binary.

These are build-time tools only and are not added to ClassGraph runtime dependencies.

The SEA blob embeds:

- `app/index.html`
- `app/styles.css`
- compiled `dist/app-client.js`

The packaged desktop entry point always binds to `127.0.0.1`. It opens the resulting local URL in the default browser. If the default port is already in use, it falls back to an ephemeral loopback port.

## Phase 6 slices

### P6.0 — Consolidate completed phases

- [x] Merge PR #3 (Phase 1) into `main`.
- [x] Retarget and merge PR #4 (Phase 2) into `main`.
- [x] Retarget and merge PR #5 (Phase 3) into `main`.
- [x] Retarget and merge PR #6 (Phase 4) into `main`.
- [x] Retarget and merge PR #7 (Phase 5) into `main`.
- [x] Create Phase 6 branch from consolidated `main`.

### P6.1 — Embedded desktop runtime

- [x] Add embedded static-asset support to the local server.
- [x] Add desktop entry point with loopback-only binding, browser launch, port fallback, and self-test.
- [x] Add regression coverage for embedded assets.

### P6.2 — Native SEA packaging

- [x] Add deterministic platform-local SEA build script.
- [x] Produce Windows x64 executable.
- [x] Produce Linux x64 executable.
- [x] Produce macOS arm64 and x64 executables.
- [x] Keep packaging tools out of runtime dependencies.

### P6.3 — Release automation

- [x] Add four-platform GitHub Actions matrix.
- [x] Run executable self-test on each native runner.
- [x] Package macOS app bundles and Linux archive.
- [x] Attach downloads to tagged GitHub releases.
- [x] Generate SHA-256 checksums.

### P6.4 — Documentation and release

- [x] Document desktop downloads and unsigned-build warnings.
- [x] Update DESIGN and README status.
- [x] Pass Gate 6.
- [x] Merge Phase 6 to `main`.
- [x] Create first Phase 6 release tag and verify attached assets.

## Gate 6

Phase 6 is complete only when:

- normal format, lint, strict typecheck, tests, build, and production dependency audit pass;
- packaged builds start without a separately installed Node.js runtime;
- every platform executable passes `--self-test` on its native GitHub runner;
- packaged UI assets are served from the executable and contain no remote dependency;
- desktop runtime binds to loopback only;
- Windows, macOS arm64, macOS Intel, and Linux release artifacts are produced;
- tagged release contains all four downloads and a SHA-256 checksum manifest;
- no Electron/runtime framework is added;
- no packaging tool is added to runtime dependencies;
- existing local-first, provenance, missing-data, assistance, privacy, and EduBoard boundaries remain unchanged.

## Completion evidence

- Phase 6 PR: #8 — merged to `main`.
- Merge commit: `2cba3401e036f60f1155182bf99fe9bc61a59bad`.
- Final merged-main Tests run: `37015686618` — success.
- Final merged-main Dependency check run: `37015687123` — success.
- Final desktop/release run: `37015687127` — success.
- Native executable self-tests passed on Windows x64, Linux x64, macOS Apple Silicon, and macOS Intel.
- Release job passed and published `v0.6.0`.
- Release assets verified:
  - `ClassGraph-Windows-x64.exe`
  - `ClassGraph-macOS-AppleSilicon.app.zip`
  - `ClassGraph-macOS-Intel.app.zip`
  - `ClassGraph-Linux-x64.tar.gz`
  - `SHA256SUMS.txt`
- No Electron/runtime desktop framework was added.
- Build tooling remains packaging-only and ClassGraph runtime dependencies remain unchanged.

## Signing boundary

Phase 6 initially uses unsigned Windows builds and ad-hoc-signed macOS builds. Windows SmartScreen and macOS Gatekeeper may warn users. Authenticode signing and Apple Developer ID notarisation require external credentials and are deliberately separate from the source/release pipeline until those credentials are available.
