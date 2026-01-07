import type { Database } from 'bun:sqlite'

// Migration helpers
function getDbVersion(db: Database): number {
  const result = db.query('PRAGMA user_version').get() as { user_version: number }
  return result.user_version
}

function setDbVersion(db: Database, version: number): void {
  db.run(`PRAGMA user_version = ${version}`)
}

function columnExists(db: Database, table: string, column: string): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return columns.some((col) => col.name === column)
}

function addColumnIfNotExists(db: Database, table: string, column: string, definition: string): void {
  if (!columnExists(db, table, column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

// Migration definitions - each migration is idempotent (safe to run multiple times)
const MIGRATIONS: Array<{ version: number; description: string; up: (db: Database) => void }> = [
  {
    version: 1,
    description: 'Create initial tables (projects, items)',
    up: (db) => {
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
    },
  },
  {
    version: 2,
    description: 'Add remote_ide_type to items',
    up: (db) => addColumnIfNotExists(db, 'items', 'remote_ide_type', 'TEXT'),
  },
  {
    version: 3,
    description: 'Add command_mode to items',
    up: (db) => addColumnIfNotExists(db, 'items', 'command_mode', 'TEXT'),
  },
  {
    version: 4,
    description: 'Add command_cwd to items',
    up: (db) => addColumnIfNotExists(db, 'items', 'command_cwd', 'TEXT'),
  },
  {
    version: 5,
    description: 'Add command_host to items',
    up: (db) => addColumnIfNotExists(db, 'items', 'command_host', 'TEXT'),
  },
  {
    version: 6,
    description: 'Create file_cards table',
    up: (db) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS file_cards (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          content TEXT NOT NULL,
          position_x REAL NOT NULL DEFAULT 100,
          position_y REAL NOT NULL DEFAULT 100,
          is_expanded INTEGER NOT NULL DEFAULT 0,
          z_index INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)
    },
  },
  {
    version: 7,
    description: 'Add is_minimized to file_cards',
    up: (db) => addColumnIfNotExists(db, 'file_cards', 'is_minimized', 'INTEGER NOT NULL DEFAULT 0'),
  },
  {
    version: 8,
    description: 'Create settings table',
    up: (db) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `)
    },
  },
  {
    version: 9,
    description: 'Convert file_cards positions from pixels to percentage',
    up: (db) => {
      // Reference resolution for conversion (common desktop resolution)
      const REF_WIDTH = 1920
      const REF_HEIGHT = 1080

      // Get all file cards with pixel-like positions (> 100 likely means pixels)
      const cards = db.query('SELECT id, position_x, position_y FROM file_cards').all() as {
        id: string
        position_x: number
        position_y: number
      }[]

      for (const card of cards) {
        // If values look like pixels (> 100), convert to percentage
        if (card.position_x > 100 || card.position_y > 100) {
          const percentX = (card.position_x / REF_WIDTH) * 100
          const percentY = (card.position_y / REF_HEIGHT) * 100
          db.run('UPDATE file_cards SET position_x = ?, position_y = ? WHERE id = ?', [percentX, percentY, card.id])
        }
      }
    },
  },
]

// Run migrations
export function runMigrations(db: Database): void {
  const currentVersion = getDbVersion(db)
  const targetVersion = MIGRATIONS.length

  if (currentVersion >= targetVersion) {
    console.log(`Database is up to date (version ${currentVersion})`)
    return
  }

  console.log(`Migrating database from version ${currentVersion} to ${targetVersion}`)

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`  Running migration ${migration.version}: ${migration.description}`)
      migration.up(db)
      setDbVersion(db, migration.version)
    }
  }

  console.log(`Database migration complete (version ${targetVersion})`)
}
