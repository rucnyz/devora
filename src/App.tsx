import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { useSetting, SettingsProvider } from './hooks/useSettings.tsx'
import { getProjects, exportData, importData, getSetting, setSetting, deleteSetting } from './api/tauri'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: Update }
  | { status: 'downloading'; progress: number }
  | { status: 'ready' }
  | { status: 'error'; message: string }
  | { status: 'up-to-date' }

function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  const checkForUpdate = async () => {
    setState({ status: 'checking' })
    try {
      // Add 5 second timeout to prevent long waits on slow networks
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Update check timed out')), 5000)
      )
      const update = await Promise.race([check(), timeoutPromise])
      if (update) {
        setState({ status: 'available', update })
      } else {
        setState({ status: 'up-to-date' })
        // Reset to idle after 3 seconds
        setTimeout(() => setState({ status: 'idle' }), 3000)
      }
    } catch (err) {
      setState({ status: 'error', message: String(err) })
      setTimeout(() => setState({ status: 'idle' }), 2000)
    }
  }

  const downloadAndInstall = async () => {
    if (state.status !== 'available') return
    const { update } = state

    setState({ status: 'downloading', progress: 0 })
    try {
      let downloaded = 0
      let contentLength = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const progress = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setState({ status: 'downloading', progress })
        } else if (event.event === 'Finished') {
          setState({ status: 'ready' })
        }
      })
      // Relaunch after installation
      await relaunch()
    } catch (err) {
      setState({ status: 'error', message: String(err) })
      setTimeout(() => setState({ status: 'idle' }), 2000)
    }
  }

  // Render based on state
  switch (state.status) {
    case 'idle':
      return (
        <button
          onClick={checkForUpdate}
          className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
        >
          Check for update
        </button>
      )

    case 'checking':
      return (
        <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1.5">
          <span className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
          Checking...
        </span>
      )

    case 'available':
      return (
        <button
          onClick={downloadAndInstall}
          className="text-xs font-mono text-[var(--accent-primary)] hover:underline flex items-center gap-1"
        >
          <span>v{state.update.version} available</span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--accent-primary)] text-white text-[10px]">Update</span>
        </button>
      )

    case 'downloading':
      return (
        <span className="text-xs font-mono text-[var(--accent-primary)] flex items-center gap-1.5">
          <span className="w-3 h-3 border border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          Downloading {state.progress}%
        </span>
      )

    case 'ready':
      return <span className="text-xs font-mono text-[var(--accent-primary)]">Restarting...</span>

    case 'up-to-date':
      return <span className="text-xs font-mono text-[var(--text-muted)]">Up to date</span>

    case 'error':
      return (
        <button
          onClick={checkForUpdate}
          className="text-xs font-mono text-[var(--accent-danger)] hover:underline"
          title={state.message}
        >
          Update failed - retry
        </button>
      )
  }
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-4 h-4 text-[var(--accent-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  )
}

interface ProjectBasic {
  id: string
  name: string
}

function DataMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [projects, setProjects] = useState<ProjectBasic[]>([])
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openExportDialog = async () => {
    setIsOpen(false)
    try {
      const data = await getProjects()
      setProjects(data.map((p) => ({ id: p.id, name: p.name })))
      setSelectedProjects(new Set(data.map((p) => p.id))) // Select all by default
      setShowExportDialog(true)
    } catch {
      setStatus({ type: 'error', message: 'Failed to load projects' })
      setTimeout(() => setStatus(null), 3000)
    }
  }

  const toggleProject = (id: string) => {
    const newSet = new Set(selectedProjects)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedProjects(newSet)
  }

  const toggleAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(projects.map((p) => p.id)))
    }
  }

  const handleExport = async () => {
    try {
      const projectIds = Array.from(selectedProjects)
      const data = await exportData(projectIds.length > 0 ? projectIds : undefined)

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `devora-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(blobUrl)

      setStatus({ type: 'success', message: `Exported ${data.projects.length} projects!` })
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus({ type: 'error', message: 'Export failed' })
      setTimeout(() => setStatus(null), 3000)
    }
    setShowExportDialog(false)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const result = await importData(data, 'merge')
      setStatus({
        type: 'success',
        message: `Imported ${result.projectsImported} projects, ${result.itemsImported} items`,
      })
      // Reload page to show imported data
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setStatus({ type: 'error', message: `Import failed: ${err}` })
      setTimeout(() => setStatus(null), 3000)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all"
        title="Data sync"
      >
        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              onClick={openExportDialog}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Export Data
            </button>
            <label className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Import Data
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowExportDialog(false)}
        >
          <div
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl w-[400px] max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Export Projects</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">Select projects to export</p>
            </div>

            <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedProjects.size === projects.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Select All ({selectedProjects.size}/{projects.length})
                </span>
              </label>
            </div>

            <div className="max-h-[300px] overflow-y-auto px-5 py-3">
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-3 py-2 cursor-pointer hover:bg-[var(--bg-surface)] -mx-2 px-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.has(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                  <span className="text-sm text-[var(--text-primary)] truncate">{project.name}</span>
                </label>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-3">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={selectedProjects.size === 0}
                className="px-4 py-2 text-sm bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export {selectedProjects.size} Project{selectedProjects.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm z-50 ${
            status.type === 'success' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--accent-error)] text-white'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  )
}

const GITHUB_REPO = 'rucnyz/devora'

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null)
  const [hidden, setHidden] = useState<boolean | null>(null) // null = loading

  // Load setting from database
  useEffect(() => {
    getSetting('hideGitHubStars')
      .then((value) => setHidden(value === 'true'))
      .catch(() => setHidden(false))
  }, [])

  // Fetch stars when not hidden
  useEffect(() => {
    if (hidden !== false) return
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count)
        }
      })
      .catch(() => {})
  }, [hidden])

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return count.toString()
  }

  const hide = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSetting('hideGitHubStars', 'true')
    setHidden(true)
  }

  const show = () => {
    deleteSetting('hideGitHubStars')
    setHidden(false)
  }

  // Loading state
  if (hidden === null) return null

  if (hidden) {
    return (
      <button
        onClick={show}
        className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--border-subtle)] hover:border-[var(--border-accent)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-all"
        title="Show GitHub stars"
      >
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="group/stars relative flex items-center">
      <a
        href={`https://github.com/${GITHUB_REPO}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center h-8 rounded-md overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all text-sm"
        title="Star on GitHub"
      >
        {/* Left: GitHub icon + Star */}
        <span className="flex items-center gap-1.5 px-3 h-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-colors">
          <svg className="w-4 h-4 text-[var(--text-primary)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          <span className="font-medium text-[var(--text-primary)]">Star</span>
        </span>
        {/* Right: Count */}
        <span className="flex items-center px-3 h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] font-medium text-[var(--text-primary)]">
          {stars !== null ? formatStars(stars) : '-'}
        </span>
      </a>
      {/* Hide button */}
      <button
        onClick={hide}
        className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center opacity-0 group-hover/stars:opacity-100 hover:bg-[var(--accent-danger)] hover:border-[var(--accent-danger)] hover:text-white transition-all"
        title="Hide GitHub stars (no external requests)"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const { value: fileCardMaxSize, updateValue: setFileCardMaxSize } = useSetting('fileCardMaxSize')
  const { value: zoomLevel, updateValue: setZoomLevel } = useSetting('zoomLevel')
  const [inputValue, setInputValue] = useState('')
  const [zoomInputValue, setZoomInputValue] = useState('')

  // Round to 1 decimal place to avoid floating point display issues
  const currentMb = Math.round((fileCardMaxSize / (1024 * 1024)) * 10) / 10

  const handleOpen = () => {
    setIsOpen(true)
    setInputValue(String(currentMb))
    setZoomInputValue(String(zoomLevel))
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleSizeChange = (mb: number) => {
    const clamped = Math.max(0.1, Math.min(100, mb))
    // Round to 1 decimal place to avoid floating point issues
    const rounded = Math.round(clamped * 10) / 10
    setFileCardMaxSize(Math.round(rounded * 1024 * 1024))
    setInputValue(String(rounded))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const mb = parseFloat(inputValue)
    if (!isNaN(mb) && mb > 0) {
      handleSizeChange(mb)
    } else {
      setInputValue(String(currentMb))
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  const handleZoomChange = (zoom: number) => {
    const clamped = Math.max(50, Math.min(200, zoom))
    setZoomLevel(clamped)
    setZoomInputValue(String(clamped))
  }

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInputValue(e.target.value)
  }

  const handleZoomInputBlur = () => {
    const zoom = parseInt(zoomInputValue)
    if (!isNaN(zoom) && zoom >= 50 && zoom <= 200) {
      handleZoomChange(zoom)
    } else {
      setZoomInputValue(String(zoomLevel))
    }
  }

  const handleZoomInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomInputBlur()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all"
        title="Settings"
      >
        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center h-screen w-screen" onClick={handleClose}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 h-full w-full" />

          {/* Dialog */}
          <div
            className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Settings</h3>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* File Preview Max Size */}
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-2">File preview max size</label>
                <div className="flex items-center gap-2">
                  {/* Decrease button */}
                  <button
                    onClick={() => handleSizeChange(currentMb - 1)}
                    className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>

                  {/* Input */}
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={inputValue}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      onKeyDown={handleInputKeyDown}
                      className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-center text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-sm text-[var(--text-muted)] shrink-0">MB</span>
                  </div>

                  {/* Increase button */}
                  <button
                    onClick={() => handleSizeChange(currentMb + 1)}
                    className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Interface Zoom */}
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-2">Interface zoom</label>
                <div className="flex items-center gap-2">
                  {/* Decrease button */}
                  <button
                    onClick={() => handleZoomChange(zoomLevel - 10)}
                    disabled={zoomLevel <= 50}
                    className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>

                  {/* Input */}
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="50"
                      max="200"
                      step="10"
                      value={zoomInputValue}
                      onChange={handleZoomInputChange}
                      onBlur={handleZoomInputBlur}
                      onKeyDown={handleZoomInputKeyDown}
                      className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-center text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-sm text-[var(--text-muted)] shrink-0">%</span>
                  </div>

                  {/* Increase button */}
                  <button
                    onClick={() => handleZoomChange(zoomLevel + 10)}
                    disabled={zoomLevel >= 200}
                    className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  Ctrl+Scroll or Ctrl+/- to zoom, Ctrl+0 to reset
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-void)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="group flex items-center gap-3">
              {/* Logo */}
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="absolute inset-0.5 bg-[var(--bg-deep)] rounded-[6px]" />
                <span className="relative font-mono font-semibold text-[var(--accent-primary)] text-sm">DV</span>
              </div>
              {/* Title */}
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  Devora
                </h1>
                <p className="text-xs font-mono text-[var(--text-muted)] -mt-0.5">v{__APP_VERSION__}</p>
              </div>
            </Link>
            <span className="text-[var(--text-muted)]">·</span>
            <UpdateChecker />
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <GitHubStars />
            <DataMenu />
            <SettingsButton />
            <ThemeToggle />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <span className="inline-flex rounded-full h-2 w-2 bg-[var(--text-muted)]"></span>
              <span className="text-xs font-mono text-[var(--text-muted)]">fully offline</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

function AppContent() {
  const { value: zoomLevel, updateValue: setZoomLevel } = useSetting('zoomLevel')
  const [showZoomIndicator, setShowZoomIndicator] = useState(false)
  const zoomTimeoutRef = useRef<number | null>(null)
  const location = useLocation()
  const isProjectPage = location.pathname.startsWith('/project/')

  // Track sidebar collapsed state for layout margin
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  })

  // Listen for sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = () => {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')
    }
    window.addEventListener('sidebar-toggle', handleSidebarToggle)
    window.addEventListener('storage', handleSidebarToggle)
    return () => {
      window.removeEventListener('sidebar-toggle', handleSidebarToggle)
      window.removeEventListener('storage', handleSidebarToggle)
    }
  }, [])

  // Use ref to avoid stale closure in event handlers
  const zoomRef = useRef(zoomLevel ?? 100)
  useEffect(() => {
    zoomRef.current = zoomLevel ?? 100
  }, [zoomLevel])

  // Show zoom indicator temporarily when zoom changes
  const showZoomToast = useCallback(() => {
    setShowZoomIndicator(true)
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current)
    }
    zoomTimeoutRef.current = window.setTimeout(() => {
      setShowZoomIndicator(false)
    }, 1500)
  }, [])

  // Handle zoom with Ctrl+Wheel and keyboard shortcuts
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const currentZoom = zoomRef.current
        const delta = e.deltaY > 0 ? -10 : 10
        const newZoom = Math.max(50, Math.min(200, currentZoom + delta))
        if (newZoom !== currentZoom) {
          zoomRef.current = newZoom
          setZoomLevel(newZoom)
          showZoomToast()
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        const currentZoom = zoomRef.current
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          const newZoom = Math.min(200, currentZoom + 10)
          if (newZoom !== currentZoom) {
            zoomRef.current = newZoom
            setZoomLevel(newZoom)
            showZoomToast()
          }
        } else if (e.key === '-') {
          e.preventDefault()
          const newZoom = Math.max(50, currentZoom - 10)
          if (newZoom !== currentZoom) {
            zoomRef.current = newZoom
            setZoomLevel(newZoom)
            showZoomToast()
          }
        } else if (e.key === '0') {
          e.preventDefault()
          if (currentZoom !== 100) {
            zoomRef.current = 100
            setZoomLevel(100)
            showZoomToast()
          }
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [setZoomLevel, showZoomToast])

  const effectiveZoom = zoomLevel ?? 100

  // Apply zoom to html element so it affects everything including portals
  useEffect(() => {
    document.documentElement.style.zoom = `${effectiveZoom / 100}`
    return () => {
      document.documentElement.style.zoom = ''
    }
  }, [effectiveZoom])

  // Calculate sidebar margin for project pages
  const sidebarMargin = isProjectPage ? (sidebarCollapsed ? 'md:ml-12' : 'md:ml-60') : ''

  return (
    <div className={`min-h-screen flex flex-col transition-[margin] duration-300 ${sidebarMargin}`}>
      <Header />
      <main className="flex-1 px-6 py-8 w-full">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-xs font-mono text-[var(--text-muted)] text-center">
            Built with Tauri + React // <span className="text-[var(--accent-primary)]">Neo-Terminal</span> design
          </p>
        </div>
      </footer>

      {/* Zoom indicator toast - rendered via portal to be above sidebar */}
      {showZoomIndicator &&
        createPortal(
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-visible)] rounded-lg shadow-lg z-[100] animate-fade-in flex items-center gap-3">
            <span className="text-sm font-mono text-[var(--text-primary)]">Zoom {effectiveZoom}%</span>
            {effectiveZoom !== 100 && (
              <button
                onClick={() => {
                  zoomRef.current = 100
                  setZoomLevel(100)
                  showZoomToast()
                }}
                className="text-sm font-mono text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Reset to 100%
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </SettingsProvider>
    </ThemeProvider>
  )
}
