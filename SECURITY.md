# Security and privacy

ClassGraph is designed as a local-first application that may contain student information.

## Current pre-release architecture

Phase 0 provides the UI-independent schema/generation/analysis core. Phase 1 adds a small local HTTP boundary and browser interface.

The local server binds to `127.0.0.1` by default. No internet connection is required for the core teacher workflow. A teacher can explicitly override `CLASSGRAPH_HOST`, but a non-loopback host may expose the app and student data to other devices on the network and should only be used deliberately on a trusted network.

## Security principles

- Student data is not telemetry.
- Error reports/logs should not contain student values by default.
- Imported JSON is treated only as data and is validated before use.
- Local HTTP request bodies are size-capped and project mutations are schema-validated before core operations run.
- UI assets are served from an explicit allow-list rather than arbitrary filesystem paths.
- Local responses use no-store, nosniff, and no-referrer protections; the app does not enable cross-origin access by default.
- Core operation must not require remote scripts, fonts, APIs, or accounts.
- Future network/AI features must be opt-in and show what data would leave the device before sending it.
- Names are optional; pseudonymous student IDs are supported throughout the data model.
- Production persistence of identifiable data must receive an explicit at-rest protection review before release.

## Reporting a vulnerability

Do not include real student data in a public report. Use GitHub private vulnerability reporting for security issues in this repository.
