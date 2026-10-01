# ClassGraph Exchange v1

ClassGraph Exchange is the machine-readable boundary between ClassGraph and future adapters such as EduBoard.

## Current version

```text
schemaVersion: "1.0"
```

The canonical runtime validator lives in `src/schema.ts`.

## Rules

1. Student IDs are required; names are optional.
2. Every metric value must have a matching metric definition.
3. Missing values are represented as `null`, never silently as zero/false/average.
4. Important fields may carry field-level provenance using stable JSON-pointer-like paths.
5. `derived` and `synthetic` values remain distinguishable from `observed`, `teacher-entered`, and `imported` values.
6. ClassGraph does not infer hidden social relationships. Relationship edges must be explicit or marked synthetic.
7. `extensions` may carry future application-specific data. Core readers must ignore unsupported extension data rather than interpret it as a core field.

## EduBoard adapter principle

A future EduBoard adapter should map only fields both products understand. ClassGraph-derived or synthetic values must not overwrite EduBoard observed data without an explicit teacher-approved mapping step.
