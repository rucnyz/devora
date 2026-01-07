import { useEffect, useCallback, type RefObject } from 'react'

interface UseEditorHandlersOptions {
  /** Ref to the container element */
  containerRef: RefObject<HTMLElement | null>
  /** Whether the editor is active */
  isActive: boolean
  /** Whether the content is valid for saving */
  canSave: boolean
  /** Save callback */
  onSave: () => Promise<void> | void
  /** Cancel callback (called when clicking outside with invalid content) */
  onCancel?: () => void
  /** Optional condition to skip click-outside handling (e.g., when modal is open) */
  skipClickOutside?: boolean
}

/**
 * Hook to handle common editor behaviors:
 * - Click outside to save/cancel
 * - Ctrl+S to save
 */
export function useEditorHandlers({
  containerRef,
  isActive,
  canSave,
  onSave,
  onCancel,
  skipClickOutside = false,
}: UseEditorHandlersOptions) {
  const handleSave = useCallback(async () => {
    if (canSave) {
      await onSave()
    } else {
      onCancel?.()
    }
  }, [canSave, onSave, onCancel])

  // Click outside handler
  useEffect(() => {
    if (!isActive) return

    const handleClickOutside = async (event: MouseEvent) => {
      if (skipClickOutside) return
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        await handleSave()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isActive, skipClickOutside, containerRef, handleSave])

  // Ctrl+S handler
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && canSave) {
        e.preventDefault()
        e.stopPropagation()
        await onSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isActive, canSave, onSave])

  return { handleSave }
}
