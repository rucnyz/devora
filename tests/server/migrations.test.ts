import { describe, test, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { runMigrations } from '../../server/migrations/index'

describe('Database Migrations', () => {
  let db: Database

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(':memory:')
  })

  describe('runMigrations', () => {
    test('creates projects table on fresh database', () => {
      runMigrations(db)

      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        .all()

      expect(tables.length).toBe(1)
    })

    test('creates items table on fresh database', () => {
      runMigrations(db)

      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='items'")
        .all()

      expect(tables.length).toBe(1)
    })

    test('creates file_cards table', () => {
      runMigrations(db)

      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='file_cards'")
        .all()

      expect(tables.length).toBe(1)
    })

    test('creates settings table', () => {
      runMigrations(db)

      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
        .all()

      expect(tables.length).toBe(1)
    })

    test('sets database version after migrations', () => {
      runMigrations(db)

      const result = db.query('PRAGMA user_version').get() as { user_version: number }

      expect(result.user_version).toBeGreaterThan(0)
    })

    test('is idempotent - running twice has same result', () => {
      runMigrations(db)
      const versionAfterFirst = (db.query('PRAGMA user_version').get() as { user_version: number })
        .user_version

      runMigrations(db)
      const versionAfterSecond = (db.query('PRAGMA user_version').get() as { user_version: number })
        .user_version

      expect(versionAfterSecond).toBe(versionAfterFirst)
    })

    test('skips already applied migrations', () => {
      // Set version to skip some migrations
      db.run('PRAGMA user_version = 5')

      // Only migrations > 5 should run
      runMigrations(db)

      // Should still complete successfully
      const result = db.query('PRAGMA user_version').get() as { user_version: number }
      expect(result.user_version).toBeGreaterThanOrEqual(5)
    })
  })

  describe('projects table schema', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('has id column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'id')).toBe(true)
    })

    test('has name column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'name')).toBe(true)
    })

    test('has description column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'description')).toBe(true)
    })

    test('has metadata column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'metadata')).toBe(true)
    })

    test('has created_at column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'created_at')).toBe(true)
    })

    test('has updated_at column', () => {
      const columns = db.query('PRAGMA table_info(projects)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'updated_at')).toBe(true)
    })
  })

  describe('items table schema', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('has all required columns', () => {
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      const columnNames = columns.map((c) => c.name)

      expect(columnNames).toContain('id')
      expect(columnNames).toContain('project_id')
      expect(columnNames).toContain('type')
      expect(columnNames).toContain('title')
      expect(columnNames).toContain('content')
      expect(columnNames).toContain('ide_type')
      expect(columnNames).toContain('order')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')
    })

    test('has remote_ide_type column (migration 2)', () => {
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'remote_ide_type')).toBe(true)
    })

    test('has command_mode column (migration 3)', () => {
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'command_mode')).toBe(true)
    })

    test('has command_cwd column (migration 4)', () => {
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'command_cwd')).toBe(true)
    })

    test('has command_host column (migration 5)', () => {
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'command_host')).toBe(true)
    })
  })

  describe('file_cards table schema', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('has all required columns', () => {
      const columns = db.query('PRAGMA table_info(file_cards)').all() as { name: string }[]
      const columnNames = columns.map((c) => c.name)

      expect(columnNames).toContain('id')
      expect(columnNames).toContain('project_id')
      expect(columnNames).toContain('filename')
      expect(columnNames).toContain('content')
      expect(columnNames).toContain('position_x')
      expect(columnNames).toContain('position_y')
      expect(columnNames).toContain('is_expanded')
      expect(columnNames).toContain('z_index')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')
    })

    test('has is_minimized column (migration 7)', () => {
      const columns = db.query('PRAGMA table_info(file_cards)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'is_minimized')).toBe(true)
    })
  })

  describe('settings table schema', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('has key column', () => {
      const columns = db.query('PRAGMA table_info(settings)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'key')).toBe(true)
    })

    test('has value column', () => {
      const columns = db.query('PRAGMA table_info(settings)').all() as { name: string }[]
      expect(columns.some((c) => c.name === 'value')).toBe(true)
    })
  })

  describe('foreign key constraints', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('items has foreign key to projects', () => {
      const fkInfo = db.query('PRAGMA foreign_key_list(items)').all() as { table: string }[]
      expect(fkInfo.some((fk) => fk.table === 'projects')).toBe(true)
    })

    test('file_cards has foreign key to projects', () => {
      const fkInfo = db.query('PRAGMA foreign_key_list(file_cards)').all() as { table: string }[]
      expect(fkInfo.some((fk) => fk.table === 'projects')).toBe(true)
    })
  })

  describe('data integrity', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    test('can insert and retrieve project', () => {
      const now = new Date().toISOString()
      db.run(
        'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['test-id', 'Test Project', 'Description', '{}', now, now]
      )

      const result = db.query('SELECT * FROM projects WHERE id = ?').get('test-id') as {
        name: string
      }
      expect(result.name).toBe('Test Project')
    })

    test('can insert and retrieve item', () => {
      const now = new Date().toISOString()
      // First create a project
      db.run(
        'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['proj-1', 'Project', '', '{}', now, now]
      )

      // Then create an item
      db.run(
        'INSERT INTO items (id, project_id, type, title, content, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['item-1', 'proj-1', 'note', 'Test Note', 'Content', 0, now, now]
      )

      const result = db.query('SELECT * FROM items WHERE id = ?').get('item-1') as { title: string }
      expect(result.title).toBe('Test Note')
    })

    test('can insert and retrieve file_card', () => {
      const now = new Date().toISOString()
      // First create a project
      db.run(
        'INSERT INTO projects (id, name, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['proj-1', 'Project', '', '{}', now, now]
      )

      // Then create a file card
      db.run(
        'INSERT INTO file_cards (id, project_id, filename, content, position_x, position_y, is_expanded, is_minimized, z_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['card-1', 'proj-1', 'test.txt', 'content', 10, 20, 0, 0, 1, now, now]
      )

      const result = db.query('SELECT * FROM file_cards WHERE id = ?').get('card-1') as {
        filename: string
      }
      expect(result.filename).toBe('test.txt')
    })

    test('can insert and retrieve setting', () => {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['testKey', 'testValue'])

      const result = db.query('SELECT * FROM settings WHERE key = ?').get('testKey') as {
        value: string
      }
      expect(result.value).toBe('testValue')
    })
  })

  describe('incremental migration', () => {
    test('applies only new migrations when starting from version 0', () => {
      // Start fresh
      runMigrations(db)

      const version = (db.query('PRAGMA user_version').get() as { user_version: number })
        .user_version

      // Should be at the latest version (9 based on the migration file)
      expect(version).toBe(9)
    })

    test('applies remaining migrations when starting from middle version', () => {
      // Manually create initial tables and set version to 4
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
          remote_ide_type TEXT,
          command_mode TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)
      db.run('PRAGMA user_version = 4')

      // Run migrations - should only run 5+
      runMigrations(db)

      // Check that command_cwd column exists (migration 4)
      const columns = db.query('PRAGMA table_info(items)').all() as { name: string }[]
      // command_host is from migration 5
      expect(columns.some((c) => c.name === 'command_host')).toBe(true)
    })
  })
})
