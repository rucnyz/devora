import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useEditorHandlers } from '../../../src/hooks/useEditorHandlers'
import { useRef } from 'react'

describe('useEditorHandlers', () => {
  let container: HTMLDivElement
  let outsideElement: HTMLDivElement

  beforeEach(() => {
    // Create DOM elements for testing
    container = document.createElement('div')
    container.id = 'editor-container'
    document.body.appendChild(container)

    outsideElement = document.createElement('div')
    outsideElement.id = 'outside'
    document.body.appendChild(outsideElement)
  })

  afterEach(() => {
    document.body.removeChild(container)
    document.body.removeChild(outsideElement)
  })

  describe('handleSave', () => {
    test('calls onSave when canSave is true', async () => {
      const onSave = mock(() => Promise.resolve())
      const onCancel = mock(() => {})

      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
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
      const onSave = mock(() => Promise.resolve())
      const onCancel = mock(() => {})

      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
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

    test('does not call onCancel if not provided', async () => {
      const onSave = mock(() => Promise.resolve())

      const { result } = renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: false,
          onSave,
        })
      })

      // Should not throw
      await act(async () => {
        await result.current.handleSave()
      })

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('click outside handler', () => {
    test('triggers handleSave when clicking outside container', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      // Simulate click outside
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        outsideElement.dispatchEvent(event)
      })

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onSave).toHaveBeenCalled()
    })

    test('does not trigger when clicking inside container', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      // Simulate click inside
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        container.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('does not trigger when isActive is false', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: false,
          canSave: true,
          onSave,
        })
      })

      // Simulate click outside
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        outsideElement.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('does not trigger when skipClickOutside is true', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
          skipClickOutside: true,
        })
      })

      // Simulate click outside
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        outsideElement.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('calls onCancel when clicking outside with canSave false', async () => {
      const onSave = mock(() => Promise.resolve())
      const onCancel = mock(() => {})

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: false,
          onSave,
          onCancel,
        })
      })

      // Simulate click outside
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        outsideElement.dispatchEvent(event)
      })

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onSave).not.toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('Ctrl+S handler', () => {
    test('triggers onSave on Ctrl+S when canSave is true', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      // Simulate Ctrl+S
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).toHaveBeenCalled()
    })

    test('triggers onSave on Cmd+S (Mac) when canSave is true', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      // Simulate Cmd+S (Mac)
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          metaKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).toHaveBeenCalled()
    })

    test('does not trigger onSave when canSave is false', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: false,
          onSave,
        })
      })

      // Simulate Ctrl+S
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('does not trigger when isActive is false', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: false,
          canSave: true,
          onSave,
        })
      })

      // Simulate Ctrl+S
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('does not trigger on regular S key without modifier', async () => {
      const onSave = mock(() => Promise.resolve())

      renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      // Simulate regular S key
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    test('removes event listeners on unmount', async () => {
      const onSave = mock(() => Promise.resolve())

      const { unmount } = renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      unmount()

      // Simulate click outside after unmount
      await act(async () => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        outsideElement.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    test('removes keyboard listener on unmount', async () => {
      const onSave = mock(() => Promise.resolve())

      const { unmount } = renderHook(() => {
        const containerRef = useRef<HTMLElement>(container)
        return useEditorHandlers({
          containerRef,
          isActive: true,
          canSave: true,
          onSave,
        })
      })

      unmount()

      // Simulate Ctrl+S after unmount
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('re-renders', () => {
    test('updates handlers when canSave changes', async () => {
      const onSave = mock(() => Promise.resolve())
      let canSave = false

      const { rerender } = renderHook(
        () => {
          const containerRef = useRef<HTMLElement>(container)
          return useEditorHandlers({
            containerRef,
            isActive: true,
            canSave,
            onSave,
          })
        }
      )

      // Ctrl+S should not work initially
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).not.toHaveBeenCalled()

      // Change canSave to true
      canSave = true
      rerender()

      // Now Ctrl+S should work
      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      })

      expect(onSave).toHaveBeenCalled()
    })
  })
})
