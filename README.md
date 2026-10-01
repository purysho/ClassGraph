# ClassGraph

**ClassGraph** is a local-first classroom analysis and planning tool for turning structured student/class information into useful teacher-facing views: graphs, tables, grouping and seating plans, explainable feedback, and portable reports.

## Project status

Early foundation. ClassGraph is being built as a **standalone companion to EduBoard**. The two apps remain independent for now, with a versioned JSON interchange format planned so data can move safely between them later.

## Planned input paths

- Import a ClassGraph/EduBoard-compatible `.json` file.
- Enter or edit students manually.
- Generate a fully synthetic class from explicit parameters.
- Generate a synthetic/derived class profile from teacher-supplied constraints, with provenance retained.

## Planned outputs

- Distribution and comparison graphs.
- Student/class tables.
- Seating and grouping plans with visible constraints and trade-offs.
- Explainable teacher feedback and candidate adjustments.
- `.json`, `.docx`, and `.pdf` exports.

## Product principles

- **Local first.** Student data stays on the teacher's device unless the teacher explicitly exports or shares it.
- **Observed, entered, derived, and synthetic data remain distinguishable.**
- **Explain recommendations.** Seating/grouping suggestions must show which constraints and objectives produced them.
- **No black-box student labels.** ClassGraph supports teacher judgement; it does not diagnose personality, ability, behaviour, or future achievement.
- **Portable by design.** The canonical exchange format is versioned JSON.
- **Quality gates before features.** Lint, strict typecheck, automated tests, schema validation, dependency auditing, and reproducible fixtures are part of the product.

See `DESIGN.md` once the foundation branch lands.

## Relationship to EduBoard

EduBoard remains the operational teacher dashboard and source-of-truth product. ClassGraph focuses on **analysis, visualisation, layout/group planning, and decision support**. Integration should happen through explicit import/export contracts rather than shared databases or hidden coupling.

## Repository

https://github.com/purysho/ClassGraph
