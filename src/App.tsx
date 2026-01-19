import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getCurrentWindow } from '@tauri-apps/api/window'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { useSetting, SettingsProvider } from './hooks/useSettings.tsx'
import { useCustomIdes, CustomIdesProvider } from './hooks/useCustomIdes'
import { ToastProvider } from './hooks/useToast'

import type { CustomIde, CustomRemoteIde, TerminalType } from './types'
import { WINDOWS_TERMINALS, MACOS_TERMINALS, LINUX_TERMINALS } from './types'
import {
  getProjects,
  exportDataToFile,
  importData,
  getSetting,
  setSetting,
  deleteSetting,
  saveFileDialog,
  getDatabasePath,
  getDefaultDatabasePath,
  setDatabasePath,
  checkDatabaseExists,
  selectFolder,
  checkExternalChanges,
  reloadStore,
} from './api/tauri'

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
          className="text-xs font-mono text-(--text-muted) hover:text-(--accent-primary) transition-colors"
        >
          Check for update
        </button>
      )

    case 'checking':
      return (
        <span className="text-xs font-mono text-(--text-muted) flex items-center gap-1.5">
          <span className="w-3 h-3 border border-(--text-muted) border-t-transparent rounded-full animate-spin" />
          Checking...
        </span>
      )

    case 'available':
      return (
        <button
          onClick={downloadAndInstall}
          className="text-xs font-mono text-(--accent-primary) hover:underline flex items-center gap-1"
        >
          <span>v{state.update.version} available</span>
          <span className="px-1.5 py-0.5 rounded bg-(--accent-primary) text-white text-[10px]">Update</span>
        </button>
      )

    case 'downloading':
      return (
        <span className="text-xs font-mono text-(--accent-primary) flex items-center gap-1.5">
          <span className="w-3 h-3 border border-(--accent-primary) border-t-transparent rounded-full animate-spin" />
          Downloading {state.progress}%
        </span>
      )

    case 'ready':
      return <span className="text-xs font-mono text-(--accent-primary)">Restarting...</span>

    case 'up-to-date':
      return <span className="text-xs font-mono text-(--text-muted)">Up to date</span>

    case 'error':
      return (
        <button
          onClick={checkForUpdate}
          className="text-xs font-mono text-(--accent-danger) hover:underline"
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
      className="p-2 rounded-lg bg-(--bg-elevated) border border-(--border-subtle) hover:border-(--border-accent) transition-all"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-4 h-4 text-(--accent-warning)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-(--accent-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      const defaultName = `devora-backup-${new Date().toISOString().split('T')[0]}.json`
      const filePath = await saveFileDialog(defaultName)

      if (!filePath) {
        // User cancelled
        setShowExportDialog(false)
        return
      }

      const projectIds = Array.from(selectedProjects)
      const count = await exportDataToFile(filePath, projectIds.length > 0 ? projectIds : undefined)

      setStatus({ type: 'success', message: `Exported ${count} projects!` })
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
        className="p-2 rounded-lg bg-(--bg-elevated) border border-(--border-subtle) hover:border-(--border-accent) transition-all"
        title="Data sync"
      >
        <svg className="w-4 h-4 text-(--text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="absolute right-0 mt-2 w-48 bg-(--bg-elevated) border border-(--border-subtle) rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              onClick={openExportDialog}
              className="w-full px-4 py-2.5 text-left text-sm text-(--text-primary) hover:bg-(--bg-surface) flex items-center gap-2"
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
            <label className="w-full px-4 py-2.5 text-left text-sm text-(--text-primary) hover:bg-(--bg-surface) flex items-center gap-2 cursor-pointer">
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

      {/* Export Dialog - use portal to avoid zoom issues */}
      {showExportDialog &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowExportDialog(false)}
          >
            <div
              className="bg-(--bg-elevated) border border-(--border-subtle) rounded-xl shadow-2xl w-100 max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-(--border-subtle)">
                <h3 className="text-lg font-semibold text-(--text-primary)">Export Projects</h3>
                <p className="text-sm text-(--text-muted) mt-1">Select projects to export</p>
              </div>

              <div className="px-5 py-3 border-b border-(--border-subtle)">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === projects.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-(--border-subtle) text-(--accent-primary) focus:ring-(--accent-primary)"
                  />
                  <span className="text-sm font-medium text-(--text-primary)">
                    Select All ({selectedProjects.size}/{projects.length})
                  </span>
                </label>
              </div>

              <div className="max-h-75 overflow-y-auto px-5 py-3">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-3 py-2 cursor-pointer hover:bg-(--bg-surface) -mx-2 px-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="w-4 h-4 rounded border-(--border-subtle) text-(--accent-primary) focus:ring-(--accent-primary)"
                    />
                    <span className="text-sm text-(--text-primary) truncate">{project.name}</span>
                  </label>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-(--border-subtle) flex justify-end gap-3">
                <button
                  onClick={() => setShowExportDialog(false)}
                  className="px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={selectedProjects.size === 0}
                  className="px-4 py-2 text-sm bg-(--accent-primary) text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export {selectedProjects.size} Project{selectedProjects.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Status toast - use portal to avoid zoom issues */}
      {status &&
        createPortal(
          <div
            className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm z-50 ${
              status.type === 'success' ? 'bg-(--accent-primary) text-white' : 'bg-(--accent-error) text-white'
            }`}
          >
            {status.message}
          </div>,
          document.body
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
        className="flex items-center justify-center w-8 h-8 rounded-md border border-(--border-subtle) hover:border-(--border-accent) bg-(--bg-elevated) hover:bg-(--bg-surface) transition-all"
        title="Show GitHub stars"
      >
        <svg className="w-4 h-4 text-(--text-muted)" fill="currentColor" viewBox="0 0 16 16">
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
        className="flex items-center h-8 rounded-md overflow-hidden border border-(--border-subtle) hover:border-(--border-accent) transition-all text-sm"
        title="Star on GitHub"
      >
        {/* Left: GitHub icon + Star */}
        <span className="flex items-center gap-1.5 px-3 h-full bg-(--bg-elevated) hover:bg-(--bg-surface) transition-colors">
          <svg className="w-4 h-4 text-(--text-primary)" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          <span className="font-medium text-(--text-primary)">Star</span>
        </span>
        {/* Right: Count */}
        <span className="flex items-center px-3 h-full bg-(--bg-surface) border-l border-(--border-subtle) font-medium text-(--text-primary)">
          {stars !== null ? formatStars(stars) : '-'}
        </span>
      </a>
      {/* Hide button */}
      <button
        onClick={hide}
        className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-(--bg-elevated) border border-(--border-subtle) flex items-center justify-center opacity-0 group-hover/stars:opacity-100 hover:bg-(--accent-danger) hover:border-(--accent-danger) hover:text-white transition-all"
        title="Hide GitHub stars (no external requests)"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Generate a unique ID from label with hash suffix
function generateIdeId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const hash = Math.random().toString(36).substring(2, 8)
  return `${base}-${hash}`
}

// Detect platform for terminal options
function getPlatform(): 'windows' | 'macos' | 'linux' {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'linux'
}

function getTerminalOptions() {
  const platform = getPlatform()
  switch (platform) {
    case 'windows':
      return WINDOWS_TERMINALS
    case 'macos':
      return MACOS_TERMINALS
    default:
      return LINUX_TERMINALS
  }
}

function getDefaultTerminal(): TerminalType {
  const platform = getPlatform()
  switch (platform) {
    case 'windows':
      return 'cmd'
    case 'macos':
      return 'mac-terminal'
    default:
      return 'gnome-terminal'
  }
}

function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const { value: fileCardMaxSize, updateValue: setFileCardMaxSize } = useSetting('fileCardMaxSize')
  const { value: zoomLevel, updateValue: setZoomLevel } = useSetting('zoomLevel')
  const { value: defaultTerminalStr, updateValue: setDefaultTerminal } = useSetting('defaultTerminal')
  const { value: codingAgentGlobalEnv, updateValue: setCodingAgentGlobalEnv } = useSetting('codingAgentGlobalEnv')
  const {
    customIdes,
    addCustomIde,
    updateCustomIde,
    deleteCustomIde,
    customRemoteIdes,
    addCustomRemoteIde,
    updateCustomRemoteIde,
    deleteCustomRemoteIde,
  } = useCustomIdes()
  const [inputValue, setInputValue] = useState('')
  const [zoomInputValue, setZoomInputValue] = useState('')

  // IDE tab type (local or remote)
  const [ideTabType, setIdeTabType] = useState<'local' | 'remote'>('local')

  // Custom IDE form state (local)
  const [isAddingIde, setIsAddingIde] = useState(false)
  const [editingIdeId, setEditingIdeId] = useState<string | null>(null)
  const [ideForm, setIdeForm] = useState<CustomIde>({ id: '', label: '', command: '' })
  const [ideError, setIdeError] = useState('')

  // Custom Remote IDE form state
  const [isAddingRemoteIde, setIsAddingRemoteIde] = useState(false)
  const [editingRemoteIdeId, setEditingRemoteIdeId] = useState<string | null>(null)
  const [remoteIdeForm, setRemoteIdeForm] = useState<CustomRemoteIde>({ id: '', label: '', command: '' })
  const [remoteIdeError, setRemoteIdeError] = useState('')

  // Database path state
  const [dbPath, setDbPath] = useState('')
  const [defaultDbPath, setDefaultDbPath] = useState('')
  const [pendingDbPath, setPendingDbPath] = useState<string | null>(null)
  const [dbExists, setDbExists] = useState(false)
  const [dbPathError, setDbPathError] = useState('')

  // Global environment variables state - initialized when modal opens
  const [globalEnvEntries, setGlobalEnvEntries] = useState<Array<{ key: string; value: string }>>([])

  // Round to 1 decimal place to avoid floating point display issues
  const currentMb = Math.round((fileCardMaxSize / (1024 * 1024)) * 10) / 10

  // Initialize env entries when modal opens (not in effect to avoid cascading renders)
  const handleOpenWithEnvInit = () => {
    setIsOpen(true)
    setInputValue(String(currentMb))
    setZoomInputValue(String(zoomLevel))
    // Initialize env entries from settings
    if (codingAgentGlobalEnv) {
      try {
        const parsed = JSON.parse(codingAgentGlobalEnv)
        setGlobalEnvEntries(Object.entries(parsed).map(([key, value]) => ({ key, value: value as string })))
      } catch {
        setGlobalEnvEntries([])
      }
    } else {
      setGlobalEnvEntries([])
    }
  }

  // Load database paths when modal opens
  useEffect(() => {
    if (isOpen) {
      Promise.all([getDatabasePath(), getDefaultDatabasePath()]).then(([current, defaultPath]) => {
        setDbPath(current)
        setDefaultDbPath(defaultPath)
        setPendingDbPath(null)
        setDbPathError('')
      })
    }
  }, [isOpen])

  // Check if database exists when pending path changes
  useEffect(() => {
    if (pendingDbPath) {
      checkDatabaseExists(pendingDbPath).then(setDbExists)
    }
  }, [pendingDbPath])

  const handleClose = () => {
    setIsOpen(false)
    setIdeTabType('local')
    setIsAddingIde(false)
    setEditingIdeId(null)
    setIdeForm({ id: '', label: '', command: '' })
    setIdeError('')
    setIsAddingRemoteIde(false)
    setEditingRemoteIdeId(null)
    setRemoteIdeForm({ id: '', label: '', command: '' })
    setRemoteIdeError('')
  }

  // Custom IDE handlers
  const resetIdeForm = () => {
    setIsAddingIde(false)
    setEditingIdeId(null)
    setIdeForm({ id: '', label: '', command: '' })
    setIdeError('')
  }

  const handleAddIde = async () => {
    if (!ideForm.label.trim() || !ideForm.command.trim()) {
      setIdeError('Label and command are required')
      return
    }
    if (!ideForm.command.includes('{path}')) {
      setIdeError('Command must include {path} placeholder')
      return
    }
    try {
      const id = generateIdeId(ideForm.label)
      await addCustomIde({ ...ideForm, id })
      resetIdeForm()
    } catch (err) {
      setIdeError(err instanceof Error ? err.message : 'Failed to add IDE')
    }
  }

  const handleEditIde = (ide: CustomIde) => {
    setEditingIdeId(ide.id)
    setIdeForm({ ...ide })
    setIdeError('')
  }

  const handleSaveEdit = async () => {
    if (!ideForm.label.trim() || !ideForm.command.trim()) {
      setIdeError('Label and command are required')
      return
    }
    if (!ideForm.command.includes('{path}')) {
      setIdeError('Command must include {path} placeholder')
      return
    }
    try {
      await updateCustomIde(editingIdeId!, { label: ideForm.label, command: ideForm.command })
      resetIdeForm()
    } catch (err) {
      setIdeError(err instanceof Error ? err.message : 'Failed to update IDE')
    }
  }

  const handleDeleteIde = async (id: string) => {
    if (confirm('Delete this custom IDE?')) {
      await deleteCustomIde(id)
    }
  }

  // Custom Remote IDE handlers
  const resetRemoteIdeForm = () => {
    setIsAddingRemoteIde(false)
    setEditingRemoteIdeId(null)
    setRemoteIdeForm({ id: '', label: '', command: '' })
    setRemoteIdeError('')
  }

  const handleAddRemoteIde = async () => {
    if (!remoteIdeForm.label.trim() || !remoteIdeForm.command.trim()) {
      setRemoteIdeError('Label and command are required')
      return
    }
    if (!remoteIdeForm.command.includes('{host}') || !remoteIdeForm.command.includes('{path}')) {
      setRemoteIdeError('Command must include both {host} and {path} placeholders')
      return
    }
    try {
      const id = generateIdeId(remoteIdeForm.label)
      await addCustomRemoteIde({ ...remoteIdeForm, id })
      resetRemoteIdeForm()
    } catch (err) {
      setRemoteIdeError(err instanceof Error ? err.message : 'Failed to add remote IDE')
    }
  }

  const handleEditRemoteIde = (ide: CustomRemoteIde) => {
    setEditingRemoteIdeId(ide.id)
    setRemoteIdeForm({ ...ide })
    setRemoteIdeError('')
  }

  const handleSaveRemoteEdit = async () => {
    if (!remoteIdeForm.label.trim() || !remoteIdeForm.command.trim()) {
      setRemoteIdeError('Label and command are required')
      return
    }
    if (!remoteIdeForm.command.includes('{host}') || !remoteIdeForm.command.includes('{path}')) {
      setRemoteIdeError('Command must include both {host} and {path} placeholders')
      return
    }
    try {
      await updateCustomRemoteIde(editingRemoteIdeId!, { label: remoteIdeForm.label, command: remoteIdeForm.command })
      resetRemoteIdeForm()
    } catch (err) {
      setRemoteIdeError(err instanceof Error ? err.message : 'Failed to update remote IDE')
    }
  }

  const handleDeleteRemoteIde = async (id: string) => {
    if (confirm('Delete this custom remote IDE?')) {
      await deleteCustomRemoteIde(id)
    }
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

  // Database path handlers
  const handleSelectDbPath = async () => {
    const selected = await selectFolder()
    if (selected) {
      setPendingDbPath(selected)
      setDbPathError('')
    }
  }

  const handleApplyDbPath = async () => {
    if (!pendingDbPath) return
    try {
      await setDatabasePath(pendingDbPath)
      // Restart the app to apply changes
      await relaunch()
    } catch (err) {
      setDbPathError(err instanceof Error ? err.message : 'Failed to set database path')
    }
  }

  const handleResetDbPath = async () => {
    try {
      await setDatabasePath('')
      await relaunch()
    } catch (err) {
      setDbPathError(err instanceof Error ? err.message : 'Failed to reset database path')
    }
  }

  // Global environment variables handlers
  const updateGlobalEnvEntry = (index: number, field: 'key' | 'value', newValue: string) => {
    const newEntries = [...globalEnvEntries]
    newEntries[index] = { ...newEntries[index], [field]: newValue }
    setGlobalEnvEntries(newEntries)
  }

  const addGlobalEnvEntry = () => {
    setGlobalEnvEntries([...globalEnvEntries, { key: '', value: '' }])
  }

  const removeGlobalEnvEntry = (index: number) => {
    const newEntries = globalEnvEntries.filter((_, i) => i !== index)
    setGlobalEnvEntries(newEntries)
  }

  const saveGlobalEnvVars = () => {
    const obj: Record<string, string> = {}
    globalEnvEntries
      .filter((e) => e.key.trim())
      .forEach((e) => {
        obj[e.key.trim()] = e.value
      })
    const json = Object.keys(obj).length > 0 ? JSON.stringify(obj) : ''
    setCodingAgentGlobalEnv(json)
  }

  return (
    <>
      <button
        onClick={handleOpenWithEnvInit}
        className="p-2 rounded-lg bg-(--bg-elevated) border border-(--border-subtle) hover:border-(--border-accent) transition-all"
        title="Settings"
      >
        <svg className="w-4 h-4 text-(--text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal - use portal to avoid zoom issues */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
            {/* Dialog */}
            <div
              className="relative bg-(--bg-elevated) border border-(--border-subtle) rounded-xl shadow-2xl w-100 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-subtle)">
                <h3 className="text-base font-semibold text-(--text-primary)">Settings</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded hover:bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary) transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* File Preview Max Size */}
                <div>
                  <label className="block text-sm text-(--text-primary) mb-2">File preview max size</label>
                  <div className="flex items-center gap-2">
                    {/* Decrease button */}
                    <button
                      onClick={() => handleSizeChange(currentMb - 1)}
                      className="p-2 rounded-lg bg-(--bg-surface) hover:bg-(--bg-surface-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
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
                        className="w-full px-3 py-2 bg-(--bg-surface) border border-(--border-subtle) rounded-lg text-center text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary) [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-(--text-muted) shrink-0">MB</span>
                    </div>

                    {/* Increase button */}
                    <button
                      onClick={() => handleSizeChange(currentMb + 1)}
                      className="p-2 rounded-lg bg-(--bg-surface) hover:bg-(--bg-surface-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Interface Zoom */}
                <div>
                  <label className="block text-sm text-(--text-primary) mb-2">Interface zoom</label>
                  <div className="flex items-center gap-2">
                    {/* Decrease button */}
                    <button
                      onClick={() => handleZoomChange(zoomLevel - 10)}
                      disabled={zoomLevel <= 50}
                      className="p-2 rounded-lg bg-(--bg-surface) hover:bg-(--bg-surface-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="w-full px-3 py-2 bg-(--bg-surface) border border-(--border-subtle) rounded-lg text-center text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary) [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-(--text-muted) shrink-0">%</span>
                    </div>

                    {/* Increase button */}
                    <button
                      onClick={() => handleZoomChange(zoomLevel + 10)}
                      disabled={zoomLevel >= 200}
                      className="p-2 rounded-lg bg-(--bg-surface) hover:bg-(--bg-surface-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-(--text-muted) mt-1.5">Ctrl+Scroll or Ctrl+/- to zoom, Ctrl+0 to reset</p>
                </div>

                {/* Default Terminal */}
                <div>
                  <label className="block text-sm text-(--text-primary) mb-2">
                    Default terminal (for Coding Agents)
                  </label>
                  <select
                    value={defaultTerminalStr || getDefaultTerminal()}
                    onChange={(e) => setDefaultTerminal(e.target.value)}
                    className="w-full px-3 py-2 bg-(--bg-surface) border border-(--border-subtle) rounded-lg text-sm text-(--text-primary) focus:outline-none focus:border-(--accent-primary)"
                  >
                    {getTerminalOptions().map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-(--text-muted) mt-1.5">
                    Terminal to use when launching coding agents (Claude, OpenCode, Gemini)
                  </p>
                </div>

                {/* Global Environment Variables for Coding Agents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-(--text-primary)">
                      Global environment variables (Coding Agents)
                    </label>
                    <button onClick={addGlobalEnvEntry} className="text-xs text-(--accent-primary) hover:underline">
                      + Add
                    </button>
                  </div>
                  {globalEnvEntries.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {globalEnvEntries.map((entry, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="KEY"
                            value={entry.key}
                            onChange={(e) => updateGlobalEnvEntry(idx, 'key', e.target.value)}
                            onBlur={saveGlobalEnvVars}
                            className="flex-1 px-2 py-1.5 bg-(--bg-surface) border border-(--border-subtle) rounded text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary)"
                          />
                          <input
                            type="text"
                            placeholder="value"
                            value={entry.value}
                            onChange={(e) => updateGlobalEnvEntry(idx, 'value', e.target.value)}
                            onBlur={saveGlobalEnvVars}
                            className="flex-2 px-2 py-1.5 bg-(--bg-surface) border border-(--border-subtle) rounded text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary)"
                          />
                          <button
                            onClick={() => {
                              removeGlobalEnvEntry(idx)
                              // Save after removal (useEffect won't catch this since we're modifying state directly)
                              setTimeout(saveGlobalEnvVars, 0)
                            }}
                            className="p-1 text-(--text-muted) hover:text-(--accent-danger) transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-(--text-muted) mb-2">
                      No global environment variables set. These will be passed to all coding agents.
                    </p>
                  )}
                  <p className="text-xs text-(--text-muted)">
                    Environment variables set here will be available to all coding agents. Agent-specific variables can
                    override these.
                  </p>
                </div>

                {/* Custom IDEs */}
                <div className="border-t border-(--border-subtle) pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-(--text-primary)">Custom IDEs</label>
                    {ideTabType === 'local' && !isAddingIde && !editingIdeId && (
                      <button
                        onClick={() => setIsAddingIde(true)}
                        className="text-xs text-(--accent-primary) hover:underline"
                      >
                        + Add
                      </button>
                    )}
                    {ideTabType === 'remote' && !isAddingRemoteIde && !editingRemoteIdeId && (
                      <button
                        onClick={() => setIsAddingRemoteIde(true)}
                        className="text-xs text-(--accent-remote) hover:underline"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex gap-1 mb-3">
                    <button
                      onClick={() => setIdeTabType('local')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        ideTabType === 'local'
                          ? 'bg-(--accent-primary) text-white'
                          : 'bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary)'
                      }`}
                    >
                      Local
                    </button>
                    <button
                      onClick={() => setIdeTabType('remote')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        ideTabType === 'remote'
                          ? 'bg-(--accent-remote) text-white'
                          : 'bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary)'
                      }`}
                    >
                      Remote
                    </button>
                  </div>

                  {/* Local IDE Tab */}
                  {ideTabType === 'local' && (
                    <>
                      {/* Add/Edit Form */}
                      {(isAddingIde || editingIdeId) && (
                        <div className="mb-3 p-3 bg-(--bg-surface) rounded-lg space-y-2">
                          <input
                            type="text"
                            placeholder="Label (e.g., Neovim)"
                            value={ideForm.label}
                            onChange={(e) => setIdeForm({ ...ideForm, label: e.target.value })}
                            className="w-full px-2 py-1.5 bg-(--bg-elevated) border border-(--border-subtle) rounded text-sm text-(--text-primary) focus:outline-none focus:border-(--accent-primary)"
                          />
                          <input
                            type="text"
                            placeholder="Command (e.g., nvim {path})"
                            value={ideForm.command}
                            onChange={(e) => setIdeForm({ ...ideForm, command: e.target.value })}
                            className="w-full px-2 py-1.5 bg-(--bg-elevated) border border-(--border-subtle) rounded text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary)"
                          />
                          {ideError && <p className="text-xs text-(--accent-danger)">{ideError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={isAddingIde ? handleAddIde : handleSaveEdit}
                              className="flex-1 px-2 py-1.5 bg-(--accent-primary) text-white text-xs rounded hover:opacity-90 transition-opacity"
                            >
                              {isAddingIde ? 'Add' : 'Save'}
                            </button>
                            <button
                              onClick={resetIdeForm}
                              className="px-2 py-1.5 bg-(--bg-elevated) text-(--text-muted) text-xs rounded hover:text-(--text-primary) transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* IDE List */}
                      {customIdes.length > 0 ? (
                        <div className="space-y-1.5">
                          {customIdes.map((ide) => (
                            <div
                              key={ide.id}
                              className="flex items-center justify-between p-2 bg-(--bg-surface) rounded-lg group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-(--text-primary) font-medium">{ide.label}</div>
                                <div className="text-xs text-(--text-muted) font-mono truncate">{ide.command}</div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditIde(ide)}
                                  className="p-1 text-(--text-muted) hover:text-(--accent-primary) transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteIde(ide.id)}
                                  className="p-1 text-(--text-muted) hover:text-(--accent-danger) transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !isAddingIde && (
                          <p className="text-xs text-(--text-muted)">
                            No custom IDEs. Click "+ Add" to register your own IDE.
                          </p>
                        )
                      )}
                      <div className="text-xs text-(--text-muted) mt-2 space-y-1">
                        <p>
                          Use <code className="bg-(--bg-surface) px-1 rounded">{'{path}'}</code> as placeholder for
                          project path.
                        </p>
                        <p>
                          Use quotes if path may contain spaces:{' '}
                          <code className="bg-(--bg-surface) px-1 rounded">nvim &quot;{'{path}'}&quot;</code>
                        </p>
                      </div>
                    </>
                  )}

                  {/* Remote IDE Tab */}
                  {ideTabType === 'remote' && (
                    <>
                      {/* Add/Edit Form */}
                      {(isAddingRemoteIde || editingRemoteIdeId) && (
                        <div className="mb-3 p-3 bg-(--bg-surface) rounded-lg space-y-2">
                          <input
                            type="text"
                            placeholder="Label (e.g., Neovim SSH)"
                            value={remoteIdeForm.label}
                            onChange={(e) => setRemoteIdeForm({ ...remoteIdeForm, label: e.target.value })}
                            className="w-full px-2 py-1.5 bg-(--bg-elevated) border border-(--border-subtle) rounded text-sm text-(--text-primary) focus:outline-none focus:border-(--accent-remote)"
                          />
                          <input
                            type="text"
                            placeholder="e.g., code --folder-uri vscode-remote://ssh-remote+{host}{path}"
                            title="Command with {host} and {path} placeholders"
                            value={remoteIdeForm.command}
                            onChange={(e) => setRemoteIdeForm({ ...remoteIdeForm, command: e.target.value })}
                            className="w-full px-2 py-1.5 bg-(--bg-elevated) border border-(--border-subtle) rounded text-sm font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-remote)"
                          />
                          {remoteIdeError && <p className="text-xs text-(--accent-danger)">{remoteIdeError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={isAddingRemoteIde ? handleAddRemoteIde : handleSaveRemoteEdit}
                              className="flex-1 px-2 py-1.5 bg-(--accent-remote) text-white text-xs rounded hover:opacity-90 transition-opacity"
                            >
                              {isAddingRemoteIde ? 'Add' : 'Save'}
                            </button>
                            <button
                              onClick={resetRemoteIdeForm}
                              className="px-2 py-1.5 bg-(--bg-elevated) text-(--text-muted) text-xs rounded hover:text-(--text-primary) transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Remote IDE List */}
                      {customRemoteIdes.length > 0 ? (
                        <div className="space-y-1.5">
                          {customRemoteIdes.map((ide) => (
                            <div
                              key={ide.id}
                              className="flex items-center justify-between p-2 bg-(--bg-surface) rounded-lg group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-(--text-primary) font-medium">{ide.label}</div>
                                <div className="text-xs text-(--text-muted) font-mono truncate">{ide.command}</div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditRemoteIde(ide)}
                                  className="p-1 text-(--text-muted) hover:text-(--accent-remote) transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteRemoteIde(ide.id)}
                                  className="p-1 text-(--text-muted) hover:text-(--accent-danger) transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !isAddingRemoteIde && (
                          <p className="text-xs text-(--text-muted)">
                            No custom remote IDEs. Click "+ Add" to register your own.
                          </p>
                        )
                      )}
                      <div className="text-xs text-(--text-muted) mt-2 space-y-1">
                        <p>
                          Use <code className="bg-(--bg-surface) px-1 rounded">{'{host}'}</code> and{' '}
                          <code className="bg-(--bg-surface) px-1 rounded">{'{path}'}</code> as placeholders.
                        </p>
                        <p>
                          For terminal apps (e.g., nvim), open a new window:{' '}
                          <code className="bg-(--bg-surface) px-1 rounded">
                            start cmd /k ssh {'{host}'} &quot;nvim {'{path}'}&quot;
                          </code>
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Database Location */}
                <div className="border-t border-(--border-subtle) pt-4">
                  <label className="block text-sm text-(--text-primary) mb-2">Database location</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={pendingDbPath ?? dbPath}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-(--bg-surface) border border-(--border-subtle) rounded-lg text-(--text-primary) font-mono truncate"
                      title={pendingDbPath ?? dbPath}
                    />
                    <button
                      onClick={handleSelectDbPath}
                      className="px-3 py-2 bg-(--bg-surface) hover:bg-(--bg-surface-hover) border border-(--border-subtle) rounded-lg text-sm text-(--text-primary) transition-colors shrink-0"
                    >
                      Browse
                    </button>
                  </div>

                  {/* Status message */}
                  {pendingDbPath && (
                    <p className={`text-xs mb-2 ${dbExists ? 'text-(--accent-success)' : 'text-(--text-muted)'}`}>
                      {dbExists
                        ? 'Existing database found at this location'
                        : 'A new database will be created at this location'}
                    </p>
                  )}

                  {/* Error message */}
                  {dbPathError && <p className="text-xs text-(--accent-danger) mb-2">{dbPathError}</p>}

                  {/* Action buttons */}
                  {pendingDbPath && pendingDbPath !== dbPath && (
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={handleApplyDbPath}
                        className="flex-1 px-3 py-2 bg-(--accent-primary) text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Apply & Restart
                      </button>
                      <button
                        onClick={() => {
                          setPendingDbPath(null)
                          setDbPathError('')
                        }}
                        className="px-3 py-2 bg-(--bg-surface) text-(--text-muted) text-sm rounded-lg hover:text-(--text-primary) transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Reset to default */}
                  {dbPath !== defaultDbPath && !pendingDbPath && (
                    <button onClick={handleResetDbPath} className="text-xs text-(--accent-primary) hover:underline">
                      Reset to default location
                    </button>
                  )}

                  <p className="text-xs text-(--text-muted) mt-2">Changes require a restart to take effect.</p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-(--border-subtle) bg-(--bg-void)/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="group flex items-center gap-3">
              {/* Logo */}
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 bg-(--accent-primary) rounded-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="absolute inset-0.5 bg-(--bg-deep) rounded-md" />
                <span className="relative font-mono font-semibold text-(--accent-primary) text-sm">DV</span>
              </div>
              {/* Title */}
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-(--text-primary) group-hover:text-(--accent-primary) transition-colors">
                  Devora
                </h1>
                <p className="text-xs font-mono text-(--text-muted) -mt-0.5">v{__APP_VERSION__}</p>
              </div>
            </Link>
            <span className="text-(--text-muted)">·</span>
            <UpdateChecker />
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <GitHubStars />
            <DataMenu />
            <SettingsButton />
            <ThemeToggle />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--bg-elevated) border border-(--border-subtle)">
              <span className="inline-flex rounded-full h-2 w-2 bg-(--text-muted)"></span>
              <span className="text-xs font-mono text-(--text-muted)">fully offline</span>
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

  // Check for external changes and auto-reload if needed
  const checkAndReloadIfNeeded = useCallback(async () => {
    try {
      const hasChanges = await checkExternalChanges()
      if (hasChanges) {
        await reloadStore()
        window.location.reload()
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Periodically check for external changes (e.g., OneDrive sync)
  useEffect(() => {
    const checkInterval = setInterval(checkAndReloadIfNeeded, 5 * 60 * 1000) // Check every 5 minutes
    return () => clearInterval(checkInterval)
  }, [checkAndReloadIfNeeded])

  // Check immediately when window regains focus (using Tauri window event)
  useEffect(() => {
    let unlisten: (() => void) | undefined

    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          checkAndReloadIfNeeded()
        }
      })
      .then((fn) => {
        unlisten = fn
      })

    return () => {
      unlisten?.()
    }
  }, [checkAndReloadIfNeeded])

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
      <footer className="border-t border-(--border-subtle)">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-xs font-mono text-(--text-muted) text-center">
            Built with Tauri + React // <span className="text-(--accent-primary)">Neo-Terminal</span> design
          </p>
        </div>
      </footer>

      {/* Zoom indicator toast - rendered via portal to be above sidebar */}
      {showZoomIndicator &&
        createPortal(
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-(--bg-elevated) border border-(--border-visible) rounded-lg shadow-lg z-100 animate-fade-in flex items-center gap-3">
            <span className="text-sm font-mono text-(--text-primary)">Zoom {effectiveZoom}%</span>
            {effectiveZoom !== 100 && (
              <button
                onClick={() => {
                  zoomRef.current = 100
                  setZoomLevel(100)
                  showZoomToast()
                }}
                className="text-sm font-mono text-(--accent-primary) hover:text-(--accent-hover) transition-colors"
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
        <CustomIdesProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ToastProvider>
        </CustomIdesProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}
