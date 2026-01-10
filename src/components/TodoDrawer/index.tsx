import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TodoItem, TodoProgress as TodoProgressType } from '../../types'
import TodoList, { type TodoListRef } from './TodoList'
import TodoProgress from './TodoProgress'

interface TodoDrawerProps {
  isOpen: boolean
  onClose: () => void
  todos: TodoItem[]
  progress: TodoProgressType
  loading: boolean
  onAdd: (content: string, indentLevel?: number) => Promise<TodoItem>
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReorder: (todoIds: string[]) => Promise<void>
  onIndent: (id: string, delta: number) => Promise<void>
  onUpdate: (
    id: string,
    updates: Partial<Pick<TodoItem, 'content' | 'completed' | 'indent_level' | 'order'>>
  ) => Promise<void>
}

export default function TodoDrawer({
  isOpen,
  onClose,
  todos,
  progress,
  loading,
  onAdd,
  onToggle,
  onDelete,
  onReorder,
  onIndent,
  onUpdate,
}: TodoDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<TodoListRef>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-full w-[480px] max-w-[90vw] z-50
          bg-(--bg-surface) border-l border-(--border-visible)
          transform transition-transform duration-300 ease-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-(--border-subtle)">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-(--text-primary)">TODOs</h2>
            <TodoProgress progress={progress} />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Todo list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-(--text-muted)">Loading...</div>
          ) : (
            <TodoList
              ref={listRef}
              todos={todos}
              onToggle={onToggle}
              onDelete={onDelete}
              onReorder={onReorder}
              onIndent={onIndent}
              onUpdate={onUpdate}
              onAdd={onAdd}
            />
          )}
        </div>
      </div>
    </>
  )

  return createPortal(drawer, document.body)
}
