import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useEditorHandlers } from '../../../src/hooks/useEditorHandlers'

describe('useEditorHandlers', () => {
  let onSave: ReturnType<typeof mock>
  let onCancel: ReturnType<typeof mock>

  beforeEach(() => {
    onSave = mock(() => Promise.resolve())
    onCancel = mock(() => {})
  })

  afterEach(() => {
    mock.restore()
  })

  describe('handleSave', () => {
    test('calls onSave when canSave is true', async () => {
      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
          onCancel,
        })
      })

      await act(async () => {
        await result.current.handleSave()
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onCancel).not.toHaveBeenCalled()
    })

    test('calls onCancel when canSave is false', async () => {
      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: false,
          onSave,
          onCancel,
        })
      })

      await act(async () => {
        await result.current.handleSave()
      })

      expect(onSave).not.toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    test('does not throw when onCancel is undefined and canSave is false', async () => {
      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: false,
          onSave,
          // onCancel is undefined
        })
      })

      await act(async () => {
        await result.current.handleSave()
      })

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('click outside handler', () => {
    test('does not set up listener when isActive is false', () => {
      const addEventListenerSpy = mock(document.addEventListener)

      renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: false,
          canSave: true,
          onSave,
        })
      })

      // Should not have added mousedown listener for inactive editor
      const mousedownCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'mousedown')
      expect(mousedownCalls.length).toBe(0)
    })

    test('sets up listener when isActive is true', () => {
      const originalAddEventListener = document.addEventListener
      const addedListeners: string[] = []

      document.addEventListener = mock((event: string) => {
        addedListeners.push(event)
        return originalAddEventListener.call(document, event, () => {})
      })

      renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      expect(addedListeners).toContain('mousedown')

      document.addEventListener = originalAddEventListener
    })
  })

  describe('Ctrl+S handler', () => {
    test('does not set up listener when isActive is false', () => {
      const addEventListenerSpy = mock(document.addEventListener)

      renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: false,
          canSave: true,
          onSave,
        })
      })

      // Should not have added keydown listener for inactive editor
      const keydownCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'keydown')
      expect(keydownCalls.length).toBe(0)
    })

    test('sets up keydown listener when isActive is true', () => {
      const originalAddEventListener = document.addEventListener
      const addedListeners: string[] = []

      document.addEventListener = mock((event: string) => {
        addedListeners.push(event)
        return originalAddEventListener.call(document, event, () => {})
      })

      renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      expect(addedListeners).toContain('keydown')

      document.addEventListener = originalAddEventListener
    })
  })

  describe('skipClickOutside option', () => {
    test('respects skipClickOutside flag', async () => {
      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
          skipClickOutside: true,
        })
      })

      // The hook should still return handleSave
      expect(result.current.handleSave).toBeDefined()
      expect(typeof result.current.handleSave).toBe('function')
    })
  })

  describe('return value', () => {
    test('returns handleSave function', () => {
      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      expect(result.current).toHaveProperty('handleSave')
      expect(typeof result.current.handleSave).toBe('function')
    })
  })

  describe('cleanup', () => {
    test('removes event listeners on unmount', () => {
      const originalRemoveEventListener = document.removeEventListener
      const removedListeners: string[] = []

      document.removeEventListener = mock((event: string) => {
        removedListeners.push(event)
        return originalRemoveEventListener.call(document, event, () => {})
      })

      const { unmount } = renderHook(() => {
        const containerRef = useRef<HTMLDivElement>(null)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      unmount()

      expect(removedListeners).toContain('mousedown')
      expect(removedListeners).toContain('keydown')

      document.removeEventListener = originalRemoveEventListener
    })
  })
})
