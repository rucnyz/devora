import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { selectFolder, runCommand } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useToast } from '../../hooks/useToast'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import CommandCreator from './CommandCreator'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import ItemContextMenu, { DuplicateIcon } from '../ItemContextMenu'
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
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editMode, setEditMode] = useState<CommandMode>('background')
  const [editCwd, setEditCwd] = useState('')
  const [editHost, setEditHost] = useState('')
  const editCommandRef = useRef<HTMLDivElement>(null)

  const [commandOutput, setCommandOutput] = useState<{ title: string; output: string; error?: string } | null>(null)
  const [showBrowser, setShowBrowser] = useState(false)

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
    setEditMode('background')
    setEditCwd('')
    setEditHost('')
  }, [])

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
      resetEditState()
    }
  }, [editingId, editTitle, editContent, editMode, editCwd, editHost, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editCommandRef,
    isActive: !!editingId,
    canSave: !!editContent.trim(),
    onSave: saveEditing,
    onCancel: resetEditState,
    skipClickOutside: showBrowser,
  })

  const handleBrowseForEdit = async () => {
    if (editHost) {
      setShowBrowser(true)
    } else {
      const path = await selectFolder()
      if (path) setEditCwd(path)
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
        toast.error('Failed to run command', err instanceof Error ? err.message : String(err))
      }
    }
  }

  const handleAdd = async (title: string, command: string, mode: CommandMode, cwd?: string, host?: string) => {
    await onAdd(title, command, mode, cwd, host)
    onCreatingChange(false)
  }

  const handleDuplicate = async (item: Item) => {
    try {
      await onAdd(
        `${item.title} COPY`,
        item.content || '',
        item.command_mode || 'background',
        item.command_cwd,
        item.command_host
      )
    } catch (err) {
      toast.error('Failed to duplicate', err instanceof Error ? err.message : String(err))
    }
  }

  if (!isCreating && items.length === 0) return null

  return (
    <>
      <section id="section-commands" className="scroll-mt-6">
        <h3 className="section-label">Commands</h3>

        {isCreating && (
          <CommandCreator
            workingDirs={workingDirs}
            sshHosts={sshHosts}
            onAdd={handleAdd}
            onCancel={() => onCreatingChange(false)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {items.map((item, index) =>
            editingId === item.id ? (
              <div
                key={item.id}
                ref={editCommandRef}
                className="w-full p-4 rounded-xl bg-(--bg-elevated) border border-(--border-visible) animate-card-enter"
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
                    <button type="button" onClick={handleBrowseForEdit} className="btn-ghost whitespace-nowrap">
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
                <WorkingDirsSuggestions
                  workingDirs={workingDirs}
                  onSelect={(path, host) => {
                    setEditCwd(path)
                    setEditHost(host || '')
                  }}
                  className="mb-3"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-(--text-muted)">
                    Click outside to save {editHost && <span className="text-[#e879f9]">(SSH: {editHost})</span>}
                  </span>
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
                  className="group/command relative animate-card-enter mr-7"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className={`tag cursor-pointer ${item.command_host ? 'tag-remote-command' : 'tag-command'}`}
                    onClick={() => handleRun(item)}
                  >
                    {item.command_host ? (
                      <svg className="w-4 h-4 text-[#e879f9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M5 12h14M12 5l7 7-7 7"
                        />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                    <span>{item.title}</span>
                    {item.command_host && <span className="text-xs text-[#e879f9]">@{item.command_host}</span>}
                    {item.command_mode === 'output' && <span className="text-xs opacity-50">[out]</span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(item.id)
                      }}
                      className="ml-1 opacity-0 group-hover/command:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    onClick={() => handleEdit(item)}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--text-primary) hover:border-(--text-muted) opacity-0 group-hover/command:opacity-100 transition-all"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-warning) text-(--text-muted) hover:text-(--accent-warning) transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-mono text-sm">Add</span>
            </button>
          )}
        </div>
      </section>

      {commandOutput &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setCommandOutput(null)}
          >
            <div
              className="bg-(--bg-elevated) border border-(--border-visible) rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-(--text-primary)">{commandOutput.title}</h3>
                <button
                  onClick={() => setCommandOutput(null)}
                  className="text-(--text-muted) hover:text-(--text-primary)"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {commandOutput.output && (
                  <div className="mb-4">
                    <h4 className="text-sm font-mono text-(--text-muted) mb-2">Output:</h4>
                    <pre className="bg-(--bg-surface) p-3 rounded-lg text-sm font-mono text-(--text-secondary) whitespace-pre-wrap overflow-x-auto">
                      {commandOutput.output}
                    </pre>
                  </div>
                )}
                {commandOutput.error && (
                  <div>
                    <h4 className="text-sm font-mono text-(--accent-danger) mb-2">Error:</h4>
                    <pre className="bg-(--bg-surface) p-3 rounded-lg text-sm font-mono text-(--accent-danger) whitespace-pre-wrap overflow-x-auto">
                      {commandOutput.error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {showBrowser && (
        <RemoteDirBrowser
          host={editHost}
          initialPath={editCwd}
          onSelect={(path) => {
            setEditCwd(path)
            setShowBrowser(false)
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}
