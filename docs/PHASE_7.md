# ClassGraph — Phase 7 Recovery Log

**Phase:** 7 — Desktop UX and Local Saves  
**Branch:** \`feat/phase-7-desktop-saves\`  
**Base:** \`main\` after v0.6.0 and README/branding refresh  
**Status:** In progress  
**Last updated:** 2026-10-02

## Purpose

Make the downloadable build behave like a normal desktop application while preserving ClassGraph's lightweight browser UI and local-first architecture.

Phase 7 must solve three concrete user problems:

1. Windows launch must not leave a PowerShell/console window on screen.
2. Packaged applications must use the ClassGraph CG mark as their operating-system icon.
3. ClassGraph projects must survive app restarts automatically, while portable \`.json\` backups remain easy to import after reinstalling ClassGraph or moving to another computer.

## Storage model

ClassGraph keeps each validated project as portable Exchange v1 JSON in a small local project library.

Default data folders:

- Windows: \`%LOCALAPPDATA%\\ClassGraph\` (falling back to \`%APPDATA%\\ClassGraph\`)
- macOS: \`~/Library/Application Support/ClassGraph\`
- Linux: \`\${XDG_DATA_HOME:-~/.local/share}/ClassGraph\`

The library contains current project files plus a small rolling local backup before overwrites. It is not a database and does not change the canonical ClassGraph JSON format.

Portable recovery remains explicit:

- **Backup JSON** downloads the current project as a \`.classgraph.json\` file.
- **Import / restore backup** accepts a valid ClassGraph JSON file from an older installation or another computer and saves it into the local library.
- An imported project keeps its original project ID and provenance.

## Phase 7 slices

### P7.0 — Recovery contract

- [x] Create Phase 7 branch and recovery log.
- [x] Preserve the Node SEA/browser architecture; no Electron migration.
- [x] Keep Exchange v1 JSON as the portable source of truth.

### P7.1 — Local project library

- [ ] Add filesystem-backed project storage with platform-appropriate data directory.
- [ ] Autosave validated projects after create, import, generation, and every accepted mutation.
- [ ] List saved projects and reopen them after app restart.
- [ ] Keep a rolling local safety copy before overwriting a project.
- [ ] Test persistence across store re-instantiation.

### P7.2 — Restore and backup UX

- [ ] Show saved projects on the start/projects screen.
- [ ] Reopen the last project automatically on desktop startup.
- [ ] Rename export action to Backup JSON.
- [ ] Make import language explicitly cover restore/new-computer scenarios.
- [ ] Keep imported JSON schema validation before any local save.

### P7.3 — Quiet desktop launch

- [ ] Windows packaged executable uses GUI subsystem and does not create a console window.
- [ ] A second launch reopens an already-running ClassGraph instance instead of starting a duplicate hidden server.
- [ ] Native self-test still verifies the Windows GUI executable by process exit code.

### P7.4 — OS branding

- [ ] Windows executable embeds the CG icon.
- [ ] macOS app bundle contains a CG \`.icns\` icon.
- [ ] Linux package contains a CG PNG and desktop-entry file.
- [ ] Keep icon-generation tooling build-time only.

### P7.5 — Release

- [ ] Update README with autosave/restore behavior and data locations.
- [ ] Bump to v0.7.0.
- [ ] Pass normal tests, dependency audit, and four native desktop builds.
- [ ] Merge Phase 7 to \`main\`.
- [ ] Publish v0.7.0 and verify all platform downloads.

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
