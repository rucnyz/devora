import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MilkdownEditor from './MilkdownEditor'

interface NotesDrawerProps {
  isOpen: boolean
  onClose: () => void
  content: string
  loading: boolean
  onSave: (content: string) => Promise<void>
}

export default function NotesDrawer({ isOpen, onClose, content, loading, onSave }: NotesDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [drawerWidth, setDrawerWidth] = useState(560)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [localContent, setLocalContent] = useState(content)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const MIN_WIDTH = 320
  const MAX_WIDTH = Math.min(1200, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1200)

  // Sync local content when prop changes (e.g., when switching projects)
  useEffect(() => {
    setLocalContent(content)
  }, [content])

  // Auto-save with debounce
  const handleContentChange = useCallback(
    (newContent: string) => {
      setLocalContent(newContent)

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save by 500ms
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          await onSave(newContent)
        } finally {
          setIsSaving(false)
        }
      }, 500)
    },
    [onSave]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      resizeRef.current = { startX: e.clientX, startWidth: drawerWidth }
    },
    [drawerWidth]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = resizeRef.current.startX - e.clientX
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeRef.current.startWidth + delta))
      setDrawerWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        style={{ width: `${drawerWidth}px` }}
        className={`
          fixed top-0 right-0 h-full max-w-[90vw] z-50
          bg-(--bg-surface) border-l border-(--border-visible)
          transform transition-transform duration-300 ease-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${isResizing ? 'transition-none select-none' : ''}
        `}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className={`
            absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize
            hover:bg-(--accent-primary) transition-colors
            ${isResizing ? 'bg-(--accent-primary)' : ''}
          `}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-(--border-subtle)">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-(--text-primary)">Notes</h2>
            {isSaving && <span className="text-xs text-(--text-muted)">Saving...</span>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-(--text-muted)">Loading...</div>
          ) : (
            <MilkdownEditor value={localContent} onChange={handleContentChange} />
          )}
        </div>
      </div>
    </>
  )

  return createPortal(drawer, document.body)
}
