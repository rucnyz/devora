import { useState, useRef, useCallback } from 'react'
import { selectFolder } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import type { CommandMode, WorkingDir } from '../../types'

interface CommandCreatorProps {
  workingDirs: WorkingDir[]
  sshHosts: string[]
  onAdd: (title: string, command: string, mode: CommandMode, cwd?: string, host?: string) => Promise<void>
  onCancel: () => void
}

export default function CommandCreator({ workingDirs, sshHosts, onAdd, onCancel }: CommandCreatorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<CommandMode>('background')
  const [cwd, setCwd] = useState('')
  const [host, setHost] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const save = useCallback(async () => {
    if (content.trim()) {
      const finalTitle = title.trim() || content.trim()
      await onAdd(finalTitle, content.trim(), mode, cwd.trim() || undefined, host.trim() || undefined)
    } else {
      onCancel()
    }
  }, [title, content, mode, cwd, host, onAdd, onCancel])

  useEditorHandlers({
    containerRef: formRef,
    isActive: true,
    canSave: !!content.trim(),
    onSave: save,
    onCancel,
    skipClickOutside: showBrowser,
  })

  const handleBrowse = async () => {
    if (host) {
      setShowBrowser(true)
    } else {
      const path = await selectFolder()
      if (path) setCwd(path)
    }
  }

  return (
    <>
      <div ref={formRef} className="mb-4 p-4 rounded-xl bg-(--bg-elevated) border border-(--border-visible) relative">
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-surface) transition-colors"
          title="Cancel"
        >
          ×
        </button>
        <div className="flex flex-wrap items-center gap-3 mb-3 pr-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)..."
            className="input-terminal w-40"
          />
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Command to run..."
            className="input-terminal flex-1"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <HostInput
            value={host}
            onChange={setHost}
            suggestions={sshHosts}
            placeholder="Host (optional for remote)"
            className="w-36"
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder={host ? 'Remote path...' : 'Working directory (optional)...'}
              className="input-terminal flex-1"
            />
            <button type="button" onClick={handleBrowse} className="btn-ghost whitespace-nowrap">
              Browse
            </button>
          </div>
          <select value={mode} onChange={(e) => setMode(e.target.value as CommandMode)} className="input-terminal w-36">
            <option value="background">Background</option>
            <option value="output">Show Output</option>
          </select>
        </div>
        <WorkingDirsSuggestions
          workingDirs={workingDirs}
          onSelect={(path, dirHost) => {
            setCwd(path)
            setHost(dirHost || '')
          }}
          className="mb-3"
        />
        <div className="text-xs font-mono text-(--text-muted)">
          Click outside to save {host && <span className="text-[#e879f9]">(SSH: {host})</span>}
        </div>
      </div>

      {showBrowser && (
        <RemoteDirBrowser
          host={host}
          initialPath={cwd}
          onSelect={(path) => {
            setCwd(path)
            setShowBrowser(false)
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}
