import { useState } from 'react'
import type { Project } from '../../types'

interface ProjectHeaderProps {
  project: Project
  onUpdate: (data: Partial<Project>) => Promise<void>
}

export default function ProjectHeader({ project, onUpdate }: ProjectHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGithub, setEditGithub] = useState('')
  const [editCustomUrl, setEditCustomUrl] = useState('')

  const startEdit = () => {
    setEditName(project.name)
    setEditDesc(project.description)
    setEditGithub(project.metadata?.github_url || '')
    setEditCustomUrl(project.metadata?.custom_url || '')
    setEditing(true)
  }

  const save = async () => {
    await onUpdate({
      name: editName,
      description: editDesc,
      metadata: {
        ...project.metadata,
        github_url: editGithub || undefined,
        custom_url: editCustomUrl || undefined,
      },
    })
    setEditing(false)
  }

  if (editing) {
    return (
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
          className="w-full bg-transparent border-b border-[var(--border-visible)] text-[var(--accent-secondary)] mb-4 pb-2 focus:outline-none focus:border-[var(--accent-primary)] font-mono text-sm"
        />
        <input
          type="text"
          placeholder="Custom URL (GitLab, Bitbucket, etc.)"
          value={editCustomUrl}
          onChange={(e) => setEditCustomUrl(e.target.value)}
          className="w-full bg-transparent border-b border-[var(--border-visible)] text-[var(--accent-secondary)] mb-6 pb-2 focus:outline-none focus:border-[var(--accent-primary)] font-mono text-sm"
        />
        <div className="flex gap-3">
          <button onClick={save} className="btn-solid">
            Save Changes
          </button>
          <button onClick={() => setEditing(false)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-[var(--text-primary)] mb-2">{project.name}</h2>
          {project.description && (
            <p className="text-[var(--text-secondary)] mb-3">{project.description}</p>
          )}
          <div className="flex flex-wrap gap-4">
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
                {project.metadata.github_url.replace('https://github.com/', '').replace(/\/$/, '')}
              </a>
            )}
            {project.metadata?.custom_url && (
              <a
                href={project.metadata.custom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-mono text-[var(--accent-secondary)] hover:underline"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {project.metadata.custom_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={startEdit}
          className="btn-ghost text-sm"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
