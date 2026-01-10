import type { TodoProgress as TodoProgressType } from '../../types'

interface TodoProgressProps {
  progress: TodoProgressType
}

export default function TodoProgress({ progress }: TodoProgressProps) {
  if (progress.total === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono text-(--text-muted)">
        {progress.completed}/{progress.total}
      </span>
      <div className="w-20 h-1.5 bg-(--bg-elevated) rounded-full overflow-hidden">
        <div
          className="h-full bg-(--accent-primary) transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  )
}
