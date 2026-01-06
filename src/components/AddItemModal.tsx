import { useState } from 'react'
import type { ItemType, IdeType } from '../types'

interface Props {
  onClose: () => void
  onAdd: (type: ItemType, title: string, content?: string, ideType?: IdeType) => Promise<void>
  initialType?: ItemType
}

const ITEM_TYPES: { value: ItemType; label: string; color: string }[] = [
  { value: 'note', label: 'Note', color: 'var(--accent-warning)' },
  { value: 'ide', label: 'IDE', color: 'var(--accent-primary)' },
  { value: 'file', label: 'File', color: 'var(--text-secondary)' },
  { value: 'url', label: 'URL', color: 'var(--accent-secondary)' },
]

const IDE_TYPES: { value: IdeType; label: string }[] = [
  { value: 'pycharm', label: 'PyCharm' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'zed', label: 'Zed' },
  { value: 'obsidian', label: 'Obsidian' },
]

const TYPE_LABELS: Record<ItemType, string> = {
  note: 'Note',
  ide: 'IDE Shortcut',
  file: 'File',
  url: 'URL Link',
}

export default function AddItemModal({ onClose, onAdd, initialType }: Props) {
  const [type, setType] = useState<ItemType>(initialType || 'note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [ideType, setIdeType] = useState<IdeType>('pycharm')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      await onAdd(
        type,
        title.trim(),
        content.trim() || undefined,
        type === 'ide' ? ideType : undefined
      )
    } finally {
      setLoading(false)
    }
  }

  const getContentLabel = () => {
    switch (type) {
      case 'note':
        return 'Content (optional)'
      case 'ide':
        return 'Project Path'
      case 'file':
        return 'File Path'
      case 'url':
        return 'URL'
    }
  }

  const getContentPlaceholder = () => {
    switch (type) {
      case 'note':
        return 'Write your note here...'
      case 'ide':
        return 'C:\\Users\\...\\project-folder'
      case 'file':
        return 'C:\\Users\\...\\document.pdf'
      case 'url':
        return 'https://example.com'
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {initialType ? `Add ${TYPE_LABELS[initialType]}` : 'Add Block'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type Selection */}
          {!initialType && (
            <div className="mb-5">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {ITEM_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${
                      type === t.value
                        ? 'border-2'
                        : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-visible)]'
                    }`}
                    style={type === t.value ? {
                      color: t.color,
                      borderColor: t.color,
                      backgroundColor: `color-mix(in srgb, ${t.color} 10%, transparent)`
                    } : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* IDE Type */}
          {type === 'ide' && (
            <div className="mb-5">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
                IDE
              </label>
              <select
                value={ideType}
                onChange={(e) => setIdeType(e.target.value as IdeType)}
                className="input-terminal"
              >
                {IDE_TYPES.map((ide) => (
                  <option key={ide.value} value={ide.value}>
                    {ide.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="mb-5">
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
              className="input-terminal"
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="mb-6">
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {getContentLabel()}
            </label>
            {type === 'note' ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={getContentPlaceholder()}
                rows={4}
                className="textarea-terminal"
              />
            ) : (
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={getContentPlaceholder()}
                className="input-terminal"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || loading}
              className="btn-solid"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
