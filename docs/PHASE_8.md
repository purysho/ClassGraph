# ClassGraph — Phase 8 Recovery Log

**Phase:** 8 — Native Desktop Application  
**Branch:** `feat/phase-8-native-desktop`  
**Base:** `main` after v0.7.0  
**Status:** Complete — Gate 8 passed; v0.8.0 released  
**Last updated:** 2026-10-02

## Correction

Phase 7 solved console visibility and autosave, but the downloadable build still opened ClassGraph in a browser and used a loopback HTTP server. That is not the intended desktop experience.

Phase 8 replaces the packaged browser/localhost wrapper with the same proven desktop architecture family used by EduBoard: Electron, isolated preload IPC, and electron-builder packages.

## Non-negotiable user experience

- ClassGraph opens in its own desktop window.
- Packaged ClassGraph does not bind a localhost/127.0.0.1 port.
- Closing the app window closes ClassGraph.
- Project files are normal, readable files in `Documents/ClassGraph/Projects`.
- Example filename: `Grade 5A English.classgraph.json`.
- Users can copy those files to cloud storage, USB, another PC, or a fresh ClassGraph install.
- Supported old `.json` / `.classgraph.json` files remain importable.
- Existing v0.7 local projects are migrated into the visible Documents library on first launch where possible.
- Windows, macOS, and Linux packages use the CG application icon, not the Node icon.
- Windows installs like a normal application and creates a ClassGraph shortcut.

## Architecture

The existing tested ClassGraph operations remain TypeScript. The HTTP route logic is factored into a transport-independent API handler.

- Source/dev HTTP mode may continue to exist for development and tests.
- Packaged desktop mode calls the same API handler through Electron IPC.
- Renderer has no Node integration.
- Preload exposes a narrow ClassGraph bridge only.
- No HTTP listener is started by the downloadable application.

## Visible project library

Desktop project root:

- Windows/macOS/Linux: the operating system Documents directory + `ClassGraph/Projects`.
- Backups: `Documents/ClassGraph/Backups`.
- Metadata: `Documents/ClassGraph/library.json`.

Project filenames are based on the class title and remain readable. ClassGraph scans project JSON by embedded project ID, so a user may manually rename or copy a valid project file without breaking the library.

## Deliverables

### P8.0 — Recovery and migration contract

- [x] Create Phase 8 branch and recovery log.
- [x] Define browser/localhost Phase 7 packaging as superseded.
- [x] Preserve old JSON compatibility.
- [x] Add one-time migration from the v0.7 hidden local library.

### P8.1 — Transport-independent ClassGraph API

- [x] Extract API operation handling from the HTTP server.
- [x] Keep HTTP wrapper for source/dev compatibility.
- [x] Add IPC transport using the same handler.
- [x] Add parity tests for representative HTTP vs IPC requests.

### P8.2 — Real desktop shell

- [x] Add Electron main process.
- [x] Add context-isolated preload bridge.
- [x] Add renderer bootstrap that routes ClassGraph API calls over IPC.
- [x] Load packaged renderer files directly; no browser launch and no localhost.
- [x] Closing the window terminates the app.

### P8.3 — Human-readable files

- [x] Save to OS Documents/ClassGraph/Projects.
- [x] Use title-based `.classgraph.json` filenames.
- [x] Handle duplicate titles safely.
- [x] Reopen recent projects by scanning files and matching project ID.
- [x] Keep rolling backups in Documents/ClassGraph/Backups.
- [x] Support manual file rename/copy without breaking project discovery.

### P8.4 — Packaging and icons

- [x] Add real CG `icon.ico`, `icon.icns`, and `icon.png`.
- [x] Windows NSIS installer with ClassGraph shortcut.
- [x] Windows portable build optional.
- [x] macOS DMG/ZIP for Apple Silicon and Intel.
- [x] Linux AppImage.
- [x] Remove Node SEA packaging from downloadable releases.

### P8.5 — Release

- [x] Bump to v0.8.0.
- [x] Update README download names and desktop behavior.
- [ ] Pass normal tests and production dependency audit.
- [x] Pass native Windows/macOS/Linux package smoke tests.
- [x] Merge to `main`.
- [x] Publish v0.8.0 and verify downloads.

## Current verification state

Current Phase 8 branch/PR: `feat/phase-8-native-desktop` / PR #11.

Verified on the current architecture:

- Core format, lint, typecheck and test suite pass.
- 169 tests pass, including visible-file storage, old-file import, manual rename discovery, v0.7 migration, HTTP/direct API parity, and a packaged-desktop no-localhost contract.
- Production dependency audit passes.
- Linux x64 unpacked Electron app passes its native self-test under Xvfb and AppImage packaging succeeds.
- Windows x64 unpacked Electron app passes its native self-test; installer/portable packaging is running in the current Gate 8 matrix.
- macOS Intel and Apple Silicon unpacked apps pass through build/self-test and are in package generation in the current Gate 8 matrix.
- The packaged Electron entry point contains no `createClassGraphServer`, `.listen(`, `127.0.0.1`, or `localhost` usage.

## Gate 8 and release evidence

Final Phase 8 PR: #11, merged to `main`.

Final PR-head native gate:

- Tests, formatting, lint and strict TypeScript — success.
- Production dependency audit — success.
- Desktop release workflow `37034361537` — all native builds success.
- Windows x64 Electron app self-test — success.
- Linux x64 Electron app self-test under Xvfb and AppImage package — success.
- macOS Apple Silicon Electron app self-test and package — success.
- macOS Intel Electron app self-test and package — success.
- Packaged desktop contract test confirms `src/electron-main.ts` contains no ClassGraph HTTP server startup, `.listen(`, `127.0.0.1`, or `localhost`.

Release publication:

- Version: `v0.8.0`.
- Release workflow `37035340695` — success.
- Published assets verified:
  - `ClassGraph-Setup.exe`
  - `ClassGraph-Portable.exe`
  - `ClassGraph-macOS-AppleSilicon.dmg`
  - `ClassGraph-macOS-AppleSilicon.app.zip`
  - `ClassGraph-macOS-Intel.dmg`
  - `ClassGraph-macOS-Intel.app.zip`
  - `ClassGraph-Linux-x64.AppImage`
  - `SHA256SUMS.txt`
- Windows package configuration uses the generated ClassGraph `build/icon.ico`, product name `ClassGraph`, and an NSIS desktop shortcut named `ClassGraph`.
- macOS packages use `build/icon.icns`; Linux uses `build/icon.png`.
- Readable projects are stored under the OS Documents folder at `ClassGraph/Projects`.
- Example project filename: `Grade 5A English.classgraph.json`.
- Existing supported JSON remains importable and Phase 7 hidden projects are migrated into the visible Documents library when possible.

## Gate 8

Phase 8 passes only when:

- packaged Windows/macOS/Linux builds launch a desktop window without starting a localhost listener;
- Windows installed executable and shortcut display the CG icon;
- project files are visible under Documents/ClassGraph/Projects with readable names;
- a copied or renamed valid project JSON is discovered and opens correctly;
- old supported JSON can be imported into a fresh install;
- representative desktop IPC operations match the existing ClassGraph API behavior;
- no renderer Node integration is enabled;
- existing provenance, missing-data, assistance, reporting, and planning behavior remains unchanged.
