import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

interface SortableNoteProps {
  id: string
  children: ReactNode
}

// Disable animation when dragging ends to prevent jump
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { wasDragging } = args
  if (wasDragging) {
    return false
  }
  return defaultAnimateLayoutChanges(args)
}

export default function SortableNote({ id, children }: SortableNoteProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group/note relative">
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-3 p-1 rounded opacity-0 group-hover/note:opacity-50 hover:!opacity-100 focus:!opacity-100 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--accent-warning)] transition-opacity z-10"
        title="Drag to reorder"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      {children}
    </div>
  )
}
