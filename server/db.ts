import { Database } from 'bun:sqlite'
import { v4 as uuidv4 } from 'uuid'
import type { Project, Item, ProjectMetadata, ItemType, IdeType } from '../src/types'

const db = new Database('data/projects.db', { create: true })

// Initialize tables
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

// Projects CRUD
export function getAllProjects(): Project[] {
  const rows = db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    metadata: JSON.parse(row.metadata || '{}'),
  }))
}

export function getProjectById(id: string): Project | null {
  const row = db.query('SELECT * FROM projects WHERE id = ?').get(id) as any
  if (!row) return null

  const items = db.query('SELECT * FROM items WHERE project_id = ? ORDER BY "order" ASC').all(id) as Item[]

  return {
    ...row,
    metadata: JSON.parse(row.metadata || '{}'),
    items,
  }
}

export function createProject(name: string, description: string = '', metadata: ProjectMetadata = {}): Project {
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

export function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>): Project | null {
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

export function deleteProject(id: string): boolean {
  const result = db.run('DELETE FROM projects WHERE id = ?', [id])
  return result.changes > 0
}

// Items CRUD
export function createItem(
  projectId: string,
  type: ItemType,
  title: string,
  content: string = '',
  ideType?: IdeType
): Item {
  const id = uuidv4()
  const now = new Date().toISOString()

  // Get max order
  const maxOrder = db.query('SELECT MAX("order") as max FROM items WHERE project_id = ?').get(projectId) as any
  const order = (maxOrder?.max ?? -1) + 1

  db.run(
    'INSERT INTO items (id, project_id, type, title, content, ide_type, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, type, title, content, ideType || null, order, now, now]
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
    order,
    created_at: now,
    updated_at: now,
  }
}

export function updateItem(id: string, updates: Partial<Pick<Item, 'title' | 'content' | 'ide_type' | 'order'>>): Item | null {
  const existing = db.query('SELECT * FROM items WHERE id = ?').get(id) as Item | null
  if (!existing) return null

  const now = new Date().toISOString()
  const title = updates.title ?? existing.title
  const content = updates.content ?? existing.content
  const ideType = updates.ide_type ?? existing.ide_type
  const order = updates.order ?? existing.order

  db.run(
    'UPDATE items SET title = ?, content = ?, ide_type = ?, "order" = ?, updated_at = ? WHERE id = ?',
    [title, content, ideType || null, order, now, id]
  )

  // Update project's updated_at
  db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, existing.project_id])

  return db.query('SELECT * FROM items WHERE id = ?').get(id) as Item
}

export function deleteItem(id: string): boolean {
  const existing = db.query('SELECT project_id FROM items WHERE id = ?').get(id) as { project_id: string } | null
  if (!existing) return false

  const result = db.run('DELETE FROM items WHERE id = ?', [id])

  if (result.changes > 0) {
    const now = new Date().toISOString()
    db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, existing.project_id])
  }

  return result.changes > 0
}

export function reorderItems(projectId: string, itemIds: string[]): void {
  const now = new Date().toISOString()

  itemIds.forEach((id, index) => {
    db.run('UPDATE items SET "order" = ?, updated_at = ? WHERE id = ? AND project_id = ?', [index, now, id, projectId])
  })

  db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [now, projectId])
}
