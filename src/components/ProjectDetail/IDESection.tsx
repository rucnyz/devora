import { useState, useRef, useEffect, useCallback } from 'react'
import { selectFolder, openIde } from '../../hooks/useProjects'
import { IDE_LABELS, IDE_TAG_CLASSES, IDE_TYPES } from '../../constants/itemTypes'
import type { Item, IdeType, WorkingDir } from '../../types'

// Extracted creator component to reset state on mount
function IDECreator({
  workingDirs,
  onAdd,
  onCreatingChange,
}: {
  workingDirs: WorkingDir[]
  onAdd: (title: string, path: string, ideType: IdeType) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}) {
  const [newIdeType, setNewIdeType] = useState<IdeType>('pycharm')
  const [newPath, setNewPath] = useState('')
  const newIdeRef = useRef<HTMLDivElement>(null)

  const saveCreating = useCallback(async () => {
    if (newPath.trim()) {
      const pathParts = newPath.trim().split(/[\\/]/)
      const title = pathParts[pathParts.length - 1] || 'Project'
      await onAdd(title, newPath.trim(), newIdeType)
      onCreatingChange(false)
    }
  }, [newPath, newIdeType, onAdd, onCreatingChange])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (newIdeRef.current && !newIdeRef.current.contains(event.target as Node)) {
        if (newPath.trim()) {
          await saveCreating()
        } else {
          onCreatingChange(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [newPath, saveCreating, onCreatingChange])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && newPath.trim()) {
        e.preventDefault()
        e.stopPropagation()
        await saveCreating()
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [newPath, saveCreating])

  const handleSelectFolder = async () => {
    const path = await selectFolder()
    if (path) setNewPath(path)
  }

  return (
    <div
      ref={newIdeRef}
      className="mb-4 p-4 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/30"
    >
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={newIdeType}
          onChange={(e) => setNewIdeType(e.target.value as IdeType)}
          className="input-terminal !w-auto"
        >
          {IDE_TYPES.map((ide) => (
            <option key={ide.value} value={ide.value}>
              {ide.label}
            </option>
          ))}
        </select>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="Project folder path..."
            className="input-terminal flex-1"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSelectFolder}
            className="btn-ghost whitespace-nowrap"
          >
            Browse
          </button>
        </div>
      </div>
      {/* Working dirs suggestions (local only) */}
      {workingDirs.filter(d => !d.host).length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-mono text-[var(--text-muted)]">Working dirs:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {workingDirs.filter(d => !d.host).map((dir) => (
              <button
                key={dir.path}
                type="button"
                onClick={() => setNewPath(dir.path)}
                className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors"
                title={dir.path}
              >
                {dir.name} <span className="opacity-50">local</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
        Click outside to save
      </div>
    </div>
  )
}

interface IDESectionProps {
  items: Item[]
  isCreating: boolean
  workingDirs: WorkingDir[]
  onAdd: (title: string, path: string, ideType: IdeType) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function IDESection({
  items,
  isCreating,
  workingDirs,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: IDESectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIdeType, setEditIdeType] = useState<IdeType>('pycharm')
  const [editPath, setEditPath] = useState('')
  const editIdeRef = useRef<HTMLDivElement>(null)

  const saveEditing = useCallback(async () => {
    if (editingId && editPath.trim()) {
      const pathParts = editPath.trim().split(/[\\/]/)
      const title = pathParts[pathParts.length - 1] || 'Project'
      await onUpdate(editingId, { title, content: editPath.trim(), ide_type: editIdeType })
      setEditingId(null)
      setEditPath('')
      setEditIdeType('pycharm')
    }
  }, [editingId, editPath, editIdeType, onUpdate])

  // Click outside handler for editing
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (editingId && editIdeRef.current && !editIdeRef.current.contains(event.target as Node)) {
        if (editPath.trim()) {
          await saveEditing()
        } else {
          setEditingId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingId, editPath, saveEditing])

  // Ctrl+S handler for editing
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingId && editPath.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editingId, editPath, saveEditing])

  const handleSelectFolderForEdit = async () => {
    const path = await selectFolder()
    if (path) setEditPath(path)
  }

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditIdeType(item.ide_type || 'pycharm')
    setEditPath(item.content || '')
  }

  const handleOpen = async (item: Item) => {
    if (item.ide_type && item.content) {
      try {
        await openIde(item.ide_type, item.content)
      } catch {
        alert(`Failed to open ${item.ide_type}`)
      }
    }
  }

  if (!isCreating && items.length === 0) return null

  return (
    <section id="section-apps" className="mb-8 scroll-mt-6">
      <h3 className="section-label">IDE</h3>

      {/* Inline IDE Creator */}
      {isCreating && (
        <IDECreator
          workingDirs={workingDirs}
          onAdd={onAdd}
          onCreatingChange={onCreatingChange}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) =>
          editingId === item.id ? (
            <div
              key={item.id}
              ref={editIdeRef}
              className="w-full p-4 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/30 animate-card-enter"
            >
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={editIdeType}
                  onChange={(e) => setEditIdeType(e.target.value as IdeType)}
                  className="input-terminal !w-auto"
                >
                  {IDE_TYPES.map((ide) => (
                    <option key={ide.value} value={ide.value}>
                      {ide.label}
                    </option>
                  ))}
                </select>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editPath}
                    onChange={(e) => setEditPath(e.target.value)}
                    placeholder="Project folder path..."
                    className="input-terminal flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolderForEdit}
                    className="btn-ghost whitespace-nowrap"
                  >
                    Browse
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
              className="group/ide relative animate-card-enter mr-12"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className={`tag ${IDE_TAG_CLASSES[item.ide_type!] || 'tag-file'} cursor-pointer`}
                onClick={() => handleOpen(item)}
              >
                <span>{IDE_LABELS[item.ide_type!] || item.ide_type}</span>
                <span className="opacity-60">{item.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                  className="ml-1 opacity-0 group-hover/ide:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => handleEdit(item)}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] opacity-0 group-hover/ide:opacity-100 transition-all"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--text-muted)] hover:border-[var(--accent-primary)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-all"
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
