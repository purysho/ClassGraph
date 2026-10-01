import { z } from 'zod'

const provenanceKindSchema = z.enum([
  'observed',
  'teacher-entered',
  'imported',
  'derived',
  'synthetic',
])

const provenanceEntrySchema = z.object({
  kind: provenanceKindSchema,
  source: z.string().min(1).optional(),
  note: z.string().optional(),
  derivedFrom: z.array(z.string().min(1)).optional(),
})

const metricValueSchema = z.union([z.number().finite(), z.string(), z.boolean(), z.null()])

const metricDefinitionSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9._-]*$/i),
    label: z.string().min(1),
    kind: z.enum(['number', 'ordinal', 'category', 'boolean', 'text']),
    description: z.string().optional(),
    numberScale: z
      .object({
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        unit: z.string().optional(),
      })
      .optional(),
    ordinalScale: z.array(z.string().min(1)).min(1).optional(),
    categories: z.array(z.string().min(1)).min(1).optional(),
    missingAllowed: z.boolean().optional(),
  })
  .superRefine((definition, ctx) => {
    if (
      definition.numberScale?.min !== undefined &&
      definition.numberScale.max !== undefined &&
      definition.numberScale.min > definition.numberScale.max
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['numberScale'],
        message: 'numberScale.min must be less than or equal to numberScale.max',
      })
    }

    if (definition.kind === 'ordinal' && !definition.ordinalScale) {
      ctx.addIssue({
        code: 'custom',
        path: ['ordinalScale'],
        message: 'ordinal metrics require ordinalScale',
      })
    }

    if (definition.kind === 'category' && !definition.categories) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'category metrics require categories',
      })
    }
  })

const studentSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  metrics: z.record(z.string(), metricValueSchema),
  notes: z.string().optional(),
})

const relationshipSchema = z.object({
  id: z.string().min(1),
  fromStudentId: z.string().min(1),
  toStudentId: z.string().min(1),
  type: z.enum(['works-well-with', 'avoid-pairing', 'support-pair', 'friendship', 'custom']),
  label: z.string().optional(),
  directed: z.boolean().optional(),
  weight: z.number().finite().optional(),
})

const seatSchema = z.object({
  id: z.string().min(1),
  row: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  enabled: z.boolean(),
  tags: z.array(z.string().min(1)).optional(),
})

const roomSchema = z
  .object({
    layout: z.enum(['grid', 'custom']),
    rows: z.number().int().positive().optional(),
    columns: z.number().int().positive().optional(),
    seats: z.array(seatSchema).max(1000),
  })
  .superRefine((room, ctx) => {
    if (room.layout === 'grid' && (room.rows === undefined || room.columns === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'grid rooms require rows and columns',
      })
      return
    }

    if (
      room.layout === 'grid' &&
      room.rows !== undefined &&
      room.columns !== undefined &&
      room.rows * room.columns > 1000
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['seats'],
        message: 'grid rooms cannot exceed 1000 seats',
      })
    }

    const seatIds = new Set<string>()
    const gridPositions = new Set<string>()

    for (const [index, seat] of room.seats.entries()) {
      if (seatIds.has(seat.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['seats', index, 'id'],
          message: `duplicate seat id: ${seat.id}`,
        })
      }
      seatIds.add(seat.id)

      if (room.layout === 'grid') {
        if (seat.row === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['seats', index, 'row'],
            message: 'grid seats require a row',
          })
        }
        if (seat.column === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['seats', index, 'column'],
            message: 'grid seats require a column',
          })
        }

        if (seat.row !== undefined && room.rows !== undefined && seat.row >= room.rows) {
          ctx.addIssue({
            code: 'custom',
            path: ['seats', index, 'row'],
            message: `seat row is outside configured room rows: ${seat.id}`,
          })
        }
        if (
          seat.column !== undefined &&
          room.columns !== undefined &&
          seat.column >= room.columns
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['seats', index, 'column'],
            message: `seat column is outside configured room columns: ${seat.id}`,
          })
        }

        if (seat.row !== undefined && seat.column !== undefined) {
          const key = `${seat.row}:${seat.column}`
          if (gridPositions.has(key)) {
            ctx.addIssue({
              code: 'custom',
              path: ['seats', index],
              message: `duplicate grid seat position: ${key}`,
            })
          }
          gridPositions.add(key)
        }
      } else if (seat.x === undefined || seat.y === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['seats', index],
          message: 'custom room seats require x and y coordinates',
        })
      }
    }
  })

export const classGraphProjectSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    projectId: z.string().min(1),
    title: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    classInfo: z.object({
      classId: z.string().optional(),
      subject: z.string().optional(),
      gradeOrLevel: z.string().optional(),
      term: z.string().optional(),
      teacherLabel: z.string().optional(),
      notes: z.string().optional(),
    }),
    metricDefinitions: z.array(metricDefinitionSchema),
    students: z.array(studentSchema),
    relationships: z.array(relationshipSchema).optional(),
    room: roomSchema.optional(),
    planning: z
      .object({
        seed: z.string().optional(),
        selectedMetricKeys: z.array(z.string()).optional(),
        rules: z.array(z.unknown()).optional(),
      })
      .optional(),
    provenance: z.record(z.string(), provenanceEntrySchema),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((project, ctx) => {
    const metricDefinitions = new Map(project.metricDefinitions.map((item) => [item.key, item]))

    if (metricDefinitions.size !== project.metricDefinitions.length) {
      const seen = new Set<string>()
      for (const [index, definition] of project.metricDefinitions.entries()) {
        if (seen.has(definition.key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['metricDefinitions', index, 'key'],
            message: `duplicate metric key: ${definition.key}`,
          })
        }
        seen.add(definition.key)
      }
    }

    const studentIds = new Set<string>()
    for (const [index, student] of project.students.entries()) {
      if (studentIds.has(student.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['students', index, 'id'],
          message: `duplicate student id: ${student.id}`,
        })
      }
      studentIds.add(student.id)

      for (const [metricKey, value] of Object.entries(student.metrics)) {
        const definition = metricDefinitions.get(metricKey)
        if (!definition) {
          ctx.addIssue({
            code: 'custom',
            path: ['students', index, 'metrics', metricKey],
            message: `metric has no definition: ${metricKey}`,
          })
          continue
        }

        if (value === null) {
          if (definition.missingAllowed === false) {
            ctx.addIssue({
              code: 'custom',
              path: ['students', index, 'metrics', metricKey],
              message: `metric does not allow missing values: ${metricKey}`,
            })
          }
          continue
        }

        const validType =
          (definition.kind === 'number' && typeof value === 'number') ||
          (definition.kind === 'boolean' && typeof value === 'boolean') ||
          ((definition.kind === 'text' ||
            definition.kind === 'ordinal' ||
            definition.kind === 'category') &&
            typeof value === 'string')

        if (!validType) {
          ctx.addIssue({
            code: 'custom',
            path: ['students', index, 'metrics', metricKey],
            message: `metric value type does not match definition: ${metricKey}`,
          })
          continue
        }

        if (definition.kind === 'number' && typeof value === 'number') {
          if (definition.numberScale?.min !== undefined && value < definition.numberScale.min) {
            ctx.addIssue({
              code: 'custom',
              path: ['students', index, 'metrics', metricKey],
              message: `metric is below configured minimum: ${metricKey}`,
            })
          }
          if (definition.numberScale?.max !== undefined && value > definition.numberScale.max) {
            ctx.addIssue({
              code: 'custom',
              path: ['students', index, 'metrics', metricKey],
              message: `metric is above configured maximum: ${metricKey}`,
            })
          }
        }

        if (
          definition.kind === 'category' &&
          typeof value === 'string' &&
          definition.categories &&
          !definition.categories.includes(value)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['students', index, 'metrics', metricKey],
            message: `unknown category value for ${metricKey}: ${value}`,
          })
        }

        if (
          definition.kind === 'ordinal' &&
          typeof value === 'string' &&
          definition.ordinalScale &&
          !definition.ordinalScale.includes(value)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['students', index, 'metrics', metricKey],
            message: `unknown ordinal value for ${metricKey}: ${value}`,
          })
        }
      }
    }

    for (const [index, relationship] of (project.relationships ?? []).entries()) {
      if (!studentIds.has(relationship.fromStudentId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['relationships', index, 'fromStudentId'],
          message: `unknown student: ${relationship.fromStudentId}`,
        })
      }
      if (!studentIds.has(relationship.toStudentId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['relationships', index, 'toStudentId'],
          message: `unknown student: ${relationship.toStudentId}`,
        })
      }
      if (relationship.fromStudentId === relationship.toStudentId) {
        ctx.addIssue({
          code: 'custom',
          path: ['relationships', index],
          message: 'relationship endpoints must be different students',
        })
      }
    }
  })
