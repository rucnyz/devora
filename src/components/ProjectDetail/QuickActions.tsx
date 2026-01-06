interface QuickActionsProps {
  onCreateNote: () => void
  onCreateIde: () => void
  onCreateRemoteIde: () => void
  onCreateFile: () => void
  onCreateCommand: () => void
}

export default function QuickActions({
  onCreateNote,
  onCreateIde,
  onCreateRemoteIde,
  onCreateFile,
  onCreateCommand,
}: QuickActionsProps) {
  return (
    <div className="mb-8 flex flex-wrap gap-3">
      <button
        onClick={onCreateNote}
        className="group px-4 py-3 rounded-lg bg-[var(--accent-warning)]/10 border border-[var(--accent-warning)]/30 hover:border-[var(--accent-warning)] transition-all"
      >
        <span className="font-mono text-sm text-[var(--accent-warning)]">+ Note</span>
      </button>
      <button
        onClick={onCreateIde}
        className="group px-4 py-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)] transition-all"
      >
        <span className="font-mono text-sm text-[var(--accent-primary)]">+ IDE</span>
      </button>
      <button
        onClick={onCreateRemoteIde}
        className="group px-4 py-3 rounded-lg bg-[#e879f9]/10 border border-[#e879f9]/30 hover:border-[#e879f9] transition-all"
      >
        <span className="font-mono text-sm text-[#e879f9]">+ Remote IDE</span>
      </button>
      <button
        onClick={onCreateFile}
        className="group px-4 py-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-visible)] hover:border-[var(--text-muted)] transition-all"
      >
        <span className="font-mono text-sm text-[var(--text-secondary)]">+ Open</span>
      </button>
      <button
        onClick={onCreateCommand}
        className="group px-4 py-3 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/30 hover:border-[#fbbf24] transition-all"
      >
        <span className="font-mono text-sm text-[#fbbf24]">+ Command</span>
      </button>
    </div>
  )
}
