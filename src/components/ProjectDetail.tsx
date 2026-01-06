import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProject, openIde, openFile, selectFolder, selectFile, openRemoteIde, fetchSSHHosts, fetchUrlMetadata, runCommand } from '../hooks/useProjects'
import RemoteDirBrowser from './RemoteDirBrowser'
import HostInput from './HostInput'
import type { Item, IdeType, RemoteIdeType, CommandMode } from '../types'

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

const IDE_TYPES: { value: IdeType; label: string }[] = [
  { value: 'pycharm', label: 'PyCharm' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'zed', label: 'Zed' },
  { value: 'obsidian', label: 'Obsidian' },
]

const REMOTE_IDE_LABELS: Record<RemoteIdeType, string> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
}

const REMOTE_IDE_TAG_CLASSES: Record<RemoteIdeType, string> = {
  cursor: 'tag-remote-ide-cursor',
  vscode: 'tag-remote-ide-vscode',
}

const REMOTE_IDE_TYPES: { value: RemoteIdeType; label: string }[] = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
]

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading, error, addItem, updateItem, deleteItem, updateProject } = useProject(id!)
  const [editingMeta, setEditingMeta] = useState(false)
  // Note states
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
  // IDE states
  const [isCreatingIde, setIsCreatingIde] = useState(false)
  const [newIdeType, setNewIdeType] = useState<IdeType>('pycharm')
  const [newIdePath, setNewIdePath] = useState('')
  const newIdeRef = useRef<HTMLDivElement>(null)
  // IDE edit states
  const [editingIdeId, setEditingIdeId] = useState<string | null>(null)
  const [editIdeType, setEditIdeType] = useState<IdeType>('pycharm')
  const [editIdePath, setEditIdePath] = useState('')
  const editIdeRef = useRef<HTMLDivElement>(null)
  // File states
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [newFileTitle, setNewFileTitle] = useState('')
  const [newFilePath, setNewFilePath] = useState('')
  const newFileRef = useRef<HTMLDivElement>(null)
  // File edit states
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editFileTitle, setEditFileTitle] = useState('')
  const [editFilePath, setEditFilePath] = useState('')
  const editFileRef = useRef<HTMLDivElement>(null)
  // URL states - simplified inline input
  const [quickUrlInput, setQuickUrlInput] = useState('')
  const quickUrlInputRef = useRef<HTMLInputElement>(null)
  // URL edit states
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null)
  const [editUrlTitle, setEditUrlTitle] = useState('')
  const editUrlRef = useRef<HTMLDivElement>(null)
  // Remote IDE states
  const [isCreatingRemoteIde, setIsCreatingRemoteIde] = useState(false)
  const [newRemoteIdeType, setNewRemoteIdeType] = useState<RemoteIdeType>('cursor')
  const [newRemoteHost, setNewRemoteHost] = useState('')
  const [newRemotePath, setNewRemotePath] = useState('')
  const newRemoteIdeRef = useRef<HTMLDivElement>(null)
  // Remote IDE edit states
  const [editingRemoteIdeId, setEditingRemoteIdeId] = useState<string | null>(null)
  const [editRemoteIdeType, setEditRemoteIdeType] = useState<RemoteIdeType>('cursor')
  const [editRemoteHost, setEditRemoteHost] = useState('')
  const [editRemotePath, setEditRemotePath] = useState('')
  const editRemoteIdeRef = useRef<HTMLDivElement>(null)
  // SSH hosts from ~/.ssh/config
  const [sshHosts, setSSHHosts] = useState<string[]>([])
  // Command states
  const [isCreatingCommand, setIsCreatingCommand] = useState(false)
  const [newCommandTitle, setNewCommandTitle] = useState('')
  const [newCommandContent, setNewCommandContent] = useState('')
  const [newCommandMode, setNewCommandMode] = useState<CommandMode>('background')
  const [newCommandCwd, setNewCommandCwd] = useState('')
  const newCommandRef = useRef<HTMLDivElement>(null)
  // Command edit states
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null)
  const [editCommandTitle, setEditCommandTitle] = useState('')
  const [editCommandContent, setEditCommandContent] = useState('')
  const [editCommandMode, setEditCommandMode] = useState<CommandMode>('background')
  const [editCommandCwd, setEditCommandCwd] = useState('')
  const editCommandRef = useRef<HTMLDivElement>(null)
  // Command output modal
  const [commandOutput, setCommandOutput] = useState<{ title: string; output: string; error?: string } | null>(null)
    // Remote directory browser state
  const [showRemoteBrowser, setShowRemoteBrowser] = useState<'create' | 'edit' | null>(null)
  // Meta edit states
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGithub, setEditGithub] = useState('')
  const [editCustomUrl, setEditCustomUrl] = useState('')

  useEffect(() => {
    editNoteTitleRef.current = editNoteTitle
  }, [editNoteTitle])

  useEffect(() => {
    editNoteContentRef.current = editNoteContent
  }, [editNoteContent])

  useEffect(() => {
    editingNoteIdRef.current = editingNoteId
  }, [editingNoteId])

  // Fetch SSH hosts from ~/.ssh/config
  useEffect(() => {
    fetchSSHHosts().then(setSSHHosts)
  }, [])

  // Save the note being edited
  const saveEditingNote = useCallback(async () => {
    if (editingNoteIdRef.current) {
      const title = editNoteTitleRef.current.trim() || 'Untitled'
      await updateItem(editingNoteIdRef.current, { title, content: editNoteContentRef.current.trim() || undefined })
      setEditingNoteId(null)
      setEditNoteTitle('')
      setEditNoteContent('')
    }
  }, [updateItem])

  // Save the note being created
  const saveCreatingNote = useCallback(async () => {
    if (isCreatingNote) {
      const title = newNoteTitle.trim() || 'Untitled'
      await addItem('note', title, newNoteContent.trim() || undefined)
      setIsCreatingNote(false)
      setNewNoteTitle('')
      setNewNoteContent('')
    }
  }, [isCreatingNote, newNoteTitle, newNoteContent, addItem])

  // Save the IDE being created
  const saveCreatingIde = useCallback(async () => {
    if (isCreatingIde && newIdePath.trim()) {
      const pathParts = newIdePath.trim().split(/[\\/]/)
      const title = pathParts[pathParts.length - 1] || 'Project'
      await addItem('ide', title, newIdePath.trim(), newIdeType)
      setIsCreatingIde(false)
      setNewIdePath('')
      setNewIdeType('pycharm')
    }
  }, [isCreatingIde, newIdePath, newIdeType, addItem])

  // Save the IDE being edited
  const saveEditingIde = useCallback(async () => {
    if (editingIdeId && editIdePath.trim()) {
      const pathParts = editIdePath.trim().split(/[\\/]/)
      const title = pathParts[pathParts.length - 1] || 'Project'
      await updateItem(editingIdeId, { title, content: editIdePath.trim(), ide_type: editIdeType })
      setEditingIdeId(null)
      setEditIdePath('')
      setEditIdeType('pycharm')
    }
  }, [editingIdeId, editIdePath, editIdeType, updateItem])

  // Save the File being created
  const saveCreatingFile = useCallback(async () => {
    if (isCreatingFile && newFilePath.trim()) {
      const pathParts = newFilePath.trim().split(/[\\/]/)
      const title = newFileTitle.trim() || pathParts[pathParts.length - 1] || 'File'
      await addItem('file', title, newFilePath.trim())
      setIsCreatingFile(false)
      setNewFileTitle('')
      setNewFilePath('')
    }
  }, [isCreatingFile, newFileTitle, newFilePath, addItem])

  // Save the File being edited
  const saveEditingFile = useCallback(async () => {
    if (editingFileId && editFilePath.trim()) {
      const pathParts = editFilePath.trim().split(/[\\/]/)
      const title = editFileTitle.trim() || pathParts[pathParts.length - 1] || 'File'
      await updateItem(editingFileId, { title, content: editFilePath.trim() })
      setEditingFileId(null)
      setEditFileTitle('')
      setEditFilePath('')
    }
  }, [editingFileId, editFileTitle, editFilePath, updateItem])

  // Save the URL being edited
  const saveEditingUrl = useCallback(async () => {
    if (editingUrlId && editUrlTitle.trim()) {
      await updateItem(editingUrlId, { title: editUrlTitle.trim() })
      setEditingUrlId(null)
      setEditUrlTitle('')
    }
  }, [editingUrlId, editUrlTitle, updateItem])

  // Quick add URL from inline input (optimistic update)
  const quickAddUrl = useCallback(async (url: string) => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    try {
      const urlObj = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`)
      // Fallback: use last path segment or hostname
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      const lastSegment = pathParts[pathParts.length - 1]
      let fallbackTitle = lastSegment ? decodeURIComponent(lastSegment) : urlObj.hostname

      // Special handling for Notion URLs - extract page title from URL
      // Format: notion.so/Page-Title-{32-char-hash} or notion.so/workspace/Page-Title-{32-char-hash}
      if (urlObj.hostname.includes('notion.so') && lastSegment) {
        // Remove the 32-character hash at the end (with preceding hyphen)
        const notionMatch = lastSegment.match(/^(.+)-[a-f0-9]{32}$/i)
        if (notionMatch) {
          // Replace hyphens with spaces for the title, prefix with "Notion - "
          fallbackTitle = 'Notion - ' + notionMatch[1].replace(/-/g, ' ')
        }
      }

      // Immediately add with fallback title (optimistic update)
      const newItem = await addItem('url', fallbackTitle, urlObj.href)
      setQuickUrlInput('')

      // Fetch metadata in background and update if found (skip for Notion - their meta tags aren't useful)
      if (!urlObj.hostname.includes('notion.so')) {
        fetchUrlMetadata(urlObj.href).then(metaTitle => {
          if (metaTitle && metaTitle !== fallbackTitle) {
            updateItem(newItem.id, { title: metaTitle })
          }
        })
      }
    } catch {
      // Invalid URL, don't add
    }
  }, [addItem, updateItem])

  // Save the Remote IDE being created
  // content format: host:path (e.g., "user@server:/home/user/project")
  const saveCreatingRemoteIde = useCallback(async () => {
    console.log('saveCreatingRemoteIde called', { isCreatingRemoteIde, newRemoteHost, newRemotePath, newRemoteIdeType })
    if (isCreatingRemoteIde && newRemoteHost.trim() && newRemotePath.trim()) {
      const pathParts = newRemotePath.trim().split('/')
      const title = pathParts[pathParts.length - 1] || 'Remote'
      const content = `${newRemoteHost.trim()}:${newRemotePath.trim()}`
      console.log('Creating remote-ide item:', { title, content, newRemoteIdeType })
      try {
        await addItem('remote-ide', title, content, undefined, newRemoteIdeType)
        console.log('Item created successfully')
      } catch (err) {
        console.error('Failed to create item:', err)
      }
      setIsCreatingRemoteIde(false)
      setNewRemoteHost('')
      setNewRemotePath('')
      setNewRemoteIdeType('cursor')
    }
  }, [isCreatingRemoteIde, newRemoteHost, newRemotePath, newRemoteIdeType, addItem])

  // Save the Remote IDE being edited
  const saveEditingRemoteIde = useCallback(async () => {
    if (editingRemoteIdeId && editRemoteHost.trim() && editRemotePath.trim()) {
      const pathParts = editRemotePath.trim().split('/')
      const title = pathParts[pathParts.length - 1] || 'Remote'
      const content = `${editRemoteHost.trim()}:${editRemotePath.trim()}`
      await updateItem(editingRemoteIdeId, { title, content, remote_ide_type: editRemoteIdeType })
      setEditingRemoteIdeId(null)
      setEditRemoteHost('')
      setEditRemotePath('')
      setEditRemoteIdeType('cursor')
    }
  }, [editingRemoteIdeId, editRemoteHost, editRemotePath, editRemoteIdeType, updateItem])

  // Save the Command being created
  const saveCreatingCommand = useCallback(async () => {
    if (isCreatingCommand && newCommandContent.trim()) {
      const title = newCommandTitle.trim() || newCommandContent.trim()
      await addItem('command', title, newCommandContent.trim(), undefined, undefined, newCommandMode, newCommandCwd.trim() || undefined)
      setIsCreatingCommand(false)
      setNewCommandTitle('')
      setNewCommandContent('')
      setNewCommandMode('background')
      setNewCommandCwd('')
    }
  }, [isCreatingCommand, newCommandTitle, newCommandContent, newCommandMode, newCommandCwd, addItem])

  // Save the Command being edited
  const saveEditingCommand = useCallback(async () => {
    if (editingCommandId && editCommandContent.trim()) {
      const title = editCommandTitle.trim() || editCommandContent.trim()
      await updateItem(editingCommandId, {
        title,
        content: editCommandContent.trim(),
        command_mode: editCommandMode,
        command_cwd: editCommandCwd.trim() || undefined,
      })
      setEditingCommandId(null)
      setEditCommandTitle('')
      setEditCommandContent('')
      setEditCommandMode('background')
      setEditCommandCwd('')
    }
  }, [editingCommandId, editCommandTitle, editCommandContent, editCommandMode, editCommandCwd, updateItem])

  useEffect(() => {
    const handleClickOutside = async (event: MouseEvent) => {
      if (isCreatingNote && newNoteRef.current && !newNoteRef.current.contains(event.target as Node)) {
        await saveCreatingNote()
      }
      if (editingNoteIdRef.current && editNoteRef.current && !editNoteRef.current.contains(event.target as Node)) {
        await saveEditingNote()
      }
      if (isCreatingIde && newIdeRef.current && !newIdeRef.current.contains(event.target as Node)) {
        if (newIdePath.trim()) {
          await saveCreatingIde()
        } else {
          setIsCreatingIde(false)
        }
      }
      if (editingIdeId && editIdeRef.current && !editIdeRef.current.contains(event.target as Node)) {
        if (editIdePath.trim()) {
          await saveEditingIde()
        } else {
          setEditingIdeId(null)
        }
      }
      if (isCreatingFile && newFileRef.current && !newFileRef.current.contains(event.target as Node)) {
        if (newFilePath.trim()) {
          await saveCreatingFile()
        } else {
          setIsCreatingFile(false)
        }
      }
      if (editingFileId && editFileRef.current && !editFileRef.current.contains(event.target as Node)) {
        if (editFilePath.trim()) {
          await saveEditingFile()
        } else {
          setEditingFileId(null)
        }
      }
      if (editingUrlId && editUrlRef.current && !editUrlRef.current.contains(event.target as Node)) {
        if (editUrlTitle.trim()) {
          await saveEditingUrl()
        } else {
          setEditingUrlId(null)
        }
      }
      // Don't process click outside for remote IDE when the browser modal is open
      if (!showRemoteBrowser) {
        if (isCreatingRemoteIde && newRemoteIdeRef.current && !newRemoteIdeRef.current.contains(event.target as Node)) {
          if (newRemoteHost.trim() && newRemotePath.trim()) {
            await saveCreatingRemoteIde()
          } else {
            setIsCreatingRemoteIde(false)
          }
        }
        if (editingRemoteIdeId && editRemoteIdeRef.current && !editRemoteIdeRef.current.contains(event.target as Node)) {
          if (editRemoteHost.trim() && editRemotePath.trim()) {
            await saveEditingRemoteIde()
          } else {
            setEditingRemoteIdeId(null)
          }
        }
      }
      // Command
      if (isCreatingCommand && newCommandRef.current && !newCommandRef.current.contains(event.target as Node)) {
        if (newCommandContent.trim()) {
          await saveCreatingCommand()
        } else {
          setIsCreatingCommand(false)
        }
      }
      if (editingCommandId && editCommandRef.current && !editCommandRef.current.contains(event.target as Node)) {
        if (editCommandContent.trim()) {
          await saveEditingCommand()
        } else {
          setEditingCommandId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCreatingNote, saveCreatingNote, saveEditingNote, isCreatingIde, newIdePath, saveCreatingIde, editingIdeId, editIdePath, saveEditingIde, isCreatingFile, newFilePath, saveCreatingFile, editingFileId, editFilePath, saveEditingFile, editingUrlId, editUrlTitle, saveEditingUrl, isCreatingRemoteIde, newRemoteHost, newRemotePath, saveCreatingRemoteIde, editingRemoteIdeId, editRemoteHost, editRemotePath, saveEditingRemoteIde, showRemoteBrowser, isCreatingCommand, newCommandContent, saveCreatingCommand, editingCommandId, editCommandContent, saveEditingCommand])

  // Ctrl+S / Cmd+S keyboard shortcut to save all inline editors
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const hasActiveEditor = editingNoteIdRef.current || isCreatingNote || isCreatingIde || editingIdeId || isCreatingFile || editingFileId || editingUrlId || isCreatingRemoteIde || editingRemoteIdeId || isCreatingCommand || editingCommandId
        if (hasActiveEditor) {
          e.preventDefault()
          e.stopPropagation()
          // Note
          if (editingNoteIdRef.current) {
            await saveEditingNote()
          } else if (isCreatingNote) {
            await saveCreatingNote()
          }
          // IDE
          else if (editingIdeId && editIdePath.trim()) {
            await saveEditingIde()
          } else if (isCreatingIde && newIdePath.trim()) {
            await saveCreatingIde()
          }
          // File
          else if (editingFileId && editFilePath.trim()) {
            await saveEditingFile()
          } else if (isCreatingFile && newFilePath.trim()) {
            await saveCreatingFile()
          }
          // URL
          else if (editingUrlId && editUrlTitle.trim()) {
            await saveEditingUrl()
          }
          // Remote IDE
          else if (editingRemoteIdeId && editRemoteHost.trim() && editRemotePath.trim()) {
            await saveEditingRemoteIde()
          } else if (isCreatingRemoteIde && newRemoteHost.trim() && newRemotePath.trim()) {
            await saveCreatingRemoteIde()
          }
          // Command
          else if (editingCommandId && editCommandContent.trim()) {
            await saveEditingCommand()
          } else if (isCreatingCommand && newCommandContent.trim()) {
            await saveCreatingCommand()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCreatingNote, saveCreatingNote, saveEditingNote, isCreatingIde, newIdePath, saveCreatingIde, editingIdeId, editIdePath, saveEditingIde, isCreatingFile, newFilePath, saveCreatingFile, editingFileId, editFilePath, saveEditingFile, editingUrlId, editUrlTitle, saveEditingUrl, isCreatingRemoteIde, newRemoteHost, newRemotePath, saveCreatingRemoteIde, editingRemoteIdeId, editRemoteHost, editRemotePath, saveEditingRemoteIde, isCreatingCommand, newCommandContent, saveCreatingCommand, editingCommandId, editCommandContent, saveEditingCommand])

  // Global Ctrl+V to quick add URL (only when not editing)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Check if user is in any editing mode (input/textarea focused)
      const activeEl = document.activeElement
      const isEditing = activeEl instanceof HTMLInputElement ||
                        activeEl instanceof HTMLTextAreaElement ||
                        activeEl?.getAttribute('contenteditable') === 'true'

      if (isEditing) return // Don't intercept paste when editing

      const text = e.clipboardData?.getData('text')?.trim()
      if (!text) return

      // Check if it looks like a URL
      const urlPattern = /^(https?:\/\/|www\.)/i
      if (urlPattern.test(text)) {
        e.preventDefault()
        await quickAddUrl(text)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [quickAddUrl])

  const handleCreateNote = () => {
    setIsCreatingNote(true)
    setNewNoteTitle('')
    setNewNoteContent('')
  }

  const handleCreateIde = () => {
    setIsCreatingIde(true)
    setNewIdeType('pycharm')
    setNewIdePath('')
  }

  const handleCreateFile = () => {
    setIsCreatingFile(true)
    setNewFileTitle('')
    setNewFilePath('')
  }

  const handleCreateCommand = () => {
    setIsCreatingCommand(true)
    setNewCommandTitle('')
    setNewCommandContent('')
    setNewCommandMode('background')
    setNewCommandCwd('')
  }

  const handleSelectFolder = async () => {
    const path = await selectFolder()
    if (path) {
      setNewIdePath(path)
    }
  }

  const handleSelectFolderForEdit = async () => {
    const path = await selectFolder()
    if (path) {
      setEditIdePath(path)
    }
  }

  const handleEditIde = (item: Item) => {
    setEditingIdeId(item.id)
    setEditIdeType(item.ide_type || 'pycharm')
    setEditIdePath(item.content || '')
  }

  const handleSelectFile = async () => {
    const path = await selectFile()
    if (path) {
      setNewFilePath(path)
    }
  }

  const handleSelectFolderForFile = async () => {
    const path = await selectFolder()
    if (path) {
      setNewFilePath(path)
    }
  }

  const handleSelectFileForEdit = async () => {
    const path = await selectFile()
    if (path) {
      setEditFilePath(path)
    }
  }

  const handleSelectFolderForFileEdit = async () => {
    const path = await selectFolder()
    if (path) {
      setEditFilePath(path)
    }
  }

  const handleEditFile = (item: Item) => {
    setEditingFileId(item.id)
    setEditFileTitle(item.title)
    setEditFilePath(item.content || '')
  }

  const handleEditNote = (note: Item) => {
    setEditingNoteId(note.id)
    setEditNoteTitle(note.title)
    setEditNoteContent(note.content || '')
  }

  const handleCreateRemoteIde = () => {
    setIsCreatingRemoteIde(true)
    setNewRemoteIdeType('cursor')
    setNewRemoteHost('')
    setNewRemotePath('')
  }

  const handleEditRemoteIde = (item: Item) => {
    setEditingRemoteIdeId(item.id)
    setEditRemoteIdeType(item.remote_ide_type || 'cursor')
    // Parse content: "host:path"
    const content = item.content || ''
    const colonIndex = content.indexOf(':')
    if (colonIndex > 0) {
      setEditRemoteHost(content.substring(0, colonIndex))
      setEditRemotePath(content.substring(colonIndex + 1))
    } else {
      setEditRemoteHost(content)
      setEditRemotePath('')
    }
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

  const handleOpenRemoteIde = async (item: Item) => {
    console.log('handleOpenRemoteIde called', item)
    if (item.remote_ide_type && item.content) {
      try {
        // Parse content: "host:path"
        const content = item.content
        const colonIndex = content.indexOf(':')
        console.log('content:', content, 'colonIndex:', colonIndex)
        if (colonIndex > 0) {
          const host = content.substring(0, colonIndex)
          const path = content.substring(colonIndex + 1)
          console.log('Opening remote IDE:', item.remote_ide_type, host, path)
          await openRemoteIde(item.remote_ide_type, host, path)
          console.log('openRemoteIde completed')
        }
      } catch (err) {
        console.error('Failed to open remote IDE:', err)
        alert(`Failed to open remote ${item.remote_ide_type}`)
      }
    }
  }

  const handleRunCommand = async (item: Item) => {
    if (item.content && item.command_mode) {
      try {
        const result = await runCommand(item.content, item.command_mode, item.command_cwd)
        if (item.command_mode === 'output') {
          setCommandOutput({
            title: item.title,
            output: result.output || '',
            error: result.error,
          })
        }
      } catch (err) {
        alert(`Failed to run command: ${err}`)
      }
    }
  }

  const handleEditCommand = (item: Item) => {
    setEditingCommandId(item.id)
    setEditCommandTitle(item.title)
    setEditCommandContent(item.content)
    setEditCommandMode(item.command_mode || 'background')
    setEditCommandCwd(item.command_cwd || '')
  }

  const handleSelectFolderForCommand = async (isEdit: boolean) => {
    const path = await selectFolder()
    if (path) {
      if (isEdit) {
        setEditCommandCwd(path)
      } else {
        setNewCommandCwd(path)
      }
    }
  }

  const startEditMeta = () => {
    setEditName(project.name)
    setEditDesc(project.description)
    setEditGithub(project.metadata?.github_url || '')
    setEditCustomUrl(project.metadata?.custom_url || '')
    setEditingMeta(true)
  }

  const saveMeta = async () => {
    await updateProject({
      name: editName,
      description: editDesc,
      metadata: {
        ...project.metadata,
        github_url: editGithub || undefined,
        custom_url: editCustomUrl || undefined,
      },
    })
    setEditingMeta(false)
  }

  const notes = project.items?.filter((i) => i.type === 'note') || []
  const ideItems = project.items?.filter((i) => i.type === 'ide') || []
  const remoteIdeItems = project.items?.filter((i) => i.type === 'remote-ide') || []
  const fileItems = project.items?.filter((i) => i.type === 'file') || []
  const urlItems = project.items?.filter((i) => i.type === 'url') || []
  const commandItems = project.items?.filter((i) => i.type === 'command') || []

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Navigation items - only show sections that have content or are being created
  const navItems = [
    { id: 'section-apps', label: 'IDE', show: ideItems.length > 0 || isCreatingIde, color: 'var(--accent-primary)' },
    { id: 'section-remote', label: 'Remote', show: remoteIdeItems.length > 0 || isCreatingRemoteIde, color: '#e879f9' },
    { id: 'section-files', label: 'Open', show: fileItems.length > 0 || isCreatingFile, color: 'var(--text-secondary)' },
    { id: 'section-commands', label: 'Commands', show: commandItems.length > 0 || isCreatingCommand, color: '#fbbf24' },
    { id: 'section-links', label: 'Links', show: true, color: 'var(--accent-secondary)' },
    { id: 'section-notes', label: 'Notes', show: true, color: 'var(--accent-warning)' },
  ].filter(item => item.show)

  return (
    <div className="animate-card-enter relative">
      {/* Side Navigation */}
      {navItems.length > 0 && (
        <nav className="fixed right-2 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-1 p-1.5 rounded-lg bg-[var(--bg-surface)]/80 backdrop-blur-sm border border-[var(--border-subtle)]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-elevated)] transition-colors"
              title={item.label}
            >
              <span
                className="w-2 h-2 rounded-full transition-transform group-hover:scale-125"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs font-mono text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors hidden lg:inline">
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      )}

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
          onClick={handleCreateIde}
          className="group px-4 py-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--accent-primary)]">+ IDE</span>
        </button>
        <button
          onClick={handleCreateRemoteIde}
          className="group px-4 py-3 rounded-lg bg-[#e879f9]/10 border border-[#e879f9]/30 hover:border-[#e879f9] transition-all"
        >
          <span className="font-mono text-sm text-[#e879f9]">+ Remote IDE</span>
        </button>
        <button
          onClick={handleCreateFile}
          className="group px-4 py-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-visible)] hover:border-[var(--text-muted)] transition-all"
        >
          <span className="font-mono text-sm text-[var(--text-secondary)]">+ Open</span>
        </button>
        <button
          onClick={handleCreateCommand}
          className="group px-4 py-3 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/30 hover:border-[#fbbf24] transition-all"
        >
          <span className="font-mono text-sm text-[#fbbf24]">+ Command</span>
        </button>
      </div>

      {/* IDE */}
      {(ideItems.length > 0 || isCreatingIde) && (
        <section id="section-apps" className="mb-8 scroll-mt-6">
          <h3 className="section-label">IDE</h3>

          {/* Inline IDE Creator */}
          {isCreatingIde && (
            <div
              ref={newIdeRef}
              className="mb-4 p-4 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/30"
            >
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={newIdeType}
                  onChange={(e) => setNewIdeType(e.target.value as IdeType)}
                  className="input-terminal !w-auto"
                >
                  {IDE_TYPES.map((ide) => (
                    <option key={ide.value} value={ide.value}>
                      {ide.label}
                    </option>
                  ))}
                </select>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newIdePath}
                    onChange={(e) => setNewIdePath(e.target.value)}
                    placeholder="Project folder path..."
                    className="input-terminal flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="btn-ghost whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
              </div>
              {/* Existing paths suggestions */}
              {ideItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Existing paths:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[...new Set(ideItems.map(i => i.content))].map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setNewIdePath(path)}
                        className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors truncate max-w-xs"
                        title={path}
                      >
                        {path.split(/[\\/]/).pop()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
                Click outside to save
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {ideItems.map((item, index) =>
              editingIdeId === item.id ? (
                <div
                  key={item.id}
                  ref={editIdeRef}
                  className="w-full p-4 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/30 animate-card-enter"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={editIdeType}
                      onChange={(e) => setEditIdeType(e.target.value as IdeType)}
                      className="input-terminal !w-auto"
                    >
                      {IDE_TYPES.map((ide) => (
                        <option key={ide.value} value={ide.value}>
                          {ide.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editIdePath}
                        onChange={(e) => setEditIdePath(e.target.value)}
                        placeholder="Project folder path..."
                        className="input-terminal flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSelectFolderForEdit}
                        className="btn-ghost whitespace-nowrap"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                        setEditingIdeId(null)
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="group/ide relative animate-card-enter mr-12"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className={`tag ${IDE_TAG_CLASSES[item.ide_type!] || 'tag-file'} cursor-pointer`}
                    onClick={() => handleOpenIde(item)}
                  >
                    <span>{IDE_LABELS[item.ide_type!] || item.ide_type}</span>
                    <span className="opacity-60">{item.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                      }}
                      className="ml-1 opacity-0 group-hover/ide:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    onClick={() => handleEditIde(item)}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] opacity-0 group-hover/ide:opacity-100 transition-all"
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Remote IDE */}
      {(remoteIdeItems.length > 0 || isCreatingRemoteIde) && (
        <section id="section-remote" className="mb-8 scroll-mt-6">
          <h3 className="section-label">Remote IDE</h3>

          {/* Inline Remote IDE Creator */}
          {isCreatingRemoteIde && (
            <div
              ref={newRemoteIdeRef}
              className="mb-4 p-4 rounded-xl bg-[#e879f9]/5 border border-[#e879f9]/30"
            >
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={newRemoteIdeType}
                  onChange={(e) => setNewRemoteIdeType(e.target.value as RemoteIdeType)}
                  className="input-terminal !w-auto"
                >
                  {REMOTE_IDE_TYPES.map((ide) => (
                    <option key={ide.value} value={ide.value}>
                      {ide.label}
                    </option>
                  ))}
                </select>
                <HostInput
                  value={newRemoteHost}
                  onChange={setNewRemoteHost}
                  suggestions={sshHosts}
                  className="w-40"
                  autoFocus
                />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newRemotePath}
                    onChange={(e) => setNewRemotePath(e.target.value)}
                    placeholder="/home/user/project"
                    className="input-terminal flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRemoteBrowser('create')}
                    disabled={!newRemoteHost.trim()}
                    className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Browse
                  </button>
                </div>
              </div>
              {/* Existing remote paths suggestions */}
              {remoteIdeItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Existing remotes:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[...new Map(remoteIdeItems.map(i => {
                      const content = i.content || ''
                      const colonIndex = content.indexOf(':')
                      const host = colonIndex > 0 ? content.substring(0, colonIndex) : content
                      const path = colonIndex > 0 ? content.substring(colonIndex + 1) : ''
                      return [content, { host, path }]
                    })).entries()].map(([key, { host, path }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setNewRemoteHost(host)
                          setNewRemotePath(path)
                        }}
                        className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[#e879f9] hover:border-[#e879f9] transition-colors truncate max-w-xs"
                        title={`${host}:${path}`}
                      >
                        {host}:{path.split('/').pop()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
                Click outside to save
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {remoteIdeItems.map((item, index) =>
              editingRemoteIdeId === item.id ? (
                <div
                  key={item.id}
                  ref={editRemoteIdeRef}
                  className="w-full p-4 rounded-xl bg-[#e879f9]/5 border border-[#e879f9]/30 animate-card-enter"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={editRemoteIdeType}
                      onChange={(e) => setEditRemoteIdeType(e.target.value as RemoteIdeType)}
                      className="input-terminal !w-auto"
                    >
                      {REMOTE_IDE_TYPES.map((ide) => (
                        <option key={ide.value} value={ide.value}>
                          {ide.label}
                        </option>
                      ))}
                    </select>
                    <HostInput
                      value={editRemoteHost}
                      onChange={setEditRemoteHost}
                      suggestions={sshHosts}
                      className="w-40"
                      autoFocus
                    />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editRemotePath}
                        onChange={(e) => setEditRemotePath(e.target.value)}
                        placeholder="/home/user/project"
                        className="input-terminal flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRemoteBrowser('edit')}
                        disabled={!editRemoteHost.trim()}
                        className="btn-ghost whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                        setEditingRemoteIdeId(null)
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="group/remote-ide relative animate-card-enter mr-7"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className={`tag ${REMOTE_IDE_TAG_CLASSES[item.remote_ide_type!] || 'tag-remote-ide-cursor'} cursor-pointer`}
                    onClick={() => handleOpenRemoteIde(item)}
                  >
                    <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span>{REMOTE_IDE_LABELS[item.remote_ide_type!] || item.remote_ide_type}</span>
                    <span className="opacity-60">{item.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                      }}
                      className="ml-1 opacity-0 group-hover/remote-ide:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    onClick={() => handleEditRemoteIde(item)}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[#e879f9] hover:border-[#e879f9] opacity-0 group-hover/remote-ide:opacity-100 transition-all"
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Open */}
      {(fileItems.length > 0 || isCreatingFile) && (
        <section id="section-files" className="mb-8 scroll-mt-6">
          <h3 className="section-label">
            Open
            <span
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--text-muted)]/20 text-[var(--text-muted)] text-xs cursor-help"
              title="Quick open files, folders, or executables with system default handler"
            >?</span>
          </h3>

          {/* Inline File Creator */}
          {isCreatingFile && (
            <div
              ref={newFileRef}
              className="mb-4 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)]"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={newFileTitle}
                  onChange={(e) => setNewFileTitle(e.target.value)}
                  placeholder="Title (optional)..."
                  className="input-terminal w-40"
                />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    placeholder="File or folder path..."
                    className="input-terminal flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    className="btn-ghost whitespace-nowrap"
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFolderForFile}
                    className="btn-ghost whitespace-nowrap"
                  >
                    Folder
                  </button>
                </div>
              </div>
              {/* Existing paths suggestions */}
              {fileItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Existing files:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[...new Set(fileItems.map(i => i.content))].map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setNewFilePath(path || '')}
                        className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-visible)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors truncate max-w-xs"
                        title={path}
                      >
                        {path?.split(/[\\/]/).pop()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs font-mono text-[var(--text-muted)] mt-3">
                Click outside to save
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {fileItems.map((item, index) =>
              editingFileId === item.id ? (
                <div
                  key={item.id}
                  ref={editFileRef}
                  className="w-full p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)] animate-card-enter"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={editFileTitle}
                      onChange={(e) => setEditFileTitle(e.target.value)}
                      placeholder="Title (optional)..."
                      className="input-terminal w-40"
                      autoFocus
                    />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editFilePath}
                        onChange={(e) => setEditFilePath(e.target.value)}
                        placeholder="File or folder path..."
                        className="input-terminal flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleSelectFileForEdit}
                        className="btn-ghost whitespace-nowrap"
                      >
                        File
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectFolderForFileEdit}
                        className="btn-ghost whitespace-nowrap"
                      >
                        Folder
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                        setEditingFileId(null)
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="group/file relative animate-card-enter mr-7"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className="tag tag-file cursor-pointer"
                    onClick={() => handleOpenFile(item)}
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
                      className="ml-1 opacity-0 group-hover/file:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    onClick={() => handleEditFile(item)}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] opacity-0 group-hover/file:opacity-100 transition-all"
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Commands */}
      {(commandItems.length > 0 || isCreatingCommand) && (
        <section id="section-commands" className="mb-8 scroll-mt-6">
          <h3 className="section-label">Commands</h3>

          {/* Inline Command Creator */}
          {isCreatingCommand && (
            <div
              ref={newCommandRef}
              className="mb-4 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)]"
            >
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <input
                  type="text"
                  value={newCommandTitle}
                  onChange={(e) => setNewCommandTitle(e.target.value)}
                  placeholder="Title (optional)..."
                  className="input-terminal w-40"
                />
                <input
                  type="text"
                  value={newCommandContent}
                  onChange={(e) => setNewCommandContent(e.target.value)}
                  placeholder="Command to run..."
                  className="input-terminal flex-1"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newCommandCwd}
                    onChange={(e) => setNewCommandCwd(e.target.value)}
                    placeholder="Working directory (optional)..."
                    className="input-terminal flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectFolderForCommand(false)}
                    className="btn-ghost whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
                <select
                  value={newCommandMode}
                  onChange={(e) => setNewCommandMode(e.target.value as CommandMode)}
                  className="input-terminal w-36"
                >
                  <option value="background">Background</option>
                  <option value="output">Show Output</option>
                </select>
              </div>
              <div className="text-xs font-mono text-[var(--text-muted)]">
                Click outside to save
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {commandItems.map((item, index) =>
              editingCommandId === item.id ? (
                <div
                  key={item.id}
                  ref={editCommandRef}
                  className="w-full p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)] animate-card-enter"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={editCommandTitle}
                      onChange={(e) => setEditCommandTitle(e.target.value)}
                      placeholder="Title (optional)..."
                      className="input-terminal w-40"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editCommandContent}
                      onChange={(e) => setEditCommandContent(e.target.value)}
                      placeholder="Command to run..."
                      className="input-terminal flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editCommandCwd}
                        onChange={(e) => setEditCommandCwd(e.target.value)}
                        placeholder="Working directory (optional)..."
                        className="input-terminal flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleSelectFolderForCommand(true)}
                        className="btn-ghost whitespace-nowrap"
                      >
                        Browse
                      </button>
                    </div>
                    <select
                      value={editCommandMode}
                      onChange={(e) => setEditCommandMode(e.target.value as CommandMode)}
                      className="input-terminal w-36"
                    >
                      <option value="background">Background</option>
                      <option value="output">Show Output</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Click outside to save</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                        setEditingCommandId(null)
                      }}
                      className="btn-delete"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="group/command relative animate-card-enter mr-7"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className="tag tag-command cursor-pointer"
                    onClick={() => handleRunCommand(item)}
                  >
                    <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{item.title}</span>
                    {item.command_mode === 'output' && (
                      <span className="text-xs opacity-50">[out]</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                      }}
                      className="ml-1 opacity-0 group-hover/command:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    onClick={() => handleEditCommand(item)}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] opacity-0 group-hover/command:opacity-100 transition-all"
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Command Output Modal */}
      {commandOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCommandOutput(null)}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-visible)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{commandOutput.title}</h3>
              <button
                onClick={() => setCommandOutput(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {commandOutput.output && (
                <div className="mb-4">
                  <h4 className="text-sm font-mono text-[var(--text-muted)] mb-2">Output:</h4>
                  <pre className="bg-[var(--bg-surface)] p-3 rounded-lg text-sm font-mono text-[var(--text-secondary)] whitespace-pre-wrap overflow-x-auto">{commandOutput.output}</pre>
                </div>
              )}
              {commandOutput.error && (
                <div>
                  <h4 className="text-sm font-mono text-[var(--accent-danger)] mb-2">Error:</h4>
                  <pre className="bg-[var(--bg-surface)] p-3 rounded-lg text-sm font-mono text-[var(--accent-danger)] whitespace-pre-wrap overflow-x-auto">{commandOutput.error}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* URLs - always visible with inline input */}
      <section id="section-links" className="mb-8 scroll-mt-6">
        <h3 className="section-label">Links</h3>

        <div className="flex flex-wrap items-center gap-2">
          {urlItems.map((item, index) =>
            editingUrlId === item.id ? (
              <div
                key={item.id}
                ref={editUrlRef}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]"
              >
                <input
                  type="text"
                  value={editUrlTitle}
                  onChange={(e) => setEditUrlTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editUrlTitle.trim()) {
                      e.preventDefault()
                      saveEditingUrl()
                    } else if (e.key === 'Escape') {
                      setEditingUrlId(null)
                    }
                  }}
                  className="w-40 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)]"
                  autoFocus
                />
                <button
                  onClick={() => setEditingUrlId(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <a
                key={item.id}
                href={item.content}
                target="_blank"
                rel="noopener noreferrer"
                className="tag tag-url animate-card-enter group"
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
                    setEditingUrlId(item.id)
                    setEditUrlTitle(item.title)
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-[var(--accent-secondary)] transition-opacity"
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    deleteItem(item.id)
                  }}
                  className="ml-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-[var(--accent-danger)] transition-opacity"
                >
                  ×
                </button>
              </a>
            )
          )}
          {/* Quick URL input */}
          <div className="inline-flex items-center">
            <input
              ref={quickUrlInputRef}
              type="text"
              value={quickUrlInput}
              onChange={(e) => setQuickUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickUrlInput.trim()) {
                  e.preventDefault()
                  quickAddUrl(quickUrlInput)
                }
              }}
              placeholder="Paste URL or Ctrl+V anywhere..."
              className="w-56 px-3 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section id="section-notes" className="scroll-mt-6">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveCreatingNote()
                }
              }}
              placeholder="Note title..."
              className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none"
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveEditingNote()
                      }
                    }}
                    placeholder="Note title..."
                    className="w-full text-lg font-medium text-[var(--text-primary)] bg-transparent mb-3 pb-2 border-b border-[var(--border-visible)] focus:outline-none"
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
                  className="note-card animate-card-enter group relative"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteItem(note.id)
                    }}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    ×
                  </button>
                  <h4 className="font-medium text-[var(--text-primary)] mb-2 pr-6">{note.title}</h4>
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                    {note.content || <span className="text-[var(--text-muted)] italic">Empty note</span>}
                  </div>
                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex gap-4 text-xs font-mono text-[var(--text-muted)]">
                    <span>Created: {new Date(note.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}</span>
                    <span>Updated: {new Date(note.updated_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}</span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Remote Directory Browser Modal */}
      {showRemoteBrowser && (
        <RemoteDirBrowser
          host={showRemoteBrowser === 'create' ? newRemoteHost : editRemoteHost}
          initialPath={showRemoteBrowser === 'create' ? newRemotePath || '~' : editRemotePath || '~'}
          onSelect={(path) => {
            console.log('RemoteDirBrowser onSelect called with path:', path, 'mode:', showRemoteBrowser)
            if (showRemoteBrowser === 'create') {
              setNewRemotePath(path)
            } else {
              setEditRemotePath(path)
            }
            setShowRemoteBrowser(null)
          }}
          onClose={() => setShowRemoteBrowser(null)}
        />
      )}
    </div>
  )
}
