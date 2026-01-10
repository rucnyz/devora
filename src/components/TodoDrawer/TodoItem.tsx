import { useState, useRef, useEffect } from 'react'
import type { TodoItem as TodoItemType } from '../../types'

interface TodoItemProps {
  todo: TodoItemType
  onToggle: () => void
  onDelete: () => void
  onUpdate: (content: string) => Promise<void> | void
  onIndent: (delta: number) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onEditNext?: () => void
  isLast?: boolean
  isFirst?: boolean
  onAddNew?: () => Promise<void> | void
  onEditPrev?: () => void
}

// Simple markdown content renderer - makes URLs clickable and preserves newlines
function MarkdownContent({ content, completed }: { content: string; completed: boolean }) {
  // Split by newlines first, then by URLs within each line
  const lines = content.split('\n')

  return (
    <span className={`whitespace-pre-wrap ${completed ? 'line-through text-(--text-muted)' : 'text-(--text-primary)'}`}>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(https?:\/\/[^\s]+)/g)
        return (
          <span key={lineIndex}>
            {lineIndex > 0 && '\n'}
            {parts.map((part, i) => {
              if (part.match(/^https?:\/\//)) {
                return (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--accent-secondary) hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {part}
                  </a>
                )
              }
              return part
            })}
          </span>
        )
      })}
    </span>
  )
}

export default function TodoItem({
  todo,
  onToggle,
  onDelete,
  onUpdate,
  onIndent,
  dragHandleProps,
  isEditing: controlledIsEditing,
  onStartEdit,
  onStopEdit,
  onEditNext,
  isLast,
  isFirst,
  onAddNew,
  onEditPrev,
}: TodoItemProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(false)
  const isEditing = controlledIsEditing ?? internalIsEditing
  const [editContent, setEditContent] = useState(todo.content)
  const [prevIsEditing, setPrevIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blurTimeoutRef = useRef<number | null>(null)

  // Reset edit content when entering edit mode (adjusting state during render)
  if (isEditing && !prevIsEditing) {
    setEditContent(todo.content)
    setPrevIsEditing(true)
  }
  if (!isEditing && prevIsEditing) {
    setPrevIsEditing(false)
  }

  const startEditing = () => {
    if (onStartEdit) {
      onStartEdit()
    } else {
      setInternalIsEditing(true)
    }
  }

  const stopEditing = () => {
    if (onStopEdit) {
      onStopEdit()
    } else {
      setInternalIsEditing(false)
    }
  }

  // Focus and auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      // Auto-resize to fit content
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  // Cleanup timeout on unmount or when editing ends
  useEffect(() => {
    // Clear blur timeout when we're no longer editing
    // (prevents race condition when switching between TODOs)
    if (!isEditing && blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [isEditing])

  // Auto-resize textarea on content change
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  const handleSave = async (andEditNext = false) => {
    // Don't trim - preserve trailing newlines so user can navigate to empty lines
    if (editContent !== todo.content) {
      await onUpdate(editContent)
    }
    stopEditing()
    if (andEditNext) {
      if (isLast && onAddNew) {
        await onAddNew()
      } else if (onEditNext) {
        onEditNext()
      }
    }
  }

  // Delay blur to allow focus to return if it's just a momentary loss
  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      handleSave()
    }, 150)
  }

  // Cancel blur timeout if we regain focus
  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      // Ctrl/Cmd/Shift+Enter saves and moves to next
      e.preventDefault()
      await handleSave(true)
    } else if (e.key === 'Escape') {
      setEditContent(todo.content)
      stopEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onIndent(e.shiftKey ? -1 : 1)
    } else if (e.key === 'ArrowUp' && onEditPrev && !isFirst) {
      const textarea = textareaRef.current
      if (textarea) {
        // Check if cursor is on the first line
        const cursorPos = textarea.selectionStart
        const textBeforeCursor = editContent.substring(0, cursorPos)
        const isOnFirstLine = !textBeforeCursor.includes('\n')
        if (isOnFirstLine) {
          e.preventDefault()
          await handleSave(false)
          onEditPrev()
        }
      }
    } else if (e.key === 'ArrowDown' && !isLast && onEditNext) {
      const textarea = textareaRef.current
      if (textarea) {
        // Check if cursor is on the last line
        const cursorPos = textarea.selectionStart
        const textAfterCursor = editContent.substring(cursorPos)
        const isOnLastLine = !textAfterCursor.includes('\n')
        if (isOnLastLine) {
          e.preventDefault()
          await handleSave(false)
          onEditNext()
        }
      }
    } else if (e.key === 'Backspace' && editContent === '') {
      // Delete empty TODO on backspace
      e.preventDefault()
      onDelete()
      // Move to previous TODO if exists
      if (onEditPrev && !isFirst) {
        onEditPrev()
      } else {
        stopEditing()
      }
    }
  }

  // Indent padding: 0 -> 0px, 1 -> 24px, 2 -> 48px, 3 -> 72px
  const indentPadding = todo.indent_level * 24

  return (
    <div className="flex items-start gap-2 py-2 group" style={{ paddingLeft: `${indentPadding}px` }}>
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="flex-shrink-0 p-1 text-(--text-muted) opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`
          flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5
          transition-colors cursor-pointer flex items-center justify-center
          ${
            todo.completed
              ? 'bg-(--accent-primary) border-(--accent-primary)'
              : 'border-(--border-visible) hover:border-(--accent-primary)'
          }
        `}
      >
        {todo.completed && (
          <svg className="w-3 h-3 text-(--bg-deep)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={handleTextareaChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          rows={1}
          className="flex-1 w-full bg-transparent border-none outline-none text-(--text-primary) text-sm resize-none overflow-hidden whitespace-pre-wrap"
        />
      ) : (
        <div onClick={startEditing} className="flex-1 text-sm cursor-text min-h-[20px]">
          <MarkdownContent content={todo.content} completed={todo.completed} />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-1 text-(--text-muted) opacity-0 group-hover:opacity-100 hover:text-(--accent-danger) transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  )
}
