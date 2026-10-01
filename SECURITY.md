# Security and privacy

ClassGraph is designed as a local-first application that may contain student information.

## Current foundation

The repository is pre-release. The Phase 0 core contains data/schema/generation/analysis utilities and does not require a network service.

## Security principles

- Student data is not telemetry.
- Error reports/logs should not contain student values by default.
- Imported JSON is treated only as data and is validated before use.
- Core operation must not require remote scripts, fonts, APIs, or accounts.
- Future network/AI features must be opt-in and show what data would leave the device before sending it.
- Names are optional; pseudonymous student IDs are supported throughout the data model.
- Production persistence of identifiable data must receive an explicit at-rest protection review before release.

## Reporting a vulnerability

Do not include real student data in a public report. Use GitHub private vulnerability reporting for security issues in this repository.
