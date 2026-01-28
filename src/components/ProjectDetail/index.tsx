import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useProject, fetchSSHHosts, fetchUrlMetadata } from '../../hooks/useProjects'
import { useSetting } from '../../hooks/useSettings'
import { useProjectState, getProjectState } from '../../hooks/useProjectState'
import SectionNavigation from './SectionNavigation'
import ProjectHeader from './ProjectHeader'
import WorkingDirsSection from './WorkingDirsSection'
import IDESection from './IDESection'
import RemoteIDESection from './RemoteIDESection'
import CodingAgentSection from './CodingAgentSection'
import FileSection from './FileSection'
import CommandSection from './CommandSection'
import LinksSection from './LinksSection'
import NotesSection from './NotesSection'
import SortableSection from './SortableSection'
import FileCardContainer from '../FilePreviewCard/FileCardContainer'
import Sidebar from '../Sidebar'
import TodoDrawer from '../TodoDrawer'
import { useTodos } from '../../hooks/useTodos'
import {
  DEFAULT_SECTION_ORDER,
  type CodingAgentType,
  type CommandMode,
  type WorkingDir,
  type SectionKey,
} from '../../types'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading, error, addItem, updateItem, deleteItem, updateProject, reorderItems, fetchProject } =
    useProject(id!)
  const { value: codingAgentGlobalEnv } = useSetting('codingAgentGlobalEnv')

  // Project state persistence (scroll position, todo drawer state)
  const { restoreScrollPosition, setTodoDrawerOpen: saveTodoDrawerState } = useProjectState(id)

  // Get initial state for this project
  const initialState = id ? getProjectState(id) : null

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Todo drawer state - initialize from saved state
  const [todoDrawerOpen, setTodoDrawerOpen] = useState(() => initialState?.todoDrawerOpen ?? false)
  const {
    todos,
    progress: todoProgress,
    loading: todosLoading,
    addTodo,
    toggleComplete,
    deleteTodo: removeTodo,
    reorderTodos,
    changeIndent,
    updateTodo,
  } = useTodos(id!)

  // SSH hosts from ~/.ssh/config
  const [sshHosts, setSSHHosts] = useState<string[]>([])

  // Creating states for each section
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [isCreatingIde, setIsCreatingIde] = useState(false)
  const [isCreatingRemoteIde, setIsCreatingRemoteIde] = useState(false)
  const [isCreatingCodingAgent, setIsCreatingCodingAgent] = useState(false)
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingCommand, setIsCreatingCommand] = useState(false)

  // Fetch SSH hosts
  useEffect(() => {
    fetchSSHHosts().then(setSSHHosts)
  }, [])

  // Restore scroll position when project loads
  useEffect(() => {
    if (!loading && project) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        restoreScrollPosition()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [loading, project, restoreScrollPosition])

  // Update window title when project loads
  useEffect(() => {
    if (project?.name) {
      getCurrentWindow().setTitle(`Devora - ${project.name}`)
    }
    // Reset title when leaving the project page
    return () => {
      getCurrentWindow().setTitle('Devora')
    }
  }, [project?.name])

  // Sync todo drawer state to project state
  const handleTodoDrawerChange = useCallback(
    (open: boolean) => {
      setTodoDrawerOpen(open)
      saveTodoDrawerState(open)
    },
    [saveTodoDrawerState]
  )

  // Helper: detect if text is a file path
  const isFilePath = useCallback((text: string): boolean => {
    // Windows absolute path: C:\, D:\, etc.
    if (/^[A-Za-z]:[/\\]/.test(text)) return true
    // Unix absolute path: /home/..., /Users/...
    if (/^\/[^/]/.test(text)) return true
    // Home directory: ~/...
    return /^~[/\\]/.test(text)
  }, [])

  // Helper: quick add URL with metadata fetch
  const quickAddUrl = useCallback(
    async (url: string) => {
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
          if (notionMatch?.[1]) {
            fallbackTitle = 'Notion - ' + notionMatch[1].replace(/-/g, ' ')
          }
        }

        const newItem = await addItem('url', fallbackTitle, urlObj.href)

        // Fetch metadata in background (skip for Notion)
        if (!urlObj.hostname.includes('notion.so')) {
          fetchUrlMetadata(urlObj.href).then((metaTitle) => {
            if (metaTitle && metaTitle !== fallbackTitle) {
              updateItem(newItem.id, { title: metaTitle })
            }
          })
        }
      } catch {
        // Invalid URL, ignore
      }
    },
    [addItem, updateItem]
  )

  // Helper: quick add working directory from path
  const quickAddWorkingDir = useCallback(
    async (path: string) => {
      if (!project) return
      const trimmedPath = path.trim()
      if (!trimmedPath) return

      const existingDirs = project.metadata.working_dirs || []
      // Check if path already exists
      if (existingDirs.some((d) => d.path === trimmedPath)) return

      // Extract folder name from path
      const name = trimmedPath.split(/[/\\]/).filter(Boolean).pop() || trimmedPath

      const newDirs: WorkingDir[] = [...existingDirs, { name, path: trimmedPath }]
      await updateProject({
        metadata: {
          ...project.metadata,
          working_dirs: newDirs,
        },
      })
    },
    [project, updateProject]
  )

  // Global paste handler: URL -> Links, File path -> Working Dirs
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      const isEditing =
        activeEl instanceof HTMLInputElement ||
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

  // Section order - must be called before any conditional returns (React hooks rule)
  const sectionOrder = useMemo((): SectionKey[] => {
    const order = project?.metadata.section_order
    if (!order || order.length === 0) return DEFAULT_SECTION_ORDER
    // Validate and fill in missing sections
    const validKeys = new Set(DEFAULT_SECTION_ORDER)
    const result = order.filter((key) => validKeys.has(key))
    // Add any missing sections at the end
    for (const key of DEFAULT_SECTION_ORDER) {
      if (!result.includes(key)) result.push(key)
    }
    return result
  }, [project?.metadata.section_order])

  // DnD sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-(--accent-primary) border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-(--text-muted)">Loading project...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="px-4 py-3 bg-(--accent-danger)/10 border border-(--accent-danger)/30 rounded-lg">
          <span className="font-mono text-(--accent-danger)">Error: {error}</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="font-mono text-(--text-muted)">Project not found</span>
      </div>
    )
  }

  // Filter items by type
  const notes = project.items?.filter((i) => i.type === 'note') || []
  const ideItems = project.items?.filter((i) => i.type === 'ide') || []
  const remoteIdeItems = project.items?.filter((i) => i.type === 'remote-ide') || []
  const codingAgentItems = project.items?.filter((i) => i.type === 'coding-agent') || []
  const fileItems = project.items?.filter((i) => i.type === 'file') || []
  const urlItems = project.items?.filter((i) => i.type === 'url') || []
  const commandItems = project.items?.filter((i) => i.type === 'command') || []

  // Navigation items - only show sections that have content or are being created
  // Colors use CSS variables for consistency with the color system
  const navItemsConfig: Record<SectionKey, { id: string; label: string; show: boolean; color: string }> = {
    workingDirs: {
      id: 'section-working-dirs',
      label: 'Dirs',
      show: (project.metadata.working_dirs || []).length > 0,
      color: 'var(--text-muted)',
    },
    ide: {
      id: 'section-apps',
      label: 'IDE',
      show: ideItems.length > 0 || isCreatingIde,
      color: 'var(--accent-primary)',
    },
    remoteIde: {
      id: 'section-remote',
      label: 'Remote',
      show: remoteIdeItems.length > 0 || isCreatingRemoteIde,
      color: 'var(--accent-remote)',
    },
    codingAgent: {
      id: 'section-coding-agent',
      label: 'Agent',
      show: codingAgentItems.length > 0 || isCreatingCodingAgent,
      color: 'var(--accent-agent)',
    },
    file: {
      id: 'section-files',
      label: 'Open',
      show: fileItems.length > 0 || isCreatingFile,
      color: 'var(--text-secondary)',
    },
    command: {
      id: 'section-commands',
      label: 'Commands',
      show: commandItems.length > 0 || isCreatingCommand,
      color: 'var(--accent-warning)',
    },
    links: { id: 'section-links', label: 'Links', show: true, color: 'var(--accent-secondary)' },
    notes: { id: 'section-notes', label: 'Notes', show: true, color: 'var(--accent-warning)' },
  }

  // Build navItems in section order
  const navItems = sectionOrder.map((key) => navItemsConfig[key]).filter((item) => item.show)

  // Handler functions for adding items
  const handleAddNote = async (title: string, content?: string) => {
    await addItem('note', title, content)
  }

  const handleAddIde = async (title: string, path: string, ideType: string) => {
    await addItem('ide', title, path, ideType)
  }

  const handleAddRemoteIde = async (title: string, content: string, remoteIdeType: string) => {
    await addItem('remote-ide', title, content, undefined, remoteIdeType)
  }

  const handleAddCodingAgent = async (
    title: string,
    path: string,
    agentType: CodingAgentType,
    args: string,
    env: string
  ) => {
    await addItem('coding-agent', title, path, undefined, undefined, agentType, args || undefined, env || undefined)
  }

  const handleAddFile = async (title: string, path: string) => {
    await addItem('file', title, path)
  }

  const handleAddUrl = async (title: string, url: string) => {
    return await addItem('url', title, url)
  }

  const handleAddCommand = async (title: string, command: string, mode: CommandMode, cwd?: string, host?: string) => {
    await addItem('command', title, command, undefined, undefined, undefined, undefined, mode, cwd, host)
  }

  const handleUpdateWorkingDirs = async (dirs: WorkingDir[]) => {
    await updateProject({
      metadata: {
        ...project.metadata,
        working_dirs: dirs,
      },
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as SectionKey)
      const newIndex = sectionOrder.indexOf(over.id as SectionKey)
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex)
      await updateProject({
        metadata: {
          ...project.metadata,
          section_order: newOrder,
        },
      })
    }
  }

  // Map section keys to their components
  const sectionsMap: Record<SectionKey, ReactNode> = {
    workingDirs: (
      <WorkingDirsSection
        workingDirs={project.metadata.working_dirs || []}
        sshHosts={sshHosts}
        ideItems={ideItems}
        remoteIdeItems={remoteIdeItems}
        fileItems={fileItems}
        commandItems={commandItems}
        onUpdate={handleUpdateWorkingDirs}
      />
    ),
    ide: (
      <IDESection
        items={ideItems}
        projectId={project.id}
        isCreating={isCreatingIde}
        workingDirs={project.metadata.working_dirs || []}
        onAdd={handleAddIde}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingIde}
        onReorder={() => fetchProject(false)}
      />
    ),
    remoteIde: (
      <RemoteIDESection
        items={remoteIdeItems}
        projectId={project.id}
        isCreating={isCreatingRemoteIde}
        sshHosts={sshHosts}
        workingDirs={project.metadata.working_dirs || []}
        onAdd={handleAddRemoteIde}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingRemoteIde}
        onReorder={() => fetchProject(false)}
      />
    ),
    codingAgent: (
      <CodingAgentSection
        items={codingAgentItems}
        projectId={project.id}
        isCreating={isCreatingCodingAgent}
        workingDirs={project.metadata.working_dirs || []}
        globalEnv={codingAgentGlobalEnv}
        onAdd={handleAddCodingAgent}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingCodingAgent}
        onReorder={() => fetchProject(false)}
      />
    ),
    file: (
      <FileSection
        items={fileItems}
        projectId={project.id}
        isCreating={isCreatingFile}
        onAdd={handleAddFile}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingFile}
        onReorder={() => fetchProject(false)}
      />
    ),
    command: (
      <CommandSection
        items={commandItems}
        projectId={project.id}
        isCreating={isCreatingCommand}
        workingDirs={project.metadata.working_dirs || []}
        sshHosts={sshHosts}
        onAdd={handleAddCommand}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingCommand}
        onReorder={() => fetchProject(false)}
      />
    ),
    links: (
      <LinksSection
        urls={urlItems}
        projectId={project.id}
        onAdd={handleAddUrl}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onReorder={() => fetchProject(false)}
      />
    ),
    notes: (
      <NotesSection
        notes={notes}
        isCreating={isCreatingNote}
        onAdd={handleAddNote}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingNote}
        onReorder={reorderItems}
      />
    ),
  }

  return (
    <div className="animate-card-enter relative">
      {/* Sidebar (fixed position, doesn't affect layout) */}
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* File Preview Cards - floating drag-drop file previews */}
      <FileCardContainer projectId={project.id} />

      {/* Side Navigation */}
      <SectionNavigation items={navItems} />

      {/* Centered content container */}
      <div className="max-w-5xl mx-auto">
        {/* Back navigation with mobile menu button */}
        <div className="flex items-center gap-3 mb-6">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-md hover:bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary) transition-colors"
            title="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono text-(--text-muted) hover:text-(--accent-primary) transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            back to projects
          </Link>
        </div>

        {/* Project Header */}
        <ProjectHeader
          project={project}
          onUpdate={updateProject}
          onCreateNote={() => setIsCreatingNote(true)}
          onCreateIde={() => setIsCreatingIde(true)}
          onCreateRemoteIde={() => setIsCreatingRemoteIde(true)}
          onCreateCodingAgent={() => setIsCreatingCodingAgent(true)}
          onCreateFile={() => setIsCreatingFile(true)}
          onCreateCommand={() => setIsCreatingCommand(true)}
          onOpenTodos={() => handleTodoDrawerChange(true)}
          todoProgress={todoProgress}
        />

        {/* Sortable Sections */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            {sectionOrder.map((key) => (
              <SortableSection key={key} id={key}>
                {sectionsMap[key]}
              </SortableSection>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Todo Drawer */}
      <TodoDrawer
        isOpen={todoDrawerOpen}
        onClose={() => handleTodoDrawerChange(false)}
        todos={todos}
        progress={todoProgress}
        loading={todosLoading}
        onAdd={addTodo}
        onToggle={toggleComplete}
        onDelete={removeTodo}
        onReorder={reorderTodos}
        onIndent={changeIndent}
        onUpdate={updateTodo}
      />
    </div>
  )
}
