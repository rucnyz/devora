export type ItemType = 'note' | 'ide' | 'file' | 'url' | 'remote-ide' | 'command'
export type IdeType =
  // JetBrains IDEs
  | 'idea'
  | 'pycharm'
  | 'webstorm'
  | 'phpstorm'
  | 'rubymine'
  | 'clion'
  | 'goland'
  | 'rider'
  | 'datagrip'
  | 'rustrover'
  | 'aqua'
  // Other IDEs
  | 'cursor'
  | 'vscode'
  | 'zed'
  | 'antigravity'
export type RemoteIdeType = 'cursor' | 'vscode'
export type CommandMode = 'background' | 'output'

// Custom IDE configuration for user-defined IDEs
export interface CustomIde {
  id: string // unique identifier (e.g., "nvim", "sublime")
  label: string // display name (e.g., "Neovim", "Sublime Text")
  command: string // command template with {path} placeholder (e.g., "nvim {path}")
}

// Section keys for drag-and-drop reordering
export type SectionKey = 'workingDirs' | 'ide' | 'remoteIde' | 'file' | 'command' | 'links' | 'notes'

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'workingDirs',
  'ide',
  'remoteIde',
  'file',
  'command',
  'links',
  'notes',
]

export interface Item {
  id: string
  project_id: string
  type: ItemType
  title: string
  content: string
  ide_type?: string // Can be built-in IdeType or custom IDE id
  remote_ide_type?: string // Can be built-in RemoteIdeType or custom remote IDE id
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
  section_order?: SectionKey[]
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
