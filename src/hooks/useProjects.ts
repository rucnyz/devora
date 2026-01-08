import { useState, useEffect, useCallback } from 'react'
import type { Project, Item, ItemType, CommandMode, ProjectMetadata } from '../types'
import * as api from '../api/tauri'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getProjects()
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
    const project = await api.createProject(name, description, metadata)
    setProjects((prev) => [project, ...prev])
    return project
  }

  const updateProject = async (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>) => {
    const project = await api.updateProject(id, updates)
    if (project) {
      setProjects((prev) => prev.map((p) => (p.id === id ? project : p)))
    }
    return project
  }

  const deleteProject = async (id: string) => {
    await api.deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return { projects, loading, error, fetchProjects, createProject, updateProject, deleteProject }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true)
        const data = await api.getProject(id)
        setProject(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (showLoading) setLoading(false)
      }
    },
    [id]
  )

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const addItem = async (
    type: ItemType,
    title: string,
    content?: string,
    ideType?: string, // Can be built-in IdeType or custom IDE id
    remoteIdeType?: string, // Can be built-in RemoteIdeType or custom remote IDE id
    commandMode?: CommandMode,
    commandCwd?: string,
    commandHost?: string
  ) => {
    const item = await api.createItem(
      id,
      type,
      title,
      content,
      ideType,
      remoteIdeType,
      commandMode,
      commandCwd,
      commandHost
    )
    await fetchProject(false)
    return item
  }

  const updateItem = async (
    itemId: string,
    updates: Partial<
      Pick<Item, 'title' | 'content' | 'ide_type' | 'remote_ide_type' | 'command_mode' | 'command_cwd' | 'command_host'>
    >
  ) => {
    await api.updateItem(itemId, updates)
    await fetchProject(false)
  }

  const deleteItem = async (itemId: string) => {
    await api.deleteItem(itemId)
    await fetchProject(false)
  }

  const updateProject = async (updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>) => {
    await api.updateProject(id, updates)
    await fetchProject(false)
  }

  const reorderItems = async (itemIds: string[]) => {
    // Optimistic update - reorder items locally first
    if (project?.items) {
      const itemMap = new Map(project.items.map((item) => [item.id, item]))
      const reorderedItems = itemIds
        .map((id) => itemMap.get(id))
        .filter((item): item is Item => item !== undefined)
        .map((item, index) => ({ ...item, order: index }))
      // Keep items not in itemIds (other types) in their original positions
      const otherItems = project.items.filter((item) => !itemIds.includes(item.id))
      setProject({
        ...project,
        items: [...reorderedItems, ...otherItems].sort((a, b) => a.order - b.order),
      })
    }

    // Send to backend (no need to refetch)
    await api.reorderItems(id, itemIds)
  }

  return { project, loading, error, fetchProject, addItem, updateItem, deleteItem, updateProject, reorderItems }
}

// Re-export system operations from API
export const openIde = api.openIde
export const openCustomIde = api.openCustomIde
export const openFile = api.openFile
export const selectFolder = api.selectFolder
export const selectFile = api.selectFile
export const openRemoteIde = api.openRemoteIde
export const fetchSSHHosts = api.getSSHHosts
export const fetchUrlMetadata = api.fetchUrlMetadata

// Remote directory types - re-export with compatible names
export interface RemoteDirEntry {
  name: string
  isDir: boolean
}

export interface RemoteDirResult {
  path: string
  entries: RemoteDirEntry[]
}

export async function listRemoteDir(host: string, path: string = '~'): Promise<RemoteDirResult> {
  const result = await api.listRemoteDir(host, path)
  return {
    path: result.current_path,
    entries: result.entries.map((e) => ({ name: e.name, isDir: e.is_dir })),
  }
}

// Command result type - re-export with compatible structure
export interface CommandResult {
  success: boolean
  output?: string
  error?: string
  exitCode?: number
}

export async function runCommand(
  command: string,
  mode: CommandMode,
  cwd?: string,
  host?: string
): Promise<CommandResult> {
  const result = await api.runCommand(command, mode, cwd, host)
  return {
    success: result.exit_code === 0,
    output: result.stdout,
    error: result.stderr,
    exitCode: result.exit_code,
  }
}
