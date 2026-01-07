import { useState, useRef, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import NoteCreator from './NoteCreator'
import SortableNote from './SortableNote'
import type { Item } from '../../types'

interface NotesSectionProps {
  notes: Item[]
  isCreating: boolean
  onAdd: (title: string, content?: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
  onReorder: (noteIds: string[]) => Promise<void>
}

export default function NotesSection({
  notes,
  isCreating,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
  onReorder,
}: NotesSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const editNoteRef = useRef<HTMLDivElement>(null)

  // Refs for accessing latest state in effects
  const editTitleRef = useRef('')
  const editContentRef = useRef('')
  const editingIdRef = useRef<string | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex((n) => n.id === active.id)
      const newIndex = notes.findIndex((n) => n.id === over.id)
      const newOrder = arrayMove(notes, oldIndex, newIndex)
      await onReorder(newOrder.map((n) => n.id))
    }
  }

  useEffect(() => {
    editTitleRef.current = editTitle
  }, [editTitle])

  useEffect(() => {
    editContentRef.current = editContent
  }, [editContent])

  useEffect(() => {
    editingIdRef.current = editingId
  }, [editingId])

  const saveEditing = useCallback(async () => {
    if (editingIdRef.current) {
      const title = editTitleRef.current.trim() || 'Untitled'
      await onUpdate(editingIdRef.current, { title, content: editContentRef.current.trim() || undefined })
      setEditingId(null)
      setEditTitle('')
      setEditContent('')
    }
  }, [onUpdate])

  // Click outside handler (editor only)
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (editingIdRef.current && editNoteRef.current && !editNoteRef.current.contains(event.target as Node)) {
        await saveEditing()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [saveEditing])

  // Ctrl+S handler (editor only)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingIdRef.current) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [saveEditing])

  const handleEdit = (note: Item) => {
    setEditingId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content || '')
  }

  const handleAdd = async (title: string, content?: string) => {
    await onAdd(title, content)
    onCreatingChange(false)
  }

  return (
    <section id="section-notes" className="scroll-mt-6">
      <h3 className="section-label">Notes</h3>

      {/* New Note Editor */}
      {isCreating && <NoteCreator onAdd={handleAdd} onCancel={() => onCreatingChange(false)} />}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {notes.map((note, index) => (
              <SortableNote key={note.id} id={note.id}>
                {editingId === note.id ? (
                  <div ref={editNoteRef} className="note-card note-card-editing">
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
                      <span>
                        Created:{' '}
                        {new Date(note.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span>
                        Updated:{' '}
                        {new Date(note.updated_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </SortableNote>
            ))}

            {/* Add button */}
            {!isCreating && (
              <button
                onClick={() => onCreatingChange(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--text-muted)] hover:border-[var(--accent-warning)] text-[var(--text-muted)] hover:text-[var(--accent-warning)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-mono text-sm">Add</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
