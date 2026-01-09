import { useState, useRef, useCallback } from 'react'
import { selectFolder, openIde, openCustomIde } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useCustomIdes } from '../../hooks/useCustomIdes'
import { useToast } from '../../hooks/useToast'
import { getPathName } from '../../utils/remote'
import { IDE_LABELS, IDE_TAG_CLASS, IDE_GROUPS, IDE_TYPES } from '../../constants/itemTypes'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import ItemContextMenu, { DuplicateIcon } from '../ItemContextMenu'
import type { Item, IdeType, WorkingDir, CustomIde } from '../../types'

// Check if IDE type is a built-in IDE
const isBuiltInIde = (ideType: string): ideType is IdeType => {
  return IDE_TYPES.some((ide) => ide.value === ideType)
}

// Get display label for any IDE (built-in or custom)
const getIdeLabel = (ideType: string, customIdes: CustomIde[]): string => {
  if (isBuiltInIde(ideType)) {
    return IDE_LABELS[ideType]
  }
  const custom = customIdes.find((c) => c.id === ideType)
  return custom?.label || ideType
}

// Extracted creator component to reset state on mount
function IDECreator({
  workingDirs,
  customIdes,
  onAdd,
  onCreatingChange,
}: {
  workingDirs: WorkingDir[]
  customIdes: CustomIde[]
  onAdd: (title: string, path: string, ideType: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}) {
  const toast = useToast()
  const [newIdeType, setNewIdeType] = useState<string>('pycharm')
  const [newPath, setNewPath] = useState('')
  const newIdeRef = useRef<HTMLDivElement>(null)

  const saveCreating = useCallback(async () => {
    if (newPath.trim()) {
      try {
        const title = getPathName(newPath, 'Project')
        await onAdd(title, newPath.trim(), newIdeType)
        onCreatingChange(false)
      } catch (err) {
        toast.error('Failed to add IDE', err instanceof Error ? err.message : String(err))
      }
    }
  }, [newPath, newIdeType, onAdd, onCreatingChange, toast])

  useEditorHandlers({
    containerRef: newIdeRef,
    isActive: true,
    canSave: !!newPath.trim(),
    onSave: saveCreating,
    onCancel: () => onCreatingChange(false),
  })

  const handleSelectFolder = async () => {
    const path = await selectFolder()
    if (path) setNewPath(path)
  }

  return (
    <div
      ref={newIdeRef}
      className="mb-4 p-4 rounded-xl bg-(--accent-primary)/5 border border-(--accent-primary)/30 relative"
    >
      <button
        onClick={() => onCreatingChange(false)}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-elevated) transition-colors"
        title="Cancel"
      >
        ×
      </button>
      <div className="flex flex-wrap items-center gap-3 pr-6">
        <select value={newIdeType} onChange={(e) => setNewIdeType(e.target.value)} className="input-terminal w-auto!">
          {IDE_GROUPS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map((ide) => (
                <option key={ide.value} value={ide.value}>
                  {ide.label}
                </option>
              ))}
            </optgroup>
          ))}
          {customIdes.length > 0 && (
            <optgroup label="Custom">
              {customIdes.map((ide) => (
                <option key={ide.id} value={ide.id}>
                  {ide.label}
                </option>
              ))}
            </optgroup>
          )}
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
          <button type="button" onClick={handleSelectFolder} className="btn-ghost whitespace-nowrap">
            Browse
          </button>
        </div>
      </div>
      <WorkingDirsSuggestions
        workingDirs={workingDirs}
        filter="local"
        onSelect={(path) => setNewPath(path)}
        className="mt-3 pt-3 border-t border-(--border-subtle)"
      />
      <div className="text-xs font-mono text-(--text-muted) mt-3">Click outside to save</div>
    </div>
  )
}

interface IDESectionProps {
  items: Item[]
  isCreating: boolean
  workingDirs: WorkingDir[]
  onAdd: (title: string, path: string, ideType: string) => Promise<void>
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
  const toast = useToast()
  const { customIdes } = useCustomIdes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIdeType, setEditIdeType] = useState<string>('pycharm')
  const [editPath, setEditPath] = useState('')
  const editIdeRef = useRef<HTMLDivElement>(null)

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditPath('')
    setEditIdeType('pycharm')
  }, [])

  const saveEditing = useCallback(async () => {
    if (editingId && editPath.trim()) {
      const title = getPathName(editPath, 'Project')
      await onUpdate(editingId, { title, content: editPath.trim(), ide_type: editIdeType })
      resetEditState()
    }
  }, [editingId, editPath, editIdeType, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editIdeRef,
    isActive: !!editingId,
    canSave: !!editPath.trim(),
    onSave: saveEditing,
    onCancel: resetEditState,
  })

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
        if (isBuiltInIde(item.ide_type)) {
          await openIde(item.ide_type, item.content)
        } else {
          // Custom IDE - find command and execute
          const customIde = customIdes.find((c) => c.id === item.ide_type)
          if (customIde) {
            await openCustomIde(customIde.command, item.content)
          } else {
            toast.error('Failed to open IDE', `Custom IDE "${item.ide_type}" not found`)
            return
          }
        }
      } catch (err) {
        toast.error('Failed to open IDE', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  const handleDuplicate = async (item: Item) => {
    try {
      await onAdd(`${item.title} COPY`, item.content || '', item.ide_type || 'pycharm')
    } catch (err) {
      toast.error('Failed to duplicate', err instanceof Error ? err.message : String(err))
    }
  }

  if (!isCreating && items.length === 0) return null

  return (
    <section id="section-apps" className="scroll-mt-6">
      <h3 className="section-label">IDE</h3>

      {isCreating && (
        <IDECreator
          workingDirs={workingDirs}
          customIdes={customIdes}
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
              className="w-full p-4 rounded-xl bg-(--accent-primary)/5 border border-(--accent-primary)/30 animate-card-enter"
            >
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={editIdeType}
                  onChange={(e) => setEditIdeType(e.target.value)}
                  className="input-terminal w-auto!"
                >
                  {IDE_GROUPS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((ide) => (
                        <option key={ide.value} value={ide.value}>
                          {ide.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {customIdes.length > 0 && (
                    <optgroup label="Custom">
                      {customIdes.map((ide) => (
                        <option key={ide.id} value={ide.id}>
                          {ide.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
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
                  <button type="button" onClick={handleSelectFolderForEdit} className="btn-ghost whitespace-nowrap">
                    Browse
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
            <ItemContextMenu
              key={item.id}
              items={[
                {
                  label: 'Duplicate',
                  icon: <DuplicateIcon className="w-4 h-4" />,
                  onClick: () => handleDuplicate(item),
                },
              ]}
            >
              <div
                className="group/ide relative animate-card-enter mr-12"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className={`tag ${IDE_TAG_CLASS} cursor-pointer`} onClick={() => handleOpen(item)}>
                  <span>{getIdeLabel(item.ide_type!, customIdes)}</span>
                  <span className="opacity-60">{item.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="ml-1 opacity-0 group-hover/ide:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                  >
                    ×
                  </button>
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-primary) hover:border-(--accent-primary) opacity-0 group-hover/ide:opacity-100 transition-all"
                >
                  Edit
                </button>
              </div>
            </ItemContextMenu>
          )
        )}

        {!isCreating && (
          <button
            onClick={() => onCreatingChange(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-primary) text-(--text-muted) hover:text-(--accent-primary) transition-all"
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
