import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { getProjects, openProjectWindow } from '../api/tauri'
import type { Project } from '../types'

interface ContextMenuState {
  x: number
  y: number
  project: Project
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { id: currentProjectId } = useParams<{ id: string }>()
  const [projects, setProjects] = useState<Project[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })
  const [mounted, setMounted] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Enable transitions after mount to prevent initial animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Fetch projects
  useEffect(() => {
    getProjects().then(setProjects).catch(console.error)
  }, [])

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  // Close mobile sidebar on click outside
  useEffect(() => {
    if (!mobileOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onMobileClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileOpen, onMobileClose])

  // Close context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }

    // Use click instead of mousedown to avoid timing issues with button clicks
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const newVal = !c
      // Dispatch custom event so ProjectDetail can sync margin
      setTimeout(() => window.dispatchEvent(new CustomEvent('sidebar-toggle')), 0)
      return newVal
    })
  }

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleOpenInNewWindow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!contextMenu) return
    const project = contextMenu.project
    setContextMenu(null)
    try {
      await openProjectWindow(project.id, project.name)
    } catch (error) {
      console.error('Failed to open project window:', error)
    }
  }

  const handleLinkClick = async (e: React.MouseEvent, project: Project) => {
    // Ctrl+Click or Cmd+Click opens in new window
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      try {
        await openProjectWindow(project.id, project.name)
      } catch (error) {
        console.error('Failed to open project window:', error)
      }
    } else {
      onMobileClose()
    }
  }

  return createPortal(
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onMobileClose} />}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-(--bg-void) border-r border-(--border-subtle)
          ${mounted ? 'transition-[width,transform] duration-300 ease-in-out' : ''}
          ${collapsed ? 'w-12' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-center p-2 border-b border-(--border-subtle)">
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-md hover:bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary) transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {projects.map((project) => {
            const isActive = project.id === currentProjectId
            return (
              <Link
                key={project.id}
                to={`/project/${project.id}`}
                onClick={(e) => handleLinkClick(e, project)}
                onContextMenu={(e) => handleContextMenu(e, project)}
                title={collapsed ? project.name : `${project.name} (Ctrl+Click to open in new window)`}
                className={`
                  flex items-center gap-2 px-3 py-2 mx-1 rounded-md
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-(--accent-primary)/10 text-(--accent-primary)'
                      : 'text-(--text-secondary) hover:bg-(--bg-surface) hover:text-(--text-primary)'
                  }
                `}
              >
                {/* Project icon with initial */}
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center relative">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold pt-0.5">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {!collapsed && <span className="truncate text-sm">{project.name}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[160px] py-1 bg-(--bg-surface) border border-(--border-subtle) rounded-lg shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={(e) => handleOpenInNewWindow(e)}
            className="w-full px-3 py-2 text-left text-sm text-(--text-primary) hover:bg-(--bg-hover) flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open in new window
          </button>
        </div>
      )}
    </>,
    document.body
  )
}
