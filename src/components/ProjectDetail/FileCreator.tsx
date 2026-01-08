import { useState, useRef, useCallback } from 'react'
import { selectFolder, selectFile } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { getPathName } from '../../utils/remote'

interface FileCreatorProps {
  existingPaths: string[]
  onAdd: (title: string, path: string) => Promise<void>
  onCancel: () => void
}

export default function FileCreator({ existingPaths, onAdd, onCancel }: FileCreatorProps) {
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const formRef = useRef<HTMLDivElement>(null)

  const save = useCallback(async () => {
    if (path.trim()) {
      const finalTitle = title.trim() || getPathName(path, 'File')
      await onAdd(finalTitle, path.trim())
    } else {
      onCancel()
    }
  }, [title, path, onAdd, onCancel])

  useEditorHandlers({
    containerRef: formRef,
    isActive: true,
    canSave: !!path.trim(),
    onSave: save,
    onCancel,
  })

  const handleSelectFile = async () => {
    const selected = await selectFile()
    if (selected) setPath(selected)
  }

  const handleSelectFolder = async () => {
    const selected = await selectFolder()
    if (selected) setPath(selected)
  }

  return (
    <div ref={formRef} className="mb-4 p-4 rounded-xl bg-(--bg-elevated) border border-(--border-visible)">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)..."
          className="input-terminal w-40"
        />
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="File or folder path..."
            className="input-terminal flex-1"
            autoFocus
          />
          <button type="button" onClick={handleSelectFile} className="btn-ghost whitespace-nowrap">
            File
          </button>
          <button type="button" onClick={handleSelectFolder} className="btn-ghost whitespace-nowrap">
            Folder
          </button>
        </div>
      </div>
      {existingPaths.length > 0 && (
        <div className="mt-3 pt-3 border-t border-(--border-subtle)">
          <span className="text-xs font-mono text-(--text-muted)">Existing files:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {existingPaths.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPath(p)}
                className="text-xs font-mono px-2 py-1 rounded bg-(--bg-surface) border border-(--border-visible) text-(--text-secondary) hover:text-(--text-primary) hover:border-(--text-muted) transition-colors truncate max-w-xs"
                title={p}
              >
                {p.split(/[\\/]/).pop()}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs font-mono text-(--text-muted) mt-3">Click outside to save</div>
    </div>
  )
}
