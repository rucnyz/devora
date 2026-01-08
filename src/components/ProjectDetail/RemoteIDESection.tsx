import { useState, useRef, useCallback } from 'react'
import { openRemoteIde, openCustomRemoteIde } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useCustomIdes } from '../../hooks/useCustomIdes'
import { parseRemoteContent, buildRemoteContent, getPathName } from '../../utils/remote'
import { REMOTE_IDE_LABELS, REMOTE_IDE_TAG_CLASS, REMOTE_IDE_TYPES } from '../../constants/itemTypes'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import RemoteIDECreator from './RemoteIDECreator'
import type { Item, RemoteIdeType, WorkingDir, CustomRemoteIde } from '../../types'

// Helper to check if remote IDE type is built-in
const isBuiltInRemoteIde = (ideType: string): ideType is RemoteIdeType => {
  return REMOTE_IDE_TYPES.some((ide) => ide.value === ideType)
}

// Helper to get remote IDE label
const getRemoteIdeLabel = (ideType: string, customRemoteIdes: CustomRemoteIde[]): string => {
  if (isBuiltInRemoteIde(ideType)) {
    return REMOTE_IDE_LABELS[ideType]
  }
  const custom = customRemoteIdes.find((c) => c.id === ideType)
  return custom?.label || ideType
}

interface RemoteIDESectionProps {
  items: Item[]
  isCreating: boolean
  sshHosts: string[]
  workingDirs: WorkingDir[]
  onAdd: (title: string, content: string, remoteIdeType: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function RemoteIDESection({
  items,
  isCreating,
  sshHosts,
  workingDirs,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: RemoteIDESectionProps) {
  const { customRemoteIdes } = useCustomIdes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRemoteIdeType, setEditRemoteIdeType] = useState<string>('cursor')
  const [editHost, setEditHost] = useState('')
  const [editPath, setEditPath] = useState('')
  const editRemoteIdeRef = useRef<HTMLDivElement>(null)

  const [showBrowser, setShowBrowser] = useState(false)

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditHost('')
    setEditPath('')
    setEditRemoteIdeType('cursor')
  }, [])

  const saveEditing = useCallback(async () => {
    if (editingId && editHost.trim() && editPath.trim()) {
      const title = getPathName(editPath, 'Remote')
      const content = buildRemoteContent(editHost, editPath)
      await onUpdate(editingId, { title, content, remote_ide_type: editRemoteIdeType })
      resetEditState()
    }
  }, [editingId, editHost, editPath, editRemoteIdeType, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editRemoteIdeRef,
    isActive: !!editingId,
    canSave: !!editHost.trim() && !!editPath.trim(),
    onSave: saveEditing,
    onCancel: resetEditState,
    skipClickOutside: showBrowser,
  })

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditRemoteIdeType(item.remote_ide_type || 'cursor')
    const { host, path } = parseRemoteContent(item.content || '')
    setEditHost(host)
    setEditPath(path)
  }

  const handleOpen = async (item: Item) => {
    if (item.remote_ide_type && item.content) {
      try {
        const { host, path } = parseRemoteContent(item.content)
        if (host && path) {
          if (isBuiltInRemoteIde(item.remote_ide_type)) {
            await openRemoteIde(item.remote_ide_type, host, path)
          } else {
            // Custom remote IDE
            const customIde = customRemoteIdes.find((c) => c.id === item.remote_ide_type)
            if (customIde) {
              await openCustomRemoteIde(customIde.command, host, path)
            } else {
              alert(`Failed to open remote IDE: Custom remote IDE "${item.remote_ide_type}" not found`)
              return
            }
          }
        }
      } catch (err) {
        alert(`Failed to open remote IDE: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  const handleAdd = async (title: string, content: string, remoteIdeType: string) => {
    await onAdd(title, content, remoteIdeType)
    onCreatingChange(false)
  }

  if (!isCreating && items.length === 0) return null

  return (
    <>
      <section id="section-remote" className="scroll-mt-6">
        <h3 className="section-label">Remote IDE</h3>

        {isCreating && (
          <RemoteIDECreator
            sshHosts={sshHosts}
            workingDirs={workingDirs}
            onAdd={handleAdd}
            onCancel={() => onCreatingChange(false)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {items.map((item, index) =>
            editingId === item.id ? (
              <div
                key={item.id}
                ref={editRemoteIdeRef}
                className="w-full p-4 rounded-xl bg-(--accent-remote)/5 border border-(--accent-remote)/30 animate-card-enter"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={editRemoteIdeType}
                    onChange={(e) => setEditRemoteIdeType(e.target.value)}
                    className="input-terminal w-auto!"
                  >
                    {REMOTE_IDE_TYPES.map((ide) => (
                      <option key={ide.value} value={ide.value}>
                        {ide.label}
                      </option>
                    ))}
                    {customRemoteIdes.length > 0 && (
                      <optgroup label="Custom">
                        {customRemoteIdes.map((ide) => (
                          <option key={ide.id} value={ide.id}>
                            {ide.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <HostInput
                    value={editHost}
                    onChange={setEditHost}
                    suggestions={sshHosts}
                    className="w-40"
                    autoFocus
                  />
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editPath}
                      onChange={(e) => setEditPath(e.target.value)}
                      placeholder="/home/user/project"
                      className="input-terminal flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBrowser(true)}
                      disabled={!editHost.trim()}
                      className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
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
              <div
                key={item.id}
                className="group/remote-ide relative animate-card-enter mr-7"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className={`tag ${REMOTE_IDE_TAG_CLASS} cursor-pointer`} onClick={() => handleOpen(item)}>
                  <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span>{getRemoteIdeLabel(item.remote_ide_type!, customRemoteIdes)}</span>
                  <span className="opacity-60">{item.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="ml-1 opacity-0 group-hover/remote-ide:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                  >
                    ×
                  </button>
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-remote) hover:border-(--accent-remote) opacity-0 group-hover/remote-ide:opacity-100 transition-all"
                >
                  Edit
                </button>
              </div>
            )
          )}

          {!isCreating && (
            <button
              onClick={() => onCreatingChange(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-remote) text-(--text-muted) hover:text-(--accent-remote) transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-mono text-sm">Add</span>
            </button>
          )}
        </div>
      </section>

      {showBrowser && (
        <RemoteDirBrowser
          host={editHost}
          initialPath={editPath || '~'}
          onSelect={(path) => {
            setEditPath(path)
            setShowBrowser(false)
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}
