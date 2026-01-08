import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Virtuoso } from 'react-virtuoso'
import type { FileCard } from '../../hooks/useFileCards'
import { readFileContent, getFileInfo, readFileLines } from '../../api/tauri'
import { useSetting } from '../../hooks/useSettings'

interface FilePreviewCardProps {
  card: FileCard
  onClose: () => void
  onPositionChange: (x: number, y: number) => void
  onMinimizeToggle: () => void
  onBringToFront: () => void
}

// Convert percentage (0-100) to pixels
const percentToPixel = (percentX: number, percentY: number) => ({
  x: (percentX / 100) * window.innerWidth,
  y: (percentY / 100) * window.innerHeight,
})

// Convert pixels to percentage (0-100)
const pixelToPercent = (x: number, y: number) => ({
  x: (x / window.innerWidth) * 100,
  y: (y / window.innerHeight) * 100,
})

export default function FilePreviewCard({
  card,
  onClose,
  onPositionChange,
  onMinimizeToggle,
  onBringToFront,
}: FilePreviewCardProps) {
  const { value: zoomLevel } = useSetting('zoomLevel')
  const [isDragging, setIsDragging] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingFull, setLoadingFull] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [lineCount, setLineCount] = useState<number>(0)
  const lineCache = useRef<Map<number, string>>(new Map())
  const [, setCacheVersion] = useState(0) // Trigger re-render when cache updates
  // Local position in pixels for smooth dragging
  const [localPosition, setLocalPosition] = useState(() => percentToPixel(card.position_x, card.position_y))
  const [prevCardPos, setPrevCardPos] = useState({ x: card.position_x, y: card.position_y })
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef({ startMouseX: 0, startMouseY: 0, startCardX: 0, startCardY: 0, rafId: 0, active: false })
  const callbacksRef = useRef({ onPositionChange, onBringToFront })
  // Get current zoom level for drag calculations
  const zoomRef = useRef((zoomLevel ?? 100) / 100)

  useEffect(() => {
    zoomRef.current = (zoomLevel ?? 100) / 100
  }, [zoomLevel])

  // Load preview content (first 8KB) on mount for normal card
  useEffect(() => {
    let cancelled = false
    const loadPreview = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await readFileContent(card.file_path, 8 * 1024) // Only read first 8KB for preview
        if (!cancelled) {
          setPreviewContent(result.content)
          setFileSize(result.file_size)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load file preview:', err)
          setError(err instanceof Error ? err.message : 'Failed to load file')
          setLoading(false)
        }
      }
    }
    loadPreview()
    return () => {
      cancelled = true
    }
  }, [card.file_path])

  // Load file info when modal opens
  useEffect(() => {
    if (!isModalOpen) return

    let cancelled = false
    const loadFileInfo = async () => {
      try {
        setLoadingFull(true)
        lineCache.current.clear()

        const info = await getFileInfo(card.file_path)

        if (!cancelled) {
          setFileSize(info.file_size)

          // Preload first screen (first 100 lines) BEFORE setting lineCount
          if (info.line_count > 0) {
            const initialLines = Math.min(100, info.line_count)
            const result = await readFileLines(card.file_path, 0, initialLines)
            result.lines.forEach((line, index) => {
              lineCache.current.set(index, line)
            })
          }

          // Set lineCount AFTER data is loaded, so Virtuoso starts with data ready
          setLineCount(info.line_count)
          setLoadingFull(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load file info:', err)
          setLoadingFull(false)
        }
      }
    }
    loadFileInfo()
    return () => {
      cancelled = true
    }
  }, [isModalOpen, card.file_path])

  // Load lines on demand for virtual scrolling
  const loadLinesRange = useCallback(
    async (startLine: number, endLine: number) => {
      const linesToLoad: number[] = []

      // Find which lines are not in cache
      for (let i = startLine; i <= endLine; i++) {
        if (!lineCache.current.has(i)) {
          linesToLoad.push(i)
        }
      }

      if (linesToLoad.length === 0) return

      // Load the full requested range
      const firstLine = startLine
      const count = endLine - startLine + 1

      try {
        const result = await readFileLines(card.file_path, firstLine, count)
        result.lines.forEach((line, index) => {
          lineCache.current.set(firstLine + index, line)
        })
        setCacheVersion((v) => v + 1) // Trigger re-render
      } catch (err) {
        console.error('Failed to load lines:', err)
      }
    },
    [card.file_path]
  )

  // Get line content with caching
  const getLineContent = (lineIndex: number): string => {
    return lineCache.current.get(lineIndex) ?? ''
  }

  useEffect(() => {
    callbacksRef.current = { onPositionChange, onBringToFront }
  })

  // Recalculate position on window resize to keep card visible
  useEffect(() => {
    const handleResize = () => {
      if (isDragging) return
      // Recalculate pixel position from percentage
      const newPos = percentToPixel(card.position_x, card.position_y)
      // Clamp to ensure card stays within viewport
      const clamped = {
        x: Math.max(0, Math.min(newPos.x, window.innerWidth - 100)),
        y: Math.max(0, Math.min(newPos.y, window.innerHeight - 50)),
      }
      setLocalPosition(clamped)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [card.position_x, card.position_y, isDragging])

  // Close modal on Escape key and lock body scroll
  useEffect(() => {
    if (!isModalOpen) return

    // Lock body scroll to prevent wheel events from scrolling the page
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isModalOpen])

  // Sync local position with props when not dragging (convert percent to pixel)
  if (!isDragging && (card.position_x !== prevCardPos.x || card.position_y !== prevCardPos.y)) {
    setPrevCardPos({ x: card.position_x, y: card.position_y })
    setLocalPosition(percentToPixel(card.position_x, card.position_y))
  }

  // Clamp pixel position within viewport
  const clampPosition = (x: number, y: number) => ({
    x: Math.max(0, Math.min(x, window.innerWidth - 100)),
    y: Math.max(0, Math.min(y, window.innerHeight - 50)),
  })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()

      const state = dragStateRef.current
      state.startMouseX = e.clientX
      state.startMouseY = e.clientY
      state.startCardX = localPosition.x
      state.startCardY = localPosition.y
      state.active = true

      setIsDragging(true)
      callbacksRef.current.onBringToFront()

      const handleMouseMove = (e: MouseEvent) => {
        if (state.rafId) cancelAnimationFrame(state.rafId)
        state.rafId = requestAnimationFrame(() => {
          if (!state.active) return
          // Divide mouse delta by zoom to match visual movement
          const zoom = zoomRef.current
          const deltaX = (e.clientX - state.startMouseX) / zoom
          const deltaY = (e.clientY - state.startMouseY) / zoom
          const { x, y } = clampPosition(state.startCardX + deltaX, state.startCardY + deltaY)
          if (cardRef.current) {
            cardRef.current.style.transform = `translate(${x - state.startCardX}px, ${y - state.startCardY}px)`
          }
        })
      }

      const handleMouseUp = (e: MouseEvent) => {
        state.active = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        if (state.rafId) {
          cancelAnimationFrame(state.rafId)
          state.rafId = 0
        }

        // Divide mouse delta by zoom to match visual movement
        const zoom = zoomRef.current
        const deltaX = (e.clientX - state.startMouseX) / zoom
        const deltaY = (e.clientY - state.startMouseY) / zoom
        const { x: finalX, y: finalY } = clampPosition(state.startCardX + deltaX, state.startCardY + deltaY)

        if (cardRef.current) {
          cardRef.current.style.left = `${finalX}px`
          cardRef.current.style.top = `${finalY}px`
          cardRef.current.style.transform = ''
        }

        setLocalPosition({ x: finalX, y: finalY })
        setIsDragging(false)
        // Save as percentage
        const percent = pixelToPercent(finalX, finalY)
        callbacksRef.current.onPositionChange(percent.x, percent.y)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [localPosition.x, localPosition.y]
  )

  // Truncate filename for display
  const displayFilename = card.filename.length > 20 ? card.filename.slice(0, 17) + '...' : card.filename

  // Common style for cards - keep hover effects but disable position transform
  const cardStyle = {
    left: localPosition.x,
    top: localPosition.y,
    zIndex: 50 + card.z_index,
    transform: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  // Minimized view - just a small pill with filename
  if (card.is_minimized) {
    return (
      <div
        ref={cardRef}
        className={`fixed glass-card shadow-lg select-none ${isDragging ? 'cursor-grabbing opacity-90' : 'cursor-grab'}`}
        style={cardStyle}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
          {/* File icon */}
          <svg
            className="w-3.5 h-3.5 text-[var(--accent-secondary)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-xs font-mono text-[var(--text-primary)] max-w-[120px] truncate" title={card.filename}>
            {displayFilename}
          </span>
          {/* Restore button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMinimizeToggle()
            }}
            className="p-0.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Restore"
          >
            <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-0.5 hover:bg-[var(--accent-danger)]/20 rounded transition-colors"
            title="Close"
          >
            <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className={`fixed glass-card shadow-xl select-none ${isDragging ? 'cursor-grabbing opacity-90' : 'cursor-grab'}`}
      style={{ ...cardStyle, width: '280px' }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          {/* File icon */}
          <svg
            className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm font-mono text-[var(--text-primary)] truncate" title={card.filename}>
            {card.filename.length > 30 ? card.filename.slice(0, 27) + '...' : card.filename}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Minimize button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMinimizeToggle()
            }}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          {/* Fullscreen button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsModalOpen(true)
            }}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            title="Fullscreen"
          >
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 hover:bg-[var(--accent-danger)]/20 rounded transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="overflow-hidden max-h-32"
        onMouseDown={(e) => e.stopPropagation()} // Allow text selection
      >
        {loading ? (
          <div className="p-3 text-xs text-[var(--text-muted)] italic">Loading preview...</div>
        ) : error ? (
          <div className="p-3 text-xs text-[var(--accent-danger)]">Error: {error}</div>
        ) : (
          <pre className="p-3 text-xs font-mono text-[var(--text-secondary)] overflow-auto whitespace-pre-wrap break-words cursor-text select-text">
            {previewContent}
          </pre>
        )}
      </div>

      {/* Footer with file size info */}
      <div className="px-3 py-1 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
        {loading
          ? '...'
          : error
            ? 'Error'
            : previewContent.length >= 8 * 1024
              ? `${(previewContent.length / 1024).toFixed(1)} KB (preview)`
              : `${(previewContent.length / 1024).toFixed(1)} KB`}
      </div>

      {/* Fullscreen Modal - rendered via portal to escape parent styles */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="glass-card shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-base font-mono text-[var(--text-primary)]">{card.filename}</span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {loadingFull
                      ? '(Loading...)'
                      : lineCount > 0
                        ? `(${lineCount.toLocaleString()} lines, ${(fileSize / 1024).toFixed(1)} KB)`
                        : ''}
                  </span>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-[var(--accent-danger)]/20 rounded transition-colors"
                  title="Close"
                >
                  <svg
                    className="w-5 h-5 text-[var(--text-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Modal Content */}
              <div className="flex-1 overflow-hidden">
                {loadingFull ? (
                  <div className="p-4 text-sm text-[var(--text-muted)] italic">Loading file info...</div>
                ) : lineCount > 0 ? (
                  <Virtuoso
                    style={{ height: '100%', width: '100%' }}
                    totalCount={lineCount}
                    overscan={500}
                    initialTopMostItemIndex={0}
                    rangeChanged={(range) => {
                      // Preload a buffer around visible range
                      const bufferSize = 200
                      const start = Math.max(0, range.startIndex - bufferSize)
                      const end = Math.min(lineCount - 1, range.endIndex + bufferSize)
                      loadLinesRange(start, end)
                    }}
                    itemContent={(index) => {
                      const lineContent = getLineContent(index)
                      return (
                        <div className="px-4 py-0.5 font-mono text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words hover:bg-[var(--bg-hover)]">
                          <span className="inline-block w-12 text-right text-[var(--text-muted)] select-none mr-4">
                            {index + 1}
                          </span>
                          {lineContent || '\u00A0'}
                        </div>
                      )
                    }}
                  />
                ) : (
                  <div className="p-4 text-sm text-[var(--text-muted)] italic">Empty file</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
