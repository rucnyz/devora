import { useState, useRef, useEffect } from 'react'

interface AddDropdownProps {
  onCreateNote: () => void
  onCreateIde: () => void
  onCreateRemoteIde: () => void
  onCreateFile: () => void
  onCreateCommand: () => void
}

// Actions use CSS variables for consistent color theming
const actions = [
  { id: 'note', label: 'Note', color: 'var(--accent-warning)' },
  { id: 'ide', label: 'IDE', color: 'var(--accent-primary)' },
  { id: 'remote', label: 'Remote IDE', color: 'var(--accent-remote)' },
  { id: 'open', label: 'Open File', color: 'var(--text-secondary)' },
  { id: 'command', label: 'Command', color: 'var(--accent-warning)' },
]

export default function AddDropdown({
  onCreateNote,
  onCreateIde,
  onCreateRemoteIde,
  onCreateFile,
  onCreateCommand,
}: AddDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'note':
        onCreateNote()
        break
      case 'ide':
        onCreateIde()
        break
      case 'remote':
        onCreateRemoteIde()
        break
      case 'open':
        onCreateFile()
        break
      case 'command':
        onCreateCommand()
        break
    }
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn-ghost text-sm flex items-center gap-1.5 ${isOpen ? 'bg-[var(--bg-elevated)]' : ''}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 py-2 min-w-[160px] rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-visible)] shadow-lg z-50 animate-card-enter">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="w-full px-4 py-2 text-left text-sm font-mono hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: action.color }} />
              <span style={{ color: action.color }}>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
