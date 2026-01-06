import { useState, useEffect } from 'react'
import { listRemoteDir, type RemoteDirEntry } from '../hooks/useProjects'

interface RemoteDirBrowserProps {
  host: string
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

export default function RemoteDirBrowser({ host, initialPath = '~', onSelect, onClose }: RemoteDirBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [inputPath, setInputPath] = useState(initialPath)
  const [entries, setEntries] = useState<RemoteDirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!host) return

    setLoading(true)
    setError(null)

    listRemoteDir(host, currentPath)
      .then((result) => {
        setCurrentPath(result.path)
        setInputPath(result.path) // Sync input with resolved path
        // Sort: directories first, then alphabetically
        const sorted = [...result.entries].sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setEntries(sorted)
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [host, currentPath])

  const handleNavigate = (entry: RemoteDirEntry) => {
    if (entry.isDir) {
      setCurrentPath(`${currentPath}/${entry.name}`)
    }
  }

  const handleGoUp = () => {
    const parts = currentPath.split('/')
    if (parts.length > 1) {
      parts.pop()
      setCurrentPath(parts.join('/') || '/')
    }
  }

  const handleSelectCurrent = () => {
    console.log('handleSelectCurrent called, currentPath:', currentPath)
    onSelect(currentPath)
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Browse Remote: <span className="text-[var(--accent-remote)]">{host}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            ×
          </button>
        </div>

        {/* Current path with inline editing */}
        <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-visible)]">
          <button
            onClick={handleGoUp}
            className="px-2 py-1 text-sm font-mono rounded bg-[var(--bg-surface)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors"
            disabled={currentPath === '/'}
          >
            ↑ ..
          </button>
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToPath()}
            className="flex-1 text-sm font-mono bg-transparent border-none text-[var(--text-primary)] focus:outline-none"
          />
          {inputPath.trim() !== currentPath && (
            <button
              onClick={handleGoToPath}
              className="px-2 py-1 text-sm font-mono rounded bg-[var(--bg-surface)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--accent-remote)] hover:border-[var(--accent-remote)] transition-colors"
            >
              Go
            </button>
          )}
        </div>

        {/* Directory listing */}
        <div className="h-64 overflow-y-auto mb-4 rounded-lg border border-[var(--border-visible)]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[var(--accent-remote)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono text-[var(--text-muted)]">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full p-4">
              <span className="text-sm font-mono text-[var(--accent-danger)]">{error}</span>
            </div>
          ) : directories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm font-mono text-[var(--text-muted)]">No subdirectories</span>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {directories.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => handleNavigate(entry)}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <svg className="w-4 h-4 text-[var(--accent-remote)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="font-mono text-sm text-[var(--text-primary)]">{entry.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSelectCurrent}
            className="px-4 py-2 rounded-lg bg-[var(--accent-remote)] text-white font-medium hover:bg-[var(--accent-remote-dim)] transition-colors"
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  )
}
