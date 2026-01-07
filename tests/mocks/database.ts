import { Database } from 'bun:sqlite'
import { initializeDatabase } from '../../server/db'

export function createTestDatabase(): Database {
  const db = new Database(':memory:', { create: true })
  initializeDatabase(db)
  return db
}

export function seedTestData(db: Database) {
  const now = new Date().toISOString()

  // Seed test projects
  db.run(
    'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['test-project-1', 'Test Project 1', 'First test project', '{"github_url":"https://github.com/test"}', now, now]
  )

  db.run(
    'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['test-project-2', 'Test Project 2', 'Second test project', '{}', now, now]
  )

  // Seed test items
  db.run(
    'INSERT INTO items (id, project_id, type, title, content, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['test-item-1', 'test-project-1', 'note', 'Test Note', 'Note content here', 0, now, now]
  )

  db.run(
    'INSERT INTO items (id, project_id, type, title, content, ide_type, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['test-item-2', 'test-project-1', 'ide', 'VS Code Project', '/path/to/project', 'vscode', 1, now, now]
  )

  db.run(
    'INSERT INTO items (id, project_id, type, title, content, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['test-item-3', 'test-project-1', 'url', 'GitHub', 'https://github.com', 2, now, now]
  )
}
