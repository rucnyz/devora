import { useState, useEffect, useCallback } from 'react'
import * as api from '../api/tauri'

export function useTodos(projectId: string) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchTodos = useCallback(async () => {
    try {
      const todos = await api.getProjectTodos(projectId)
      setContent(todos)
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchTodos()
  }, [fetchTodos])

  const saveTodos = useCallback(
    async (newContent: string) => {
      try {
        await api.setProjectTodos(projectId, newContent)
        setContent(newContent)
      } catch (error) {
        console.error('Failed to save todos:', error)
        throw error
      }
    },
    [projectId]
  )

  return {
    content,
    loading,
    saveTodos,
    refreshTodos: fetchTodos,
  }
}
