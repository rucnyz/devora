import { useState, useRef, useCallback } from 'react'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useCustomIdes } from '../../hooks/useCustomIdes'
import { buildRemoteContent, getPathName } from '../../utils/remote'
import { REMOTE_IDE_TYPES, REMOTE_IDE_LABELS } from '../../constants/itemTypes'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import type { WorkingDir, RemoteIdeType, CustomRemoteIde } from '../../types'

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

interface RemoteIDECreatorProps {
  sshHosts: string[]
  workingDirs: WorkingDir[]
  onAdd: (title: string, content: string, remoteIdeType: string) => Promise<void>
  onCancel: () => void
}

export default function RemoteIDECreator({ sshHosts, workingDirs, onAdd, onCancel }: RemoteIDECreatorProps) {
  const { customRemoteIdes } = useCustomIdes()
  const [ideType, setIdeType] = useState<string>('cursor')
  const [host, setHost] = useState('')
  const [path, setPath] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const save = useCallback(async () => {
    if (host.trim() && path.trim()) {
      const ideLabel = getRemoteIdeLabel(ideType, customRemoteIdes)
      const title = `${ideLabel} - ${getPathName(path, 'Remote')}@${host}`
      const content = buildRemoteContent(host, path)
      await onAdd(title, content, ideType)
    } else {
      onCancel()
    }
  }, [host, path, ideType, customRemoteIdes, onAdd, onCancel])

  useEditorHandlers({
    containerRef: formRef,
    isActive: true,
    canSave: !!host.trim() && !!path.trim(),
    onSave: save,
    onCancel,
    skipClickOutside: showBrowser,
  })

  return (
    <>
      <div
        ref={formRef}
        className="mb-4 p-4 rounded-xl bg-(--accent-remote)/5 border border-(--accent-remote)/30 relative"
      >
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-elevated) transition-colors"
          title="Cancel"
        >
          ×
        </button>
        <div className="flex flex-wrap items-center gap-3 pr-6">
          <select value={ideType} onChange={(e) => setIdeType(e.target.value)} className="input-terminal !w-auto">
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
          <HostInput value={host} onChange={setHost} suggestions={sshHosts} className="w-40" autoFocus />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/project"
              className="input-terminal flex-1"
            />
            <button
              type="button"
              onClick={() => setShowBrowser(true)}
              disabled={!host.trim()}
              className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Browse
            </button>
          </div>
        </div>
        <WorkingDirsSuggestions
          workingDirs={workingDirs}
          filter="remote"
          onSelect={(dirPath, dirHost) => {
            setHost(dirHost || '')
            setPath(dirPath)
          }}
          className="mt-3 pt-3 border-t border-(--border-subtle)"
        />
        <div className="text-xs font-mono text-(--text-muted) mt-3">Click outside to save</div>
      </div>

      {showBrowser && (
        <RemoteDirBrowser
          host={host}
          initialPath={path || '~'}
          onSelect={(selectedPath) => {
            setPath(selectedPath)
            setShowBrowser(false)
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}
