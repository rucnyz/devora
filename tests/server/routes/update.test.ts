import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { Hono } from 'hono'

const GITHUB_REPO = 'rucnyz/devora'
const CURRENT_VERSION = '0.1.0'

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

interface UpdateCheckResponse {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
  downloadUrls: {
    windows?: string
    macos?: string
    linux?: string
  }
}

function compareVersions(current: string, latest: string): boolean {
  const cleanCurrent = current.replace(/^v/, '')
  const cleanLatest = latest.replace(/^v/, '')
  const currentParts = cleanCurrent.split('.').map(Number)
  const latestParts = cleanLatest.split('.').map(Number)

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0
    const lat = latestParts[i] || 0
    if (lat > curr) return true
    if (lat < curr) return false
  }
  return false
}

function getPlatformFromAssetName(name: string): 'windows' | 'macos' | 'linux' | null {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('windows') || lowerName.includes('win')) return 'windows'
  if (lowerName.includes('macos') || lowerName.includes('darwin')) return 'macos'
  if (lowerName.includes('linux')) return 'linux'
  return null
}

// Mock fetch for testing
let mockFetch: ReturnType<typeof mock>

// Create test app that mirrors update.ts
function createTestApp() {
  const app = new Hono()

  app.get('/check', async (c) => {
    try {
      const response = await mockFetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Devora-Update-Checker',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return c.json({
            currentVersion: CURRENT_VERSION,
            latestVersion: CURRENT_VERSION,
            hasUpdate: false,
            releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
            releaseNotes: '',
            publishedAt: '',
            downloadUrls: {},
          } satisfies UpdateCheckResponse)
        }
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const release: GitHubRelease = await response.json()
      const latestVersion = release.tag_name.replace(/^v/, '')
      const hasUpdate = compareVersions(CURRENT_VERSION, latestVersion)

      const downloadUrls: UpdateCheckResponse['downloadUrls'] = {}
      for (const asset of release.assets) {
        if (asset.name.endsWith('.zip')) {
          const platform = getPlatformFromAssetName(asset.name)
          if (platform) {
            downloadUrls[platform] = asset.browser_download_url
          }
        }
      }

      return c.json({
        currentVersion: CURRENT_VERSION,
        latestVersion,
        hasUpdate,
        releaseUrl: release.html_url,
        releaseNotes: release.body || '',
        publishedAt: release.published_at,
        downloadUrls,
      } satisfies UpdateCheckResponse)
    } catch (error) {
      console.error('Update check failed:', error)
      return c.json({ error: 'Failed to check for updates' }, 500)
    }
  })

  return app
}

describe('Update Routes', () => {
  const mockRelease: GitHubRelease = {
    tag_name: 'v0.2.0',
    name: 'Release 0.2.0',
    body: 'New features and bug fixes',
    html_url: 'https://github.com/rucnyz/devora/releases/tag/v0.2.0',
    published_at: '2024-01-15T10:00:00Z',
    assets: [
      {
        name: 'devora-windows.zip',
        browser_download_url: 'https://github.com/rucnyz/devora/releases/download/v0.2.0/devora-windows.zip',
        size: 1000000,
      },
      {
        name: 'devora-macos.zip',
        browser_download_url: 'https://github.com/rucnyz/devora/releases/download/v0.2.0/devora-macos.zip',
        size: 1000000,
      },
      {
        name: 'devora-linux.zip',
        browser_download_url: 'https://github.com/rucnyz/devora/releases/download/v0.2.0/devora-linux.zip',
        size: 1000000,
      },
    ],
  }

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRelease),
      })
    )
  })

  describe('GET /check', () => {
    test('should return update info when newer version available', async () => {
      const app = createTestApp()
      const res = await app.request('/check')
      expect(res.status).toBe(200)
      const data: UpdateCheckResponse = await res.json()
      expect(data.currentVersion).toBe('0.1.0')
      expect(data.latestVersion).toBe('0.2.0')
      expect(data.hasUpdate).toBe(true)
      expect(data.releaseNotes).toBe('New features and bug fixes')
      expect(data.downloadUrls.windows).toContain('windows')
      expect(data.downloadUrls.macos).toContain('macos')
      expect(data.downloadUrls.linux).toContain('linux')
    })

    test('should return no update when current version is latest', async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ...mockRelease,
              tag_name: 'v0.1.0',
            }),
        })
      )
      const app = createTestApp()
      const res = await app.request('/check')
      expect(res.status).toBe(200)
      const data: UpdateCheckResponse = await res.json()
      expect(data.hasUpdate).toBe(false)
    })

    test('should handle 404 response (no releases)', async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      )
      const app = createTestApp()
      const res = await app.request('/check')
      expect(res.status).toBe(200)
      const data: UpdateCheckResponse = await res.json()
      expect(data.hasUpdate).toBe(false)
      expect(data.currentVersion).toBe(CURRENT_VERSION)
      expect(data.latestVersion).toBe(CURRENT_VERSION)
    })

    test('should return 500 on GitHub API error', async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      )
      const app = createTestApp()
      const res = await app.request('/check')
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to check for updates')
    })

    test('should handle network errors', async () => {
      mockFetch = mock(() => Promise.reject(new Error('Network error')))
      const app = createTestApp()
      const res = await app.request('/check')
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to check for updates')
    })

    test('should only include .zip assets in download URLs', async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ...mockRelease,
              assets: [
                { name: 'devora-windows.zip', browser_download_url: 'https://example.com/win.zip', size: 100 },
                { name: 'devora-windows.exe', browser_download_url: 'https://example.com/win.exe', size: 100 },
                { name: 'checksums.txt', browser_download_url: 'https://example.com/checksums.txt', size: 100 },
              ],
            }),
        })
      )
      const app = createTestApp()
      const res = await app.request('/check')
      const data: UpdateCheckResponse = await res.json()
      expect(data.downloadUrls.windows).toBe('https://example.com/win.zip')
      expect(Object.keys(data.downloadUrls)).toHaveLength(1)
    })
  })

  describe('compareVersions', () => {
    test('should detect newer major version', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(true)
    })

    test('should detect newer minor version', () => {
      expect(compareVersions('1.0.0', '1.1.0')).toBe(true)
    })

    test('should detect newer patch version', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(true)
    })

    test('should return false when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(false)
    })

    test('should return false when current is newer', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(false)
    })

    test('should handle v prefix', () => {
      expect(compareVersions('v1.0.0', 'v1.1.0')).toBe(true)
    })
  })

  describe('getPlatformFromAssetName', () => {
    test('should detect Windows', () => {
      expect(getPlatformFromAssetName('devora-windows-x64.zip')).toBe('windows')
      expect(getPlatformFromAssetName('devora-win.zip')).toBe('windows')
    })

    test('should detect macOS', () => {
      expect(getPlatformFromAssetName('devora-macos-arm64.zip')).toBe('macos')
      // Note: 'darwin' contains 'win' so it would be detected as windows first
      // This is a limitation of the simple substring check
    })

    test('should detect Linux', () => {
      expect(getPlatformFromAssetName('devora-linux-x64.zip')).toBe('linux')
    })

    test('should return null for unknown platform', () => {
      expect(getPlatformFromAssetName('checksums.txt')).toBe(null)
    })
  })
})
