# ClassGraph — Phase 4 Recovery Log

**Phase:** 4 — Relationship Graph and Advanced Comparison  
**Branch:** `feat/phase-4-relationships`  
**Base:** `feat/phase-3-reports` @ `25822d92c137396169c6c920e5c8edfe0ef55fd1`  
**Status:** In progress  
**Last updated:** 2026-10-02

## Non-negotiable rules

- Relationship edges come only from explicit teacher-supplied records or clearly marked synthetic records.
- Never infer friendship, conflict, compatibility, social status, or peer influence from metrics, demographics, names, attendance, seating history, or other unrelated data.
- Preserve field-level provenance.
- Missing relationship/history data stays missing; never reconstruct it.
- Keep hard constraints and soft objectives distinct.
- Candidate/recommendation state must remain separate from teacher-approved persisted planning.
- Important graph views require accessible table equivalents.
- Do not add automatic EduBoard write/application behavior in Phase 4.
- Do not merge existing PRs automatically.
- Keep dependencies lean; justify and size-review any new graph dependency.

## Reviewed starting state

- Phase 1 PR #3: open, mergeable, unmerged.
- Phase 2 PR #4: open, mergeable, unmerged.
- Phase 3 PR #5: open, mergeable, unmerged.
- Phase 3 final head: `25822d92c137396169c6c920e5c8edfe0ef55fd1`.
- Existing architecture remains plain TypeScript + Node + Zod with a thin local HTTP boundary.
- Existing Exchange v1 already contains optional explicit `relationships`.

## Phase 4 slices

### P4.0 — Branch + recovery/architecture contract
- [x] Verify earlier phase PRs remain unmerged.
- [x] Create `feat/phase-4-relationships` from exact Phase 3 head.
- [x] Create this recovery log.
- [ ] Reconcile exact current relationship schema/model and mutation patterns before implementation.

### P4.1 — Explicit relationship CRUD/schema/service
- [ ] Add/edit/remove relationship records.
- [ ] Validate student references, type, directedness, weight and provenance.
- [ ] Define duplicate/self-edge behavior.
- [ ] Add deterministic canonical edge semantics.
- [ ] Add tests.

### P4.2 — Relationship table
- [ ] Accessible tabular equivalent first.
- [ ] Filter by relationship type.
- [ ] Show source/provenance clearly.
- [ ] Add tests.

### P4.3 — Deterministic relationship graph
- [ ] Explicit/synthetic edges only.
- [ ] Deterministic layout.
- [ ] Labels/types and selected-student focus.
- [ ] No hidden inference.
- [ ] Table equivalent always available.
- [ ] Add tests.

### P4.4 — Network comparison
- [ ] Compare explicit saved groups/scenarios.
- [ ] Descriptive counts only.
- [ ] No claim that edge density/count is educationally better unless an explicit authored rule says so.
- [ ] Add tests.

### P4.5 — Repeat-neighbour history
- [ ] Use only explicitly stored historical approved seating.
- [ ] Do not infer/reconstruct missing history.
- [ ] Separate history from current candidate state.
- [ ] Add tests.

### P4.6 — Saved scenarios
- [ ] Save approved/current planning snapshots.
- [ ] Deterministic IDs/versioning.
- [ ] Explicit comparison dimensions.
- [ ] Descriptive before/after views.
- [ ] Add tests.

### P4.7 — UI polish + persistence
- [ ] Relationship workspace.
- [ ] Scenario comparison.
- [ ] Provenance visibility.
- [ ] JSON round-trip.
- [ ] Accessible table equivalents.

### P4.8 — Gate 4
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=high`
- [ ] Dependency/size review if runtime dependencies changed.

## Gate 4 acceptance

- Same explicit relationship data produces deterministic graph/layout.
- No relationship is inferred from student metrics.
- Synthetic relationship edges stay synthetic.
- Teacher-entered/imported relationships retain provenance.
- Directed/undirected edges behave consistently.
- Missing relationship history is not invented.
- Saved scenarios preserve the exact planning state being compared.
- Before/after comparisons remain descriptive.
- Important graph views have table equivalents.
- Format/lint/typecheck/tests/build/audit are green.

## Recovery instruction

If work is interrupted, resume from the repository state on `feat/phase-4-relationships` and this file, not chat memory. Complete one slice at a time, test it, commit it, then update this log before continuing.
