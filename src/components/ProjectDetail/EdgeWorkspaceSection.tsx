import { useState, useRef, useCallback, useEffect } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { getEdgeProfiles, getEdgeWorkspaces, openEdgeWorkspace, reorderItems } from '../../hooks/useProjects'
import { useEditorHandlers } from '../../hooks/useEditorHandlers'
import { useToast } from '../../hooks/useToast'
import ItemContextMenu, { DuplicateIcon } from '../ItemContextMenu'
import { SortableItem } from './SortableItem'
import type { Item } from '../../types'
import type { EdgeProfile, EdgeWorkspaceInfo } from '../../api/tauri'

const EDGE_TAG_CLASS = 'tag-edge-workspace'

function EdgeWorkspaceCreator({
  onAdd,
  onCreatingChange,
}: {
  onAdd: (title: string, workspaceId: string, edgeProfile: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
}) {
  const toast = useToast()
  const [profiles, setProfiles] = useState<EdgeProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState('')
  const [workspaces, setWorkspaces] = useState<EdgeWorkspaceInfo[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch Edge profiles on mount
  useEffect(() => {
    getEdgeProfiles()
      .then((p) => {
        setProfiles(p)
        if (p.length > 0) setSelectedProfile(p[0]!.dir)
      })
      .catch((err) => toast.error('Failed to load Edge profiles', String(err)))
      .finally(() => setLoadingProfiles(false))
  }, [toast])

  // Fetch workspaces when profile changes
  useEffect(() => {
    if (!selectedProfile) return
    let cancelled = false
    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true)
      try {
        const ws = await getEdgeWorkspaces(selectedProfile)
        if (cancelled) return
        setWorkspaces(ws)
        if (ws.length > 0) setSelectedWorkspace(ws[0]!.id)
        else setSelectedWorkspace('')
      } catch (err) {
        if (!cancelled) toast.error('Failed to load workspaces', String(err))
      } finally {
        if (!cancelled) setLoadingWorkspaces(false)
      }
    }
    fetchWorkspaces()
    return () => {
      cancelled = true
    }
  }, [selectedProfile, toast])

  const canSave = !!selectedProfile && !!selectedWorkspace

  const saveCreating = useCallback(async () => {
    if (!canSave) return
    try {
      const profile = profiles.find((p) => p.dir === selectedProfile)
      const workspace = workspaces.find((w) => w.id === selectedWorkspace)
      const title = `${profile?.name || selectedProfile} / ${workspace?.name || 'Workspace'}`
      await onAdd(title, selectedWorkspace, selectedProfile)
      onCreatingChange(false)
    } catch (err) {
      toast.error('Failed to add Edge workspace', err instanceof Error ? err.message : String(err))
    }
  }, [canSave, selectedProfile, selectedWorkspace, profiles, workspaces, onAdd, onCreatingChange, toast])

  useEditorHandlers({
    containerRef,
    isActive: true,
    canSave,
    onSave: saveCreating,
    onCancel: () => onCreatingChange(false),
  })

  return (
    <div
      ref={containerRef}
      className="mb-4 p-4 rounded-xl bg-(--accent-edge)/5 border border-(--accent-edge)/30 relative"
    >
      <button
        onClick={() => onCreatingChange(false)}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-elevated) transition-colors"
        title="Cancel"
      >
        x
      </button>
      <div className="flex flex-wrap items-center gap-3 pr-6">
        <select
          value={selectedProfile}
          onChange={(e) => setSelectedProfile(e.target.value)}
          className="input-terminal w-auto!"
          disabled={loadingProfiles}
        >
          {loadingProfiles ? (
            <option>Loading profiles...</option>
          ) : profiles.length === 0 ? (
            <option>No Edge profiles found</option>
          ) : (
            profiles.map((p) => (
              <option key={p.dir} value={p.dir}>
                {p.name}
              </option>
            ))
          )}
        </select>
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="input-terminal w-auto! flex-1"
          disabled={loadingWorkspaces || workspaces.length === 0}
        >
          {loadingWorkspaces ? (
            <option>Loading workspaces...</option>
          ) : workspaces.length === 0 ? (
            <option>No workspaces found</option>
          ) : (
            workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.tab_count} tabs)
              </option>
            ))
          )}
        </select>
      </div>
      <div className="text-xs font-mono text-(--text-muted) mt-3">Click outside to save</div>
    </div>
  )
}

interface EdgeWorkspaceSectionProps {
  items: Item[]
  projectId: string
  isCreating: boolean
  onAdd: (title: string, workspaceId: string, edgeProfile: string) => Promise<void>
  onUpdate: (id: string, data: Partial<Item>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreatingChange: (creating: boolean) => void
  onReorder: () => void
}

export default function EdgeWorkspaceSection({
  items,
  projectId,
  isCreating,
  onAdd,
  onUpdate,
  onDelete,
  onCreatingChange,
  onReorder,
}: EdgeWorkspaceSectionProps) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProfile, setEditProfile] = useState('')
  const [editWorkspaceId, setEditWorkspaceId] = useState('')
  const [profiles, setProfiles] = useState<EdgeProfile[]>([])
  const [workspaces, setWorkspaces] = useState<EdgeWorkspaceInfo[]>([])
  const editRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Load profiles when editing starts
  useEffect(() => {
    if (editingId) {
      getEdgeProfiles().then(setProfiles)
    }
  }, [editingId])

  // Load workspaces when edit profile changes
  useEffect(() => {
    if (editingId && editProfile) {
      getEdgeWorkspaces(editProfile).then(setWorkspaces)
    }
  }, [editingId, editProfile])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      const newOrder = arrayMove(items, oldIndex, newIndex)
      await reorderItems(
        projectId,
        newOrder.map((i) => i.id)
      )
      onReorder()
    }
  }

  const resetEditState = useCallback(() => {
    setEditingId(null)
    setEditTitle('')
    setEditProfile('')
    setEditWorkspaceId('')
    setProfiles([])
    setWorkspaces([])
  }, [])

  const saveEditing = useCallback(async () => {
    if (editingId && editProfile && editWorkspaceId) {
      const profile = profiles.find((p) => p.dir === editProfile)
      const workspace = workspaces.find((w) => w.id === editWorkspaceId)
      const title = editTitle.trim() || `${profile?.name || editProfile} / ${workspace?.name || 'Workspace'}`
      await onUpdate(editingId, { title, content: editWorkspaceId, edge_profile: editProfile })
      resetEditState()
    }
  }, [editingId, editTitle, editProfile, editWorkspaceId, profiles, workspaces, onUpdate, resetEditState])

  useEditorHandlers({
    containerRef: editRef,
    isActive: !!editingId,
    canSave: !!editProfile && !!editWorkspaceId,
    onSave: saveEditing,
    onCancel: resetEditState,
  })

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditProfile(item.edge_profile || '')
    setEditWorkspaceId(item.content || '')
    setEditTitle(item.title)
  }

  const handleOpen = async (item: Item) => {
    if (item.edge_profile && item.content) {
      try {
        await openEdgeWorkspace(item.edge_profile, item.content)
      } catch (err) {
        toast.error('Failed to open Edge workspace', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  const handleDuplicate = async (item: Item) => {
    try {
      await onAdd(`${item.title} COPY`, item.content || '', item.edge_profile || '')
    } catch (err) {
      toast.error('Failed to duplicate', err instanceof Error ? err.message : String(err))
    }
  }

  if (!isCreating && items.length === 0) return null

  return (
    <section id="section-edge-workspace" className="scroll-mt-6">
      <h3 className="section-label">Edge Workspaces</h3>

      {isCreating && <EdgeWorkspaceCreator onAdd={onAdd} onCreatingChange={onCreatingChange} />}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) =>
              editingId === item.id ? (
                <div
                  key={item.id}
                  ref={editRef}
                  className="w-full p-4 rounded-xl bg-(--accent-edge)/5 border border-(--accent-edge)/30 animate-card-enter"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={editProfile}
                      onChange={(e) => setEditProfile(e.target.value)}
                      className="input-terminal w-auto!"
                    >
                      {profiles.map((p) => (
                        <option key={p.dir} value={p.dir}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editWorkspaceId}
                      onChange={(e) => setEditWorkspaceId(e.target.value)}
                      className="input-terminal w-auto! flex-1"
                    >
                      {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name} ({ws.tab_count} tabs)
                        </option>
                      ))}
                      {/* Keep current workspace ID if not in list */}
                      {editWorkspaceId && !workspaces.find((ws) => ws.id === editWorkspaceId) && (
                        <option value={editWorkspaceId}>{editWorkspaceId}</option>
                      )}
                    </select>
                  </div>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Display name..."
                      className="input-terminal w-full"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-(--text-muted)">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(item.id)
                        resetEditState()
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <SortableItem key={item.id} id={item.id}>
                  <ItemContextMenu
                    items={[
                      {
                        label: 'Duplicate',
                        icon: <DuplicateIcon className="w-4 h-4" />,
                        onClick: () => handleDuplicate(item),
                      },
                    ]}
                  >
                    <div
                      className="group/edge relative animate-card-enter mr-12"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className={`tag ${EDGE_TAG_CLASS} cursor-pointer`} onClick={() => handleOpen(item)}>
                        <span>{item.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(item.id)
                          }}
                          className="ml-1 opacity-0 group-hover/edge:opacity-100 text-(--text-muted) hover:text-(--accent-danger) transition-opacity"
                        >
                          x
                        </button>
                      </div>
                      <button
                        onClick={() => handleEdit(item)}
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-(--bg-elevated) border border-(--border-visible) text-(--text-muted) hover:text-(--accent-edge) hover:border-(--accent-edge) opacity-0 group-hover/edge:opacity-100 transition-all"
                      >
                        Edit
                      </button>
                    </div>
                  </ItemContextMenu>
                </SortableItem>
              )
            )}

            {!isCreating && (
              <button
                onClick={() => onCreatingChange(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-(--text-muted) hover:border-(--accent-edge) text-(--text-muted) hover:text-(--accent-edge) transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-mono text-sm">Add</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
