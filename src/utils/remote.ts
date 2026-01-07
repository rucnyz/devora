/**
 * Parse remote content in format "host:path"
 */
export function parseRemoteContent(content: string): { host: string; path: string } {
  const colonIndex = content.indexOf(':')
  if (colonIndex > 0) {
    return {
      host: content.substring(0, colonIndex),
      path: content.substring(colonIndex + 1),
    }
  }
  return { host: content, path: '' }
}

/**
 * Build remote content from host and path
 */
export function buildRemoteContent(host: string, path: string): string {
  return `${host.trim()}:${path.trim()}`
}

/**
 * Extract the last segment from a path (file/folder name)
 */
export function getPathName(path: string, defaultName = 'Project'): string {
  const parts = path.trim().split(/[\\/]/)
  return parts[parts.length - 1] || defaultName
}
