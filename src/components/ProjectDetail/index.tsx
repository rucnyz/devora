import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProject, fetchSSHHosts, fetchUrlMetadata } from '../../hooks/useProjects'
import SectionNavigation from './SectionNavigation'
import ProjectHeader from './ProjectHeader'
import WorkingDirsSection from './WorkingDirsSection'
import IDESection from './IDESection'
import RemoteIDESection from './RemoteIDESection'
import FileSection from './FileSection'
import CommandSection from './CommandSection'
import LinksSection from './LinksSection'
import NotesSection from './NotesSection'
import type { IdeType, RemoteIdeType, CommandMode, WorkingDir } from '../../types'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading, error, addItem, updateItem, deleteItem, updateProject } = useProject(id!)

  // SSH hosts from ~/.ssh/config
  const [sshHosts, setSSHHosts] = useState<string[]>([])

  // Creating states for each section
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [isCreatingIde, setIsCreatingIde] = useState(false)
  const [isCreatingRemoteIde, setIsCreatingRemoteIde] = useState(false)
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingCommand, setIsCreatingCommand] = useState(false)

  // Fetch SSH hosts
  useEffect(() => {
    fetchSSHHosts().then(setSSHHosts)
  }, [])

  // Helper: detect if text is a file path
  const isFilePath = useCallback((text: string): boolean => {
    // Windows absolute path: C:\, D:\, etc.
    if (/^[A-Za-z]:[/\\]/.test(text)) return true
    // Unix absolute path: /home/..., /Users/...
    if (/^\/[^/]/.test(text)) return true
    // Home directory: ~/...
    if (/^~[/\\]/.test(text)) return true
    return false
  }, [])

  // Helper: quick add URL with metadata fetch
  const quickAddUrl = useCallback(async (url: string) => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    try {
      const urlObj = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      const lastSegment = pathParts[pathParts.length - 1]
      let fallbackTitle = lastSegment ? decodeURIComponent(lastSegment) : urlObj.hostname

      // Special handling for Notion URLs
      if (urlObj.hostname.includes('notion.so') && lastSegment) {
        const notionMatch = lastSegment.match(/^(.+)-[a-f0-9]{32}$/i)
        if (notionMatch) {
          fallbackTitle = 'Notion - ' + notionMatch[1].replace(/-/g, ' ')
        }
      }

      const newItem = await addItem('url', fallbackTitle, urlObj.href)

      // Fetch metadata in background (skip for Notion)
      if (!urlObj.hostname.includes('notion.so')) {
        fetchUrlMetadata(urlObj.href).then(metaTitle => {
          if (metaTitle && metaTitle !== fallbackTitle) {
            updateItem(newItem.id, { title: metaTitle })
          }
        })
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [addItem, updateItem])

  // Helper: quick add working directory from path
  const quickAddWorkingDir = useCallback(async (path: string) => {
    if (!project) return
    const trimmedPath = path.trim()
    if (!trimmedPath) return

    const existingDirs = project.metadata.working_dirs || []
    // Check if path already exists
    if (existingDirs.some(d => d.path === trimmedPath)) return

    // Extract folder name from path
    const name = trimmedPath.split(/[/\\]/).filter(Boolean).pop() || trimmedPath

    const newDirs: WorkingDir[] = [...existingDirs, { name, path: trimmedPath }]
    await updateProject({
      metadata: {
        ...project.metadata,
        working_dirs: newDirs,
      },
    })
  }, [project, updateProject])

  // Global paste handler: URL -> Links, File path -> Working Dirs
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      const isEditing = activeEl instanceof HTMLInputElement ||
                        activeEl instanceof HTMLTextAreaElement ||
                        activeEl?.getAttribute('contenteditable') === 'true'

      if (isEditing) return

      const text = e.clipboardData?.getData('text')?.trim()
      if (!text) return

      const urlPattern = /^(https?:\/\/|www\.)/i
      if (urlPattern.test(text)) {
        e.preventDefault()
        await quickAddUrl(text)
      } else if (isFilePath(text)) {
        e.preventDefault()
        await quickAddWorkingDir(text)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [isFilePath, quickAddUrl, quickAddWorkingDir])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-[var(--text-muted)]">Loading project...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="px-4 py-3 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 rounded-lg">
          <span className="font-mono text-[var(--accent-danger)]">Error: {error}</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="font-mono text-[var(--text-muted)]">Project not found</span>
      </div>
    )
  }

  // Filter items by type
  const notes = project.items?.filter((i) => i.type === 'note') || []
  const ideItems = project.items?.filter((i) => i.type === 'ide') || []
  const remoteIdeItems = project.items?.filter((i) => i.type === 'remote-ide') || []
  const fileItems = project.items?.filter((i) => i.type === 'file') || []
  const urlItems = project.items?.filter((i) => i.type === 'url') || []
  const commandItems = project.items?.filter((i) => i.type === 'command') || []

  // Navigation items - only show sections that have content or are being created
  // Colors use CSS variables for consistency with the color system
  const navItems = [
    { id: 'section-apps', label: 'IDE', show: ideItems.length > 0 || isCreatingIde, color: 'var(--accent-primary)' },
    { id: 'section-remote', label: 'Remote', show: remoteIdeItems.length > 0 || isCreatingRemoteIde, color: 'var(--accent-remote)' },
    { id: 'section-files', label: 'Open', show: fileItems.length > 0 || isCreatingFile, color: 'var(--text-secondary)' },
    { id: 'section-commands', label: 'Commands', show: commandItems.length > 0 || isCreatingCommand, color: 'var(--accent-warning)' },
    { id: 'section-links', label: 'Links', show: true, color: 'var(--accent-secondary)' },
    { id: 'section-notes', label: 'Notes', show: true, color: 'var(--accent-warning)' },
  ].filter(item => item.show)

  // Handler functions for adding items
  const handleAddNote = async (title: string, content?: string) => {
    await addItem('note', title, content)
  }

  const handleAddIde = async (title: string, path: string, ideType: IdeType) => {
    await addItem('ide', title, path, ideType)
  }

  const handleAddRemoteIde = async (title: string, content: string, remoteIdeType: RemoteIdeType) => {
    await addItem('remote-ide', title, content, undefined, remoteIdeType)
  }

  const handleAddFile = async (title: string, path: string) => {
    await addItem('file', title, path)
  }

  const handleAddUrl = async (title: string, url: string) => {
    return await addItem('url', title, url)
  }

  const handleAddCommand = async (title: string, command: string, mode: CommandMode, cwd?: string, host?: string) => {
    await addItem('command', title, command, undefined, undefined, mode, cwd, host)
  }

  const handleUpdateWorkingDirs = async (dirs: WorkingDir[]) => {
    await updateProject({
      metadata: {
        ...project.metadata,
        working_dirs: dirs,
      },
    })
  }

  return (
    <div className="animate-card-enter relative">
      {/* Side Navigation */}
      <SectionNavigation items={navItems} />

      {/* Back navigation */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-mono text-[var(--text-muted)] hover:text-[var(--accent-primary)] mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        back to projects
      </Link>

      {/* Project Header */}
      <ProjectHeader
        project={project}
        onUpdate={updateProject}
        onCreateNote={() => setIsCreatingNote(true)}
        onCreateIde={() => setIsCreatingIde(true)}
        onCreateRemoteIde={() => setIsCreatingRemoteIde(true)}
        onCreateFile={() => setIsCreatingFile(true)}
        onCreateCommand={() => setIsCreatingCommand(true)}
      />

      {/* Working Dirs Section */}
      <WorkingDirsSection
        workingDirs={project.metadata.working_dirs || []}
        sshHosts={sshHosts}
        ideItems={ideItems}
        remoteIdeItems={remoteIdeItems}
        fileItems={fileItems}
        commandItems={commandItems}
        onUpdate={handleUpdateWorkingDirs}
      />

      {/* IDE Section */}
      <IDESection
        items={ideItems}
        isCreating={isCreatingIde}
        workingDirs={project.metadata.working_dirs || []}
        onAdd={handleAddIde}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingIde}
      />

      {/* Remote IDE Section */}
      <RemoteIDESection
        items={remoteIdeItems}
        isCreating={isCreatingRemoteIde}
        sshHosts={sshHosts}
        workingDirs={project.metadata.working_dirs || []}
        onAdd={handleAddRemoteIde}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingRemoteIde}
      />

      {/* File Section */}
      <FileSection
        items={fileItems}
        isCreating={isCreatingFile}
        onAdd={handleAddFile}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingFile}
      />

      {/* Command Section */}
      <CommandSection
        items={commandItems}
        isCreating={isCreatingCommand}
        workingDirs={project.metadata.working_dirs || []}
        sshHosts={sshHosts}
        onAdd={handleAddCommand}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingCommand}
      />

      {/* Links Section */}
      <LinksSection
        urls={urlItems}
        onAdd={handleAddUrl}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />

      {/* Notes Section */}
      <NotesSection
        notes={notes}
        isCreating={isCreatingNote}
        onAdd={handleAddNote}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingNote}
      />
    </div>
  )
}
