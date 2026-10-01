# ClassGraph — Phase 5 Recovery Log

**Phase:** 5 — Optional Assistance Layer  
**Branch:** `feat/phase-5-assistance`  
**Base:** `feat/phase-4-relationships` @ `3872081dc33068e373b26d0f0324a9e680101686`  
**Status:** Complete — Gate 5 passed  
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

- [x] Reuse the existing structured synthetic-generation schema.
- [x] Accept natural-language teacher intent only as draft input.
- [x] Produce an editable proposed specification plus warnings/assumptions.
- [x] Never generate students until the structured proposal is explicitly accepted.
- [x] Add tests for unsupported/ambiguous requests and provenance boundaries.

### P5.2 — Analysis explanation drafts

- [x] Explain only existing descriptive analysis outputs.
- [x] Include missing-data caveats.
- [x] Include association-is-not-causation language where relevant.
- [x] Do not invent causal, diagnostic, behavioural, or predictive interpretations.
- [x] Add tests.

### P5.3 — Report wording drafts

- [x] Draft wording from the canonical report snapshot.
- [x] Preserve provenance/missingness/limitations.
- [x] Keep generated prose outside canonical project data unless explicitly copied/exported.
- [x] Add tests.

### P5.4 — Planning-rule suggestions

- [x] Suggest only explicit existing rule types.
- [x] Identify input fields/relationships used.
- [x] Show whether each suggestion is hard or soft and why.
- [x] Keep suggestions separate from persisted planning rules until explicit acceptance.
- [x] Never infer a relationship edge in order to justify a rule.
- [x] Add tests.

### P5.5 — Assistance workspace

- [x] Show provider/offline status.
- [x] Show exactly what context will be sent before any network call.
- [x] Provide preview/edit/apply-or-copy workflow.
- [x] Keep core workflows available with assistance disabled.
- [x] Add accessible status/error states.

### P5.6 — Optional provider boundary

- [x] Implement a provider interface with no provider enabled by default.
- [x] Keep secrets out of ClassGraph project/export state.
- [x] Require explicit network action for every request.
- [x] Prefer direct HTTPS implementation or existing platform primitives before adding an SDK.
- [x] Add timeout/size/error handling.
- [x] Add provider-boundary tests with local fakes only; CI must not require a network key.

## Phase 5 implementation checkpoint

Implemented before Gate 5:

- `src/assistance-contract.ts` and `src/assistance-acceptance.ts` define versioned proposal/disclosure and explicit acceptance boundaries.
- `src/assistance-synthetic.ts`, `src/assistance-analysis.ts`, `src/assistance-report.ts`, and `src/assistance-planning.ts` provide deterministic local drafts with conservative safety rules.
- `src/assistance-context.ts` builds task-specific disclosure context, using aggregate/redacted data where student-level detail is unnecessary.
- `src/assistance-provider.ts` implements the optional direct-HTTPS provider boundary with no provider enabled by default, environment-only credentials, explicit confirmation, timeout, response-size cap, and validated responses.
- `src/assistance-service.ts` keeps provider/offline execution behind one request/proposal contract.
- `src/server.ts` exposes local status/preview/run/accept endpoints. Acceptance validates proposals but does not silently generate students or persist rules.
- `src/server-main.ts` reads optional provider configuration from `CLASSGRAPH_ASSISTANCE_URL`, `CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL`, and `CLASSGRAPH_ASSISTANCE_TOKEN`.
- The Assistance workspace shows offline/provider status, exact network disclosure context, per-request confirmation, editable/copyable drafts, and explicit selected-rule application.
- Provider, local-draft, contract, and server tests use local fakes only. CI does not require an external provider or key.
- No provider SDK or other Phase 5 runtime dependency was added.

The first full implementation test pass reached 148/149 tests; the sole failure was an exact caveat wording assertion. The text was tightened to say missing values "are not imputed" explicitly. A credential-boundary regression test was then added, bringing the final suite to 150 tests.

### P5.7 — Gate 5

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm audit --omit=dev --audit-level=high`
- [x] Verify core no-network workflows still pass.
- [x] Dependency/size review.
- [x] Verify no credentials or assistance student context are written to logs/project exports by assistance code.

Gate 5 verification: run `36917677220` at head `f7700b4ddf832329771f15af4da70b5be43d470c`.

- format check passed;
- lint passed;
- strict TypeScript typecheck passed;
- **150/150 tests across 29 files passed**;
- build passed;
- `npm audit --omit=dev --audit-level=high` reported **0 vulnerabilities**;
- no external provider, provider key, or network assistance service was required by CI;
- analysis/report assistance tests confirm aggregate/redacted context omits student IDs/display names when they are unnecessary;
- the credential-boundary regression confirms provider tokens do not appear in provider status, assistance requests, or ClassGraph project exports;
- static review of all nine assistance modules found no `console.*`, browser storage, or telemetry writes;
- `package.json` and `package-lock.json` are unchanged from the Phase 4 head, so Phase 5 adds **zero runtime dependencies** and no provider SDK/assets.

Verification: run `36917593651` — format, lint, strict typecheck, **150/150 tests across 29 files**, build, and production audit all passed; audit reported **0 vulnerabilities**.

Gate 5 review:

- Core no-network workflows remain covered and green; `/api/assistance/status` reports offline assistance available with the network provider disabled by default.
- Credential regression coverage verifies provider tokens do not enter assistance request payloads or ClassGraph project/export state.
- No Phase 5 change touched `package.json` or `package-lock.json`; **0 new runtime/build dependencies** were added.
- Size review against the Phase 4 head: `src/` grew by **66,688 bytes**, of which the nine assistance core modules total **42,062 bytes**; `src/app-client.ts + app/styles.css` grew by **23,029 bytes**. This is source-only growth with no framework/provider-SDK payload.
- Network assistance uses aggregate/redacted analysis/report context when student-level detail is unnecessary; explicit relationship/planning context can include stable student IDs while omitting display names.
- Temporary phase workflows are removed after this recorded Gate 5 run; their removal does not change runtime/test source.

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

Phase 5 is complete. If later maintenance is interrupted, resume from the repository state and this file rather than chat memory; preserve the proposal/acceptance, disclosure, privacy, and no-hidden-inference boundaries above.
