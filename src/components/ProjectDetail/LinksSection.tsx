import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchUrlMetadata } from '../../hooks/useProjects'
import type { Item } from '../../types'

interface LinksSectionProps {
  urls: Item[]
  onAdd: (title: string, url: string) => Promise<Item>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function LinksSection({ urls, onAdd, onUpdate, onDelete }: LinksSectionProps) {
  const [quickUrlInput, setQuickUrlInput] = useState('')
  const quickUrlInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editUrlRef = useRef<HTMLDivElement>(null)

  const quickAddUrl = useCallback(async (url: string) => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    try {
      const urlObj = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`)
      // Fallback: use last path segment or hostname
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      const lastSegment = pathParts[pathParts.length - 1]
      let fallbackTitle = lastSegment ? decodeURIComponent(lastSegment) : urlObj.hostname

      // Special handling for Notion URLs - extract page title from URL
      if (urlObj.hostname.includes('notion.so') && lastSegment) {
        const notionMatch = lastSegment.match(/^(.+)-[a-f0-9]{32}$/i)
        if (notionMatch) {
          fallbackTitle = 'Notion - ' + notionMatch[1].replace(/-/g, ' ')
        }
      }

      // Immediately add with fallback title (optimistic update)
      const newItem = await onAdd(fallbackTitle, urlObj.href)
      setQuickUrlInput('')

      // Fetch metadata in background and update if found (skip for Notion)
      if (!urlObj.hostname.includes('notion.so')) {
        fetchUrlMetadata(urlObj.href).then(metaTitle => {
          if (metaTitle && metaTitle !== fallbackTitle) {
            onUpdate(newItem.id, { title: metaTitle })
          }
        })
      }
    } catch {
      // Invalid URL, don't add
    }
  }, [onAdd, onUpdate])

  const saveEditing = useCallback(async () => {
    if (editingId && editTitle.trim()) {
      await onUpdate(editingId, { title: editTitle.trim() })
      setEditingId(null)
      setEditTitle('')
    }
  }, [editingId, editTitle, onUpdate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (editingId && editUrlRef.current && !editUrlRef.current.contains(event.target as Node)) {
        if (editTitle.trim()) {
          await saveEditing()
        } else {
          setEditingId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingId, editTitle, saveEditing])

  // Global Ctrl+V to quick add URL (only when not editing)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      const isEditing = activeEl instanceof HTMLInputElement ||
                        activeEl instanceof HTMLTextAreaElement ||
                        activeEl?.getAttribute('contenteditable') === 'true'

      if (isEditing) return

      const text = e.clipboardData?.getData('text')?.trim()
      if (!text) return

      const urlPattern = /^(https?:\/\/|www\.)/i
      if (urlPattern.test(text)) {
        e.preventDefault()
        await quickAddUrl(text)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [quickAddUrl])

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingId && editTitle.trim()) {
          e.preventDefault()
          e.stopPropagation()
          await saveEditing()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editingId, editTitle, saveEditing])

  return (
    <section id="section-links" className="mb-8 scroll-mt-6">
      <h3 className="section-label">Links</h3>

      <div className="flex flex-wrap items-center gap-2">
        {urls.map((item, index) =>
          editingId === item.id ? (
            <div
              key={item.id}
              ref={editUrlRef}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]"
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editTitle.trim()) {
                    e.preventDefault()
                    saveEditing()
                  } else if (e.key === 'Escape') {
                    setEditingId(null)
                  }
                }}
                className="w-40 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)]"
                autoFocus
              />
              <button
                onClick={() => setEditingId(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <a
              key={item.id}
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              className="tag tag-url animate-card-enter group"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>{item.title}</span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setEditingId(item.id)
                  setEditTitle(item.title)
                }}
                className="ml-1 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-[var(--accent-secondary)] transition-opacity"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(item.id)
                }}
                className="ml-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-[var(--accent-danger)] transition-opacity"
              >
                ×
              </button>
            </a>
          )
        )}
        {/* Quick URL input */}
        <div className="inline-flex items-center">
          <input
            ref={quickUrlInputRef}
            type="text"
            value={quickUrlInput}
            onChange={(e) => setQuickUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickUrlInput.trim()) {
                e.preventDefault()
                quickAddUrl(quickUrlInput)
              }
            }}
            placeholder="Paste URL or Ctrl+V anywhere..."
            className="w-56 px-3 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors"
          />
        </div>
      </div>
    </section>
  )
}
