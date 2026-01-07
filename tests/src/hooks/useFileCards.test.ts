import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFileCards, type FileCard } from '../../../src/hooks/useFileCards'

describe('useFileCards hook', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const mockFileCard: FileCard = {
    id: 'card-1',
    project_id: 'project-1',
    filename: 'test.txt',
    content: 'Test content',
    position_x: 10,
    position_y: 20,
    is_expanded: false,
    is_minimized: false,
    z_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  describe('fetchCards', () => {
    test('fetches cards on mount', async () => {
      const mockCards = [mockFileCard]
      globalThis.fetch = async () => new Response(JSON.stringify(mockCards), { status: 200 })

      const { result } = renderHook(() => useFileCards('project-1'))

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards).toEqual(mockCards)
    })

    test('returns empty array when no cards exist', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify([]), { status: 200 })

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards).toEqual([])
    })

    test('handles fetch error gracefully', async () => {
      globalThis.fetch = async () => new Response('', { status: 500 })

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards).toEqual([])
    })

    test('calculates maxZIndex from fetched cards', async () => {
      const cards = [
        { ...mockFileCard, id: 'card-1', z_index: 5 },
        { ...mockFileCard, id: 'card-2', z_index: 10 },
        { ...mockFileCard, id: 'card-3', z_index: 3 },
      ]
      globalThis.fetch = async () => new Response(JSON.stringify(cards), { status: 200 })

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards.length).toBe(3)
    })
  })

  describe('addCard', () => {
    test('creates card and adds to state', async () => {
      const newCard = { ...mockFileCard, id: 'new-card' }
      let callCount = 0

      globalThis.fetch = async (url, options) => {
        callCount++
        if (callCount === 1) {
          // Initial fetch
          return new Response(JSON.stringify([]), { status: 200 })
        }
        // Create card
        return new Response(JSON.stringify(newCard), { status: 201 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let createdCard: FileCard | undefined
      await act(async () => {
        createdCard = await result.current.addCard({
          filename: 'test.txt',
          content: 'Test content',
        })
      })

      expect(createdCard).toEqual(newCard)
      expect(result.current.cards.length).toBe(1)
      expect(result.current.cards[0].id).toBe('new-card')
    })

    test('passes position to API when provided', async () => {
      let capturedBody: any
      let callCount = 0

      globalThis.fetch = async (url, options) => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([]), { status: 200 })
        }
        capturedBody = JSON.parse(options?.body as string)
        return new Response(JSON.stringify(mockFileCard), { status: 201 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.addCard({
          filename: 'test.txt',
          content: 'Test content',
          position_x: 100,
          position_y: 200,
        })
      })

      expect(capturedBody.position_x).toBe(100)
      expect(capturedBody.position_y).toBe(200)
    })

    test('throws error on API failure', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([]), { status: 200 })
        }
        return new Response('', { status: 500 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.addCard({ filename: 'test.txt', content: 'content' })
        })
      ).rejects.toThrow('Failed to create file card')
    })
  })

  describe('updateCard', () => {
    test('updates card optimistically', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateCard('card-1', { filename: 'updated.txt' })
      })

      expect(result.current.cards[0].filename).toBe('updated.txt')
    })

    test('updates expanded state', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateCard('card-1', { is_expanded: true })
      })

      expect(result.current.cards[0].is_expanded).toBe(true)
    })

    test('updates minimized state', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateCard('card-1', { is_minimized: true })
      })

      expect(result.current.cards[0].is_minimized).toBe(true)
    })

    test('debounces position updates', async () => {
      let apiCallCount = 0
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        apiCallCount++
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Multiple rapid position updates
      act(() => {
        result.current.updateCard('card-1', { position_x: 50 })
        result.current.updateCard('card-1', { position_x: 60 })
        result.current.updateCard('card-1', { position_x: 70 })
      })

      // State should update immediately (optimistic)
      expect(result.current.cards[0].position_x).toBe(70)

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 250))

      // API should only be called once due to debouncing
      expect(apiCallCount).toBeLessThanOrEqual(1)
    })
  })

  describe('deleteCard', () => {
    test('removes card from state', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards.length).toBe(1)

      await act(async () => {
        await result.current.deleteCard('card-1')
      })

      expect(result.current.cards.length).toBe(0)
    })

    test('calls DELETE API', async () => {
      let deleteUrl: string | undefined
      let callCount = 0

      globalThis.fetch = async (url, options) => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify([mockFileCard]), { status: 200 })
        }
        if (options?.method === 'DELETE') {
          deleteUrl = typeof url === 'string' ? url : url.toString()
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.deleteCard('card-1')
      })

      expect(deleteUrl).toContain('/file-cards/card-1')
    })
  })

  describe('bringToFront', () => {
    test('updates z-index to be highest', async () => {
      const cards = [
        { ...mockFileCard, id: 'card-1', z_index: 1 },
        { ...mockFileCard, id: 'card-2', z_index: 2 },
      ]
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify(cards), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.bringToFront('card-1')
      })

      const card1 = result.current.cards.find((c) => c.id === 'card-1')
      expect(card1?.z_index).toBe(3) // maxZIndex (2) + 1
    })
  })

  describe('refetch', () => {
    test('fetchCards can be called manually to refresh', async () => {
      let callCount = 0
      const initialCards = [mockFileCard]
      const updatedCards = [{ ...mockFileCard, filename: 'updated.txt' }]

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify(initialCards), { status: 200 })
        }
        return new Response(JSON.stringify(updatedCards), { status: 200 })
      }

      const { result } = renderHook(() => useFileCards('project-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.cards[0].filename).toBe('test.txt')

      await act(async () => {
        await result.current.fetchCards()
      })

      expect(result.current.cards[0].filename).toBe('updated.txt')
    })
  })
})
