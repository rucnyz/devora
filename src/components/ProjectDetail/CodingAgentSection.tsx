import { useState, useRef, useCallback, useMemo } from 'react'
import { selectFolder, openCodingAgent } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useSetting } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { getPathName } from '../../utils/remote'
import { CODING_AGENT_LABELS, CODING_AGENT_TAG_CLASS, CODING_AGENT_TYPES } from '../../constants/itemTypes'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import type { Item, CodingAgentType, WorkingDir, TerminalType } from '../../types'

// Helper to check if args contain a flag
function hasFlag(args: string, flag: string): boolean {
  return args.split(/\s+/).includes(flag)
}

// Helper to toggle a flag in args
function toggleFlag(args: string, flag: string, enabled: boolean): string {
  const parts = args.split(/\s+/).filter((p) => p && p !== flag)
  if (enabled) {
    parts.unshift(flag)
  }
  return parts.join(' ')
}

// Helper to check if args start with "web"
function hasWebMode(args: string): boolean {
  return args.trim().startsWith('web')
}

// Helper to toggle web mode
function toggleWebMode(args: string, enabled: boolean): string {
  const trimmed = args.trim()
  if (enabled && !trimmed.startsWith('web')) {
    return trimmed ? `web ${trimmed}` : 'web'
  } else if (!enabled && trimmed.startsWith('web')) {
    return trimmed.replace(/^web\s*/, '')
  }
  return args
}

// Helper to parse --add-dir paths from args
// Matches paths after --add-dir until next --flag or end of string
function getAddDirPaths(args: string): string[] {
  const match = args.match(/--add-dir\s+(.*?)(?=\s+--|$)/)
  if (match && match[1]) {
    return match[1]
      .trim()
      .split(/\s+/)
      .filter((p) => p)
  }
  return []
}

// Regex to match --add-dir and its paths (until next --flag or end)
const ADD_DIR_REGEX = /--add-dir(?:\s+.*?)?(?=\s+--|$)/

// Helper to add a path to --add-dir
function addPathToAddDir(args: string, newPath: string): string {
  const existingPaths = getAddDirPaths(args)
  if (existingPaths.includes(newPath)) return args

  const hasAddDirFlag = args.includes('--add-dir')

  if (existingPaths.length > 0) {
    // Replace existing --add-dir with expanded version
    const newPaths = [...existingPaths, newPath].join(' ')
    return args.replace(ADD_DIR_REGEX, `--add-dir ${newPaths}`)
  } else if (hasAddDirFlag) {
    // --add-dir flag exists but no paths yet, replace it with flag + new path
    return args.replace(ADD_DIR_REGEX, `--add-dir ${newPath}`)
  } else {
    // Add new --add-dir with path
    return `${args} --add-dir ${newPath}`.trim()
  }
}

// Helper to remove a path from --add-dir
function removePathFromAddDir(args: string, pathToRemove: string): string {
  const existingPaths = getAddDirPaths(args)
  const newPaths = existingPaths.filter((p) => p !== pathToRemove)

  if (newPaths.length === 0) {
    // Remove --add-dir entirely
    return args.replace(ADD_DIR_REGEX, '').trim()
  } else {
    return args.replace(ADD_DIR_REGEX, `--add-dir ${newPaths.join(' ')}`)
  }
}

// Checkbox component for agent options
function AgentCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-mono text-(--text-muted) cursor-pointer hover:text-(--text-primary) transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border border-(--border-visible) bg-(--bg-elevated) accent-(--accent-agent)"
      />
      <span>{label}</span>
    </label>
  )
}

// Agent-specific options component
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
  const addDirPaths = useMemo(() => getAddDirPaths(args), [args])

  const handleSelectAddDir = async () => {
    const path = await selectFolder()
    if (path) {
      onArgsChange(addPathToAddDir(args, path))
    }
  }

  if (agentType === 'claude-code') {
    const hasChrome = hasFlag(args, '--chrome')
    const hasAddDir = args.includes('--add-dir')

    return (
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-(--border-subtle)">
        <div className="flex flex-wrap items-center gap-4">
          <AgentCheckbox
            label="--chrome"
            checked={hasChrome}
            onChange={(v) => onArgsChange(toggleFlag(args, '--chrome', v))}
          />
          <AgentCheckbox
            label="--add-dir"
            checked={hasAddDir}
            onChange={(v) => {
              if (v && !hasAddDir) {
                onArgsChange(`${args} --add-dir `.trim())
              } else if (!v && hasAddDir) {
                onArgsChange(args.replace(ADD_DIR_REGEX, '').trim())
              }
            }}
          />
        </div>

        {hasAddDir && (
          <div className="flex flex-wrap items-center gap-2 ml-4">
            <span className="text-xs text-(--text-muted) font-mono">Dirs:</span>
            {addDirPaths.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-(--bg-elevated) border border-(--border-subtle) text-xs font-mono"
              >
                {getPathName(p, p)}
                <button
                  type="button"
                  onClick={() => onArgsChange(removePathFromAddDir(args, p))}
                  className="text-(--text-muted) hover:text-(--accent-danger)"
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={handleSelectAddDir} className="btn-ghost text-xs py-0.5 px-2">
              + Browse
            </button>
            {localWorkingDirs.length > 0 && (
              <>
                {localWorkingDirs.map((d) => (
                  <button
                    key={d.path}
                    type="button"
                    onClick={() => onArgsChange(addPathToAddDir(args, d.path))}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-(--bg-elevated) border border-(--border-subtle) text-(--text-muted) hover:border-(--accent-agent) hover:text-(--accent-agent) transition-colors"
                    disabled={addDirPaths.includes(d.path)}
                  >
                    + {d.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (agentType === 'opencode') {
    const hasWeb = hasWebMode(args)

    return (
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-(--border-subtle)">
        <AgentCheckbox label="web mode" checked={hasWeb} onChange={(v) => onArgsChange(toggleWebMode(args, v))} />
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
