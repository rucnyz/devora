import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { selectFolder, openCodingAgent } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useSetting } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { getPathName } from '../../utils/remote'
import { CODING_AGENT_LABELS, CODING_AGENT_TAG_CLASS, CODING_AGENT_TYPES } from '../../constants/itemTypes'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import type { Item, CodingAgentType, WorkingDir, TerminalType } from '../../types'

// Helper to quote a path if it contains spaces (for shell compatibility)
function quotePath(path: string): string {
  if (path.includes(' ')) {
    return `"${path}"`
  }
  return path
}

// Button component for appending args
function ArgButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-0.5 rounded text-xs font-mono bg-(--bg-elevated) border border-(--border-subtle) text-(--text-muted) hover:border-(--accent-agent) hover:text-(--accent-agent) transition-colors"
    >
      + {label}
    </button>
  )
}

// Dropdown button for --add-dir with path options
function AddDirDropdown({ workingDirs, onSelect }: { workingDirs: WorkingDir[]; onSelect: (arg: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleBrowse = async () => {
    const path = await selectFolder()
    if (path) {
      onSelect(`--add-dir ${quotePath(path)}`)
    }
    setIsOpen(false)
  }

  const handleSelectDir = (path: string) => {
    onSelect(`--add-dir ${quotePath(path)}`)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-0.5 rounded text-xs font-mono bg-(--bg-elevated) border border-(--border-subtle) text-(--text-muted) hover:border-(--accent-agent) hover:text-(--accent-agent) transition-colors flex items-center gap-1"
      >
        + --add-dir
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-48 py-1 rounded-lg bg-(--bg-elevated) border border-(--border-visible) shadow-lg">
          <button
            type="button"
            onClick={handleBrowse}
            className="w-full px-3 py-1.5 text-left text-xs font-mono text-(--text-muted) hover:bg-(--bg-surface) hover:text-(--accent-agent) transition-colors"
          >
            Browse...
          </button>
          {workingDirs.length > 0 && (
            <>
              <div className="border-t border-(--border-subtle) my-1" />
              {workingDirs.map((d) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => handleSelectDir(d.path)}
                  className="w-full px-3 py-1.5 text-left text-xs font-mono text-(--text-muted) hover:bg-(--bg-surface) hover:text-(--accent-agent) transition-colors truncate"
                  title={d.path}
                >
                  {d.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Agent-specific options component - buttons append to args, no parsing needed
function AgentOptions({
  agentType,
  args,
  onArgsChange,
  workingDirs,
}: {
  agentType: CodingAgentType
  args: string
  onArgsChange: (args: string) => void
  workingDirs: WorkingDir[]
}) {
  const localWorkingDirs = useMemo(() => workingDirs.filter((d) => !d.host), [workingDirs])

  const appendArg = (arg: string) => {
    onArgsChange(args ? `${args} ${arg}` : arg)
  }

  if (agentType === 'claude-code') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-(--border-subtle)">
        <span className="text-xs text-(--text-muted) font-mono">Insert:</span>
        <ArgButton label="--chrome" onClick={() => appendArg('--chrome')} />
        <AddDirDropdown workingDirs={localWorkingDirs} onSelect={appendArg} />
      </div>
    )
  }

  if (agentType === 'opencode') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-(--border-subtle)">
        <span className="text-xs text-(--text-muted) font-mono">Insert:</span>
        <ArgButton label="web" onClick={() => appendArg('web')} />
      </div>
    )
  }

  return null
}

// Extracted creator component to reset state on mount
function CodingAgentCreator({
  workingDirs,
  onAdd,
  onCreatingChange,
}: {
  workingDirs: WorkingDir[]
  onAdd: (title: string, path: string, agentType: CodingAgentType, args: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}) {
  const toast = useToast()
  const [newAgentType, setNewAgentType] = useState<CodingAgentType>('claude-code')
  const [newPath, setNewPath] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const newAgentRef = useRef<HTMLDivElement>(null)

  const saveCreating = useCallback(async () => {
    if (newPath.trim()) {
      try {
        const title = getPathName(newPath, 'Project')
        await onAdd(title, newPath.trim(), newAgentType, newArgs.trim())
        onCreatingChange(false)
      } catch (err) {
        toast.error('Failed to add Coding Agent', err instanceof Error ? err.message : String(err))
      }
    }
  }, [newPath, newAgentType, newArgs, onAdd, onCreatingChange, toast])

  useEditorHandlers({
    containerRef: newAgentRef,
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
    <div ref={newAgentRef} className="mb-4 p-4 rounded-xl bg-(--accent-agent)/5 border border-(--accent-agent)/30">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={newAgentType}
          onChange={(e) => {
            setNewAgentType(e.target.value as CodingAgentType)
            setNewArgs('') // Reset args when changing agent type
          }}
          className="input-terminal w-auto!"
        >
          {CODING_AGENT_TYPES.map((agent) => (
            <option key={agent.value} value={agent.value}>
              {agent.label}
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

      {/* Arguments input */}
      <div className="mt-3 pt-3 border-t border-(--border-subtle)">
        <label className="text-xs font-mono text-(--text-muted) mb-1 block">Arguments</label>
        <input
          type="text"
          value={newArgs}
          onChange={(e) => setNewArgs(e.target.value)}
          placeholder="Optional arguments..."
          className="input-terminal w-full"
        />
      </div>

      {/* Agent-specific options */}
      <AgentOptions agentType={newAgentType} args={newArgs} onArgsChange={setNewArgs} workingDirs={workingDirs} />

      <div className="text-xs font-mono text-(--text-muted) mt-3">Click outside to save</div>
    </div>
  )
}

interface CodingAgentSectionProps {
  items: Item[]
  isCreating: boolean
  workingDirs: WorkingDir[]
  onAdd: (title: string, path: string, agentType: CodingAgentType, args: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}

export default function CodingAgentSection({
  items,
  isCreating,
  workingDirs,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
}: CodingAgentSectionProps) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAgentType, setEditAgentType] = useState<CodingAgentType>('claude-code')
  const [editPath, setEditPath] = useState('')
  const [editArgs, setEditArgs] = useState('')
  const editAgentRef = useRef<HTMLDivElement>(null)
  const { value: defaultTerminal } = useSetting('defaultTerminal')

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditPath('')
    setEditArgs('')
    setEditAgentType('claude-code')
  }, [])

  const saveEditing = useCallback(async () => {
    if (editingId && editPath.trim()) {
      const title = getPathName(editPath, 'Project')
      await onUpdate(editingId, {
        title,
        content: editPath.trim(),
        coding_agent_type: editAgentType,
        coding_agent_args: editArgs.trim(), // empty string will clear the field in Rust
      })
      resetEditState()
    }
  }, [editingId, editPath, editAgentType, editArgs, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editAgentRef,
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
    setEditAgentType(item.coding_agent_type || 'claude-code')
    setEditPath(item.content || '')
    setEditArgs(item.coding_agent_args || '')
  }

  const handleOpen = async (item: Item) => {
    if (item.coding_agent_type && item.content) {
      try {
        await openCodingAgent(
          item.coding_agent_type,
          item.content,
          defaultTerminal as TerminalType | undefined,
          item.coding_agent_args
        )
      } catch (err) {
        toast.error('Failed to open Coding Agent', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  if (!isCreating && items.length === 0) return null

  return (
    <section id="section-coding-agent" className="scroll-mt-6">
      <h3 className="section-label">Coding Agent</h3>

      {isCreating && <CodingAgentCreator workingDirs={workingDirs} onAdd={onAdd} onCreatingChange={onCreatingChange} />}

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) =>
          editingId === item.id ? (
            <div
              key={item.id}
              ref={editAgentRef}
              className="w-full p-4 rounded-xl bg-(--accent-agent)/5 border border-(--accent-agent)/30 animate-card-enter"
            >
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={editAgentType}
                  onChange={(e) => {
                    setEditAgentType(e.target.value as CodingAgentType)
                    setEditArgs('') // Reset args when changing agent type
                  }}
                  className="input-terminal w-auto!"
                >
                  {CODING_AGENT_TYPES.map((agent) => (
                    <option key={agent.value} value={agent.value}>
                      {agent.label}
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
                  <button type="button" onClick={handleSelectFolderForEdit} className="btn-ghost whitespace-nowrap">
                    Browse
                  </button>
                </div>
              </div>
              <WorkingDirsSuggestions
                workingDirs={workingDirs}
                filter="local"
                onSelect={(path) => setEditPath(path)}
                className="mt-3 pt-3 border-t border-(--border-subtle)"
              />

              {/* Arguments input */}
              <div className="mt-3 pt-3 border-t border-(--border-subtle)">
                <label className="text-xs font-mono text-(--text-muted) mb-1 block">Arguments</label>
                <input
                  type="text"
                  value={editArgs}
                  onChange={(e) => setEditArgs(e.target.value)}
                  placeholder="Optional arguments..."
                  className="input-terminal w-full"
                />
              </div>

              {/* Agent-specific options */}
              <AgentOptions
                agentType={editAgentType}
                args={editArgs}
                onArgsChange={setEditArgs}
                workingDirs={workingDirs}
              />

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
              className="group/agent relative animate-card-enter mr-12"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className={`tag ${CODING_AGENT_TAG_CLASS} cursor-pointer`} onClick={() => handleOpen(item)}>
                <span>{CODING_AGENT_LABELS[item.coding_agent_type!]}</span>
                <span className="opacity-60">{item.title}</span>
                {item.coding_agent_args && (
                  <span className="opacity-40 text-xs ml-1" title={item.coding_agent_args}>
                    [args]
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                  className="ml-1 opacity-0 group-hover/agent:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => handleEdit(item)}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-agent) hover:border-(--accent-agent) opacity-0 group-hover/agent:opacity-100 transition-all"
              >
                Edit
              </button>
            </div>
          )
        )}

        {!isCreating && (
          <button
            onClick={() => onCreatingChange(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-agent) text-(--text-muted) hover:text-(--accent-agent) transition-all"
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
