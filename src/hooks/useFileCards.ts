import { useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../api/tauri'

export type { FileCard } from '../api/tauri'
import type { FileCard } from '../api/tauri'

export function useFileCards(projectId: string) {
  const [cards, setCards] = useState<FileCard[]>([])
  const [maxZIndex, setMaxZIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getFileCards(projectId)
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

  const addCard = useCallback(
    async (data: { filename: string; file_path: string; position_x?: number; position_y?: number }) => {
      const card = await api.createFileCard(projectId, data.filename, data.file_path, data.position_x, data.position_y)
      setCards((prev) => [...prev, card])
      setMaxZIndex(card.z_index)
      return card
    },
    [projectId]
  )

  const updateCard = async (
    id: string,
    updates: Partial<
      Pick<
        FileCard,
        'filename' | 'file_path' | 'position_x' | 'position_y' | 'is_expanded' | 'is_minimized' | 'z_index'
      >
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
        await api.updateFileCard(id, updates)
        delete debounceRef.current[id]
      }, 200)
    } else {
      // For non-position updates, send immediately
      await api.updateFileCard(id, updates)
    }
  }

  const deleteCard = async (id: string) => {
    // Clear any pending debounced updates
    if (debounceRef.current[id]) {
      clearTimeout(debounceRef.current[id])
      delete debounceRef.current[id]
    }

    setCards((prev) => prev.filter((c) => c.id !== id))
    await api.deleteFileCard(id)
  }

  const bringToFront = async (id: string) => {
    const newZ = maxZIndex + 1
    setMaxZIndex(newZ)
    await updateCard(id, { z_index: newZ })
  }

  return { cards, loading, addCard, updateCard, deleteCard, bringToFront, fetchCards }
}
