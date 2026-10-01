export class ClassGraphExportError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ClassGraphExportError'
    this.code = code
  }
}
