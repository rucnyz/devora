import { useState, useRef, useEffect, useCallback } from 'react'
import { selectFolder, runCommand } from '../../hooks/useProjects'
import type { Item, CommandMode } from '../../types'

interface CommandSectionProps {
  items: Item[]
  isCreating: boolean
  onAdd: (title: string, command: string, mode: CommandMode, cwd?: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function CommandSection({
  items,
  isCreating,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: CommandSectionProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newMode, setNewMode] = useState<CommandMode>('background')
  const [newCwd, setNewCwd] = useState('')
  const newCommandRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editMode, setEditMode] = useState<CommandMode>('background')
  const [editCwd, setEditCwd] = useState('')
  const editCommandRef = useRef<HTMLDivElement>(null)

  const [commandOutput, setCommandOutput] = useState<{ title: string; output: string; error?: string } | null>(null)

  const saveCreating = useCallback(async () => {
    if (isCreating && newContent.trim()) {
      const title = newTitle.trim() || newContent.trim()
      await onAdd(title, newContent.trim(), newMode, newCwd.trim() || undefined)
      onCreatingChange(false)
      setNewTitle('')
      setNewContent('')
      setNewMode('background')
      setNewCwd('')
    }
  }, [isCreating, newTitle, newContent, newMode, newCwd, onAdd, onCreatingChange])

  const saveEditing = useCallback(async () => {
    if (editingId && editContent.trim()) {
      const title = editTitle.trim() || editContent.trim()
      await onUpdate(editingId, {
        title,
        content: editContent.trim(),
        command_mode: editMode,
        command_cwd: editCwd.trim() || undefined,
      })
      setEditingId(null)
      setEditTitle('')
      setEditContent('')
      setEditMode('background')
      setEditCwd('')
    }
  }, [editingId, editTitle, editContent, editMode, editCwd, onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
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
  }, [isCreating, newContent, saveCreating, editingId, editContent, saveEditing, onCreatingChange])

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

  const handleSelectFolder = async (isEdit: boolean) => {
    const path = await selectFolder()
    if (path) {
      if (isEdit) {
        setEditCwd(path)
      } else {
        setNewCwd(path)
      }
    }
  }

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditContent(item.content || '')
    setEditMode(item.command_mode || 'background')
    setEditCwd(item.command_cwd || '')
  }

  const handleRun = async (item: Item) => {
    if (item.content && item.command_mode) {
      try {
        const result = await runCommand(item.content, item.command_mode, item.command_cwd)
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
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newCwd}
                  onChange={(e) => setNewCwd(e.target.value)}
                  placeholder="Working directory (optional)..."
                  className="input-terminal flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleSelectFolder(false)}
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
            <div className="text-xs font-mono text-[var(--text-muted)]">
              Click outside to save
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
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editCwd}
                      onChange={(e) => setEditCwd(e.target.value)}
                      placeholder="Working directory (optional)..."
                      className="input-terminal flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectFolder(true)}
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
                <div className="flex justify-between items-center">
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
                className="group/command relative animate-card-enter mr-7"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className="tag tag-command cursor-pointer"
                  onClick={() => handleRun(item)}
                >
                  <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{item.title}</span>
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
    </>
  )
}
