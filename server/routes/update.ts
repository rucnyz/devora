import { Hono } from 'hono'

const app = new Hono()

const GITHUB_REPO = 'rucnyz/devora'
const CURRENT_VERSION = process.env.npm_package_version || '0.0.0'

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
  // Remove 'v' prefix if present
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

// GET /api/update/check - Check for updates from GitHub releases
app.get('/check', async (c) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
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

    // Extract download URLs for each platform
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

export default app
