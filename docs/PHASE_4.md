# ClassGraph — Phase 4 Recovery Log

**Phase:** 4 — Relationship Graph and Advanced Comparison  
**Branch:** `feat/phase-4-relationships`  
**Base:** `feat/phase-3-reports` @ `25822d92c137396169c6c920e5c8edfe0ef55fd1`  
**Status:** Complete — ready for Phase 5  
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
- [x] Reconcile exact current relationship schema/model and mutation patterns before implementation.

### P4.1 — Explicit relationship CRUD/schema/service

- [x] Add/edit/remove relationship records.
- [x] Validate student references, type, directedness, weight and provenance.
- [x] Define duplicate/self-edge behavior.
- [x] Add deterministic canonical edge semantics.
- [x] Add tests.

Decisions:

- omitted `directed` means undirected;
- undirected endpoint order is canonical, so A↔B and B↔A with the same type are duplicates;
- directed A→B and B→A remain distinct;
- custom relationship labels participate in semantic identity;
- self-edges and duplicate relationship IDs are rejected;
- add/edit operations are teacher-entered; surviving imported/synthetic provenance is preserved when indexes move;
- removing a student removes only explicitly linked current relationships and remaps relationship provenance without inventing replacement edges;
- existing `relationships: []` compatibility is retained.

Verification: run `36911785277` — format, lint, strict typecheck, **106/106 tests across 20 files**, and build passed.

### P4.2 — Relationship table

- [x] Accessible tabular equivalent first.
- [x] Filter by relationship type.
- [x] Show source/provenance clearly.
- [x] Add tests.

Implemented a UI-independent table model plus the Relationships workspace. Record-level provenance is shown where present; nested relationship provenance is used as a fallback rather than invented.

### P4.3 — Deterministic relationship graph

- [x] Explicit/synthetic edges only.
- [x] Deterministic layout.
- [x] Labels/types and selected-student focus.
- [x] No hidden inference.
- [x] Table equivalent always available.
- [x] Add tests.

Layout is dependency-free. Whole-class nodes are sorted by stable student ID; focus mode places only explicitly connected neighbours on the inner ring. Unrelated student metrics do not affect graph nodes, edges, or layout.

### P4.4 — Network comparison

- [x] Compare explicit saved groups/scenarios.
- [x] Descriptive counts only.
- [x] No claim that edge density/count is educationally better unless an explicit authored rule says so.
- [x] Add tests.

Scenario comparison reports raw within-group, across-group, ungrouped, total, and relationship-type counts/deltas. It deliberately exposes no score, rank, winner, or optimization target.

### P4.5 — Repeat-neighbour history

- [x] Use only explicitly stored historical approved seating.
- [x] Do not infer/reconstruct missing history.
- [x] Separate history from current candidate state.
- [x] Add tests.

Teachers explicitly snapshot persisted seating with a recorded orthogonal/king neighbour rule. Grid snapshots are analysed; custom-layout history is preserved but skipped rather than guessed. Current seating is never treated as history until explicitly recorded.

### P4.6 — Saved scenarios

- [x] Save approved/current planning snapshots.
- [x] Deterministic IDs/versioning.
- [x] Explicit comparison dimensions.
- [x] Descriptive before/after views.
- [x] Add tests.

Scenario format version is `1.0`. IDs use a dependency-free deterministic hash of the label plus exact persisted planning snapshot. Saved state includes room, persisted seat assignments, groups, rules, seed/selected metrics, and approved candidate ID where present; transient generated candidates are excluded.

### P4.7 — UI polish + persistence

- [x] Relationship workspace.
- [x] Scenario comparison.
- [x] Provenance visibility.
- [x] JSON round-trip.
- [x] Accessible table equivalents.

The local workspace now combines explicit relationship CRUD, deterministic graph + table, approved seating-history capture, repeat-neighbour history, and saved before/after scenario comparison. Phase 4 data round-trips through ClassGraph JSON without flattening synthetic/teacher-entered provenance.

Integration verification before Gate 4: run `36913380276` — format, lint, strict typecheck, **127/127 tests across 26 files**, and build passed.

### P4.8 — Gate 4

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm audit --omit=dev --audit-level=high`
- [x] Dependency/size review if runtime dependencies changed.

Final Gate 4 verification: run `36913559734` — format, lint, strict typecheck, **127/127 tests across 26 files**, build, and production dependency audit all passed. Audit result: **0 vulnerabilities**.

Dependency/size review: Phase 4 changes no `package.json` or `package-lock.json` files and adds no runtime dependency. The graph/layout, snapshot IDs, history analysis, and comparisons are implemented with the existing TypeScript stack, so no new dependency-size cost was introduced.

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

If work is interrupted, resume from the repository state on `feat/phase-4-relationships` and this file, not chat memory. Phase 4 is complete. If work is interrupted after handoff, verify the Phase 4 PR remains unmerged and begin only the next explicitly requested phase.
