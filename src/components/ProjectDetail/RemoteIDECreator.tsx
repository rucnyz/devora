import { useState, useRef, useCallback } from 'react'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { buildRemoteContent, getPathName } from '../../utils/remote'
import { REMOTE_IDE_TYPES } from '../../constants/itemTypes'
import RemoteDirBrowser from '../RemoteDirBrowser'
import HostInput from '../HostInput'
import WorkingDirsSuggestions from './WorkingDirsSuggestions'
import type { RemoteIdeType, WorkingDir } from '../../types'

interface RemoteIDECreatorProps {
  sshHosts: string[]
  workingDirs: WorkingDir[]
  onAdd: (title: string, content: string, remoteIdeType: RemoteIdeType) => Promise<void>
  onCancel: () => void
}

export default function RemoteIDECreator({ sshHosts, workingDirs, onAdd, onCancel }: RemoteIDECreatorProps) {
  const [ideType, setIdeType] = useState<RemoteIdeType>('cursor')
  const [host, setHost] = useState('')
  const [path, setPath] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const save = useCallback(async () => {
    if (host.trim() && path.trim()) {
      const title = getPathName(path, 'Remote')
      const content = buildRemoteContent(host, path)
      await onAdd(title, content, ideType)
    } else {
      onCancel()
    }
  }, [host, path, ideType, onAdd, onCancel])

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
        className="mb-4 p-4 rounded-xl bg-[var(--accent-remote)]/5 border border-[var(--accent-remote)]/30"
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ideType}
            onChange={(e) => setIdeType(e.target.value as RemoteIdeType)}
            className="input-terminal !w-auto"
          >
            {REMOTE_IDE_TYPES.map((ide) => (
              <option key={ide.value} value={ide.value}>
                {ide.label}
              </option>
            ))}
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
          className="mt-3 pt-3 border-t border-[var(--border-subtle)]"
        />
        <div className="text-xs font-mono text-[var(--text-muted)] mt-3">Click outside to save</div>
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
