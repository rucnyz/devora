import type { IdeType, RemoteIdeType } from '../types'

export const IDE_LABELS: Record<IdeType, string> = {
  pycharm: 'PyCharm',
  cursor: 'Cursor',
  vscode: 'VS Code',
  zed: 'Zed',
  obsidian: 'Obsidian',
}

export const IDE_TAG_CLASSES: Record<IdeType, string> = {
  pycharm: 'tag-ide-pycharm',
  cursor: 'tag-ide-cursor',
  vscode: 'tag-ide-vscode',
  zed: 'tag-ide-zed',
  obsidian: 'tag-ide-obsidian',
}

export const IDE_TYPES: { value: IdeType; label: string }[] = [
  { value: 'pycharm', label: 'PyCharm' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'zed', label: 'Zed' },
  { value: 'obsidian', label: 'Obsidian' },
]

export const REMOTE_IDE_LABELS: Record<RemoteIdeType, string> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
}

export const REMOTE_IDE_TAG_CLASSES: Record<RemoteIdeType, string> = {
  cursor: 'tag-remote-ide-cursor',
  vscode: 'tag-remote-ide-vscode',
}

export const REMOTE_IDE_TYPES: { value: RemoteIdeType; label: string }[] = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
]
