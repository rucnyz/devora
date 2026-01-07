import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api'

export interface FileCard {
  id: string
  project_id: string
  filename: string
  content: string
  position_x: number
  position_y: number
  is_expanded: boolean
  is_minimized: boolean
  z_index: number
  created_at: string
  updated_at: string
}

export function useFileCards(projectId: string) {
  const [cards, setCards] = useState<FileCard[]>([])
  const [maxZIndex, setMaxZIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/projects/${projectId}/file-cards`)
      if (!res.ok) throw new Error('Failed to fetch file cards')
      const data: FileCard[] = await res.json()
      setCards(data)
      setMaxZIndex(Math.max(0, ...data.map((c) => c.z_index)))
    } catch (err) {
      console.error('Failed to fetch file cards:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceRef.current
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const addCard = async (data: { filename: string; content: string; position_x?: number; position_y?: number }) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/file-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create file card')
    const card: FileCard = await res.json()
    setCards((prev) => [...prev, card])
    setMaxZIndex(card.z_index)
    return card
  }

  const updateCard = async (
    id: string,
    updates: Partial<
      Pick<FileCard, 'filename' | 'content' | 'position_x' | 'position_y' | 'is_expanded' | 'is_minimized' | 'z_index'>
    >
  ) => {
    // Optimistic update for smooth dragging
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))

    // Debounce position updates to reduce API calls during drag
    if (updates.position_x !== undefined || updates.position_y !== undefined) {
      if (debounceRef.current[id]) {
        clearTimeout(debounceRef.current[id])
      }
      debounceRef.current[id] = setTimeout(async () => {
        await fetch(`${API_BASE}/file-cards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        delete debounceRef.current[id]
      }, 200)
    } else {
      // For non-position updates, send immediately
      await fetch(`${API_BASE}/file-cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    }
  }

  const deleteCard = async (id: string) => {
    // Clear any pending debounced updates
    if (debounceRef.current[id]) {
      clearTimeout(debounceRef.current[id])
      delete debounceRef.current[id]
    }

    setCards((prev) => prev.filter((c) => c.id !== id))
    await fetch(`${API_BASE}/file-cards/${id}`, { method: 'DELETE' })
  }

  const bringToFront = async (id: string) => {
    const newZ = maxZIndex + 1
    setMaxZIndex(newZ)
    await updateCard(id, { z_index: newZ })
  }

  return { cards, loading, addCard, updateCard, deleteCard, bringToFront, fetchCards }
}
