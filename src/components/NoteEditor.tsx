import { useState, useEffect, useCallback } from 'react'
import MDEditor from '@uiw/react-md-editor'
import type { Item } from '../types'
import { useTheme } from '../hooks/useTheme'

interface Props {
  note: Item
  onSave: (content: string) => Promise<void>
  onClose: () => void
}

export default function NoteEditor({ note, onSave, onClose }: Props) {
  const [content, setContent] = useState(note.content || '')
  const [saving, setSaving] = useState(false)
  const { theme } = useTheme()

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(content)
    } finally {
      setSaving(false)
    }
  }, [content, onSave])

  // Ctrl+S / Cmd+S keyboard shortcut to save (using capture phase to intercept)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [handleSave])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-(--border-subtle)">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-(--accent-warning) rounded-full" />
            <h3 className="text-lg font-semibold text-(--text-primary)">{note.title}</h3>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-solid">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden" data-color-mode={theme}>
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || '')}
            height="100%"
            preview="live"
            hideToolbar={false}
          />
        </div>
      </div>
    </div>
  )
}
