import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import type { SectionKey } from '../../types'

interface SortableSectionProps {
  id: SectionKey
  children: ReactNode
}

export default function SortableSection({ id, children }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group/sortable relative mb-8 last:mb-0">
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-2 p-1 rounded opacity-0 group-hover/sortable:opacity-50 hover:!opacity-100 focus:!opacity-100 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-opacity z-10"
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
