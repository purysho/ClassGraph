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
- [ ] P2.2 — Room editor UI: dimensions, disabled seats, tags, front/back orientation
- [ ] P2.3 — Manual seating state, assignment table, locks, and local mutation API
- [ ] P2.4 — Explicit planning-rule schema: hard constraints vs soft objectives
- [ ] P2.5 — Deterministic seating candidate engine and infeasibility reporting
- [ ] P2.6 — Three-candidate comparison with visible score components/trade-offs
- [ ] P2.7 — Lock-and-rerun plus deterministic grouping candidates
- [ ] P2.8 — Seating/grouping UI polish, accessible table equivalents, persistence
- [ ] P2.9 — Gate 2 quality pass, documentation, tests, PR

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

Add a real `Seating` workspace instead of the Phase 1 placeholder:

- rows/columns controls;
- visual grid;
- enable/disable seats;
- add/remove tags;
- explicit front-of-room orientation;
- capacity warning when enabled seats < students;
- table equivalent for every seat.

### P2.3 — Manual seating + locks

Introduce planning state separate from room geometry:

- manual student → seat assignment;
- unassigned-student list;
- no duplicate occupancy;
- assignment table;
- lock/unlock selected assignments;
- mutation API and schema validation.

### P2.4 — Planning rule schema

Replace `planning.rules?: unknown[]` with a versioned explicit rule contract while preserving Exchange compatibility deliberately.

Rules must specify:

- stable rule ID;
- hard vs soft;
- exact student/seat/metric references;
- options required for evaluation;
- teacher-authored provenance.

### P2.5 — Deterministic seating engine

Build the first search engine with:

- seeded deterministic initialisation/search;
- enabled-seat capacity check;
- hard-constraint feasibility evaluation;
- soft-objective component evaluation;
- explanation of infeasible hard constraints;
- no hidden inferred values.

### P2.6 — Candidate comparison

Return at least three distinct candidates when feasible:

- same hard-constraint status;
- component penalties;
- visible trade-offs;
- assignment differences;
- reproducible seed/configuration.

### P2.7 — Lock-and-rerun + grouping

- preserve teacher-locked assignments;
- rerun only unlocked students/seats;
- add explicit group definitions and deterministic grouping candidates;
- reuse the same hard/soft rule principles rather than creating a separate opaque optimiser.

### P2.8 — UI/persistence polish

- seating visual + table;
- grouping visual + table;
- candidate comparison;
- constraint violation table;
- provenance/source indicators;
- JSON round-trip of planning configuration/approved assignments.

### P2.9 — Gate 2 quality pass

Gate 2 passes only when:

- hard/soft rules are structurally distinct;
- infeasible plans are explained;
- candidate plans are reproducible;
- every score component is visible;
- no student trait is silently invented;
- formatting/lint/strict typecheck/tests/build/dependency audit are green;
- Phase 2 recovery/documentation is current.

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

Implement **P2.2 — Room editor UI**. Replace the disabled Seating placeholder with a local room editor for rows/columns, visual grid, seat enable/disable, seat tags, capacity warnings, explicit front-of-room orientation, and a seat table equivalent. Keep all persistence through the typed room mutation boundary.
