import { useState, useRef, useEffect, useCallback } from 'react'
import { selectFolder, selectFile, openFile } from '../../hooks/useProjects'
import type { Item } from '../../types'

interface FileSectionProps {
  items: Item[]
  isCreating: boolean
  onAdd: (title: string, path: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function FileSection({
  items,
  isCreating,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: FileSectionProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newPath, setNewPath] = useState('')
  const newFileRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPath, setEditPath] = useState('')
  const editFileRef = useRef<HTMLDivElement>(null)

  const saveCreating = useCallback(async () => {
    if (isCreating && newPath.trim()) {
      const pathParts = newPath.trim().split(/[\\/]/)
      const title = newTitle.trim() || pathParts[pathParts.length - 1] || 'File'
      await onAdd(title, newPath.trim())
      onCreatingChange(false)
      setNewTitle('')
      setNewPath('')
    }
  }, [isCreating, newTitle, newPath, onAdd, onCreatingChange])

  const saveEditing = useCallback(async () => {
    if (editingId && editPath.trim()) {
      const pathParts = editPath.trim().split(/[\\/]/)
      const title = editTitle.trim() || pathParts[pathParts.length - 1] || 'File'
      await onUpdate(editingId, { title, content: editPath.trim() })
      setEditingId(null)
      setEditTitle('')
      setEditPath('')
    }
  }, [editingId, editTitle, editPath, onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (isCreating && newFileRef.current && !newFileRef.current.contains(event.target as Node)) {
        if (newPath.trim()) {
          await saveCreating()
        } else {
          onCreatingChange(false)
        }
      }
      if (editingId && editFileRef.current && !editFileRef.current.contains(event.target as Node)) {
        if (editPath.trim()) {
          await saveEditing()
        } else {
          setEditingId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCreating, newPath, saveCreating, editingId, editPath, saveEditing, onCreatingChange])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingId && editPath.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        } else if (isCreating && newPath.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveCreating()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCreating, newPath, saveCreating, editingId, editPath, saveEditing])

  const handleSelectFile = async () => {
    const path = await selectFile()
    if (path) setNewPath(path)
  }

  const handleSelectFolder = async () => {
    const path = await selectFolder()
    if (path) setNewPath(path)
  }

  const handleSelectFileForEdit = async () => {
    const path = await selectFile()
    if (path) setEditPath(path)
  }

  const handleSelectFolderForEdit = async () => {
    const path = await selectFolder()
    if (path) setEditPath(path)
  }

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditPath(item.content || '')
  }

  const handleOpen = async (item: Item) => {
    if (item.content) {
      try {
        await openFile(item.content)
      } catch {
        alert('Failed to open file')
      }
    }
  }

  // Reset state when isCreating changes
  useEffect(() => {
    if (isCreating) {
      setNewTitle('')
      setNewPath('')
    }
  }, [isCreating])

  if (!isCreating && items.length === 0) return null

  return (
    <section id="section-files" className="mb-8 scroll-mt-6">
      <h3 className="section-label">
        Open
        <span
          className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--text-muted)]/20 text-[var(--text-muted)] text-xs cursor-help"
          title="Quick open files, folders, or executables with system default handler"
        >?</span>
      </h3>

      {/* Inline File Creator */}
      {isCreating && (
        <div
          ref={newFileRef}
          className="mb-4 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)]"
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (optional)..."
              className="input-terminal w-40"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="File or folder path..."
                className="input-terminal flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSelectFile}
                className="btn-ghost whitespace-nowrap"
              >
                File
              </button>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="btn-ghost whitespace-nowrap"
              >
                Folder
              </button>
            </div>
          </div>
          {/* Existing paths suggestions */}
          {items.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-mono text-[var(--text-muted)]">Existing files:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {[...new Set(items.map(i => i.content))].map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setNewPath(path || '')}
                    className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors truncate max-w-xs"
                    title={path}
                  >
                    {path?.split(/[\\/]/).pop()}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
            Click outside to save
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) =>
          editingId === item.id ? (
            <div
              key={item.id}
              ref={editFileRef}
              className="w-full p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)] animate-card-enter"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title (optional)..."
                  className="input-terminal w-40"
                  autoFocus
                />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editPath}
                    onChange={(e) => setEditPath(e.target.value)}
                    placeholder="File or folder path..."
                    className="input-terminal flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFileForEdit}
                    className="btn-ghost whitespace-nowrap"
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFolderForEdit}
                    className="btn-ghost whitespace-nowrap"
                  >
                    Folder
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
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
              key={item.id}
              className="group/file relative animate-card-enter mr-7"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className="tag tag-file cursor-pointer"
                onClick={() => handleOpen(item)}
              >
                <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>{item.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                  className="ml-1 opacity-0 group-hover/file:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => handleEdit(item)}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] opacity-0 group-hover/file:opacity-100 transition-all"
              >
                Edit
              </button>
            </div>
          )
        )}

        {/* Add button */}
        {!isCreating && (
          <button
            onClick={() => onCreatingChange(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--text-muted)] hover:border-[var(--text-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-mono text-sm">Add</span>
          </button>
        )}
      </div>
    </section>
  )
}
