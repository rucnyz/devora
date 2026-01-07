import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types'

export default function ProjectList() {
  const { projects, loading, error, createProject, deleteProject } = useProjects()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newGithubUrl, setNewGithubUrl] = useState('')
  const [newCustomUrl, setNewCustomUrl] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const metadata =
      newGithubUrl.trim() || newCustomUrl.trim()
        ? {
            github_url: newGithubUrl.trim() || undefined,
            custom_url: newCustomUrl.trim() || undefined,
          }
        : undefined
    await createProject(newName.trim(), newDesc.trim(), metadata)
    setNewName('')
    setNewDesc('')
    setNewGithubUrl('')
    setNewCustomUrl('')
    setShowNewForm(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-[var(--text-muted)]">Loading projects...</span>
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

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Projects</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 font-mono">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} in workspace
          </p>
        </div>
        <button onClick={() => setShowNewForm(true)} className="btn-neon">
          <span>+ New Project</span>
        </button>
      </div>

      {/* New Project Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-accent)] animate-card-enter"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Create New Project</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-terminal"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input-terminal"
            />
            <input
              type="url"
              placeholder="GitHub URL (optional)"
              value={newGithubUrl}
              onChange={(e) => setNewGithubUrl(e.target.value)}
              className="input-terminal"
            />
            <input
              type="url"
              placeholder="Custom URL (optional) - GitLab, Bitbucket, etc."
              value={newCustomUrl}
              onChange={(e) => setNewCustomUrl(e.target.value)}
              className="input-terminal"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn-solid">
              Create Project
            </button>
            <button type="button" onClick={() => setShowNewForm(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-4">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] font-mono mb-2">No projects yet</p>
          <p className="text-sm text-[var(--text-muted)]">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={deleteProject}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  onDelete,
  style,
}: {
  project: Project
  onDelete: (id: string) => void
  style?: React.CSSProperties
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="glass-card p-5 animate-card-enter"
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={`/project/${project.id}`} className="block">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
            {project.name}
          </h3>
          <div className="flex gap-1">
            {project.metadata?.github_url && (
              <a
                href={project.metadata.github_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                title="Open GitHub"
              >
                <svg
                  className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            )}
            {project.metadata?.custom_url && (
              <a
                href={project.metadata.custom_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                title="Open Link"
              >
                <svg
                  className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>

        {project.description && (
          <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">{project.description}</p>
        )}
      </Link>

      <div className="flex justify-between items-center pt-3 border-t border-[var(--border-subtle)]">
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {new Date(project.updated_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
        <button
          onClick={() => onDelete(project.id)}
          className={`btn-delete transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          delete
        </button>
      </div>
    </div>
  )
}
