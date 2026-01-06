import { useState, useEffect, useCallback } from 'react'
import type { Project, Item, ItemType, IdeType, ProjectMetadata } from '../types'

const API_BASE = '/api'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/projects`)
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (name: string, description?: string, metadata?: ProjectMetadata) => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, metadata }),
    })
    if (!res.ok) throw new Error('Failed to create project')
    const project = await res.json()
    setProjects((prev) => [project, ...prev])
    return project
  }

  const updateProject = async (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update project')
    const project = await res.json()
    setProjects((prev) => prev.map((p) => (p.id === id ? project : p)))
    return project
  }

  const deleteProject = async (id: string) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete project')
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return { projects, loading, error, fetchProjects, createProject, updateProject, deleteProject }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/projects/${id}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      const data = await res.json()
      setProject(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const addItem = async (type: ItemType, title: string, content?: string, ideType?: IdeType) => {
    const res = await fetch(`${API_BASE}/projects/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, content, ide_type: ideType }),
    })
    if (!res.ok) throw new Error('Failed to add item')
    await fetchProject()
  }

  const updateItem = async (itemId: string, updates: Partial<Pick<Item, 'title' | 'content' | 'ide_type'>>) => {
    const res = await fetch(`${API_BASE}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update item')
    await fetchProject()
  }

  const deleteItem = async (itemId: string) => {
    const res = await fetch(`${API_BASE}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete item')
    await fetchProject()
  }

  const updateProject = async (updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update project')
    await fetchProject()
  }

  return { project, loading, error, fetchProject, addItem, updateItem, deleteItem, updateProject }
}

export async function openIde(ideType: IdeType, path: string) {
  const res = await fetch(`${API_BASE}/open/ide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ide_type: ideType, path }),
  })
  if (!res.ok) throw new Error('Failed to open IDE')
}

export async function openFile(path: string) {
  const res = await fetch(`${API_BASE}/open/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('Failed to open file')
}
