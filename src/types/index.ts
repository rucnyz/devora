export type ItemType = 'note' | 'ide' | 'file' | 'url' | 'remote-ide' | 'command' | 'coding-agent'
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
export type RemoteIdeType = 'cursor' | 'vscode' | 'zed'
export type CodingAgentType = 'claude-code' | 'opencode' | 'gemini-cli' | 'codex'
export type CommandMode = 'background' | 'output'

// Terminal types for coding agents
export type TerminalType =
  // Windows
  | 'cmd'
  | 'power-shell'
  | 'pwsh-core'
  | 'windows-terminal'
  | 'git-bash'
  | 'nushell'
  // macOS
  | 'mac-terminal'
  | 'i-term2'
  // Linux/Cross-platform
  | 'gnome-terminal'
  | 'konsole'
  | 'xterm'
  | 'kitty'
  | 'alacritty'

// Platform-specific terminal options for UI
export const WINDOWS_TERMINALS: { value: TerminalType; label: string }[] = [
  { value: 'cmd', label: 'Command Prompt' },
  { value: 'power-shell', label: 'PowerShell' },
  { value: 'pwsh-core', label: 'PowerShell Core' },
  { value: 'windows-terminal', label: 'Windows Terminal' },
  { value: 'git-bash', label: 'Git Bash' },
  { value: 'nushell', label: 'Nushell' },
]

export const MACOS_TERMINALS: { value: TerminalType; label: string }[] = [
  { value: 'mac-terminal', label: 'Terminal' },
  { value: 'i-term2', label: 'iTerm2' },
  { value: 'kitty', label: 'Kitty' },
  { value: 'alacritty', label: 'Alacritty' },
]

export const LINUX_TERMINALS: { value: TerminalType; label: string }[] = [
  { value: 'gnome-terminal', label: 'GNOME Terminal' },
  { value: 'konsole', label: 'Konsole' },
  { value: 'xterm', label: 'XTerm' },
  { value: 'kitty', label: 'Kitty' },
  { value: 'alacritty', label: 'Alacritty' },
]

// Custom IDE configuration for user-defined IDEs
export interface CustomIde {
  id: string // unique identifier (e.g., "nvim", "sublime")
  label: string // display name (e.g., "Neovim", "Sublime Text")
  command: string // command template with {path} placeholder (e.g., "nvim {path}")
}

// Custom Remote IDE configuration for user-defined remote IDEs
export interface CustomRemoteIde {
  id: string // unique identifier (e.g., "remote-nvim")
  label: string // display name (e.g., "Neovim Remote")
  command: string // command template with {host} and {path} placeholders (e.g., "ssh {host} 'nvim {path}'")
}

// Section keys for drag-and-drop reordering
export type SectionKey = 'workingDirs' | 'ide' | 'remoteIde' | 'codingAgent' | 'file' | 'command' | 'links' | 'notes'

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'workingDirs',
  'ide',
  'remoteIde',
  'codingAgent',
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
  coding_agent_type?: CodingAgentType
  coding_agent_args?: string // Custom arguments for coding agent (empty string = clear)
  coding_agent_env?: string // JSON string of environment variables for coding agent
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

// Todo item
export interface TodoItem {
  id: string
  project_id: string
  content: string
  completed: boolean
  order: number
  indent_level: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

// Todo progress statistics
export interface TodoProgress {
  total: number
  completed: number
  percentage: number
}
