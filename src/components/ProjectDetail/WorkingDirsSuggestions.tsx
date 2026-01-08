import type { WorkingDir } from '../../types'

interface WorkingDirsSuggestionsProps {
  workingDirs: WorkingDir[]
  /** Filter: 'all' | 'local' | 'remote' */
  filter?: 'all' | 'local' | 'remote'
  onSelect: (path: string, host?: string) => void
  className?: string
}

/**
 * Reusable component for displaying working directory suggestions
 */
export default function WorkingDirsSuggestions({
  workingDirs,
  filter = 'all',
  onSelect,
  className = '',
}: WorkingDirsSuggestionsProps) {
  const filteredDirs = workingDirs.filter((dir) => {
    if (filter === 'local') return !dir.host
    if (filter === 'remote') return !!dir.host
    return true
  })

  if (filteredDirs.length === 0) return null

  return (
    <div className={className}>
      <span className="text-xs font-mono text-(--text-muted)">Working dirs:</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {filteredDirs.map((dir) => (
          <button
            key={dir.host ? `${dir.host}:${dir.path}` : dir.path}
            type="button"
            onClick={() => onSelect(dir.path, dir.host)}
            className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
              dir.host
                ? 'bg-[#e879f9]/10 border-[#e879f9]/30 text-[#e879f9] hover:bg-[#e879f9]/20'
                : 'bg-(--bg-surface) border-(--border-subtle) text-(--text-secondary) hover:text-(--accent-primary) hover:border-(--accent-primary)'
            }`}
            title={dir.host ? `${dir.host}:${dir.path}` : dir.path}
          >
            {dir.name} <span className="opacity-50">{dir.host ? `@${dir.host}` : 'local'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
