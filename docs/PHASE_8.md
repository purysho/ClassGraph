# ClassGraph — Phase 8 Recovery Log

**Phase:** 8 — Native Desktop Application  
**Branch:** `feat/phase-8-native-desktop`  
**Base:** `main` after v0.7.0  
**Status:** In progress  
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
- [ ] Preserve old JSON compatibility.
- [ ] Add one-time migration from the v0.7 hidden local library.

### P8.1 — Transport-independent ClassGraph API

- [ ] Extract API operation handling from the HTTP server.
- [ ] Keep HTTP wrapper for source/dev compatibility.
- [ ] Add IPC transport using the same handler.
- [ ] Add parity tests for representative HTTP vs IPC requests.

### P8.2 — Real desktop shell

- [ ] Add Electron main process.
- [ ] Add context-isolated preload bridge.
- [ ] Add renderer bootstrap that routes ClassGraph API calls over IPC.
- [ ] Load packaged renderer files directly; no browser launch and no localhost.
- [ ] Closing the window terminates the app.

### P8.3 — Human-readable files

- [ ] Save to OS Documents/ClassGraph/Projects.
- [ ] Use title-based `.classgraph.json` filenames.
- [ ] Handle duplicate titles safely.
- [ ] Reopen recent projects by scanning files and matching project ID.
- [ ] Keep rolling backups in Documents/ClassGraph/Backups.
- [ ] Support manual file rename/copy without breaking project discovery.

### P8.4 — Packaging and icons

- [ ] Add real CG `icon.ico`, `icon.icns`, and `icon.png`.
- [ ] Windows NSIS installer with ClassGraph shortcut.
- [ ] Windows portable build optional.
- [ ] macOS DMG/ZIP for Apple Silicon and Intel.
- [ ] Linux AppImage.
- [ ] Remove Node SEA packaging from downloadable releases.

### P8.5 — Release

- [ ] Bump to v0.8.0.
- [ ] Update README download names and desktop behavior.
- [ ] Pass normal tests and production dependency audit.
- [ ] Pass native Windows/macOS/Linux package smoke tests.
- [ ] Merge to `main`.
- [ ] Publish v0.8.0 and verify downloads.

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
