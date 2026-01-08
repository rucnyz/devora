import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import type { Project, Item, ProjectMetadata, ItemType, IdeType, RemoteIdeType, CommandMode } from '../types'

// File card type
export interface FileCard {
  id: string
  project_id: string
  filename: string
  file_path: string
  position_x: number
  position_y: number
  is_expanded: boolean
  is_minimized: boolean
  z_index: number
  created_at: string
  updated_at: string
}

// Command result type
export interface CommandResult {
  stdout: string
  stderr: string
  exit_code: number
}

// Directory listing types
export interface DirEntry {
  name: string
  is_dir: boolean
}

export interface DirListing {
  current_path: string
  entries: DirEntry[]
}

// Export/Import types
export interface ExportData {
  version: string
  exportedAt: string
  projects: Array<{
    id: string
    name: string
    description: string
    metadata: string
    created_at: string
    updated_at: string
  }>
  items: Item[]
  fileCards?: Array<{
    id: string
    project_id: string
    filename: string
    file_path: string
    position_x: number
    position_y: number
    is_expanded: number
    is_minimized: number
    z_index: number
    created_at: string
    updated_at: string
  }>
}

export interface ImportData {
  projects: Array<{
    id: string
    name: string
    description: string
    metadata: string
    created_at: string
    updated_at: string
  }>
  items: Item[]
  fileCards?: Array<{
    id: string
    project_id: string
    filename: string
    file_path: string
    position_x: number
    position_y: number
    is_expanded: number
    is_minimized: number
    z_index: number
    created_at: string
    updated_at: string
  }>
}

export interface ImportResult {
  projectsImported: number
  itemsImported: number
  fileCardsImported: number
  skipped: number
}

// ============ Projects API ============

export async function getProjects(): Promise<Project[]> {
  return invoke<Project[]>('get_projects')
}

export async function getProject(id: string): Promise<Project | null> {
  return invoke<Project | null>('get_project', { id })
}

export async function createProject(name: string, description?: string, metadata?: ProjectMetadata): Promise<Project> {
  return invoke<Project>('create_project', { name, description, metadata })
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>
): Promise<Project | null> {
  return invoke<Project | null>('update_project', { id, ...updates })
}

export async function deleteProject(id: string): Promise<boolean> {
  return invoke<boolean>('delete_project', { id })
}

// ============ Items API ============

export async function createItem(
  projectId: string,
  type: ItemType,
  title: string,
  content?: string,
  ideType?: string, // Can be built-in IdeType or custom IDE id
  remoteIdeType?: string, // Can be built-in RemoteIdeType or custom remote IDE id
  commandMode?: CommandMode,
  commandCwd?: string,
  commandHost?: string
): Promise<Item> {
  return invoke<Item>('create_item', {
    projectId,
    itemType: type,
    title,
    content,
    ideType,
    remoteIdeType,
    commandMode,
    commandCwd,
    commandHost,
  })
}

export async function updateItem(
  id: string,
  updates: Partial<
    Pick<
      Item,
      'title' | 'content' | 'ide_type' | 'remote_ide_type' | 'command_mode' | 'command_cwd' | 'command_host' | 'order'
    >
  >
): Promise<Item | null> {
  return invoke<Item | null>('update_item', {
    id,
    title: updates.title,
    content: updates.content,
    ideType: updates.ide_type !== undefined ? updates.ide_type : undefined,
    remoteIdeType: updates.remote_ide_type !== undefined ? updates.remote_ide_type : undefined,
    commandMode: updates.command_mode !== undefined ? updates.command_mode : undefined,
    commandCwd: updates.command_cwd !== undefined ? updates.command_cwd : undefined,
    commandHost: updates.command_host !== undefined ? updates.command_host : undefined,
    order: updates.order,
  })
}

export async function deleteItem(id: string): Promise<boolean> {
  return invoke<boolean>('delete_item', { id })
}

export async function reorderItems(projectId: string, itemIds: string[]): Promise<void> {
  return invoke('reorder_items', { projectId, itemIds })
}

// ============ File Cards API ============

export async function getFileCards(projectId: string): Promise<FileCard[]> {
  return invoke<FileCard[]>('get_file_cards', { projectId })
}

export async function createFileCard(
  projectId: string,
  filename: string,
  filePath: string,
  positionX?: number,
  positionY?: number
): Promise<FileCard> {
  return invoke<FileCard>('create_file_card', {
    projectId,
    filename,
    filePath,
    positionX,
    positionY,
  })
}

export async function updateFileCard(
  id: string,
  updates: Partial<
    Pick<FileCard, 'filename' | 'file_path' | 'position_x' | 'position_y' | 'is_expanded' | 'is_minimized' | 'z_index'>
  >
): Promise<FileCard | null> {
  return invoke<FileCard | null>('update_file_card', {
    id,
    filename: updates.filename,
    filePath: updates.file_path,
    positionX: updates.position_x,
    positionY: updates.position_y,
    isExpanded: updates.is_expanded,
    isMinimized: updates.is_minimized,
    zIndex: updates.z_index,
  })
}

export async function deleteFileCard(id: string): Promise<boolean> {
  return invoke<boolean>('delete_file_card', { id })
}

// ============ Settings API ============

export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_all_settings')
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key })
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke('set_setting', { key, value })
}

export async function deleteSetting(key: string): Promise<void> {
  return invoke('delete_setting', { key })
}

// ============ Export/Import API ============

export async function exportData(projectIds?: string[]): Promise<ExportData> {
  return invoke<ExportData>('export_data', { projectIds })
}

export async function exportDataToFile(filePath: string, projectIds?: string[]): Promise<number> {
  return invoke<number>('export_data_to_file', { filePath, projectIds })
}

export async function importData(data: ImportData, mode?: 'merge' | 'replace'): Promise<ImportResult> {
  return invoke<ImportResult>('import_data', { data, mode })
}

// ============ System Operations API ============

export async function openIde(ideType: IdeType, path: string): Promise<void> {
  return invoke('open_ide', { ideType, path })
}

export async function openCustomIde(command: string, path: string): Promise<void> {
  return invoke('open_custom_ide', { command, path })
}

export async function openRemoteIde(remoteIdeType: RemoteIdeType, host: string, path: string): Promise<void> {
  return invoke('open_remote_ide', { remoteIdeType, host, path })
}

export async function openFile(path: string): Promise<void> {
  await openPath(path)
}

export async function selectFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
  })
  return result as string | null
}

export async function selectFile(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
  })
  return result as string | null
}

export async function getSSHHosts(): Promise<string[]> {
  return invoke<string[]>('get_ssh_hosts')
}

export async function listRemoteDir(host: string, path?: string): Promise<DirListing> {
  return invoke<DirListing>('list_remote_dir', { host, path })
}

export async function runCommand(
  command: string,
  mode: CommandMode,
  cwd?: string,
  host?: string
): Promise<CommandResult> {
  return invoke<CommandResult>('run_command', { command, mode, cwd, host })
}

export async function fetchUrlMetadata(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    clearTimeout(timeoutId)

    const html = await response.text()

    // Try to extract og:title first
    const ogMatch = html.match(/og:title[^>]*content="([^"]*)"/)
    if (ogMatch?.[1]) {
      return ogMatch[1]
    }

    // Fall back to <title>
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    if (titleMatch?.[1]) {
      return titleMatch[1].trim()
    }

    return ''
  } catch {
    // CORS or network error - return empty string (graceful fallback)
    return ''
  }
}

// ============ File Dialog Helpers ============

export async function saveFileDialog(defaultName?: string): Promise<string | null> {
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  return result
}

// ============ File Read API (for drag-drop) ============

export interface ReadFileResult {
  filename: string
  content: string
  file_size: number
}

export interface FileInfo {
  filename: string
  file_size: number
  line_count: number
}

export interface FileLinesResult {
  lines: string[]
  start_line: number
}

export async function readFileContent(
  path: string,
  maxSize?: number,
  offset?: number,
  length?: number
): Promise<ReadFileResult> {
  return invoke<ReadFileResult>('read_file_content', { path, maxSize, offset, length })
}

export async function getFileInfo(path: string): Promise<FileInfo> {
  return invoke<FileInfo>('get_file_info', { path })
}

export async function readFileLines(path: string, startLine: number, count: number): Promise<FileLinesResult> {
  return invoke<FileLinesResult>('read_file_lines', { path, startLine, count })
}
