import { Database } from 'bun:sqlite'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import type { Project, Item, ProjectMetadata, ItemType, IdeType, RemoteIdeType, CommandMode } from '../src/types'
import { runMigrations } from './migrations'
import { DATA_DIR } from './config'

// Database row types (metadata is JSON string in DB)
interface ProjectRow {
  id: string
  name: string
  description: string
  metadata: string
  created_at: string
  updated_at: string
}

interface MaxOrderRow {
  max: number | null
}

// File card type for floating file preview cards
export interface FileCard {
  id: string
  project_id: string
  filename: string
  content: string
  position_x: number
  position_y: number
  is_expanded: boolean
  is_minimized: boolean
  z_index: number
  created_at: string
  updated_at: string
}

interface FileCardRow {
  id: string
  project_id: string
  filename: string
  content: string
  position_x: number
  position_y: number
  is_expanded: number // SQLite stores as 0/1
  is_minimized: number // SQLite stores as 0/1
  z_index: number
  created_at: string
  updated_at: string
}

// Export/Import data types
interface ExportData {
  version: string
  exportedAt: string
  projects: ProjectRow[]
  items: Item[]
  fileCards?: FileCardRow[]
}

interface ImportData {
  projects: ProjectRow[]
  items: Item[]
  fileCards?: FileCardRow[]
}

// Helper functions
const now = () => new Date().toISOString()
const toBool = (val: number): boolean => val === 1

function getNextOrder(db: Database, table: string, column: string, projectId: string): number {
  const row = db
    .query(`SELECT MAX("${column}") as max FROM ${table} WHERE project_id = ?`)
    .get(projectId) as MaxOrderRow | null
  return (row?.max ?? -1) + 1
}

function touchProject(db: Database, projectId: string) {
  db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now(), projectId])
}

// Database function factory for dependency injection (used in tests)
export function createDbFunctions(db: Database) {
  // Projects CRUD
  function getAllProjects(): Project[] {
    const rows = db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
    return rows.map((row) => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}') as ProjectMetadata,
    }))
  }

  function getProjectById(id: string): Project | null {
    const row = db.query('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | null
    if (!row) return null

    const items = db.query('SELECT * FROM items WHERE project_id = ? ORDER BY "order" ASC').all(id) as Item[]

    return {
      ...row,
      metadata: JSON.parse(row.metadata || '{}'),
      items,
    }
  }

  function createProject(name: string, description: string, metadata: ProjectMetadata): Project {
    const id = uuidv4()
    const timestamp = now()

    db.run('INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      id,
      name,
      description,
      JSON.stringify(metadata),
      timestamp,
      timestamp,
    ])

    return {
      id,
      name,
      description,
      metadata,
      created_at: timestamp,
      updated_at: timestamp,
    }
  }

  function updateProject(
    id: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>
  ): Project | null {
    const existing = getProjectById(id)
    if (!existing) return null

    const name = updates.name ?? existing.name
    const description = updates.description ?? existing.description
    const metadata = updates.metadata ?? existing.metadata

    db.run('UPDATE projects SET name = ?, description = ?, metadata = ?, updated_at = ? WHERE id = ?', [
      name,
      description,
      JSON.stringify(metadata),
      now(),
      id,
    ])

    return getProjectById(id)
  }

  function deleteProject(id: string): boolean {
    const result = db.run('DELETE FROM projects WHERE id = ?', [id])
    return result.changes > 0
  }

  // Items CRUD
  function createItem(
    projectId: string,
    type: ItemType,
    title: string,
    content: string,
    ideType?: IdeType,
    remoteIdeType?: RemoteIdeType,
    commandMode?: CommandMode,
    commandCwd?: string,
    commandHost?: string
  ): Item {
    const id = uuidv4()
    const timestamp = now()
    const order = getNextOrder(db, 'items', 'order', projectId)

    db.run(
      'INSERT INTO items (id, project_id, type, title, content, ide_type, remote_ide_type, command_mode, command_cwd, command_host, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        projectId,
        type,
        title,
        content,
        ideType || null,
        remoteIdeType || null,
        commandMode || null,
        commandCwd || null,
        commandHost || null,
        order,
        timestamp,
        timestamp,
      ]
    )

    touchProject(db, projectId)

    return {
      id,
      project_id: projectId,
      type,
      title,
      content,
      ide_type: ideType,
      remote_ide_type: remoteIdeType,
      command_mode: commandMode,
      command_cwd: commandCwd,
      command_host: commandHost,
      order,
      created_at: timestamp,
      updated_at: timestamp,
    }
  }

  function updateItem(
    id: string,
    updates: Partial<
      Pick<
        Item,
        'title' | 'content' | 'ide_type' | 'remote_ide_type' | 'command_mode' | 'command_cwd' | 'command_host' | 'order'
      >
    >
  ): Item | null {
    const existing = db.query('SELECT * FROM items WHERE id = ?').get(id) as Item | null
    if (!existing) return null

    const title = updates.title ?? existing.title
    const content = updates.content ?? existing.content
    const ideType = updates.ide_type ?? existing.ide_type
    const remoteIdeType = updates.remote_ide_type ?? existing.remote_ide_type
    const commandMode = updates.command_mode ?? existing.command_mode
    const commandCwd = updates.command_cwd ?? existing.command_cwd
    const commandHost = updates.command_host ?? existing.command_host
    const order = updates.order ?? existing.order

    db.run(
      'UPDATE items SET title = ?, content = ?, ide_type = ?, remote_ide_type = ?, command_mode = ?, command_cwd = ?, command_host = ?, "order" = ?, updated_at = ? WHERE id = ?',
      [
        title,
        content,
        ideType || null,
        remoteIdeType || null,
        commandMode || null,
        commandCwd || null,
        commandHost || null,
        order,
        now(),
        id,
      ]
    )

    touchProject(db, existing.project_id)

    return db.query('SELECT * FROM items WHERE id = ?').get(id) as Item
  }

  function deleteItem(id: string): boolean {
    const existing = db.query('SELECT project_id FROM items WHERE id = ?').get(id) as { project_id: string } | null
    if (!existing) return false

    const result = db.run('DELETE FROM items WHERE id = ?', [id])

    if (result.changes > 0) {
      touchProject(db, existing.project_id)
    }

    return result.changes > 0
  }

  function reorderItems(projectId: string, itemIds: string[]): void {
    const timestamp = now()

    itemIds.forEach((id, index) => {
      db.run('UPDATE items SET "order" = ?, updated_at = ? WHERE id = ? AND project_id = ?', [
        index,
        timestamp,
        id,
        projectId,
      ])
    })

    touchProject(db, projectId)
  }

  // Export data (optionally filter by project IDs)
  function exportAllData(projectIds?: string[]): ExportData {
    let projects: ProjectRow[]
    let items: Item[]
    let fileCards: FileCardRow[]

    if (projectIds && projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',')
      projects = db
        .query(`SELECT * FROM projects WHERE id IN (${placeholders}) ORDER BY updated_at DESC`)
        .all(...projectIds) as ProjectRow[]
      items = db
        .query(`SELECT * FROM items WHERE project_id IN (${placeholders}) ORDER BY project_id, "order" ASC`)
        .all(...projectIds) as Item[]
      fileCards = db
        .query(`SELECT * FROM file_cards WHERE project_id IN (${placeholders}) ORDER BY project_id, z_index ASC`)
        .all(...projectIds) as FileCardRow[]
    } else {
      projects = db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
      items = db.query('SELECT * FROM items ORDER BY project_id, "order" ASC').all() as Item[]
      fileCards = db.query('SELECT * FROM file_cards ORDER BY project_id, z_index ASC').all() as FileCardRow[]
    }

    return {
      version: '1.0',
      exportedAt: now(),
      projects,
      items,
      fileCards,
    }
  }

  // Import data (merge mode: skip existing, add new)
  function importData(
    data: ImportData,
    mode: 'merge' | 'replace' = 'merge'
  ): { projectsImported: number; itemsImported: number; fileCardsImported: number; skipped: number } {
    let projectsImported = 0
    let itemsImported = 0
    let fileCardsImported = 0
    let skipped = 0

    if (mode === 'replace') {
      // Clear all existing data
      db.run('DELETE FROM file_cards')
      db.run('DELETE FROM items')
      db.run('DELETE FROM projects')
    }

    // Import projects
    for (const project of data.projects) {
      const existing = db.query('SELECT id FROM projects WHERE id = ?').get(project.id)
      if (existing) {
        skipped++
        continue
      }

      db.run(
        'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [project.id, project.name, project.description, project.metadata, project.created_at, project.updated_at]
      )
      projectsImported++
    }

    // Import items
    for (const item of data.items) {
      const existing = db.query('SELECT id FROM items WHERE id = ?').get(item.id)
      if (existing) {
        skipped++
        continue
      }

      // Check if parent project exists
      const projectExists = db.query('SELECT id FROM projects WHERE id = ?').get(item.project_id)
      if (!projectExists) {
        skipped++
        continue
      }

      db.run(
        'INSERT INTO items (id, project_id, type, title, content, ide_type, remote_ide_type, command_mode, command_cwd, command_host, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.id,
          item.project_id,
          item.type,
          item.title,
          item.content,
          item.ide_type,
          item.remote_ide_type,
          item.command_mode,
          item.command_cwd,
          item.command_host,
          item.order,
          item.created_at,
          item.updated_at,
        ]
      )
      itemsImported++
    }

    // Import file cards
    if (data.fileCards) {
      for (const card of data.fileCards) {
        const existing = db.query('SELECT id FROM file_cards WHERE id = ?').get(card.id)
        if (existing) {
          skipped++
          continue
        }

        // Check if parent project exists
        const projectExists = db.query('SELECT id FROM projects WHERE id = ?').get(card.project_id)
        if (!projectExists) {
          skipped++
          continue
        }

        db.run(
          `INSERT INTO file_cards (id, project_id, filename, content, position_x, position_y, is_expanded, z_index, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            card.id,
            card.project_id,
            card.filename,
            card.content,
            card.position_x,
            card.position_y,
            card.is_expanded,
            card.z_index,
            card.created_at,
            card.updated_at,
          ]
        )
        fileCardsImported++
      }
    }

    return { projectsImported, itemsImported, fileCardsImported, skipped }
  }

  // File Cards CRUD
  function getFileCardsByProject(projectId: string): FileCard[] {
    const rows = db
      .query('SELECT * FROM file_cards WHERE project_id = ? ORDER BY z_index ASC')
      .all(projectId) as FileCardRow[]
    return rows.map((row) => ({
      ...row,
      is_expanded: toBool(row.is_expanded),
      is_minimized: toBool(row.is_minimized),
    }))
  }

  function createFileCard(
    projectId: string,
    filename: string,
    content: string,
    positionX: number,
    positionY: number
  ): FileCard {
    const id = uuidv4()
    const timestamp = now()
    const zIndex = getNextOrder(db, 'file_cards', 'z_index', projectId)

    db.run(
      `INSERT INTO file_cards (id, project_id, filename, content, position_x, position_y, is_expanded, is_minimized, z_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
      [id, projectId, filename, content, positionX, positionY, zIndex, timestamp, timestamp]
    )

    return {
      id,
      project_id: projectId,
      filename,
      content,
      position_x: positionX,
      position_y: positionY,
      is_expanded: false,
      is_minimized: false,
      z_index: zIndex,
      created_at: timestamp,
      updated_at: timestamp,
    }
  }

  function updateFileCard(
    id: string,
    updates: Partial<
      Pick<FileCard, 'filename' | 'content' | 'position_x' | 'position_y' | 'is_expanded' | 'is_minimized' | 'z_index'>
    >
  ): FileCard | null {
    const existing = db.query('SELECT * FROM file_cards WHERE id = ?').get(id) as FileCardRow | null
    if (!existing) return null

    const timestamp = now()
    const filename = updates.filename ?? existing.filename
    const content = updates.content ?? existing.content
    const positionX = updates.position_x ?? existing.position_x
    const positionY = updates.position_y ?? existing.position_y
    const isExpanded = updates.is_expanded !== undefined ? updates.is_expanded : toBool(existing.is_expanded)
    const isMinimized = updates.is_minimized !== undefined ? updates.is_minimized : toBool(existing.is_minimized)
    const zIndex = updates.z_index ?? existing.z_index

    db.run(
      `UPDATE file_cards SET filename = ?, content = ?, position_x = ?, position_y = ?, is_expanded = ?, is_minimized = ?, z_index = ?, updated_at = ? WHERE id = ?`,
      [filename, content, positionX, positionY, isExpanded ? 1 : 0, isMinimized ? 1 : 0, zIndex, timestamp, id]
    )

    return {
      id,
      project_id: existing.project_id,
      filename,
      content,
      position_x: positionX,
      position_y: positionY,
      is_expanded: isExpanded,
      is_minimized: isMinimized,
      z_index: zIndex,
      created_at: existing.created_at,
      updated_at: timestamp,
    }
  }

  function deleteFileCard(id: string): boolean {
    const result = db.run('DELETE FROM file_cards WHERE id = ?', [id])
    return result.changes > 0
  }

  // Settings CRUD
  function getSetting(key: string): string | null {
    const row = db.query('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | null
    return row ? row.value : null
  }

  function setSetting(key: string, value: string): void {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }

  function deleteSetting(key: string): void {
    db.run('DELETE FROM settings WHERE key = ?', [key])
  }

  function getAllSettings(): Record<string, string> {
    const rows = db.query('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  }

  return {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    exportAllData,
    importData,
    // File cards
    getFileCardsByProject,
    createFileCard,
    updateFileCard,
    deleteFileCard,
    // Settings
    getSetting,
    setSetting,
    deleteSetting,
    getAllSettings,
  }
}

// Initialize database (run migrations)
export function initializeDatabase(db: Database) {
  runMigrations(db)
}

// Production database setup
// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const dbPath = join(DATA_DIR, 'projects.db')
console.log(`Database path: ${dbPath}`)

const db = new Database(dbPath, { create: true })
initializeDatabase(db)

// Export production functions
export const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  exportAllData,
  importData,
  // File cards
  getFileCardsByProject,
  createFileCard,
  updateFileCard,
  deleteFileCard,
  // Settings
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
} = createDbFunctions(db)
