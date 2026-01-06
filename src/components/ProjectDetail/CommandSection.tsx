import { useState, useRef, useEffect, useCallback } from 'react'
import { selectFolder, runCommand } from '../../hooks/useProjects'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import type { Item, CommandMode, WorkingDir } from '../../types'

interface CommandSectionProps {
  items: Item[]
  isCreating: boolean
  workingDirs: WorkingDir[]
  sshHosts: string[]
  onAdd: (title: string, command: string, mode: CommandMode, cwd?: string, host?: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function CommandSection({
  items,
  isCreating,
  workingDirs,
  sshHosts,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: CommandSectionProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newMode, setNewMode] = useState<CommandMode>('background')
  const [newCwd, setNewCwd] = useState('')
  const [newHost, setNewHost] = useState('')
  const newCommandRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editMode, setEditMode] = useState<CommandMode>('background')
  const [editCwd, setEditCwd] = useState('')
  const [editHost, setEditHost] = useState('')
  const editCommandRef = useRef<HTMLDivElement>(null)

  const [commandOutput, setCommandOutput] = useState<{ title: string; output: string; error?: string } | null>(null)
  const [showBrowser, setShowBrowser] = useState<'create' | 'edit' | null>(null)

  const saveCreating = useCallback(async () => {
    if (isCreating && newContent.trim()) {
      const title = newTitle.trim() || newContent.trim()
      await onAdd(title, newContent.trim(), newMode, newCwd.trim() || undefined, newHost.trim() || undefined)
      onCreatingChange(false)
      setNewTitle('')
      setNewContent('')
      setNewMode('background')
      setNewCwd('')
      setNewHost('')
    }
  }, [isCreating, newTitle, newContent, newMode, newCwd, newHost, onAdd, onCreatingChange])

  const saveEditing = useCallback(async () => {
    if (editingId && editContent.trim()) {
      const title = editTitle.trim() || editContent.trim()
      await onUpdate(editingId, {
        title,
        content: editContent.trim(),
        command_mode: editMode,
        command_cwd: editCwd.trim() || undefined,
        command_host: editHost.trim() || undefined,
      })
      setEditingId(null)
      setEditTitle('')
      setEditContent('')
      setEditMode('background')
      setEditCwd('')
      setEditHost('')
    }
  }, [editingId, editTitle, editContent, editMode, editCwd, editHost, onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (showBrowser) return // Don't close when browser modal is open
      if (isCreating && newCommandRef.current && !newCommandRef.current.contains(event.target as Node)) {
        if (newContent.trim()) {
          await saveCreating()
        } else {
          onCreatingChange(false)
        }
      }
      if (editingId && editCommandRef.current && !editCommandRef.current.contains(event.target as Node)) {
        if (editContent.trim()) {
          await saveEditing()
        } else {
          setEditingId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBrowser, isCreating, newContent, saveCreating, editingId, editContent, saveEditing, onCreatingChange])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingId && editContent.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        } else if (isCreating && newContent.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveCreating()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCreating, newContent, saveCreating, editingId, editContent, saveEditing])

  const handleBrowse = async (isEdit: boolean) => {
    const host = isEdit ? editHost : newHost
    if (host) {
      // Remote: show browser modal
      setShowBrowser(isEdit ? 'edit' : 'create')
    } else {
      // Local: use folder picker
      const path = await selectFolder()
      if (path) {
        if (isEdit) {
          setEditCwd(path)
        } else {
          setNewCwd(path)
        }
      }
    }
  }

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditContent(item.content || '')
    setEditMode(item.command_mode || 'background')
    setEditCwd(item.command_cwd || '')
    setEditHost(item.command_host || '')
  }

  const handleRun = async (item: Item) => {
    if (item.content && item.command_mode) {
      try {
        const result = await runCommand(item.content, item.command_mode, item.command_cwd, item.command_host)
        if (item.command_mode === 'output') {
          setCommandOutput({
            title: item.title,
            output: result.output || '',
            error: result.error,
          })
        }
      } catch (err) {
        alert(`Failed to run command: ${err}`)
      }
    }
  }

  // Reset state when isCreating changes
  useEffect(() => {
    if (isCreating) {
      setNewTitle('')
      setNewContent('')
      setNewMode('background')
      setNewCwd('')
      setNewHost('')
    }
  }, [isCreating])

  if (!isCreating && items.length === 0) return null

  return (
    <>
      <section id="section-commands" className="mb-8 scroll-mt-6">
        <h3 className="section-label">Commands</h3>

        {/* Inline Command Creator */}
        {isCreating && (
          <div
            ref={newCommandRef}
            className="mb-4 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)]"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (optional)..."
                className="input-terminal w-40"
              />
              <input
                type="text"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Command to run..."
                className="input-terminal flex-1"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <HostInput
                value={newHost}
                onChange={setNewHost}
                suggestions={sshHosts}
                placeholder="Host (optional for remote)"
                className="w-36"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newCwd}
                  onChange={(e) => setNewCwd(e.target.value)}
                  placeholder={newHost ? 'Remote path...' : 'Working directory (optional)...'}
                  className="input-terminal flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleBrowse(false)}
                  className="btn-ghost whitespace-nowrap"
                >
                  Browse
                </button>
              </div>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as CommandMode)}
                className="input-terminal w-36"
              >
                <option value="background">Background</option>
                <option value="output">Show Output</option>
              </select>
            </div>
            {/* Working dirs suggestions */}
            {workingDirs.length > 0 && (
              <div className="mb-3">
                <span className="text-xs font-mono text-[var(--text-muted)]">Working dirs:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {workingDirs.map((dir) => (
                    <button
                      key={dir.host ? `${dir.host}:${dir.path}` : dir.path}
                      type="button"
                      onClick={() => {
                        setNewCwd(dir.path)
                        setNewHost(dir.host || '')
                      }}
                      className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                        dir.host
                          ? 'bg-[#e879f9]/10 border-[#e879f9]/30 text-[#e879f9] hover:bg-[#e879f9]/20'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                      }`}
                      title={dir.host ? `${dir.host}:${dir.path}` : dir.path}
                    >
                      {dir.name} <span className="opacity-50">{dir.host ? `@${dir.host}` : 'local'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs font-mono text-[var(--text-muted)]">
              Click outside to save {newHost && <span className="text-[#e879f9]">(SSH: {newHost})</span>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {items.map((item, index) =>
            editingId === item.id ? (
              <div
                key={item.id}
                ref={editCommandRef}
                className="w-full p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)] animate-card-enter"
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title (optional)..."
                    className="input-terminal w-40"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Command to run..."
                    className="input-terminal flex-1"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <HostInput
                    value={editHost}
                    onChange={setEditHost}
                    suggestions={sshHosts}
                    placeholder="Host (optional for remote)"
                    className="w-36"
                  />
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editCwd}
                      onChange={(e) => setEditCwd(e.target.value)}
                      placeholder={editHost ? 'Remote path...' : 'Working directory (optional)...'}
                      className="input-terminal flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleBrowse(true)}
                      className="btn-ghost whitespace-nowrap"
                    >
                      Browse
                    </button>
                  </div>
                  <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value as CommandMode)}
                    className="input-terminal w-36"
                  >
                    <option value="background">Background</option>
                    <option value="output">Show Output</option>
                  </select>
                </div>
                {/* Working dirs suggestions for edit */}
                {workingDirs.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Working dirs:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {workingDirs.map((dir) => (
                        <button
                          key={dir.host ? `${dir.host}:${dir.path}` : dir.path}
                          type="button"
                          onClick={() => {
                            setEditCwd(dir.path)
                            setEditHost(dir.host || '')
                          }}
                          className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                            dir.host
                              ? 'bg-[#e879f9]/10 border-[#e879f9]/30 text-[#e879f9] hover:bg-[#e879f9]/20'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                          }`}
                          title={dir.host ? `${dir.host}:${dir.path}` : dir.path}
                        >
                          {dir.name} <span className="opacity-50">{dir.host ? `@${dir.host}` : 'local'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    Click outside to save {editHost && <span className="text-[#e879f9]">(SSH: {editHost})</span>}
                  </span>
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
                className="group/command relative animate-card-enter mr-7"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className={`tag cursor-pointer ${item.command_host ? 'tag-remote-command' : 'tag-command'}`}
                  onClick={() => handleRun(item)}
                >
                  {item.command_host ? (
                    <svg className="w-4 h-4 text-[#e879f9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span>{item.title}</span>
                  {item.command_host && (
                    <span className="text-xs text-[#e879f9]">@{item.command_host}</span>
                  )}
                  {item.command_mode === 'output' && (
                    <span className="text-xs opacity-50">[out]</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="ml-1 opacity-0 group-hover/command:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                  >
                    ×
                  </button>
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] opacity-0 group-hover/command:opacity-100 transition-all"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--text-muted)] hover:border-[var(--accent-warning)] text-[var(--text-muted)] hover:text-[var(--accent-warning)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-mono text-sm">Add</span>
            </button>
          )}
        </div>
      </section>

      {/* Command Output Modal */}
      {commandOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCommandOutput(null)}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-visible)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{commandOutput.title}</h3>
              <button
                onClick={() => setCommandOutput(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {commandOutput.output && (
                <div className="mb-4">
                  <h4 className="text-sm font-mono text-[var(--text-muted)] mb-2">Output:</h4>
                  <pre className="bg-[var(--bg-surface)] p-3 rounded-lg text-sm font-mono text-[var(--text-secondary)] whitespace-pre-wrap overflow-x-auto">{commandOutput.output}</pre>
                </div>
              )}
              {commandOutput.error && (
                <div>
                  <h4 className="text-sm font-mono text-[var(--accent-danger)] mb-2">Error:</h4>
                  <pre className="bg-[var(--bg-surface)] p-3 rounded-lg text-sm font-mono text-[var(--accent-danger)] whitespace-pre-wrap overflow-x-auto">{commandOutput.error}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remote Directory Browser Modal */}
      {showBrowser && (
        <RemoteDirBrowser
          host={showBrowser === 'edit' ? editHost : newHost}
          initialPath={showBrowser === 'edit' ? editCwd : newCwd}
          onSelect={(path) => {
            if (showBrowser === 'edit') {
              setEditCwd(path)
            } else {
              setNewCwd(path)
            }
            setShowBrowser(null)
          }}
          onClose={() => setShowBrowser(null)}
        />
      )}
    </>
  )
}
