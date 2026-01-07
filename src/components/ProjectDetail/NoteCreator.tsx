import { useState, useRef, useCallback } from 'react'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'

interface NoteCreatorProps {
  onAdd: (title: string, content?: string) => Promise<void>
  onCancel: () => void
}

export default function NoteCreator({ onAdd, onCancel }: NoteCreatorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const formRef = useRef<HTMLDivElement>(null)

  const hasContent = title.trim() !== '' || content.trim() !== ''

  const save = useCallback(async () => {
    const finalTitle = title.trim() || 'Untitled'
    await onAdd(finalTitle, content.trim() || undefined)
  }, [title, content, onAdd])

  useEditorHandlers({
    containerRef: formRef,
    isActive: true,
    canSave: hasContent,
    onSave: save,
    onCancel,
  })

  return (
    <div ref={formRef} className="note-card note-card-editing mb-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (hasContent) {
              save()
            } else {
              onCancel()
            }
          }
        }}
        placeholder="Note title..."
        className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none"
        autoFocus
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note here..."
        className="textarea-terminal"
      />
      <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
        Click outside to {hasContent ? 'save' : 'cancel'}
      </div>
    </div>
  )
}
