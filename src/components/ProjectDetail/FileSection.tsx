import { useState, useRef, useCallback } from 'react'
import { selectFolder, selectFile, openFile } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { getPathName } from '../../utils/remote'
import FileCreator from './FileCreator'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPath, setEditPath] = useState('')
  const editFileRef = useRef<HTMLDivElement>(null)

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditTitle('')
    setEditPath('')
  }, [])

  const saveEditing = useCallback(async () => {
    if (editingId && editPath.trim()) {
      const title = editTitle.trim() || getPathName(editPath, 'File')
      await onUpdate(editingId, { title, content: editPath.trim() })
      resetEditState()
    }
  }, [editingId, editTitle, editPath, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editFileRef,
    isActive: !!editingId,
    canSave: !!editPath.trim(),
    onSave: saveEditing,
    onCancel: resetEditState,
  })

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

  const handleAdd = async (title: string, path: string) => {
    await onAdd(title, path)
    onCreatingChange(false)
  }

  if (!isCreating && items.length === 0) return null

  const existingPaths = [...new Set(items.map((i) => i.content).filter(Boolean))] as string[]

  return (
    <section id="section-files" className="scroll-mt-6">
      <h3 className="section-label">
        Open
        <span
          className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-(--text-muted)/20 text-(--text-muted) text-xs cursor-help"
          title="Quick open files, folders, or executables with system default handler"
        >
          ?
        </span>
      </h3>

      {isCreating && (
        <FileCreator existingPaths={existingPaths} onAdd={handleAdd} onCancel={() => onCreatingChange(false)} />
      )}

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) =>
          editingId === item.id ? (
            <div
              key={item.id}
              ref={editFileRef}
              className="w-full p-4 rounded-xl bg-(--bg-elevated) border border-(--border-visible) animate-card-enter"
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
                  <button type="button" onClick={handleSelectFileForEdit} className="btn-ghost whitespace-nowrap">
                    File
                  </button>
                  <button type="button" onClick={handleSelectFolderForEdit} className="btn-ghost whitespace-nowrap">
                    Folder
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs font-mono text-(--text-muted)">Click outside to save</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                    resetEditState()
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
              <div className="tag tag-file cursor-pointer" onClick={() => handleOpen(item)}>
                <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span>{item.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                  className="ml-1 opacity-0 group-hover/file:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => handleEdit(item)}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--text-primary) hover:border-(--text-muted) opacity-0 group-hover/file:opacity-100 transition-all"
              >
                Edit
              </button>
            </div>
          )
        )}

        {!isCreating && (
          <button
            onClick={() => onCreatingChange(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--text-primary) text-(--text-muted) hover:text-(--text-primary) transition-all"
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
