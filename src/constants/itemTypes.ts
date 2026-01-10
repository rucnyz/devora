import type { IdeType, RemoteIdeType, CodingAgentType } from '../types'

/**
 * IDE Configuration
 * All IDE shortcuts use the unified 'tag-ide' class (primary/green color)
 */
export const IDE_LABELS: Record<IdeType, string> = {
  // JetBrains IDEs
  idea: 'IntelliJ IDEA',
  pycharm: 'PyCharm',
  webstorm: 'WebStorm',
  phpstorm: 'PhpStorm',
  rubymine: 'RubyMine',
  clion: 'CLion',
  goland: 'GoLand',
  rider: 'Rider',
  datagrip: 'DataGrip',
  rustrover: 'RustRover',
  aqua: 'Aqua',
  // Other IDEs
  cursor: 'Cursor',
  vscode: 'VS Code',
  zed: 'Zed',
  antigravity: 'Antigravity',
}

// All IDEs use the unified tag-ide class for consistent styling
export const IDE_TAG_CLASS = 'tag-ide'

// Grouped IDE types for dropdown with optgroup
export const IDE_GROUPS: { group: string; items: { value: IdeType; label: string }[] }[] = [
  {
    group: 'JetBrains',
    items: [
      { value: 'idea', label: 'IntelliJ IDEA' },
      { value: 'pycharm', label: 'PyCharm' },
      { value: 'webstorm', label: 'WebStorm' },
      { value: 'phpstorm', label: 'PhpStorm' },
      { value: 'rubymine', label: 'RubyMine' },
      { value: 'clion', label: 'CLion' },
      { value: 'goland', label: 'GoLand' },
      { value: 'rider', label: 'Rider' },
      { value: 'datagrip', label: 'DataGrip' },
      { value: 'rustrover', label: 'RustRover' },
      { value: 'aqua', label: 'Aqua' },
    ],
  },
  {
    group: 'Other',
    items: [
      { value: 'cursor', label: 'Cursor' },
      { value: 'vscode', label: 'VS Code' },
      { value: 'zed', label: 'Zed' },
      { value: 'antigravity', label: 'Antigravity' },
    ],
  },
]

// Flat list for backward compatibility
export const IDE_TYPES: { value: IdeType; label: string }[] = IDE_GROUPS.flatMap((g) => g.items)

/**
 * Remote IDE Configuration
 * All remote IDE shortcuts use the unified 'tag-remote-ide' class (remote/magenta color)
 */
export const REMOTE_IDE_LABELS: Record<RemoteIdeType, string> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
  zed: 'Zed',
}

// All remote IDEs use the unified tag-remote-ide class
export const REMOTE_IDE_TAG_CLASS = 'tag-remote-ide'

export const REMOTE_IDE_TYPES: { value: RemoteIdeType; label: string }[] = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'zed', label: 'Zed' },
]

/**
 * Coding Agent Configuration
 * All coding agent shortcuts use the unified 'tag-coding-agent' class (cyan color)
 */
export const CODING_AGENT_LABELS: Record<CodingAgentType, string> = {
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  'gemini-cli': 'Gemini CLI',
}

// All coding agents use the unified tag-coding-agent class
export const CODING_AGENT_TAG_CLASS = 'tag-coding-agent'

export const CODING_AGENT_TYPES: { value: CodingAgentType; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
]
