import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProject, fetchSSHHosts } from '../../hooks/useProjects'
import SectionNavigation from './SectionNavigation'
import ProjectHeader from './ProjectHeader'
import QuickActions from './QuickActions'
import IDESection from './IDESection'
import RemoteIDESection from './RemoteIDESection'
import FileSection from './FileSection'
import CommandSection from './CommandSection'
import LinksSection from './LinksSection'
import NotesSection from './NotesSection'
import type { IdeType, RemoteIdeType, CommandMode } from '../../types'

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
  const navItems = [
    { id: 'section-apps', label: 'IDE', show: ideItems.length > 0 || isCreatingIde, color: 'var(--accent-primary)' },
    { id: 'section-remote', label: 'Remote', show: remoteIdeItems.length > 0 || isCreatingRemoteIde, color: '#e879f9' },
    { id: 'section-files', label: 'Open', show: fileItems.length > 0 || isCreatingFile, color: 'var(--text-secondary)' },
    { id: 'section-commands', label: 'Commands', show: commandItems.length > 0 || isCreatingCommand, color: '#fbbf24' },
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

  const handleAddCommand = async (title: string, command: string, mode: CommandMode, cwd?: string) => {
    await addItem('command', title, command, undefined, undefined, mode, cwd)
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
      <ProjectHeader project={project} onUpdate={updateProject} />

      {/* Quick Actions */}
      <QuickActions
        onCreateNote={() => setIsCreatingNote(true)}
        onCreateIde={() => setIsCreatingIde(true)}
        onCreateRemoteIde={() => setIsCreatingRemoteIde(true)}
        onCreateFile={() => setIsCreatingFile(true)}
        onCreateCommand={() => setIsCreatingCommand(true)}
      />

      {/* IDE Section */}
      <IDESection
        items={ideItems}
        isCreating={isCreatingIde}
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
        onStartCreate={() => setIsCreatingNote(true)}
        onAdd={handleAddNote}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onCreatingChange={setIsCreatingNote}
      />
    </div>
  )
}
