import type { ClassGraphProject } from './model.js'
import { classGraphProjectSchema } from './schema.js'

export class ClassGraphImportError extends Error {
  readonly code = 'CG-1001'

  constructor(message: string) {
    super(message)
    this.name = 'ClassGraphImportError'
  }
}

export function parseProjectJson(input: string): ClassGraphProject {
  let raw: unknown
  try {
    raw = JSON.parse(input) as unknown
  } catch {
    throw new ClassGraphImportError('The file is not valid JSON.')
  }

  const result = classGraphProjectSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const location = first?.path.length ? ` at ${first.path.join('.')}` : ''
    throw new ClassGraphImportError(
      `The file does not match ClassGraph Exchange v1${location}: ${first?.message ?? 'validation failed'}`,
    )
  }

  return result.data
}

export function serializeProjectJson(project: ClassGraphProject): string {
  const validated = classGraphProjectSchema.parse(project)
  return `${JSON.stringify(validated, null, 2)}\n`
}
