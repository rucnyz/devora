import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import FilePreviewCard from './index'
import { useFileCards } from '../../hooks/useFileCards'
import { useSetting } from '../../hooks/useSettings.tsx'

interface FileCardContainerProps {
  projectId: string
}

// Check if content appears to be text (not binary)
function isTextContent(content: string): boolean {
  // Check for null bytes which indicate binary content
  if (content.includes('\0')) return false

  // Sample first 8KB for performance
  const sample = content.slice(0, 8192)

  // Count printable vs non-printable characters
  let nonPrintable = 0
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)
    // Allow common text characters: printable ASCII, newlines, tabs, and common unicode
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++
    }
  }

  // If more than 10% non-printable, likely binary
  return nonPrintable / sample.length < 0.1
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function FileCardContainer({ projectId }: FileCardContainerProps) {
  const { cards, addCard, updateCard, deleteCard, bringToFront } = useFileCards(projectId)
  const { value: maxFileSize } = useSetting('fileCardMaxSize')
  const [isDragging, setIsDragging] = useState(false)
  const [dragError, setDragError] = useState<string | null>(null)

  // Clear error after a delay
  useEffect(() => {
    if (dragError) {
      const timer = setTimeout(() => setDragError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [dragError])

  // Global dragover listener to detect file drags from anywhere
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        setIsDragging(true)
      }
    }

    document.addEventListener('dragover', handleGlobalDragOver)
    return () => document.removeEventListener('dragover', handleGlobalDragOver)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only show drag state if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only hide if leaving the container entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (!file) return

      // Check file size
      if (file.size > maxFileSize) {
        setDragError(`File too large (${formatFileSize(file.size)}). Max: ${formatFileSize(maxFileSize)}`)
        return
      }

      try {
        let content: string
        try {
          content = await file.text()
        } catch (readErr) {
          console.error('Failed to read file content:', readErr)
          setDragError(`Cannot read file: ${readErr instanceof Error ? readErr.message : 'Unknown error'}`)
          return
        }

        // Check if content is text (not binary)
        if (!isTextContent(content)) {
          setDragError('Binary files are not supported')
          return
        }

        // Position card at drop location, offset to center it
        // Convert to percentage for responsive positioning
        const pixelX = Math.max(0, e.clientX - 140)
        const pixelY = Math.max(0, e.clientY - 20)
        const percentX = (pixelX / window.innerWidth) * 100
        const percentY = (pixelY / window.innerHeight) * 100
        await addCard({
          filename: file.name,
          content,
          position_x: percentX,
          position_y: percentY,
        })
      } catch (err) {
        console.error('Failed to add card:', err)
        setDragError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [addCard, maxFileSize]
  )

  // Use portal to render at body level, avoiding parent transform issues with fixed positioning
  return createPortal(
    <>
      {/* Global drop zone - always active but only visible when dragging */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isDragging ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Visual feedback overlay */}
        <div className="absolute inset-4 border-2 border-dashed border-[var(--accent-secondary)] rounded-xl bg-[var(--accent-secondary)]/5 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-[var(--accent-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-lg font-mono text-[var(--accent-secondary)]">Drop text file to preview</span>
            <p className="text-sm text-[var(--text-muted)] mt-1">Max {formatFileSize(maxFileSize)}</p>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {dragError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-[var(--accent-danger)] text-white rounded-lg shadow-lg animate-card-enter">
          {dragError}
        </div>
      )}

      {/* File preview cards */}
      {cards.map((card) => (
        <FilePreviewCard
          key={card.id}
          card={card}
          onClose={() => deleteCard(card.id)}
          onPositionChange={(x, y) => updateCard(card.id, { position_x: x, position_y: y })}
          onMinimizeToggle={() => updateCard(card.id, { is_minimized: !card.is_minimized })}
          onBringToFront={() => bringToFront(card.id)}
        />
      ))}
    </>,
    document.body
  )
}
