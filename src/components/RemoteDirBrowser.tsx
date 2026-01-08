import { useState, useEffect, useCallback, useRef } from 'react'
import { listRemoteDir, type RemoteDirEntry } from '../hooks/useProjects'

interface RemoteDirBrowserProps {
  host: string
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

// Timeout for directory listing (ms)
const DIR_LIST_TIMEOUT = 15000

export default function RemoteDirBrowser({ host, initialPath = '~', onSelect, onClose }: RemoteDirBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [inputPath, setInputPath] = useState(initialPath)
  const [entries, setEntries] = useState<RemoteDirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Prevent concurrent fetches (SSH servers rate-limit rapid connections)
  const fetchInProgressRef = useRef(false)

  const fetchDir = useCallback(async () => {
    if (!host) return

    // Prevent concurrent fetches - SSH servers rate-limit rapid connections
    if (fetchInProgressRef.current) {
      return
    }

    fetchInProgressRef.current = true
    setLoading(true)
    setError(null)

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Directory listing timed out')), DIR_LIST_TIMEOUT)
      )

      const result = await Promise.race([listRemoteDir(host, currentPath), timeoutPromise])

      setCurrentPath(result.path)
      setInputPath(result.path)
      const sorted = [...result.entries].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setEntries(sorted)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      fetchInProgressRef.current = false
      setLoading(false)
    }
  }, [host, currentPath])

  useEffect(() => {
    fetchDir()
  }, [fetchDir])

  const handleClose = () => {
    onClose()
  }

  const handleSelectCurrent = () => {
    onSelect(currentPath)
  }

  const handleNavigate = (entry: RemoteDirEntry) => {
    if (entry.isDir) {
      setCurrentPath(`${currentPath}/${entry.name}`)
    }
  }

  const handleGoUp = () => {
    // Handle ~ paths specially
    if (currentPath === '~' || currentPath === '/') {
      // Already at root, can't go up
      return
    }

    if (currentPath.startsWith('~/')) {
      // Path like ~/foo/bar -> ~/foo, or ~/foo -> ~
      const withoutTilde = currentPath.substring(2) // Remove ~/
      const parts = withoutTilde.split('/')
      parts.pop()
      if (parts.length === 0) {
        setCurrentPath('~')
      } else {
        setCurrentPath('~/' + parts.join('/'))
      }
    } else {
      // Regular absolute path like /home/user
      const parts = currentPath.split('/')
      if (parts.length > 1) {
        parts.pop()
        setCurrentPath(parts.join('/') || '/')
      }
    }
  }

  const handleGoToPath = () => {
    const path = inputPath.trim()
    if (path && path !== currentPath) {
      setCurrentPath(path)
    }
  }

  // Directories only (for selection)
  const directories = entries.filter((e) => e.isDir)

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-(--text-primary)">
            Browse Remote: <span className="text-(--accent-remote)">{host}</span>
          </h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-elevated) transition-colors"
          >
            ×
          </button>
        </div>

        {/* Current path with inline editing */}
        <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-(--bg-elevated) border border-(--border-visible)">
          <button
            onClick={handleGoUp}
            className="px-2 py-1 text-sm font-mono rounded bg-(--bg-surface) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-primary) hover:border-(--accent-primary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPath === '/' || currentPath === '~'}
          >
            ↑ ..
          </button>
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToPath()}
            className="flex-1 text-sm font-mono bg-transparent border-none text-(--text-primary) focus:outline-none"
          />
          {inputPath.trim() !== currentPath && (
            <button
              onClick={handleGoToPath}
              className="px-2 py-1 text-sm font-mono rounded bg-(--bg-surface) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-remote) hover:border-(--accent-remote) transition-colors"
            >
              Go
            </button>
          )}
        </div>

        {/* Directory listing */}
        <div className="h-64 overflow-y-auto mb-4 rounded-lg border border-(--border-visible)">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-(--accent-remote) border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono text-(--text-muted)">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
              <span className="text-sm font-mono text-(--accent-danger) text-center">{error}</span>
              <span className="text-xs text-(--text-muted) text-center">
                Tip: Ensure SSH can connect without password prompt (use ssh-agent or key without passphrase)
              </span>
            </div>
          ) : directories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm font-mono text-(--text-muted)">No subdirectories</span>
            </div>
          ) : (
            <div className="divide-y divide-(--border-subtle)">
              {directories.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => handleNavigate(entry)}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-(--bg-elevated) transition-colors"
                >
                  <svg className="w-4 h-4 text-(--accent-remote)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="font-mono text-sm text-(--text-primary)">{entry.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={handleClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSelectCurrent}
            className="px-4 py-2 rounded-lg bg-(--accent-remote) text-white font-medium hover:bg-(--accent-remote-dim) transition-colors"
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  )
}
