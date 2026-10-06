# ClassGraph — Phase 15 Recovery Log

**Phase:** 15 — In-app updates  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 14  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

Teachers had to notice a new release and re-download it by hand.

## Rules

- **No network use unless the teacher chooses it.** ClassGraph checks only when the teacher presses
  **Check for updates**, or after they tick **Check automatically when ClassGraph starts** (off by
  default). A check asks the GitHub API for the latest release version; it sends no class data,
  names or file names.
- **Installing always needs a click.** Nothing downloads or installs on its own.

## What each build can do

| Build                                      | Behaviour                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Windows installer (`ClassGraph-Setup.exe`) | Download and install in the app (electron-updater), then **Restart and update**                                                        |
| Linux AppImage                             | Same                                                                                                                                   |
| macOS (both)                               | Shows the new version and opens the release page. In-place updates on macOS need signed, notarised builds (see the code-signing task). |
| Windows portable                           | Shows the new version and opens the release page                                                                                       |
| Running from source                        | Not available                                                                                                                          |

## Implementation

- `src/update-policy.ts`: pure rules (channel per build, version comparison, default-off
  settings, parsing the GitHub response, only GitHub release links opened).
- `src/desktop-updates.ts`: main-process checker using `net.fetch` and electron-updater
  (`autoDownload` off, `autoInstallOnAppQuit` on, logging off).
- IPC `classgraph:updates` with actions `status`, `check`, `download`, `install`, `open-releases`,
  `get-settings`, `set-settings`; the setting lives in `update-settings.json` in the app's user
  data folder.
- Start screen **Updates** panel and an "Update available" note in the class sidebar.
- Release workflow publishes `latest.yml` + `ClassGraph-Setup.exe.blockmap` (Windows) and
  `latest-linux.yml` (Linux), and fails if they do not reference the uploaded file names.
- New runtime dependency: `electron-updater` 6.8.10 (MIT). It pulls `builder-util-runtime` 9.7.0,
  which is past the advisories affecting older versions; the production audit is clean.

## Verification

- [x] `npm run check`: format, lint, strict typecheck, 235 tests, build.
- [x] Packaged the Linux app: `latest-linux.yml` names `ClassGraph-Linux-x64.AppImage` and the app
      contains `resources/app-update.yml` for `purysho/ClassGraph`.
- [x] Packaged `--self-test` passes and confirms no update check happens at startup by default.
- [x] Drove the packaged Electron app with Playwright: the Updates panel shows the version, a failed
      check is reported as failed (not as "up to date"; found and fixed during this test), and the
      automatic-check setting is saved.
- [ ] Not testable before release: a real "update available → download → restart" cycle needs two
      published releases that carry the new metadata files. The first release with this change
      (v0.10.0) can only be updated _from_; users on v0.9.0 or earlier still update manually once.
