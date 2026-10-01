# ClassGraph Phase 2 Progress Log

**Branch:** `feat/phase-2-seating`  
**Phase:** 2 — Room, seating, grouping, and explainable planning  
**Base:** verified Phase 1 head `139bd21c2072834c1eee0acfc847ba474ef3b5e3`  
**Recovery instruction:** If work is interrupted, read this file first and continue from the first unchecked item.

## Architecture decision

Phase 2 keeps the **lean local TypeScript/Node architecture** established in Phase 1.

The room, rule, candidate-generation, scoring, and explanation layers remain UI-independent. The browser remains a thin local client. No React/Electron/database/cloud/AI dependency is introduced merely to implement seating.

The existing Exchange v1 room model remains the geometry source of truth:

```ts
interface RoomDefinition {
  layout: 'grid' | 'custom'
  rows?: number
  columns?: number
  seats: SeatDefinition[]
}

interface SeatDefinition {
  id: string
  row?: number
  column?: number
  x?: number
  y?: number
  enabled: boolean
  tags?: string[]
}
```

**Important separation:** room geometry is not a seating recommendation. Student-to-seat assignments, rule evaluation, candidate scores, locks, and explanations belong to the planning layer.

## Phase 2 product rules

1. **Teacher-authored inputs only.** The engine may use only explicit student fields, room data, relationships, rules, locks, and synthetic fields already present in the project.
2. **No hidden profiling.** It must not invent friendship, conflict, ability, personality, behaviour, diagnosis, or likely attainment.
3. **Hard and soft are different concepts.**
   - Hard constraints determine feasibility.
   - Soft objectives produce visible component penalties/trade-offs.
4. **No opaque winner.** Multiple candidates are shown. If a total score is used internally for search, every component remains visible to the teacher.
5. **Reproducible search.** Same project + rules + locks + seed + ClassGraph version should reproduce the same candidate ordering.
6. **Infeasible means infeasible.** The app explains which hard constraints cannot all be satisfied instead of quietly violating them.
7. **Manual control remains first-class.** Teachers can manually seat students, lock seats/assignments, and rerun around those decisions.
8. **Missing data stays missing.** A balance objective ignores unavailable values according to an explicit rule; it never replaces them with zero/average/normal.
9. **Graph/table equivalence.** Seating/grouping visual views must have assignment/constraint tables.
10. **Local first.** Core planning requires no internet connection.

## Completion checklist

- [x] P2.0 — Phase 2 branch, recovery log, architecture checkpoint
- [x] P2.1 — Room/grid core service and stronger room invariants
- [x] P2.2 — Room editor UI: dimensions, disabled seats, tags, front/back orientation
- [x] P2.3 — Manual seating state, assignment table, locks, and local mutation API
- [x] P2.4 — Explicit planning-rule schema: hard constraints vs soft objectives
- [x] P2.5 — Deterministic seating candidate engine and infeasibility reporting
- [x] P2.6 — Three-candidate comparison with visible score components/trade-offs
- [x] P2.7 — Lock-and-rerun plus deterministic grouping candidates
- [x] P2.8 — Seating/grouping UI polish, accessible table equivalents, persistence
- [x] P2.9 — Gate 2 quality pass, documentation, tests, PR

## Planned rule vocabulary

Phase 2 starts with a deliberately small explicit rule vocabulary.

### Hard constraints

Initial candidates:

- `fixed-seat` — a student must occupy a specific enabled seat;
- `keep-apart` — two students must not be neighbours under the selected neighbour model;
- `seat-tag-required` — a student must occupy a seat with a specified tag;
- `locked-assignment` — current teacher lock that search cannot change.

Hard constraints are never converted to arbitrary penalty weights.

### Soft objectives

Initial candidates:

- `prefer-together` — reduce distance between two explicitly selected students;
- `prefer-apart` — increase distance between two explicitly selected students;
- `prefer-seat-tag` — prefer a student in a seat with a specified tag;
- `balance-metric-by-row` — reduce row-to-row imbalance for one teacher-selected numeric/ordinal metric;
- `avoid-repeated-neighbour` — later, when explicit prior-neighbour history exists.

Every soft result exposes its own penalty/component.

## Seat geometry conventions

For grid rooms:

- `row` and `column` are **zero-based data coordinates**;
- teacher-facing labels may be one-based (`Row 1`, `Seat 1`);
- seat IDs are stable and deterministic for generated grids;
- disabled seats remain part of geometry but cannot receive a student;
- seat tags are explicit teacher-entered strings such as `front`, `aisle`, `accessible`, or a custom label;
- room capacity means **enabled seat count**, not total seat objects.

Grid validation must reject:

- duplicate seat IDs;
- duplicate row/column positions;
- coordinates outside configured rows/columns;
- missing row/column on grid seats;
- non-grid coordinates being silently invented;
- impossible dimensions.

## Candidate result contract

The planning engine should evolve toward a result shaped like:

```ts
interface SeatingCandidate {
  id: string
  seed: string
  assignments: Array<{ studentId: string; seatId: string }>
  feasible: boolean
  hardConstraintResults: HardConstraintResult[]
  objectiveResults: ObjectiveResult[]
  totalPenalty?: number
  explanation: string[]
}
```

If `totalPenalty` is present, it is never shown without the component `objectiveResults`.

## Implementation sequence

### P2.0 — Phase 2 checkpoint

**Status:** Complete.

- created `feat/phase-2-seating` from the final verified Phase 1 head;
- kept PR #3 unmerged;
- confirmed Phase 2 scope from `DESIGN.md`;
- preserved the lean local architecture;
- defined the geometry/planning separation and Gate 2 requirements.

### P2.1 — Room/grid core service

**Status:** Complete.

Implemented `src/room.ts`, stronger room validation in `src/schema.ts`, room mutation commands, and regression tests.

Completed behaviour:

- deterministic grid-room creation with zero-based data coordinates;
- stable generated seat IDs such as `seat-r1-c1`;
- grid resize preserves compatible seat IDs, enabled state, tags, and indexed seat provenance where the seat survives;
- explicit seat enable/disable operations;
- explicit seat-tag editing with trimmed/deduplicated tags;
- usable room capacity counts enabled seats only;
- grid creation rejects non-positive dimensions and more than 1000 seats;
- canonical schema rejects duplicate seat IDs, duplicate grid positions, out-of-bounds grid coordinates, missing grid coordinates, and custom seats without x/y coordinates;
- local mutation API supports `set-grid-room`, `set-seat-enabled`, and `set-seat-tags`;
- manual room/seat changes retain teacher-entered provenance;
- Phase 1 behaviour remains covered by the expanded suite.

Verified Phase 2 P2.1 head: `cce705323feee0b8fdc39ee746898d7365edb184`.

Read-only Phase 2 branch check run `36852759750`:

- `npm ci`: **success**;
- `npm run format:check`: **success**;
- `npm run lint`: **success**;
- `npm run typecheck`: **success**;
- `npm test`: **success — 56/56 tests across 12 files**;
- `npm run build`: **success**;
- `npm audit --omit=dev --audit-level=high`: **success**.

### P2.2 — Room editor UI

**Status:** Complete.

Implemented a real `Seating` workspace in `src/app-client.ts` and `app/styles.css`.

Completed behaviour:

- create/resize a grid room from rows/columns;
- explicit front-of-room orientation (`top`, `bottom`, `left`, `right`);
- visual seat grid with enabled/disabled/occupied states;
- enable/disable seats;
- edit comma-separated seat tags;
- capacity warning when enabled seats are fewer than roster students;
- stable one-based teacher labels over zero-based stored coordinates;
- full seat table equivalent;
- room changes persist only through typed project mutations.

### P2.3 — Manual seating + locks

**Status:** Complete.

Implemented manual planning state in `src/planning-state.ts` plus UI controls.

Completed behaviour:

- student → seat assignments stored separately from room geometry;
- duplicate occupancy rejected;
- disabled-seat assignment rejected;
- unassigned-student strip;
- drag/drop seating for mouse users;
- select-based assignment table retained as an accessible fallback;
- per-student assignment locks;
- locked assignments survive candidate reruns;
- teacher-approved candidate assignments persist with teacher-entered provenance.

### P2.4 — Explicit planning-rule schema

**Status:** Complete.

Exchange v1 planning now has a typed rule contract rather than `unknown[]`.

Hard rules:

- `fixed-seat`;
- `keep-apart` with orthogonal or diagonal-inclusive neighbour mode;
- `seat-tag-required`.

Soft objectives:

- `prefer-together`;
- `prefer-apart`;
- `prefer-seat-tag`;
- `balance-metric-by-row` for explicit numeric/ordinal metrics.

Schema validation covers:

- duplicate rule IDs;
- unknown student/seat/metric references;
- same-student pair endpoints;
- invalid balance metric kinds;
- duplicate assignments/occupancy;
- invalid group membership/locks.

Manual rules are provenance-marked and removable through the typed mutation API.

### P2.5 — Deterministic seating engine

**Status:** Complete.

Implemented `src/planning.ts`.

Completed behaviour:

- deterministic seeded candidate generation;
- teacher locks and fixed-seat constraints applied before search;
- enabled-seat capacity preflight;
- hard constraints evaluated independently from soft objectives;
- impossible tag/capacity/assignment conditions explained before search;
- search exhaustion reports which hard rules repeatedly failed without falsely claiming a mathematical proof of impossibility;
- numeric/ordinal row-balance ignores unavailable values and states how many were ignored;
- no hidden student attribute is generated or inferred.

### P2.6 — Three-candidate comparison

**Status:** Complete.

The engine/UI now:

- returns up to three distinct feasible candidates by default;
- keeps the seed/configuration visible;
- shows hard-constraint status and messages;
- shows every soft-objective penalty component;
- shows the total penalty only alongside its components;
- exposes assignment tables for each candidate;
- provides short trade-off explanations;
- lets the teacher explicitly apply a chosen candidate.

No candidate is described as educationally optimal or as improving learning outcomes.

### P2.7 — Lock-and-rerun + grouping

**Status:** Complete.

Implemented `src/grouping.ts`.

Completed behaviour:

- seat locks are preserved while unlocked assignments rerun;
- deterministic grouping candidates from explicit group count + seed;
- optional balance on one teacher-selected numeric/ordinal metric;
- missing metric values are ignored and counted;
- group-size and metric-balance penalties stay separate and visible;
- existing locked group members remain in their groups on rerun;
- candidate groups can be explicitly applied;
- saved group members can be locked/unlocked.

### P2.8 — UI/persistence polish

**Status:** Complete.

Completed Phase 2 teacher-facing surfaces:

- room visual + seat table;
- manual seating visual + assignment table;
- drag/drop plus keyboard/select fallback;
- hard/soft rule table;
- infeasibility panel;
- three-candidate comparison;
- hard-constraint and objective-component tables;
- grouping visual + assignment table;
- source/provenance retained in canonical project JSON;
- planning rules, assignments, groups, locks, seed, room orientation and seat tags round-trip through Exchange v1 JSON.

Custom-room **editing** remains out of scope; the schema continues to validate imported custom geometry.

### P2.9 — Gate 2 quality pass

**Status:** Complete.

Verified product head: `c4fd60ee997e5606d5c9093978244d4fee260d78`.

Read-only Phase 2 quality run `36899749010`:

- `npm ci`: **success**;
- `npm run format:check`: **success**;
- `npm run lint`: **success**;
- `npm run typecheck`: **success**;
- `npm test`: **success — 77/77 tests across 15 files**;
- `npm run build`: **success**;
- `npm audit --omit=dev --audit-level=high`: **success**.

Gate 2 requirements are met:

- hard/soft rules are structurally distinct;
- infeasible/search-failure states are explained rather than silently violated;
- seating/grouping candidates are reproducible;
- every score component is visible;
- missing values are never silently imputed;
- no hidden student trait is inferred.

## Out of scope for Phase 2

Do not pull later phases forward unless required by Phase 2 correctness:

- DOCX/PDF report generation;
- EduBoard live coupling;
- AI-generated planning rules;
- cloud persistence/accounts;
- predictive student outcomes;
- inferred social graphs;
- opaque “best student”, “best class”, or educational-impact scores.

## Next exact step

Phase 2 and Gate 2 are complete. Proceed to **Phase 3 — reports and portable exports**: DOCX report, PDF report/print layout, seating-plan export, analysis JSON, and EduBoard interchange adapter tests.
