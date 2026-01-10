import { useState, useEffect, useCallback } from 'react'
import * as api from '../api/tauri'
import type { TodoItem, TodoProgress } from '../types'

export function useTodos(projectId: string) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [progress, setProgress] = useState<TodoProgress>({ total: 0, completed: 0, percentage: 0 })
  const [loading, setLoading] = useState(true)

  const fetchTodos = useCallback(async () => {
    try {
      const [items, prog] = await Promise.all([api.getTodos(projectId), api.getTodoProgress(projectId)])
      setTodos(items)
      setProgress(prog)
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const addTodo = async (content: string, indentLevel?: number) => {
    const todo = await api.createTodo(projectId, content, indentLevel)
    await fetchTodos()
    return todo
  }

  const updateTodo = async (
    id: string,
    updates: Partial<Pick<TodoItem, 'content' | 'completed' | 'indent_level' | 'order'>>
  ) => {
    await api.updateTodo(id, updates)
    await fetchTodos()
  }

  const toggleComplete = async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      await api.updateTodo(id, { completed: !todo.completed })
      await fetchTodos()
    }
  }

  const removeTodo = async (id: string) => {
    await api.deleteTodo(id)
    await fetchTodos()
  }

  const reorderTodos = async (todoIds: string[]) => {
    // Optimistic update
    const reordered = todoIds.map((id, i) => {
      const todo = todos.find((t) => t.id === id)!
      return { ...todo, order: i }
    })
    setTodos(reordered)
    await api.reorderTodos(projectId, todoIds)
  }

  const changeIndent = async (id: string, delta: number) => {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      const newLevel = Math.max(0, Math.min(3, todo.indent_level + delta))
      if (newLevel !== todo.indent_level) {
        await api.updateTodo(id, { indent_level: newLevel })
        await fetchTodos()
      }
    }
  }

  return {
    todos,
    progress,
    loading,
    addTodo,
    updateTodo,
    toggleComplete,
    deleteTodo: removeTodo,
    reorderTodos,
    changeIndent,
    refreshTodos: fetchTodos,
  }
}
