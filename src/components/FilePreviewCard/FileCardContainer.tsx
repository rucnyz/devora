import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import FilePreviewCard from './index'
import { useFileCards } from '../../hooks/useFileCards'
import { useSetting } from '../../hooks/useSettings.tsx'
import { readFileContent } from '../../api/tauri'

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
  const { value: zoomLevel } = useSetting('zoomLevel')
  // Two-stage drag state: hovering (web event) -> ready (Tauri event)
  const [isHovering, setIsHovering] = useState(false) // Web dragenter triggered
  const [isReady, setIsReady] = useState(false) // Tauri over triggered, can drop now
  const [dragError, setDragError] = useState<string | null>(null)
  const dropPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Store the base scale factor (Windows DPI scale × Text scale, excluding app zoom)
  // This is calculated once on mount and used for position conversion
  const baseScaleRef = useRef<number | null>(null)
  // Use ref to always access latest maxFileSize in event callback
  const maxFileSizeRef = useRef(maxFileSize)
  // Use ref to always access latest zoomLevel in event callback
  const zoomLevelRef = useRef(zoomLevel)

  // Keep refs in sync with latest values
  useEffect(() => {
    maxFileSizeRef.current = maxFileSize
  }, [maxFileSize])

  useEffect(() => {
    zoomLevelRef.current = zoomLevel
  }, [zoomLevel])

  // Clear error after a delay
  useEffect(() => {
    if (dragError) {
      const timer = setTimeout(() => setDragError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [dragError])

  // Initialize base scale factor on mount
  // This captures Windows DPI × Text scale, excluding any app-level zoom
  useEffect(() => {
    const initBaseScale = async () => {
      try {
        const appWindow = getCurrentWindow()
        const scaleFactor = await appWindow.scaleFactor()
        // Calculate text scale ratio from current devicePixelRatio
        // Assuming no app zoom at startup, this gives us Windows DPI × Text scale
        const textScaleRatio = window.devicePixelRatio / scaleFactor
        baseScaleRef.current = scaleFactor * textScaleRatio // = devicePixelRatio at startup
      } catch {
        // Fallback to current devicePixelRatio
        baseScaleRef.current = window.devicePixelRatio
      }
    }
    initBaseScale()
  }, [])

  // Tauri native drag-drop event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    // Helper to get the scale factor for position conversion
    // Uses base scale (Windows DPI × Text scale) to ignore app-level zoom
    const getScaleFactor = async (): Promise<number> => {
      if (baseScaleRef.current !== null) {
        return baseScaleRef.current
      }
      // Fallback: calculate on the fly
      try {
        const appWindow = getCurrentWindow()
        const scaleFactor = await appWindow.scaleFactor()
        const textScaleRatio = window.devicePixelRatio / scaleFactor
        return scaleFactor * textScaleRatio
      } catch {
        return window.devicePixelRatio
      }
    }

    const setupListener = async () => {
      try {
        const webview = getCurrentWebview()
        const unlistenFn = await webview.onDragDropEvent(async (event) => {
          if (event.payload.type === 'over') {
            setIsReady(true) // Now ready to drop
            if (event.payload.position) {
              const baseScale = await getScaleFactor()
              const appWindow = getCurrentWindow()
              // Get titlebar height (difference between inner and outer position)
              const outerPos = await appWindow.outerPosition()
              const innerPos = await appWindow.innerPosition()
              const titleBarHeight = innerPos.y - outerPos.y
              // Get app zoom level (CSS zoom applied to document)
              const appZoom = (zoomLevelRef.current ?? 100) / 100
              const totalScale = baseScale * appZoom
              // Tauri position is window-relative; only Y needs titlebar offset
              dropPositionRef.current = {
                x: event.payload.position.x / totalScale,
                y: (event.payload.position.y - titleBarHeight) / totalScale,
              }
            }
          } else if (event.payload.type === 'leave') {
            setIsHovering(false)
            setIsReady(false)
          } else if (event.payload.type === 'drop') {
            setIsHovering(false)
            setIsReady(false)

            const paths = event.payload.paths
            if (!paths || paths.length === 0) return

            if (event.payload.position) {
              const baseScale = await getScaleFactor()
              const appWindow = getCurrentWindow()
              // Get titlebar height (difference between inner and outer position)
              const outerPos = await appWindow.outerPosition()
              const innerPos = await appWindow.innerPosition()
              const titleBarHeight = innerPos.y - outerPos.y

              // Get app zoom level (CSS zoom applied to document)
              const appZoom = (zoomLevelRef.current ?? 100) / 100
              const totalScale = baseScale * appZoom

              // Tauri position is window-relative; only Y needs titlebar offset
              dropPositionRef.current = {
                x: event.payload.position.x / totalScale,
                y: (event.payload.position.y - titleBarHeight) / totalScale,
              }
            }

            // Process only the first file
            const filePath = paths[0]

            try {
              const currentMaxSize = maxFileSizeRef.current
              const { filename, content } = await readFileContent(filePath!, currentMaxSize)

              // Check if content is text (not binary)
              if (!isTextContent(content)) {
                setDragError('Binary files are not supported')
                return
              }

              // Position card at drop location
              const pixelX = Math.max(0, dropPositionRef.current.x - 140)
              const pixelY = Math.max(0, dropPositionRef.current.y - 20)
              const percentX = (pixelX / window.innerWidth) * 100
              const percentY = (pixelY / window.innerHeight) * 100

              await addCard({
                filename,
                file_path: filePath!,
                position_x: percentX,
                position_y: percentY,
              })
            } catch (err) {
              console.error('Failed to read/add file:', err)
              const errMsg = err instanceof Error ? err.message : String(err)
              if (errMsg.includes('too large')) {
                setDragError(`File too large. Max: ${formatFileSize(maxFileSizeRef.current)}`)
              } else if (errMsg.includes('Failed to read file')) {
                setDragError('Cannot read file (binary or encoding issue)')
              } else {
                setDragError(`Failed: ${errMsg}`)
              }
            }
          }
        })
        // If cleanup was called while we were setting up, clean up immediately
        if (cancelled) {
          unlistenFn()
        } else {
          unlisten = unlistenFn
        }
      } catch (err) {
        console.error('Failed to setup drag-drop listener:', err)
      }
    }

    setupListener()

    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [addCard])

  // Use portal to render at body level, avoiding parent transform issues with fixed positioning
  const showOverlay = isHovering || isReady

  // Listen for drag events on document level for reliable detection
  useEffect(() => {
    const handleDocDragEnter = (e: DragEvent) => {
      e.preventDefault()
      setIsHovering(true)
    }

    const handleDocDragOver = (e: DragEvent) => {
      // Must call preventDefault to allow drop
      e.preventDefault()
      dropPositionRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleDocDragLeave = (e: DragEvent) => {
      // Only reset if leaving the window entirely (relatedTarget is null)
      if (!e.relatedTarget) {
        setIsHovering(false)
        setIsReady(false)
      }
    }

    document.addEventListener('dragenter', handleDocDragEnter)
    document.addEventListener('dragover', handleDocDragOver)
    document.addEventListener('dragleave', handleDocDragLeave)

    return () => {
      document.removeEventListener('dragenter', handleDocDragEnter)
      document.removeEventListener('dragover', handleDocDragOver)
      document.removeEventListener('dragleave', handleDocDragLeave)
    }
  }, [])

  return createPortal(
    <>
      {/* Visual feedback overlay - two states: hovering (waiting) and ready (can drop) */}
      {/* Note: Actual drop is handled by Tauri native onDragDropEvent */}
      <div className={`fixed inset-0 z-40 pointer-events-none ${showOverlay ? 'opacity-100' : 'opacity-0'}`}>
        <div
          className={`absolute inset-4 border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-150 ${
            isReady
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 backdrop-blur-sm'
              : 'border-[var(--text-muted)] bg-[var(--bg-tertiary)]/50'
          }`}
        >
          <div className="text-center">
            {isReady ? (
              <>
                {/* Ready state - can drop now */}
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-[var(--accent-primary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg font-mono text-[var(--accent-primary)]">Release to drop</span>
                <p className="text-sm text-[var(--text-muted)] mt-1">Max {formatFileSize(maxFileSize)}</p>
              </>
            ) : (
              <>
                {/* Hovering state - waiting for system to recognize */}
                <div className="w-8 h-8 mx-auto mb-3 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                <span className="text-lg font-mono text-[var(--text-muted)]">Hold to prepare drop...</span>
                <p className="text-xs text-[var(--text-muted)] mt-1">Wait for confirmation</p>
              </>
            )}
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
