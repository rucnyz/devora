import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import { ThemeProvider, useTheme } from './hooks/useTheme'

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
                v0.1.2 // local workspace
              </p>
            </div>
          </Link>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-primary)]"></span>
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">online</span>
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
