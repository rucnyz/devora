export type ItemType = 'note' | 'ide' | 'file' | 'url' | 'remote-ide' | 'command'
export type IdeType = 'pycharm' | 'cursor' | 'vscode' | 'zed' | 'antigravity'
export type RemoteIdeType = 'cursor' | 'vscode'
export type CommandMode = 'background' | 'output'

export interface Item {
  id: string
  project_id: string
  type: ItemType
  title: string
  content: string
  ide_type?: IdeType
  remote_ide_type?: RemoteIdeType
  command_mode?: CommandMode
  command_cwd?: string
  command_host?: string // for remote commands via SSH
  order: number
  created_at: string
  updated_at: string
}

export interface WorkingDir {
  name: string
  path: string
  host?: string // for remote dirs, e.g., "server1"
}

export interface ProjectMetadata {
  github_url?: string
  custom_url?: string
  other_links?: { label: string; url: string }[]
  working_dirs?: WorkingDir[]
}

export interface Project {
  id: string
  name: string
  description: string
  metadata: ProjectMetadata
  created_at: string
  updated_at: string
  items?: Item[]
}
