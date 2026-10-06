/**
 * Update rules for the desktop app, kept free of Electron so they can be unit tested.
 *
 * ClassGraph never contacts the network on its own unless the teacher has turned on
 * "check automatically". A check asks GitHub for the latest release version; no class data,
 * project names or identifiers are sent.
 */

export const RELEASES_PAGE = 'https://github.com/purysho/ClassGraph/releases/latest'
export const LATEST_RELEASE_API = 'https://api.github.com/repos/purysho/ClassGraph/releases/latest'

/**
 * - `install`: the build can download and install the update itself (Windows installer, Linux
 *   AppImage).
 * - `notify`: the build can only point to the download page (macOS until builds are signed and
 *   notarised, the Windows portable build).
 * - `unavailable`: running from source.
 */
export type UpdateChannel = 'install' | 'notify' | 'unavailable'

export interface UpdateEnvironment {
  packaged: boolean
  platform: NodeJS.Platform
  /** Set by the Windows portable launcher. */
  portableExecutable?: string
  /** Set when running from a Linux AppImage. */
  appImage?: string
}

export function updateChannel(environment: UpdateEnvironment): UpdateChannel {
  if (!environment.packaged) return 'unavailable'
  if (environment.platform === 'win32') {
    return environment.portableExecutable ? 'notify' : 'install'
  }
  if (environment.platform === 'linux') return environment.appImage ? 'install' : 'notify'
  return 'notify'
}

function versionParts(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
  return match ? match.slice(1, 4).map(Number) : null
}

/** Returns >0 when `a` is newer than `b`, <0 when older, 0 when equal or not comparable. */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a)
  const right = versionParts(b)
  if (!left || !right) return 0
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export interface UpdateSettings {
  /** Off by default: no network request happens unless the teacher turns this on. */
  checkOnStart: boolean
}

export function parseUpdateSettings(raw: unknown): UpdateSettings {
  const value =
    typeof raw === 'object' && raw !== null
      ? (raw as { checkOnStart?: unknown }).checkOnStart
      : false
  return { checkOnStart: value === true }
}

export interface UpdateStatus {
  currentVersion: string
  channel: UpdateChannel
  checking: boolean
  checkedAt: string | null
  latestVersion: string | null
  available: boolean
  downloading: boolean
  /** 0-100 while downloading. */
  progress: number | null
  downloaded: boolean
  releaseUrl: string
  error: string | null
}

export function initialUpdateStatus(currentVersion: string, channel: UpdateChannel): UpdateStatus {
  return {
    currentVersion,
    channel,
    checking: false,
    checkedAt: null,
    latestVersion: null,
    available: false,
    downloading: false,
    progress: null,
    downloaded: false,
    releaseUrl: RELEASES_PAGE,
    error: null,
  }
}

/** Reads the version from a GitHub "latest release" API response. */
export function latestReleaseVersion(body: unknown): { version: string; url: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const record = body as {
    tag_name?: unknown
    html_url?: unknown
    draft?: unknown
    prerelease?: unknown
  }
  if (record.draft === true || record.prerelease === true) return null
  if (typeof record.tag_name !== 'string' || !versionParts(record.tag_name)) return null
  return {
    version: record.tag_name.replace(/^v/, ''),
    url:
      typeof record.html_url === 'string' &&
      record.html_url.startsWith('https://github.com/purysho/ClassGraph/')
        ? record.html_url
        : RELEASES_PAGE,
  }
}
