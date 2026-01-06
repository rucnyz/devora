import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProject, openIde, openFile } from '../hooks/useProjects'
import type { Item, IdeType, ItemType } from '../types'
import AddItemModal from './AddItemModal'

const IDE_LABELS: Record<IdeType, string> = {
  pycharm: 'PyCharm',
  cursor: 'Cursor',
  vscode: 'VS Code',
  zed: 'Zed',
  obsidian: 'Obsidian',
}

const IDE_TAG_CLASSES: Record<IdeType, string> = {
  pycharm: 'tag-ide-pycharm',
  cursor: 'tag-ide-cursor',
  vscode: 'tag-ide-vscode',
  zed: 'tag-ide-zed',
  obsidian: 'tag-ide-obsidian',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading, error, addItem, updateItem, deleteItem, updateProject } = useProject(id!)
  const [showAddModal, setShowAddModal] = useState<ItemType | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const newNoteRef = useRef<HTMLDivElement>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteTitle, setEditNoteTitle] = useState('')
  const [editNoteContent, setEditNoteContent] = useState('')
  const editNoteRef = useRef<HTMLDivElement>(null)
  const editNoteTitleRef = useRef('')
  const editNoteContentRef = useRef('')
  const editingNoteIdRef = useRef<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGithub, setEditGithub] = useState('')

  useEffect(() => {
    editNoteTitleRef.current = editNoteTitle
  }, [editNoteTitle])

  useEffect(() => {
    editNoteContentRef.current = editNoteContent
  }, [editNoteContent])

  useEffect(() => {
    editingNoteIdRef.current = editingNoteId
  }, [editingNoteId])

  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (isCreatingNote && newNoteRef.current && !newNoteRef.current.contains(event.target as Node)) {
        const title = newNoteTitle.trim() || 'Untitled'
        await addItem('note', title, newNoteContent.trim() || undefined)
        setIsCreatingNote(false)
        setNewNoteTitle('')
        setNewNoteContent('')
      }
      if (editingNoteIdRef.current && editNoteRef.current && !editNoteRef.current.contains(event.target as Node)) {
        const title = editNoteTitleRef.current.trim() || 'Untitled'
        await updateItem(editingNoteIdRef.current, { title, content: editNoteContentRef.current.trim() || undefined })
        setEditingNoteId(null)
        setEditNoteTitle('')
        setEditNoteContent('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCreatingNote, newNoteTitle, newNoteContent, addItem, updateItem])

  const handleCreateNote = () => {
    setIsCreatingNote(true)
    setNewNoteTitle('')
    setNewNoteContent('')
  }

  const handleEditNote = (note: Item) => {
    setEditingNoteId(note.id)
    setEditNoteTitle(note.title)
    setEditNoteContent(note.content || '')
  }

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

  const handleOpenIde = async (item: Item) => {
    if (item.ide_type && item.content) {
      try {
        await openIde(item.ide_type, item.content)
      } catch (err) {
        alert(`Failed to open ${item.ide_type}`)
      }
    }
  }

  const handleOpenFile = async (item: Item) => {
    if (item.content) {
      try {
        await openFile(item.content)
      } catch (err) {
        alert('Failed to open file')
      }
    }
  }

  const startEditMeta = () => {
    setEditName(project.name)
    setEditDesc(project.description)
    setEditGithub(project.metadata?.github_url || '')
    setEditingMeta(true)
  }

  const saveMeta = async () => {
    await updateProject({
      name: editName,
      description: editDesc,
      metadata: { ...project.metadata, github_url: editGithub || undefined },
    })
    setEditingMeta(false)
  }

  const notes = project.items?.filter((i) => i.type === 'note') || []
  const ideItems = project.items?.filter((i) => i.type === 'ide') || []
  const fileItems = project.items?.filter((i) => i.type === 'file') || []
  const urlItems = project.items?.filter((i) => i.type === 'url') || []

  return (
    <div className="animate-card-enter">
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
      {editingMeta ? (
        <div className="mb-8 p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-accent)]">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full text-2xl font-semibold bg-transparent border-b border-[var(--border-visible)] text-[var(--text-primary)] mb-4 pb-2 focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <input
            type="text"
            placeholder="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full bg-transparent border-b border-[var(--border-visible)] text-[var(--text-secondary)] mb-4 pb-2 focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <input
            type="text"
            placeholder="GitHub URL"
            value={editGithub}
            onChange={(e) => setEditGithub(e.target.value)}
            className="w-full bg-transparent border-b border-[var(--border-visible)] text-[var(--accent-secondary)] mb-6 pb-2 focus:outline-none focus:border-[var(--accent-primary)] font-mono text-sm"
          />
          <div className="flex gap-3">
            <button onClick={saveMeta} className="btn-solid">
              Save Changes
            </button>
            <button onClick={() => setEditingMeta(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--text-primary)] mb-2">{project.name}</h2>
              {project.description && (
                <p className="text-[var(--text-secondary)] mb-3">{project.description}</p>
              )}
              {project.metadata?.github_url && (
                <a
                  href={project.metadata.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-mono text-[var(--accent-secondary)] hover:underline"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  {project.metadata.github_url.replace('https://github.com/', '')}
                </a>
              )}
            </div>
            <button
              onClick={startEditMeta}
              className="btn-ghost text-sm"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={handleCreateNote}
          className="group px-4 py-3 rounded-lg bg-[var(--accent-warning)]/10 border border-[var(--accent-warning)]/30 hover:border-[var(--accent-warning)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--accent-warning)]">+ Note</span>
        </button>
        <button
          onClick={() => setShowAddModal('ide')}
          className="group px-4 py-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--accent-primary)]">+ IDE</span>
        </button>
        <button
          onClick={() => setShowAddModal('file')}
          className="group px-4 py-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-visible)] hover:border-[var(--text-muted)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--text-secondary)]">+ File</span>
        </button>
        <button
          onClick={() => setShowAddModal('url')}
          className="group px-4 py-3 rounded-lg bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/30 hover:border-[var(--accent-secondary)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--accent-secondary)]">+ URL</span>
        </button>
      </div>

      {/* IDE Shortcuts */}
      {ideItems.length > 0 && (
        <section className="mb-8">
          <h3 className="section-label">IDE Shortcuts</h3>
          <div className="flex flex-wrap gap-2">
            {ideItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleOpenIde(item)}
                className={`tag ${IDE_TAG_CLASSES[item.ide_type!] || 'tag-file'} animate-card-enter`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <span>{IDE_LABELS[item.ide_type!] || item.ide_type}</span>
                <span className="opacity-60">{item.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteItem(item.id)
                  }}
                  className="ml-1 opacity-40 hover:opacity-100 hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Files */}
      {fileItems.length > 0 && (
        <section className="mb-8">
          <h3 className="section-label">Files</h3>
          <div className="flex flex-wrap gap-2">
            {fileItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleOpenFile(item)}
                className="tag tag-file animate-card-enter"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>{item.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteItem(item.id)
                  }}
                  className="ml-1 opacity-40 hover:opacity-100 hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* URLs */}
      {urlItems.length > 0 && (
        <section className="mb-8">
          <h3 className="section-label">Links</h3>
          <div className="flex flex-wrap gap-2">
            {urlItems.map((item, index) => (
              <a
                key={item.id}
                href={item.content}
                target="_blank"
                rel="noopener noreferrer"
                className="tag tag-url animate-card-enter"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>{item.title}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    deleteItem(item.id)
                  }}
                  className="ml-1 opacity-40 hover:opacity-100 hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section>
        <h3 className="section-label">Notes</h3>

        {/* New Note Editor */}
        {isCreatingNote && (
          <div
            ref={newNoteRef}
            className="note-card note-card-editing mb-4"
          >
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none focus:border-[var(--accent-primary)]"
              autoFocus
            />
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your note here..."
              className="textarea-terminal"
            />
            <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
              Click outside to save
            </div>
          </div>
        )}

        {notes.length === 0 && !isCreatingNote ? (
          <p className="text-[var(--text-muted)] font-mono text-sm">No notes yet. Add a note to get started.</p>
        ) : (
          <div className="space-y-4">
            {notes.map((note, index) =>
              editingNoteId === note.id ? (
                <div
                  key={note.id}
                  ref={editNoteRef}
                  className="note-card note-card-editing"
                >
                  <input
                    type="text"
                    value={editNoteTitle}
                    onChange={(e) => setEditNoteTitle(e.target.value)}
                    placeholder="Note title..."
                    className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none focus:border-[var(--accent-primary)]"
                    autoFocus
                  />
                  <textarea
                    value={editNoteContent}
                    onChange={(e) => setEditNoteContent(e.target.value)}
                    placeholder="Write your note here..."
                    className="textarea-terminal"
                  />
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(note.id)
                        setEditingNoteId(null)
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={note.id}
                  onClick={() => handleEditNote(note)}
                  className="note-card animate-card-enter"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-[var(--text-primary)]">{note.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(note.id)
                      }}
                      className="btn-delete opacity-0 group-hover:opacity-100"
                    >
                      delete
                    </button>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                    {note.content || <span className="text-[var(--text-muted)] italic">Empty note</span>}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(null)}
          initialType={showAddModal}
          onAdd={async (type: ItemType, title: string, content?: string, ideType?: IdeType) => {
            await addItem(type, title, content, ideType)
            setShowAddModal(null)
          }}
        />
      )}
    </div>
  )
}
