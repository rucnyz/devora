import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { selectFolder } from '../../hooks/useProjects'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import type { WorkingDir, Item } from '../../types'

interface WorkingDirsSectionProps {
  workingDirs: WorkingDir[]
  sshHosts: string[]
  ideItems: Item[]
  remoteIdeItems: Item[]
  fileItems: Item[]
  commandItems: Item[]
  onUpdate: (dirs: WorkingDir[]) => Promise<void>
}

export default function WorkingDirsSection({
  workingDirs,
  sshHosts,
  ideItems,
  remoteIdeItems,
  fileItems,
  commandItems,
  onUpdate,
}: WorkingDirsSectionProps) {
  const [dirs, setDirs] = useState<WorkingDir[]>(workingDirs)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editHost, setEditHost] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newHost, setNewHost] = useState('')
  const [isRemote, setIsRemote] = useState(false)
  const [editIsRemote, setEditIsRemote] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const newNameInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showBrowser, setShowBrowser] = useState<'create' | 'edit' | null>(null)

  // Compute suggested paths from IDE items, file items, and command items that are not in working dirs
  // Group by source for display
  const suggestedPaths = useMemo(() => {
    const existingLocalPaths = new Set(dirs.filter((d) => !d.host).map((d) => d.path))
    const existingRemotePaths = new Set(dirs.filter((d) => d.host).map((d) => `${d.host}:${d.path}`))

    type Suggestion = { name: string; path: string; host?: string }
    type GroupedSuggestions = { source: string; items: Suggestion[] }

    // Local suggestions grouped by source
    const localGroups: GroupedSuggestions[] = []

    // From IDE items
    const idePaths = ideItems
      .map((item) => item.content)
      .filter((path): path is string => !!path && !existingLocalPaths.has(path))
      .filter((path, index, arr) => arr.indexOf(path) === index)
    if (idePaths.length > 0) {
      localGroups.push({
        source: 'IDE',
        items: idePaths.map((path) => ({
          name: path.split(/[/\\]/).pop() || path,
          path,
        })),
      })
    }

    // From file items
    const filePaths = fileItems
      .map((item) => item.content)
      .filter((path): path is string => !!path && !existingLocalPaths.has(path))
      .filter((path, index, arr) => arr.indexOf(path) === index)
    if (filePaths.length > 0) {
      localGroups.push({
        source: 'Open',
        items: filePaths.map((path) => ({
          name: path.split(/[/\\]/).pop() || path,
          path,
        })),
      })
    }

    // From command items (local)
    const commandLocalPaths = commandItems
      .filter((item) => item.command_cwd && !item.command_host)
      .map((item) => item.command_cwd!)
      .filter((path) => !existingLocalPaths.has(path))
      .filter((path, index, arr) => arr.indexOf(path) === index)
    if (commandLocalPaths.length > 0) {
      localGroups.push({
        source: 'Command',
        items: commandLocalPaths.map((path) => ({
          name: path.split(/[/\\]/).pop() || path,
          path,
        })),
      })
    }

    // Remote suggestions grouped by source
    const remoteGroups: GroupedSuggestions[] = []

    // From Remote IDE items
    const remoteIdePaths = remoteIdeItems
      .map((item) => {
        const content = item.content || ''
        const colonIndex = content.indexOf(':')
        if (colonIndex > 0) {
          const host = content.substring(0, colonIndex)
          const path = content.substring(colonIndex + 1)
          return { host, path, key: content }
        }
        return null
      })
      .filter(
        (item): item is { host: string; path: string; key: string } => !!item && !existingRemotePaths.has(item.key)
      )
      .filter((item, index, arr) => arr.findIndex((i) => i.key === item.key) === index)
    if (remoteIdePaths.length > 0) {
      remoteGroups.push({
        source: 'Remote IDE',
        items: remoteIdePaths.map((item) => ({
          name: item.path.split('/').pop() || item.path,
          path: item.path,
          host: item.host,
        })),
      })
    }

    // From command items (remote)
    const commandRemotePaths = commandItems
      .filter((item) => item.command_cwd && item.command_host)
      .map((item) => ({
        host: item.command_host!,
        path: item.command_cwd!,
        key: `${item.command_host}:${item.command_cwd}`,
      }))
      .filter((item) => !existingRemotePaths.has(item.key))
      .filter((item, index, arr) => arr.findIndex((i) => i.key === item.key) === index)
    if (commandRemotePaths.length > 0) {
      remoteGroups.push({
        source: 'Command',
        items: commandRemotePaths.map((item) => ({
          name: item.path.split('/').pop() || item.path,
          path: item.path,
          host: item.host,
        })),
      })
    }

    return { local: localGroups, remote: remoteGroups }
  }, [dirs, ideItems, remoteIdeItems, fileItems, commandItems])

  // Sync with props
  useEffect(() => {
    setDirs(workingDirs)
  }, [workingDirs])

  // Focus input when editing
  useEffect(() => {
    if (editingIndex !== null && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [editingIndex])

  // Focus new input when adding
  useEffect(() => {
    if (isAddingNew && newNameInputRef.current) {
      newNameInputRef.current.focus()
    }
  }, [isAddingNew])

  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (editingIndex !== null) {
      const trimmedName = editName.trim()
      const trimmedPath = editPath.trim()
      const trimmedHost = editHost.trim()
      if (trimmedName && trimmedPath && (!editIsRemote || trimmedHost)) {
        const newDirs = [...dirs]
        newDirs[editingIndex] = {
          name: trimmedName,
          path: trimmedPath,
          ...(editIsRemote && trimmedHost ? { host: trimmedHost } : {}),
        }
        setDirs(newDirs)
        await onUpdate(newDirs)
        setEditingIndex(null)
        setEditName('')
        setEditPath('')
        setEditHost('')
        setEditIsRemote(false)
        return true
      }
      // Keep state if partial input - user can continue editing
      return false
    }
    return false
  }, [editingIndex, editName, editPath, editHost, editIsRemote, dirs, onUpdate])

  const saveNew = useCallback(async (): Promise<boolean> => {
    if (isAddingNew) {
      const trimmedName = newName.trim()
      const trimmedPath = newPath.trim()
      const trimmedHost = newHost.trim()
      if (trimmedName && trimmedPath && (!isRemote || trimmedHost)) {
        const newDir: WorkingDir = {
          name: trimmedName,
          path: trimmedPath,
          ...(isRemote && trimmedHost ? { host: trimmedHost } : {}),
        }
        const newDirs = [...dirs, newDir]
        setDirs(newDirs)
        await onUpdate(newDirs)
        // Only clear state after successful save
        setIsAddingNew(false)
        setNewName('')
        setNewPath('')
        setNewHost('')
        setIsRemote(false)
        return true
      }
      // If nothing to save (all fields empty), also clear state
      if (!trimmedName && !trimmedPath && (!isRemote || !trimmedHost)) {
        setIsAddingNew(false)
        setNewName('')
        setNewPath('')
        setNewHost('')
        setIsRemote(false)
        return true
      }
      // Otherwise keep state (partial input) - user can continue editing
      return false
    }
    return false
  }, [isAddingNew, newName, newPath, newHost, isRemote, dirs, onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (showBrowser) return
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (editingIndex !== null) {
          await saveEdit()
        }
        if (isAddingNew) {
          await saveNew()
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBrowser, editingIndex, isAddingNew, saveEdit, saveNew])

  const handleEdit = (index: number) => {
    const dir = dirs[index]
    if (!dir) return
    setEditingIndex(index)
    setEditName(dir.name)
    setEditPath(dir.path)
    setEditHost(dir.host || '')
    setEditIsRemote(!!dir.host)
  }

  const handleDelete = async (index: number) => {
    const newDirs = dirs.filter((_, i) => i !== index)
    setDirs(newDirs)
    await onUpdate(newDirs)
  }

  const handleKeyDown = async (e: React.KeyboardEvent, isNew: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isNew) {
        await saveNew()
      } else {
        await saveEdit()
      }
    } else if (e.key === 'Escape') {
      if (isNew) {
        setIsAddingNew(false)
        setNewName('')
        setNewPath('')
        setNewHost('')
        setIsRemote(false)
      } else {
        setEditingIndex(null)
        setEditName('')
        setEditPath('')
        setEditHost('')
        setEditIsRemote(false)
      }
    }
  }

  const handleBrowse = async (isNew: boolean) => {
    if (isNew && isRemote) {
      setShowBrowser('create')
    } else if (!isNew && editIsRemote) {
      setShowBrowser('edit')
    } else {
      const path = await selectFolder()
      if (path) {
        if (isNew) {
          setNewPath(path)
          if (!newName) {
            const folderName = path.split(/[/\\]/).pop() || ''
            setNewName(folderName)
          }
        } else if (editingIndex !== null) {
          setEditPath(path)
          if (!editName) {
            const folderName = path.split(/[/\\]/).pop() || ''
            setEditName(folderName)
          }
        }
      }
    }
  }

  const handleStartAdding = () => {
    setIsAddingNew(true)
    setNewName('')
    setNewPath('')
    setNewHost('')
    setIsRemote(false)
  }

  return (
    <>
      <section ref={containerRef}>
        <h3 className="section-label">Working Dirs</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Existing dirs */}
          {dirs.map((dir, index) =>
            editingIndex === index ? (
              <div
                key={index}
                className={`flex flex-col gap-2 px-3 py-2 rounded-lg border ${editIsRemote ? 'border-(--accent-remote)' : 'border-(--accent-primary)'} bg-(--bg-surface)`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditIsRemote(!editIsRemote)}
                    className={`text-xs px-2 py-0.5 rounded ${editIsRemote ? 'bg-(--accent-remote)/20 text-(--accent-remote)' : 'bg-(--bg-elevated) text-(--text-muted)'}`}
                  >
                    {editIsRemote ? 'Remote' : 'Local'}
                  </button>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, false)}
                    className="bg-transparent font-mono text-sm text-(--text-primary) outline-none w-24"
                    placeholder="Name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {editIsRemote && (
                    <HostInput value={editHost} onChange={setEditHost} suggestions={sshHosts} className="w-28" />
                  )}
                  <input
                    type="text"
                    value={editPath}
                    onChange={(e) => {
                      const path = e.target.value
                      setEditPath(path)
                      // Auto-fill name from path if name is empty
                      if (!editName && path.trim()) {
                        const folderName = path.split(/[/\\]/).pop() || ''
                        if (folderName) setEditName(folderName)
                      }
                    }}
                    onKeyDown={(e) => handleKeyDown(e, false)}
                    className="bg-transparent font-mono text-sm text-(--text-secondary) outline-none min-w-[200px]"
                    placeholder={editIsRemote ? '/home/user/project' : 'Path'}
                  />
                  <button
                    onClick={() => handleBrowse(false)}
                    disabled={editIsRemote && !editHost.trim()}
                    className="text-xs text-(--text-muted) hover:text-(--accent-primary) transition-colors disabled:opacity-50"
                    title="Browse folder"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={index}
                className={`group/dir relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${dir.host ? 'border-(--accent-remote)/30 bg-(--accent-remote)/5' : 'border-(--border-visible) bg-(--bg-elevated)'} hover:border-(--text-muted) transition-all cursor-pointer mr-5`}
                onClick={() => handleEdit(index)}
              >
                {dir.host ? (
                  <svg className="w-4 h-4 text-(--accent-remote)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-(--text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )}
                <span className={`font-mono text-sm ${dir.host ? 'text-(--accent-remote)' : 'text-(--text-primary)'}`}>
                  {dir.name}
                </span>
                <span className="font-mono text-xs text-(--text-muted)">{dir.host ? `@${dir.host}` : 'local'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(index)
                  }}
                  className="ml-1 opacity-0 group-hover/dir:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                >
                  x
                </button>
              </div>
            )
          )}

          {/* New dir input (dashed box) */}
          {isAddingNew ? (
            <div
              className={`relative flex flex-col gap-2 px-3 py-2 rounded-lg border ${isRemote ? 'border-(--accent-remote)' : 'border-(--accent-primary)'} bg-(--bg-surface)`}
            >
              <button
                onClick={() => {
                  setIsAddingNew(false)
                  setNewName('')
                  setNewPath('')
                  setNewHost('')
                  setIsRemote(false)
                }}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-elevated) transition-colors text-sm"
                title="Cancel"
              >
                ×
              </button>
              <div className="flex items-center gap-2 pr-4">
                <button
                  type="button"
                  onClick={() => setIsRemote(!isRemote)}
                  className={`text-xs px-2 py-0.5 rounded ${isRemote ? 'bg-(--accent-remote)/20 text-(--accent-remote)' : 'bg-(--bg-elevated) text-(--text-muted)'}`}
                >
                  {isRemote ? 'Remote' : 'Local'}
                </button>
                <input
                  ref={newNameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  className="bg-transparent font-mono text-sm text-(--text-primary) outline-none w-24"
                  placeholder="Name"
                />
              </div>
              <div className="flex items-center gap-2">
                {isRemote && (
                  <HostInput value={newHost} onChange={setNewHost} suggestions={sshHosts} className="w-28" />
                )}
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => {
                    const path = e.target.value
                    setNewPath(path)
                    // Auto-fill name from path if name is empty
                    if (!newName && path.trim()) {
                      const folderName = path.split(/[/\\]/).pop() || ''
                      if (folderName) setNewName(folderName)
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  className="bg-transparent font-mono text-sm text-(--text-secondary) outline-none min-w-[200px]"
                  placeholder={isRemote ? '/home/user/project' : 'Path'}
                />
                <button
                  onClick={() => handleBrowse(true)}
                  disabled={isRemote && !newHost.trim()}
                  className="text-xs text-(--text-muted) hover:text-(--accent-primary) transition-colors disabled:opacity-50"
                  title="Browse folder"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </button>
              </div>
              {/* Suggestions from project items, grouped by source */}
              {(isRemote ? suggestedPaths.remote : suggestedPaths.local).map((group) => (
                <div key={group.source} className="mt-2 pt-2 border-t border-(--border-subtle)">
                  <span className="text-xs font-mono text-(--text-muted)">From {group.source}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {group.items.map((suggestion) => (
                      <button
                        key={suggestion.host ? `${suggestion.host}:${suggestion.path}` : suggestion.path}
                        type="button"
                        onClick={async () => {
                          const newDir: WorkingDir = {
                            name: suggestion.name,
                            path: suggestion.path,
                            ...(suggestion.host ? { host: suggestion.host } : {}),
                          }
                          const newDirs = [...dirs, newDir]
                          setDirs(newDirs)
                          await onUpdate(newDirs)
                          setIsAddingNew(false)
                          setNewName('')
                          setNewPath('')
                          setNewHost('')
                          setIsRemote(false)
                        }}
                        className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                          isRemote
                            ? 'bg-(--accent-remote)/10 border-(--accent-remote)/30 text-(--accent-remote) hover:bg-(--accent-remote)/20'
                            : 'bg-(--bg-elevated) border-(--border-visible) text-(--text-secondary) hover:text-(--accent-primary) hover:border-(--accent-primary)'
                        }`}
                        title={suggestion.host ? `${suggestion.host}:${suggestion.path}` : suggestion.path}
                      >
                        + {suggestion.name}{' '}
                        <span className="opacity-50">{suggestion.host ? `@${suggestion.host}` : 'local'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={handleStartAdding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-primary) text-(--text-muted) hover:text-(--accent-primary) transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-mono text-sm">Add dir</span>
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
              if (!newName) {
                const folderName = path.split('/').pop() || ''
                setNewName(folderName)
              }
            } else {
              setEditPath(path)
              if (!editName) {
                const folderName = path.split('/').pop() || ''
                setEditName(folderName)
              }
            }
            setShowBrowser(null)
          }}
          onClose={() => setShowBrowser(null)}
        />
      )}
    </>
  )
}
