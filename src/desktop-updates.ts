import { app, net, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  compareVersions,
  initialUpdateStatus,
  LATEST_RELEASE_API,
  latestReleaseVersion,
  parseUpdateSettings,
  RELEASES_PAGE,
  updateChannel,
  type UpdateSettings,
  type UpdateStatus,
} from './update-policy.js'

const { autoUpdater } = electronUpdater

/**
 * Desktop update checks. Nothing here runs unless the teacher presses "Check for updates" or has
 * turned on automatic checks. Installing always needs a separate click.
 */
export class DesktopUpdates {
  private status: UpdateStatus
  private readonly settingsPath: string

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'update-settings.json')
    this.status = initialUpdateStatus(
      app.getVersion(),
      updateChannel({
        packaged: app.isPackaged,
        platform: process.platform,
        portableExecutable: process.env.PORTABLE_EXECUTABLE_FILE,
        appImage: process.env.APPIMAGE,
      }),
    )

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = null
    autoUpdater.on('download-progress', (progress: { percent: number }) => {
      this.status = { ...this.status, progress: Math.round(progress.percent) }
    })
    autoUpdater.on('update-downloaded', () => {
      this.status = { ...this.status, downloading: false, downloaded: true, progress: 100 }
    })
    autoUpdater.on('error', (error: Error) => {
      this.status = {
        ...this.status,
        downloading: false,
        error: `Automatic install is unavailable (${error.message}). Use the download page instead.`,
      }
    })
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  async getSettings(): Promise<UpdateSettings> {
    try {
      return parseUpdateSettings(JSON.parse(await readFile(this.settingsPath, 'utf8')) as unknown)
    } catch {
      return parseUpdateSettings(undefined)
    }
  }

  async setSettings(settings: UpdateSettings): Promise<UpdateSettings> {
    const next = parseUpdateSettings(settings)
    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(this.settingsPath, `${JSON.stringify(next)}\n`, 'utf8')
    return next
  }

  async check(): Promise<UpdateStatus> {
    if (this.status.channel === 'unavailable') {
      this.status = {
        ...this.status,
        error: 'Update checks are only available in installed builds.',
      }
      return this.status
    }
    this.status = { ...this.status, checking: true, error: null }
    try {
      const response = await net.fetch(LATEST_RELEASE_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `ClassGraph/${this.status.currentVersion}`,
        },
      })
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
      const latest = latestReleaseVersion(await response.json())
      if (!latest) throw new Error('the latest release has no usable version')
      const available = compareVersions(latest.version, this.status.currentVersion) > 0
      this.status = {
        ...this.status,
        checking: false,
        checkedAt: new Date().toISOString(),
        latestVersion: latest.version,
        available,
        releaseUrl: latest.url,
      }
      if (available && this.status.channel === 'install') {
        // Primes electron-updater with the release's update metadata (latest.yml).
        await autoUpdater.checkForUpdates()
      }
    } catch (error) {
      this.status = {
        ...this.status,
        checking: false,
        checkedAt: new Date().toISOString(),
        error: `Could not check for updates: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
    return this.status
  }

  download(): UpdateStatus {
    if (this.status.channel !== 'install' || !this.status.available) return this.status
    this.status = { ...this.status, downloading: true, progress: 0, error: null }
    void autoUpdater.downloadUpdate().catch(() => {
      // The 'error' listener records a readable message.
    })
    return this.status
  }

  install(): void {
    if (this.status.downloaded) autoUpdater.quitAndInstall()
  }

  async openReleasePage(): Promise<void> {
    const url = this.status.releaseUrl.startsWith('https://github.com/purysho/ClassGraph/')
      ? this.status.releaseUrl
      : RELEASES_PAGE
    await shell.openExternal(url)
  }
}
