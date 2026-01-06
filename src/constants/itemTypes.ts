import type { IdeType, RemoteIdeType } from '../types'

/**
 * IDE Configuration
 * All IDE shortcuts use the unified 'tag-ide' class (primary/green color)
 */
export const IDE_LABELS: Record<IdeType, string> = {
  pycharm: 'PyCharm',
  cursor: 'Cursor',
  vscode: 'VS Code',
  zed: 'Zed',
  antigravity: 'Antigravity',
}

// All IDEs use the unified tag-ide class for consistent styling
export const IDE_TAG_CLASS = 'tag-ide'

// Legacy mapping - all point to the unified class now
export const IDE_TAG_CLASSES: Record<IdeType, string> = {
  pycharm: IDE_TAG_CLASS,
  cursor: IDE_TAG_CLASS,
  vscode: IDE_TAG_CLASS,
  zed: IDE_TAG_CLASS,
  antigravity: IDE_TAG_CLASS,
}

export const IDE_TYPES: { value: IdeType; label: string }[] = [
  { value: 'pycharm', label: 'PyCharm' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'zed', label: 'Zed' },
  { value: 'antigravity', label: 'Antigravity' },
]

/**
 * Remote IDE Configuration
 * All remote IDE shortcuts use the unified 'tag-remote-ide' class (remote/magenta color)
 */
export const REMOTE_IDE_LABELS: Record<RemoteIdeType, string> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
}

// All remote IDEs use the unified tag-remote-ide class
export const REMOTE_IDE_TAG_CLASS = 'tag-remote-ide'

// Legacy mapping - all point to the unified class now
export const REMOTE_IDE_TAG_CLASSES: Record<RemoteIdeType, string> = {
  cursor: REMOTE_IDE_TAG_CLASS,
  vscode: REMOTE_IDE_TAG_CLASS,
}

export const REMOTE_IDE_TYPES: { value: RemoteIdeType; label: string }[] = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
]
