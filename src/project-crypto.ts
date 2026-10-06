import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto'
import { z } from 'zod'
import { parseProjectJson, serializeProjectJson } from './json.js'
import type { ClassGraphProject } from './model.js'

/**
 * Optional password protection for project files.
 *
 * A protected file is a small JSON envelope. Only the random project ID stays readable (the
 * library needs it to find the file again after a rename). The full Exchange v1 project is
 * encrypted with AES-256-GCM using a key derived from the teacher's password with scrypt.
 * The format, version and project ID are authenticated as additional data, so swapping the
 * header onto another file fails to decrypt.
 *
 * There is no recovery key. A forgotten password means the class cannot be opened.
 */

export const PROTECTED_PROJECT_FORMAT = 'classgraph-protected-project'
export const PROTECTED_PROJECT_VERSION = '1'
export const MIN_PASSWORD_LENGTH = 8

export interface ScryptParams {
  N: number
  r: number
  p: number
}

/** About 128 MB and a few hundred milliseconds per unlock on a typical laptop. */
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 17, r: 8, p: 1 }

const protectedFileSchema = z.object({
  format: z.literal(PROTECTED_PROJECT_FORMAT),
  version: z.literal(PROTECTED_PROJECT_VERSION),
  projectId: z.string().min(1),
  kdf: z.object({
    name: z.literal('scrypt'),
    N: z
      .number()
      .int()
      .min(2 ** 10)
      .max(2 ** 20),
    r: z.number().int().min(1).max(32),
    p: z.number().int().min(1).max(16),
    salt: z.string().min(16),
  }),
  cipher: z.object({
    name: z.literal('aes-256-gcm'),
    iv: z.string().min(16),
    tag: z.string().min(16),
  }),
  ciphertext: z.string().min(1),
})

export type ProtectedProjectFile = z.infer<typeof protectedFileSchema>

export interface ProjectKey {
  key: Buffer
  salt: Buffer
  params: ScryptParams
}

export function protectionError(code: string, message: string): Error {
  return new Error(`${code} ${message}`)
}

export function assertAcceptablePassword(password: string): void {
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    throw protectionError(
      'CG-2018',
      `choose a password with at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  }
}

export function deriveProjectKey(
  password: string,
  salt: Buffer = randomBytes(16),
  params: ScryptParams = DEFAULT_SCRYPT,
): Promise<ProjectKey> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFC'),
      salt,
      32,
      { ...params, maxmem: 256 * params.N * params.r + 32 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else resolve({ key, salt, params })
      },
    )
  })
}

function additionalData(projectId: string): Buffer {
  return Buffer.from(`${PROTECTED_PROJECT_FORMAT}:${PROTECTED_PROJECT_VERSION}:${projectId}`)
}

export function encryptProject(project: ClassGraphProject, key: ProjectKey): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key.key, iv)
  cipher.setAAD(additionalData(project.projectId))
  const ciphertext = Buffer.concat([
    cipher.update(serializeProjectJson(project), 'utf8'),
    cipher.final(),
  ])
  const file: ProtectedProjectFile = {
    format: PROTECTED_PROJECT_FORMAT,
    version: PROTECTED_PROJECT_VERSION,
    projectId: project.projectId,
    kdf: { name: 'scrypt', ...key.params, salt: key.salt.toString('base64') },
    cipher: {
      name: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    },
    ciphertext: ciphertext.toString('base64'),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Returns the envelope when `text` is a protected project file, otherwise null. */
export function parseProtectedFile(text: string): ProtectedProjectFile | null {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return null
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as { format?: unknown }).format !== PROTECTED_PROJECT_FORMAT
  ) {
    return null
  }
  const result = protectedFileSchema.safeParse(raw)
  if (!result.success) {
    throw protectionError('CG-2027', 'the password-protected file is damaged and cannot be read')
  }
  return result.data
}

export function decryptProject(file: ProtectedProjectFile, key: ProjectKey): ClassGraphProject {
  let plaintext: string
  try {
    const decipher = createDecipheriv('aes-256-gcm', key.key, Buffer.from(file.cipher.iv, 'base64'))
    decipher.setAAD(additionalData(file.projectId))
    decipher.setAuthTag(Buffer.from(file.cipher.tag, 'base64'))
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(file.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw protectionError('CG-2017', 'that password does not unlock this class')
  }
  const project = parseProjectJson(plaintext)
  if (project.projectId !== file.projectId) {
    throw protectionError('CG-2027', 'the password-protected file is damaged and cannot be read')
  }
  return project
}

/** Derives the key from the file's own salt and parameters, then decrypts. */
export async function unlockProtectedFile(
  file: ProtectedProjectFile,
  password: string,
): Promise<{ project: ClassGraphProject; key: ProjectKey }> {
  const key = await deriveProjectKey(password, Buffer.from(file.kdf.salt, 'base64'), {
    N: file.kdf.N,
    r: file.kdf.r,
    p: file.kdf.p,
  })
  return { project: decryptProject(file, key), key }
}
