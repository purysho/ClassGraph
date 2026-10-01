# ClassGraph — Phase 5 Recovery Log

**Phase:** 5 — Optional Assistance Layer  
**Branch:** `feat/phase-5-assistance`  
**Base:** `feat/phase-4-relationships` @ `3872081dc33068e373b26d0f0324a9e680101686`  
**Status:** In progress  
**Last updated:** 2026-10-02

## Purpose

Phase 5 adds an optional assistance layer without changing ClassGraph's core claim: teacher-supplied or clearly synthetic data remains the source of truth, and assistance may draft or suggest but must never silently mutate the project.

The initial assistance families are:

- convert a teacher natural-language synthetic-class description into an **editable proposed generation specification**;
- explain already-visible descriptive analysis in plain language;
- draft report wording from an existing validated report snapshot;
- suggest explicit candidate planning rules for teacher review.

## Non-negotiable rules

- Core ClassGraph remains fully usable offline with no assistance provider configured.
- Assistance is opt-in and never required for import, editing, analysis, planning, reports, or exports.
- No assistance result is automatically applied to project data.
- Every assistance result is a **proposal/draft** until the teacher explicitly accepts or copies it.
- Natural-language synthetic generation must produce a visible structured specification before generation.
- Assistance must not infer hidden student traits, diagnoses, intelligence, personality, motivation, social status, friendship, conflict, or future attainment.
- Relationship edges remain explicit teacher/imported/synthetic records only; assistance cannot invent them from metrics.
- Missing values stay missing unless a teacher explicitly authors a synthetic-generation rule.
- Assistance explanations may describe calculated outputs but must not convert correlation/association into causation.
- Planning-rule suggestions must identify the existing fields/relationships they use and must remain separate from persisted rules until explicit teacher acceptance.
- No real student data may leave the device without a visible disclosure of exactly what would be sent and an explicit user action.
- Prefer redacted/aggregate context over student-level data whenever the assistance task does not require student-level detail.
- Do not add telemetry.
- Do not add an API key to project files, exported projects, logs, crash output, or browser storage.
- Do not add automatic EduBoard writes.
- Keep dependencies lean; provider SDKs are not justified unless a concrete adapter requires one.

## Reviewed starting state

- Phase 4 PR #6 is open, mergeable, and unmerged.
- Phase 4 final head: `3872081dc33068e373b26d0f0324a9e680101686`.
- Phase 4 Gate 4 passed with 127/127 tests across 26 files and 0 production audit vulnerabilities.
- Core architecture remains plain TypeScript + Node + Zod + local HTTP boundary.
- No graph/AI/provider dependency was added in Phase 4.

## Phase 5 slices

### P5.0 — Branch + assistance contract

- [x] Create `feat/phase-5-assistance` from the exact Phase 4 head.
- [x] Create this recovery log before feature code.
- [x] Define provider-independent proposal/request/result types.
- [x] Define explicit data-disclosure metadata.
- [x] Define accept/apply boundaries so assistance cannot mutate silently.
- [x] Add contract tests.

Implemented:

- versioned provider-independent request/proposal envelopes;
- explicit offline/network execution mode;
- per-context disclosure records showing whether student-level data, IDs, display names, free text, real data, or synthetic-only data would be included;
- network requests require an explicit send action and visible provider label;
- all assistance outputs must remain marked `status: "proposal"`;
- synthetic-spec acceptance reuses the existing structured synthetic schema and returns a specification only — it does not generate students;
- planning-rule acceptance revalidates each selected rule against the existing planning-rule schema and returns accepted suggestions without mutating the project.

Verification: run `36914523052` — format, lint, strict typecheck, **134/134 tests across 27 files**, and build passed.

### P5.1 — Synthetic-spec drafting

- [ ] Reuse the existing structured synthetic-generation schema.
- [ ] Accept natural-language teacher intent only as draft input.
- [ ] Produce an editable proposed specification plus warnings/assumptions.
- [ ] Never generate students until the structured proposal is explicitly accepted.
- [ ] Add tests for unsupported/ambiguous requests and provenance boundaries.

### P5.2 — Analysis explanation drafts

- [ ] Explain only existing descriptive analysis outputs.
- [ ] Include missing-data caveats.
- [ ] Include association-is-not-causation language where relevant.
- [ ] Do not invent causal, diagnostic, behavioural, or predictive interpretations.
- [ ] Add tests.

### P5.3 — Report wording drafts

- [ ] Draft wording from the canonical report snapshot.
- [ ] Preserve provenance/missingness/limitations.
- [ ] Keep generated prose outside canonical project data unless explicitly copied/exported.
- [ ] Add tests.

### P5.4 — Planning-rule suggestions

- [ ] Suggest only explicit existing rule types.
- [ ] Identify input fields/relationships used.
- [ ] Show whether each suggestion is hard or soft and why.
- [ ] Keep suggestions separate from persisted planning rules until explicit acceptance.
- [ ] Never infer a relationship edge in order to justify a rule.
- [ ] Add tests.

### P5.5 — Assistance workspace

- [ ] Show provider/offline status.
- [ ] Show exactly what context will be sent before any network call.
- [ ] Provide preview/edit/apply-or-copy workflow.
- [ ] Keep core workflows available with assistance disabled.
- [ ] Add accessible status/error states.

### P5.6 — Optional provider boundary

- [ ] Implement a provider interface with no provider enabled by default.
- [ ] Keep secrets out of ClassGraph project/export state.
- [ ] Require explicit network action for every request.
- [ ] Prefer direct HTTPS implementation or existing platform primitives before adding an SDK.
- [ ] Add timeout/size/error handling.
- [ ] Add provider-boundary tests with local fakes only; CI must not require a network key.

### P5.7 — Gate 5

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=high`
- [ ] Verify core no-network workflows still pass.
- [ ] Dependency/size review.
- [ ] Verify no credentials or student data are written to logs/project exports by assistance code.

## Gate 5 acceptance

- Assistance is optional and core workflows remain usable with no provider.
- Every assistance output is visibly a proposal/draft.
- No proposal mutates project state without an explicit teacher action.
- Natural-language generation stops at an editable structured spec before student generation.
- Assistance cannot infer hidden traits or relationships.
- Network-bound context is previewable before transmission.
- Real student-level data is not sent when aggregate/redacted context is sufficient.
- Secrets are not persisted in project/export data.
- CI does not need external network access or a provider key.
- Format/lint/typecheck/tests/build/audit are green.

## Recovery instruction

If work is interrupted, resume from the repository state on `feat/phase-5-assistance` and this file, not chat memory. Complete one slice at a time, test it, commit it, then update this log before continuing.
