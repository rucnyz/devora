import { useState, useRef, useEffect, useCallback } from 'react'
import { openRemoteIde } from '../../hooks/useProjects'
import { REMOTE_IDE_LABELS, REMOTE_IDE_TAG_CLASSES, REMOTE_IDE_TYPES } from '../../constants/itemTypes'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import type { Item, RemoteIdeType, WorkingDir } from '../../types'

interface RemoteIDESectionProps {
  items: Item[]
  isCreating: boolean
  sshHosts: string[]
  workingDirs: WorkingDir[]
  onAdd: (title: string, content: string, remoteIdeType: RemoteIdeType) => Promise<void>
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
  const [newRemoteIdeType, setNewRemoteIdeType] = useState<RemoteIdeType>('cursor')
  const [newHost, setNewHost] = useState('')
  const [newPath, setNewPath] = useState('')
  const newRemoteIdeRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRemoteIdeType, setEditRemoteIdeType] = useState<RemoteIdeType>('cursor')
  const [editHost, setEditHost] = useState('')
  const [editPath, setEditPath] = useState('')
  const editRemoteIdeRef = useRef<HTMLDivElement>(null)

  const [showBrowser, setShowBrowser] = useState<'create' | 'edit' | null>(null)

  const saveCreating = useCallback(async () => {
    if (isCreating && newHost.trim() && newPath.trim()) {
      const pathParts = newPath.trim().split('/')
      const title = pathParts[pathParts.length - 1] || 'Remote'
      const content = `${newHost.trim()}:${newPath.trim()}`
      await onAdd(title, content, newRemoteIdeType)
      onCreatingChange(false)
      setNewHost('')
      setNewPath('')
      setNewRemoteIdeType('cursor')
    }
  }, [isCreating, newHost, newPath, newRemoteIdeType, onAdd, onCreatingChange])

  const saveEditing = useCallback(async () => {
    if (editingId && editHost.trim() && editPath.trim()) {
      const pathParts = editPath.trim().split('/')
      const title = pathParts[pathParts.length - 1] || 'Remote'
      const content = `${editHost.trim()}:${editPath.trim()}`
      await onUpdate(editingId, { title, content, remote_ide_type: editRemoteIdeType })
      setEditingId(null)
      setEditHost('')
      setEditPath('')
      setEditRemoteIdeType('cursor')
    }
  }, [editingId, editHost, editPath, editRemoteIdeType, onUpdate])

  // Click outside handler (skip when browser modal is open)
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (showBrowser) return

      if (isCreating && newRemoteIdeRef.current && !newRemoteIdeRef.current.contains(event.target as Node)) {
        if (newHost.trim() && newPath.trim()) {
          await saveCreating()
        } else {
          onCreatingChange(false)
        }
      }
      if (editingId && editRemoteIdeRef.current && !editRemoteIdeRef.current.contains(event.target as Node)) {
        if (editHost.trim() && editPath.trim()) {
          await saveEditing()
        } else {
          setEditingId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBrowser, isCreating, newHost, newPath, saveCreating, editingId, editHost, editPath, saveEditing, onCreatingChange])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingId && editHost.trim() && editPath.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        } else if (isCreating && newHost.trim() && newPath.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveCreating()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCreating, newHost, newPath, saveCreating, editingId, editHost, editPath, saveEditing])

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditRemoteIdeType(item.remote_ide_type || 'cursor')
    // Parse content: "host:path"
    const content = item.content || ''
    const colonIndex = content.indexOf(':')
    if (colonIndex > 0) {
      setEditHost(content.substring(0, colonIndex))
      setEditPath(content.substring(colonIndex + 1))
    } else {
      setEditHost(content)
      setEditPath('')
    }
  }

  const handleOpen = async (item: Item) => {
    if (item.remote_ide_type && item.content) {
      try {
        const content = item.content
        const colonIndex = content.indexOf(':')
        if (colonIndex > 0) {
          const host = content.substring(0, colonIndex)
          const path = content.substring(colonIndex + 1)
          await openRemoteIde(item.remote_ide_type, host, path)
        }
      } catch {
        alert(`Failed to open remote ${item.remote_ide_type}`)
      }
    }
  }

  // Reset state when isCreating changes
  useEffect(() => {
    if (isCreating) {
      setNewRemoteIdeType('cursor')
      setNewHost('')
      setNewPath('')
    }
  }, [isCreating])

  if (!isCreating && items.length === 0) return null

  return (
    <>
      <section id="section-remote" className="mb-8 scroll-mt-6">
        <h3 className="section-label">Remote IDE</h3>

        {/* Inline Remote IDE Creator */}
        {isCreating && (
          <div
            ref={newRemoteIdeRef}
            className="mb-4 p-4 rounded-xl bg-[var(--accent-remote)]/5 border border-[var(--accent-remote)]/30"
          >
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={newRemoteIdeType}
                onChange={(e) => setNewRemoteIdeType(e.target.value as RemoteIdeType)}
                className="input-terminal !w-auto"
              >
                {REMOTE_IDE_TYPES.map((ide) => (
                  <option key={ide.value} value={ide.value}>
                    {ide.label}
                  </option>
                ))}
              </select>
              <HostInput
                value={newHost}
                onChange={setNewHost}
                suggestions={sshHosts}
                className="w-40"
                autoFocus
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/home/user/project"
                  className="input-terminal flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowBrowser('create')}
                  disabled={!newHost.trim()}
                  className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Browse
                </button>
              </div>
            </div>
            {/* Working dirs suggestions (remote only) */}
            {workingDirs.filter(d => d.host).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-xs font-mono text-[var(--text-muted)]">Working dirs:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {workingDirs.filter(d => d.host).map((dir) => (
                    <button
                      key={`${dir.host}:${dir.path}`}
                      type="button"
                      onClick={() => {
                        setNewHost(dir.host!)
                        setNewPath(dir.path)
                      }}
                      className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[var(--accent-remote)] hover:border-[var(--accent-remote)] transition-colors"
                      title={`${dir.host}:${dir.path}`}
                    >
                      {dir.name} <span className="opacity-50">@{dir.host}</span>
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
                ref={editRemoteIdeRef}
                className="w-full p-4 rounded-xl bg-[var(--accent-remote)]/5 border border-[var(--accent-remote)]/30 animate-card-enter"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={editRemoteIdeType}
                    onChange={(e) => setEditRemoteIdeType(e.target.value as RemoteIdeType)}
                    className="input-terminal !w-auto"
                  >
                    {REMOTE_IDE_TYPES.map((ide) => (
                      <option key={ide.value} value={ide.value}>
                        {ide.label}
                      </option>
                    ))}
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
                      onClick={() => setShowBrowser('edit')}
                      disabled={!editHost.trim()}
                      className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="group/remote-ide relative animate-card-enter mr-7"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className={`tag ${REMOTE_IDE_TAG_CLASSES[item.remote_ide_type!] || 'tag-remote-ide-cursor'} cursor-pointer`}
                  onClick={() => handleOpen(item)}
                >
                  <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span>{REMOTE_IDE_LABELS[item.remote_ide_type!] || item.remote_ide_type}</span>
                  <span className="opacity-60">{item.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="ml-1 opacity-0 group-hover/remote-ide:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                  >
                    ×
                  </button>
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--accent-remote)] hover:border-[var(--accent-remote)] opacity-0 group-hover/remote-ide:opacity-100 transition-all"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--text-muted)] hover:border-[var(--accent-remote)] text-[var(--text-muted)] hover:text-[var(--accent-remote)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-mono text-sm">Add</span>
            </button>
          )}
        </div>
      </section>

      {/* Remote Directory Browser Modal */}
      {showBrowser && (
        <RemoteDirBrowser
          host={showBrowser === 'create' ? newHost : editHost}
          initialPath={showBrowser === 'create' ? newPath || '~' : editPath || '~'}
          onSelect={(path) => {
            if (showBrowser === 'create') {
              setNewPath(path)
            } else {
              setEditPath(path)
            }
            setShowBrowser(null)
          }}
          onClose={() => setShowBrowser(null)}
        />
      )}
    </>
  )
}
