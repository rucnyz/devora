import { useState, useEffect, useCallback } from 'react'
import type { Project, Item, ItemType, IdeType, RemoteIdeType, CommandMode, ProjectMetadata } from '../types'

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

  const fetchProject = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const res = await fetch(`${API_BASE}/projects/${id}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      const data = await res.json()
      setProject(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const addItem = async (
    type: ItemType,
    title: string,
    content?: string,
    ideType?: IdeType,
    remoteIdeType?: RemoteIdeType,
    commandMode?: CommandMode,
    commandCwd?: string
  ) => {
    const res = await fetch(`${API_BASE}/projects/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title,
        content,
        ide_type: ideType,
        remote_ide_type: remoteIdeType,
        command_mode: commandMode,
        command_cwd: commandCwd,
      }),
    })
    if (!res.ok) throw new Error('Failed to add item')
    const item = await res.json()
    await fetchProject(false)
    return item as Item
  }

  const updateItem = async (itemId: string, updates: Partial<Pick<Item, 'title' | 'content' | 'ide_type' | 'remote_ide_type' | 'command_mode' | 'command_cwd'>>) => {
    const res = await fetch(`${API_BASE}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update item')
    await fetchProject(false)
  }

  const deleteItem = async (itemId: string) => {
    const res = await fetch(`${API_BASE}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete item')
    await fetchProject(false)
  }

  const updateProject = async (updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update project')
    await fetchProject(false)
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

export async function selectFolder(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/open/select-folder`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to open folder picker')
  const data = await res.json()
  return data.path || null
}

export async function selectFile(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/open/select-file`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to open file picker')
  const data = await res.json()
  return data.path || null
}

export async function openRemoteIde(remoteIdeType: RemoteIdeType, host: string, path: string) {
  const res = await fetch(`${API_BASE}/open/remote-ide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remote_ide_type: remoteIdeType, host, path }),
  })
  if (!res.ok) throw new Error('Failed to open remote IDE')
}

export async function fetchSSHHosts(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/open/ssh-hosts`)
  if (!res.ok) return []
  const data = await res.json()
  return data.hosts || []
}

export interface RemoteDirEntry {
  name: string
  isDir: boolean
}

export interface RemoteDirResult {
  path: string
  entries: RemoteDirEntry[]
}

export async function listRemoteDir(host: string, path: string = '~'): Promise<RemoteDirResult> {
  const res = await fetch(`${API_BASE}/open/ssh/list-dir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, path }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to list remote directory')
  }
  return res.json()
}

export async function fetchUrlMetadata(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/open/url-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.title || null
  } catch {
    return null
  }
}

export interface CommandResult {
  success: boolean
  output?: string
  error?: string
  exitCode?: number
}

export async function runCommand(command: string, mode: CommandMode, cwd?: string): Promise<CommandResult> {
  const res = await fetch(`${API_BASE}/open/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, mode, cwd }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to run command')
  }
  return res.json()
}
