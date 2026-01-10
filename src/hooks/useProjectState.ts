import { useEffect, useRef, useCallback } from 'react'

/**
 * Project state that persists across project switches (in-memory, per session)
 */
export interface ProjectState {
  scrollTop: number
  todoDrawerOpen: boolean
}

// In-memory store for project states (persists during app session)
const projectStates = new Map<string, ProjectState>()

const DEFAULT_STATE: ProjectState = {
  scrollTop: 0,
  todoDrawerOpen: false,
}

/**
 * Get the stored state for a project
 */
export function getProjectState(projectId: string): ProjectState {
  return projectStates.get(projectId) ?? { ...DEFAULT_STATE }
}

/**
 * Save state for a project
 */
export function saveProjectState(projectId: string, state: Partial<ProjectState>): void {
  const existing = projectStates.get(projectId) ?? { ...DEFAULT_STATE }
  projectStates.set(projectId, { ...existing, ...state })
}

/**
 * Hook to manage project state persistence
 * - Saves scroll position when leaving a project
 * - Restores scroll position when returning to a project
 * - Tracks editing state
 */
export function useProjectState(projectId: string | undefined) {
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const hasRestoredScroll = useRef(false)
  const lastProjectId = useRef<string | null>(null)

  // Get initial state for this project
  const getInitialState = useCallback(() => {
    if (!projectId) return DEFAULT_STATE
    return getProjectState(projectId)
  }, [projectId])

  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    if (!projectId) return
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    saveProjectState(projectId, { scrollTop })
  }, [projectId])

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (!projectId || hasRestoredScroll.current) return

    const state = getProjectState(projectId)
    if (state.scrollTop > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({ top: state.scrollTop, behavior: 'instant' })
        hasRestoredScroll.current = true
      })
    } else {
      hasRestoredScroll.current = true
    }
  }, [projectId])

  // Save todo drawer state
  const setTodoDrawerOpen = useCallback(
    (open: boolean) => {
      if (!projectId) return
      saveProjectState(projectId, { todoDrawerOpen: open })
    },
    [projectId]
  )

  // Handle project change - save old project state, reset for new project
  useEffect(() => {
    if (!projectId) return

    // If switching from a different project, save the old one's scroll position
    if (lastProjectId.current && lastProjectId.current !== projectId) {
      const oldScrollTop = window.scrollY || document.documentElement.scrollTop
      saveProjectState(lastProjectId.current, { scrollTop: oldScrollTop })
    }

    // Reset restoration flag for new project
    if (lastProjectId.current !== projectId) {
      hasRestoredScroll.current = false
      lastProjectId.current = projectId
    }
  }, [projectId])

  // Save scroll position on unmount or before navigation
  useEffect(() => {
    if (!projectId) return

    const handleBeforeUnload = () => {
      saveScrollPosition()
    }

    // Save scroll on visibility change (when user switches tabs/apps)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      // Save scroll position when component unmounts (navigating away)
      saveScrollPosition()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [projectId, saveScrollPosition])

  return {
    getInitialState,
    saveScrollPosition,
    restoreScrollPosition,
    setTodoDrawerOpen,
    scrollContainerRef,
  }
}
