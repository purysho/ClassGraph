import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  latestReleaseVersion,
  parseUpdateSettings,
  RELEASES_PAGE,
  updateChannel,
} from '../src/update-policy.js'

describe('update policy', () => {
  it('installs in place only where the build can update itself', () => {
    expect(updateChannel({ packaged: false, platform: 'win32' })).toBe('unavailable')
    expect(updateChannel({ packaged: true, platform: 'win32' })).toBe('install')
    expect(
      updateChannel({
        packaged: true,
        platform: 'win32',
        portableExecutable: 'C:\\ClassGraph.exe',
      }),
    ).toBe('notify')
    expect(updateChannel({ packaged: true, platform: 'linux', appImage: '/x.AppImage' })).toBe(
      'install',
    )
    expect(updateChannel({ packaged: true, platform: 'linux' })).toBe('notify')
    expect(updateChannel({ packaged: true, platform: 'darwin' })).toBe('notify')
  })

  it('compares release versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('v0.9.1', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.9.0', '0.9.0')).toBe(0)
    expect(compareVersions('0.8.9', '0.9.0')).toBeLessThan(0)
    expect(compareVersions('nonsense', '0.9.0')).toBe(0)
  })

  it('never checks automatically unless the teacher turned it on', () => {
    expect(parseUpdateSettings(undefined)).toEqual({ checkOnStart: false })
    expect(parseUpdateSettings({ checkOnStart: 'yes' })).toEqual({ checkOnStart: false })
    expect(parseUpdateSettings({ checkOnStart: true })).toEqual({ checkOnStart: true })
  })

  it('reads the latest release and ignores drafts, prereleases and foreign links', () => {
    expect(
      latestReleaseVersion({
        tag_name: 'v0.10.0',
        html_url: 'https://github.com/purysho/ClassGraph/releases/tag/v0.10.0',
      }),
    ).toEqual({
      version: '0.10.0',
      url: 'https://github.com/purysho/ClassGraph/releases/tag/v0.10.0',
    })
    expect(latestReleaseVersion({ tag_name: 'v1.0.0', prerelease: true })).toBeNull()
    expect(latestReleaseVersion({ tag_name: 'latest' })).toBeNull()
    expect(
      latestReleaseVersion({ tag_name: 'v1.0.0', html_url: 'https://example.com/malware' })?.url,
    ).toBe(RELEASES_PAGE)
  })
})
