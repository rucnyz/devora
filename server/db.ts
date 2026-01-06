import { Database } from 'bun:sqlite'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import type { Project, Item, ProjectMetadata, ItemType, IdeType, RemoteIdeType, CommandMode } from '../src/types'

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

// Export/Import data types
interface ExportData {
  version: string
  exportedAt: string
  projects: ProjectRow[]
  items: Item[]
}

interface ImportData {
  projects: ProjectRow[]
  items: Item[]
}

// Database function factory for dependency injection (used in tests)
export function createDbFunctions(db: Database) {
  // Projects CRUD
  function getAllProjects(): Project[] {
    const rows = db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
    return rows.map(row => ({
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

  function createProject(name: string, description: string = '', metadata: ProjectMetadata = {}): Project {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description, JSON.stringify(metadata), now, now]
    )

    return {
      id,
      name,
      description,
      metadata,
      created_at: now,
      updated_at: now,
    }
  }

  function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>): Project | null {
    const existing = getProjectById(id)
    if (!existing) return null

    const now = new Date().toISOString()
    const name = updates.name ?? existing.name
    const description = updates.description ?? existing.description
    const metadata = updates.metadata ?? existing.metadata

    db.run(
      'UPDATE projects SET name = ?, description = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [name, description, JSON.stringify(metadata), now, id]
    )

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
    content: string = '',
    ideType?: IdeType,
    remoteIdeType?: RemoteIdeType,
    commandMode?: CommandMode,
    commandCwd?: string,
    commandHost?: string
  ): Item {
    const id = uuidv4()
    const now = new Date().toISOString()

    // Get max order
    const maxOrder = db.query('SELECT MAX("order") as max FROM items WHERE project_id = ?').get(projectId) as MaxOrderRow | null
    const order = (maxOrder?.max ?? -1) + 1

    db.run(
      'INSERT INTO items (id, project_id, type, title, content, ide_type, remote_ide_type, command_mode, command_cwd, command_host, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, type, title, content, ideType || null, remoteIdeType || null, commandMode || null, commandCwd || null, commandHost || null, order, now, now]
    )

    // Update project's updated_at
    db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, projectId])

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
      created_at: now,
      updated_at: now,
    }
  }

  function updateItem(id: string, updates: Partial<Pick<Item, 'title' | 'content' | 'ide_type' | 'remote_ide_type' | 'command_mode' | 'command_cwd' | 'command_host' | 'order'>>): Item | null {
    const existing = db.query('SELECT * FROM items WHERE id = ?').get(id) as Item | null
    if (!existing) return null

    const now = new Date().toISOString()
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
      [title, content, ideType || null, remoteIdeType || null, commandMode || null, commandCwd || null, commandHost || null, order, now, id]
    )

    // Update project's updated_at
    db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, existing.project_id])

    return db.query('SELECT * FROM items WHERE id = ?').get(id) as Item
  }

  function deleteItem(id: string): boolean {
    const existing = db.query('SELECT project_id FROM items WHERE id = ?').get(id) as { project_id: string } | null
    if (!existing) return false

    const result = db.run('DELETE FROM items WHERE id = ?', [id])

    if (result.changes > 0) {
      const now = new Date().toISOString()
      db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, existing.project_id])
    }

    return result.changes > 0
  }

  function reorderItems(projectId: string, itemIds: string[]): void {
    const now = new Date().toISOString()

    itemIds.forEach((id, index) => {
      db.run('UPDATE items SET "order" = ?, updated_at = ? WHERE id = ? AND project_id = ?', [index, now, id, projectId])
    })

    db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, projectId])
  }

  // Export data (optionally filter by project IDs)
  function exportAllData(projectIds?: string[]): ExportData {
    let projects: ProjectRow[]
    let items: Item[]

    if (projectIds && projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',')
      projects = db.query(`SELECT * FROM projects WHERE id IN (${placeholders}) ORDER BY updated_at DESC`).all(...projectIds) as ProjectRow[]
      items = db.query(`SELECT * FROM items WHERE project_id IN (${placeholders}) ORDER BY project_id, "order" ASC`).all(...projectIds) as Item[]
    } else {
      projects = db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
      items = db.query('SELECT * FROM items ORDER BY project_id, "order" ASC').all() as Item[]
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects,
      items,
    }
  }

  // Import data (merge mode: skip existing, add new)
  function importData(data: ImportData, mode: 'merge' | 'replace' = 'merge'): { projectsImported: number, itemsImported: number, skipped: number } {
    let projectsImported = 0
    let itemsImported = 0
    let skipped = 0

    if (mode === 'replace') {
      // Clear all existing data
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
        [project.id, project.name, project.description || '', project.metadata || '{}', project.created_at, project.updated_at]
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
        [item.id, item.project_id, item.type, item.title, item.content || '', item.ide_type || null, item.remote_ide_type || null, item.command_mode || null, item.command_cwd || null, item.command_host || null, item.order || 0, item.created_at, item.updated_at]
      )
      itemsImported++
    }

    return { projectsImported, itemsImported, skipped }
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
  }
}

// Initialize database tables
export function initializeDatabase(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      ide_type TEXT,
      "order" INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `)

  // Migration: add remote_ide_type column if not exists
  try {
    db.run(`ALTER TABLE items ADD COLUMN remote_ide_type TEXT`)
  } catch {
    // Column already exists
  }

  // Migration: add command_mode column if not exists
  try {
    db.run(`ALTER TABLE items ADD COLUMN command_mode TEXT`)
  } catch {
    // Column already exists
  }

  // Migration: add command_cwd column if not exists
  try {
    db.run(`ALTER TABLE items ADD COLUMN command_cwd TEXT`)
  } catch {
    // Column already exists
  }

  // Migration: add command_host column if not exists (for remote commands via SSH)
  try {
    db.run(`ALTER TABLE items ADD COLUMN command_host TEXT`)
  } catch {
    // Column already exists
  }
}

// Production database setup
const APP_DIR = process.cwd()
const dataDir = join(APP_DIR, 'data')

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const dbPath = join(dataDir, 'projects.db')
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
} = createDbFunctions(db)
