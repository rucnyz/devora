import type { PathMapping } from '../types'

let mappings: PathMapping[] = []

export function initPathMappings(m: PathMapping[]) {
  mappings = m
}

export function translatePath(path: string): string {
  if (!path || mappings.length === 0) return path

  const isWindows = navigator.platform.startsWith('Win')

  // Sort by longest prefix first for most-specific match
  const sorted = [...mappings].sort((a, b) => {
    if (isWindows) {
      return b.linux.length - a.linux.length
    } else {
      return b.windows.length - a.windows.length
    }
  })

  for (const mapping of sorted) {
    if (isWindows) {
      // On Windows, translate Linux paths to Windows paths
      if (path.startsWith(mapping.linux)) {
        const remainder = path.slice(mapping.linux.length)
        return (mapping.windows + remainder).replace(/\//g, '\\')
      }
    } else {
      // On Linux, translate Windows paths to Linux paths (case-insensitive prefix)
      if (path.toLowerCase().startsWith(mapping.windows.toLowerCase())) {
        const remainder = path.slice(mapping.windows.length)
        return (mapping.linux + remainder).replace(/\\/g, '/')
      }
    }
  }

  return path
}
