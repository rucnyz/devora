import { useState, useRef, useEffect, useCallback } from 'react'
import type { Item } from '../../types'

interface NotesSectionProps {
  notes: Item[]
  isCreating: boolean
  onStartCreate: () => void
  onAdd: (title: string, content?: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function NotesSection({
  notes,
  isCreating,
  onStartCreate,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: NotesSectionProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const newNoteRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const editNoteRef = useRef<HTMLDivElement>(null)

  // Refs for accessing latest state in effects
  const editTitleRef = useRef('')
  const editContentRef = useRef('')
  const editingIdRef = useRef<string | null>(null)

  useEffect(() => {
    editTitleRef.current = editTitle
  }, [editTitle])

  useEffect(() => {
    editContentRef.current = editContent
  }, [editContent])

  useEffect(() => {
    editingIdRef.current = editingId
  }, [editingId])

  const saveCreating = useCallback(async () => {
    if (isCreating) {
      const title = newTitle.trim() || 'Untitled'
      await onAdd(title, newContent.trim() || undefined)
      onCreatingChange(false)
      setNewTitle('')
      setNewContent('')
    }
  }, [isCreating, newTitle, newContent, onAdd, onCreatingChange])

  const saveEditing = useCallback(async () => {
    if (editingIdRef.current) {
      const title = editTitleRef.current.trim() || 'Untitled'
      await onUpdate(editingIdRef.current, { title, content: editContentRef.current.trim() || undefined })
      setEditingId(null)
      setEditTitle('')
      setEditContent('')
    }
  }, [onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (isCreating && newNoteRef.current && !newNoteRef.current.contains(event.target as Node)) {
        await saveCreating()
      }
      if (editingIdRef.current && editNoteRef.current && !editNoteRef.current.contains(event.target as Node)) {
        await saveEditing()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCreating, saveCreating, saveEditing])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingIdRef.current || isCreating) {
          e.preventDefault()
          e.stopPropagation()
          if (editingIdRef.current) {
            await saveEditing()
          } else if (isCreating) {
            await saveCreating()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCreating, saveCreating, saveEditing])

  const handleEdit = (note: Item) => {
    setEditingId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content || '')
  }

  // Reset creating state when isCreating prop changes to true
  useEffect(() => {
    if (isCreating) {
      setNewTitle('')
      setNewContent('')
    }
  }, [isCreating])

  return (
    <section id="section-notes" className="scroll-mt-6">
      <h3 className="section-label">Notes</h3>

      {/* New Note Editor */}
      {isCreating && (
        <div
          ref={newNoteRef}
          className="note-card note-card-editing mb-4"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveCreating()
              }
            }}
            placeholder="Note title..."
            className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your note here..."
            className="textarea-terminal"
          />
          <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
            Click outside to save
          </div>
        </div>
      )}

      {notes.length === 0 && !isCreating ? (
        <p className="text-[var(--text-muted)] font-mono text-sm">No notes yet. Add a note to get started.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note, index) =>
            editingId === note.id ? (
              <div
                key={note.id}
                ref={editNoteRef}
                className="note-card note-card-editing"
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveEditing()
                    }
                  }}
                  placeholder="Note title..."
                  className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none"
                  autoFocus
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your note here..."
                  className="textarea-terminal"
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(note.id)
                      setEditingId(null)
                    }}
                    className="btn-delete"
                  >
                    delete
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={note.id}
                onClick={() => handleEdit(note)}
                className="note-card animate-card-enter group relative"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(note.id)
                  }}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  ×
                </button>
                <h4 className="font-medium text-[var(--text-primary)] mb-2 pr-6">{note.title}</h4>
                <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {note.content || <span className="text-[var(--text-muted)] italic">Empty note</span>}
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex gap-4 text-xs font-mono text-[var(--text-muted)]">
                  <span>Created: {new Date(note.created_at).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}</span>
                  <span>Updated: {new Date(note.updated_at).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}</span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}
