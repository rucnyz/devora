import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import { ThemeProvider, useTheme } from './hooks/useTheme'

const API_BASE = 'http://localhost:13000/api'

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
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
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openExportDialog = async () => {
    setIsOpen(false)
    try {
      const res = await fetch(`${API_BASE}/projects`)
      const data = await res.json()
      setProjects(data)
      setSelectedProjects(new Set(data.map((p: ProjectBasic) => p.id))) // Select all by default
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
      setSelectedProjects(new Set(projects.map(p => p.id)))
    }
  }

  const handleExport = async () => {
    try {
      const projectIds = Array.from(selectedProjects).join(',')
      const url = projectIds ? `${API_BASE}/data/export?projectIds=${projectIds}` : `${API_BASE}/data/export`
      const res = await fetch(url)
      const data = await res.json()

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

      const res = await fetch(`${API_BASE}/data/import?mode=merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await res.json()
      if (result.success) {
        setStatus({ type: 'success', message: result.message })
        // Reload page to show imported data
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setStatus({ type: 'error', message: result.error })
        setTimeout(() => setStatus(null), 3000)
      }
    } catch {
      setStatus({ type: 'error', message: 'Import failed: Invalid file' })
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export Data
            </button>
            <label className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Import Data
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExportDialog(false)}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl w-[400px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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
              {projects.map(project => (
                <label key={project.id} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-[var(--bg-surface)] -mx-2 px-2 rounded">
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
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm z-50 ${
          status.type === 'success'
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-[var(--accent-error)] text-white'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  )
}

const GITHUB_REPO = 'rucnyz/devora'

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count)
        }
      })
      .catch(() => {})
  }, [])

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return count.toString()
  }

  return (
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
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
        </svg>
        <span className="font-medium text-[var(--text-primary)]">Star</span>
      </span>
      {/* Right: Count */}
      <span className="flex items-center px-3 h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] font-medium text-[var(--text-primary)]">
        {stars !== null ? formatStars(stars) : '-'}
      </span>
    </a>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-void)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
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
              <p className="text-xs font-mono text-[var(--text-muted)] -mt-0.5">
                v{__APP_VERSION__}
              </p>
            </div>
          </Link>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <GitHubStars />
            <DataMenu />
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

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-xs font-mono text-[var(--text-muted)] text-center">
            Built with Bun + Hono + React // <span className="text-[var(--accent-primary)]">Neo-Terminal</span> design
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  )
}
