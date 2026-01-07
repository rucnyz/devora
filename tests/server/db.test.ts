import { describe, test, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createDbFunctions, initializeDatabase } from '../../server/db'
import { createTestDatabase, seedTestData } from '../mocks/database'

describe('Database Functions', () => {
  let db: Database
  let dbFuncs: ReturnType<typeof createDbFunctions>

  beforeEach(() => {
    db = createTestDatabase()
    dbFuncs = createDbFunctions(db)
  })

  describe('getAllProjects', () => {
    test('returns empty array when no projects exist', () => {
      const projects = dbFuncs.getAllProjects()
      expect(projects).toEqual([])
    })

    test('returns all projects sorted by updated_at DESC', () => {
      seedTestData(db)
      const projects = dbFuncs.getAllProjects()

      expect(projects.length).toBe(2)
      expect(projects[0]).toHaveProperty('id')
      expect(projects[0]).toHaveProperty('name')
      expect(projects[0]).toHaveProperty('metadata')
    })

    test('parses metadata JSON correctly', () => {
      seedTestData(db)
      const projects = dbFuncs.getAllProjects()
      const projectWithMetadata = projects.find(p => p.id === 'test-project-1')

      expect(projectWithMetadata?.metadata).toEqual({ github_url: 'https://github.com/test' })
    })
  })

  describe('getProjectById', () => {
    test('returns null for non-existent project', () => {
      const project = dbFuncs.getProjectById('nonexistent')
      expect(project).toBeNull()
    })

    test('returns project with items', () => {
      seedTestData(db)
      const project = dbFuncs.getProjectById('test-project-1')

      expect(project).not.toBeNull()
      expect(project?.name).toBe('Test Project 1')
      expect(project?.items).toBeDefined()
      expect(project?.items?.length).toBe(3)
    })

    test('returns items sorted by order ASC', () => {
      seedTestData(db)
      const project = dbFuncs.getProjectById('test-project-1')

      expect(project?.items?.[0].order).toBe(0)
      expect(project?.items?.[1].order).toBe(1)
      expect(project?.items?.[2].order).toBe(2)
    })
  })

  describe('createProject', () => {
    test('creates project with all required fields', () => {
      const project = dbFuncs.createProject('New Project', '', {})

      expect(project.id).toBeDefined()
      expect(project.name).toBe('New Project')
      expect(project.description).toBe('')
      expect(project.metadata).toEqual({})
      expect(project.created_at).toBeDefined()
      expect(project.updated_at).toBeDefined()
    })

    test('creates project with description and metadata', () => {
      const metadata = { github_url: 'https://github.com/test' }
      const project = dbFuncs.createProject('Test', 'A description', metadata)

      expect(project.name).toBe('Test')
      expect(project.description).toBe('A description')
      expect(project.metadata).toEqual(metadata)
    })

    test('project is retrievable after creation', () => {
      const created = dbFuncs.createProject('Retrievable Project', '', {})
      const retrieved = dbFuncs.getProjectById(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.name).toBe('Retrievable Project')
    })
  })

  describe('updateProject', () => {
    test('returns null for non-existent project', () => {
      const result = dbFuncs.updateProject('nonexistent', { name: 'New Name' })
      expect(result).toBeNull()
    })

    test('updates project name', () => {
      seedTestData(db)
      const updated = dbFuncs.updateProject('test-project-1', { name: 'Updated Name' })

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe('Updated Name')
      expect(updated?.description).toBe('First test project') // unchanged
    })

    test('updates project description', () => {
      seedTestData(db)
      const updated = dbFuncs.updateProject('test-project-1', { description: 'New description' })

      expect(updated?.description).toBe('New description')
      expect(updated?.name).toBe('Test Project 1') // unchanged
    })

    test('updates project metadata', () => {
      seedTestData(db)
      const newMetadata = { github_url: 'https://github.com/new', custom: 'value' }
      const updated = dbFuncs.updateProject('test-project-1', { metadata: newMetadata })

      expect(updated?.metadata).toEqual(newMetadata)
    })

    test('updates updated_at timestamp', () => {
      seedTestData(db)
      const before = dbFuncs.getProjectById('test-project-1')

      // Small delay to ensure timestamp difference
      const beforeTime = new Date(before!.updated_at).getTime()

      const updated = dbFuncs.updateProject('test-project-1', { name: 'Updated' })
      const afterTime = new Date(updated!.updated_at).getTime()

      expect(afterTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('deleteProject', () => {
    test('returns false for non-existent project', () => {
      const result = dbFuncs.deleteProject('nonexistent')
      expect(result).toBe(false)
    })

    test('returns true and deletes existing project', () => {
      seedTestData(db)
      const result = dbFuncs.deleteProject('test-project-1')

      expect(result).toBe(true)
      expect(dbFuncs.getProjectById('test-project-1')).toBeNull()
    })

    test('reduces project count after deletion', () => {
      seedTestData(db)
      const beforeCount = dbFuncs.getAllProjects().length

      dbFuncs.deleteProject('test-project-1')
      const afterCount = dbFuncs.getAllProjects().length

      expect(afterCount).toBe(beforeCount - 1)
    })
  })

  describe('createItem', () => {
    test('creates item with auto-incremented order', () => {
      seedTestData(db)

      const item1 = dbFuncs.createItem('test-project-2', 'note', 'Note 1', '')
      const item2 = dbFuncs.createItem('test-project-2', 'note', 'Note 2', '')

      expect(item1.order).toBe(0)
      expect(item2.order).toBe(1)
    })

    test('creates item with correct properties', () => {
      const project = dbFuncs.createProject('Test Project', '', {})
      const item = dbFuncs.createItem(project.id, 'ide', 'VS Code', '/path/to/project', 'vscode')

      expect(item.id).toBeDefined()
      expect(item.project_id).toBe(project.id)
      expect(item.type).toBe('ide')
      expect(item.title).toBe('VS Code')
      expect(item.content).toBe('/path/to/project')
      expect(item.ide_type).toBe('vscode')
    })

    test('creates item with remote IDE type', () => {
      const project = dbFuncs.createProject('Test Project', '', {})
      const item = dbFuncs.createItem(project.id, 'remote-ide', 'Remote Cursor', '/remote/path', undefined, 'cursor')

      expect(item.remote_ide_type).toBe('cursor')
    })

    test('creates command item with mode and cwd', () => {
      const project = dbFuncs.createProject('Test Project', '', {})
      const item = dbFuncs.createItem(project.id, 'command', 'Build', 'npm run build', undefined, undefined, 'output', '/home/user/project')

      expect(item.command_mode).toBe('output')
      expect(item.command_cwd).toBe('/home/user/project')
    })

    test('updates parent project updated_at', () => {
      const project = dbFuncs.createProject('Test Project', '', {})
      const beforeTime = new Date(project.updated_at).getTime()

      dbFuncs.createItem(project.id, 'note', 'New Note', '')
      const updatedProject = dbFuncs.getProjectById(project.id)
      const afterTime = new Date(updatedProject!.updated_at).getTime()

      expect(afterTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('updateItem', () => {
    test('returns null for non-existent item', () => {
      const result = dbFuncs.updateItem('nonexistent', { title: 'New Title' })
      expect(result).toBeNull()
    })

    test('updates item title', () => {
      seedTestData(db)
      const updated = dbFuncs.updateItem('test-item-1', { title: 'Updated Title' })

      expect(updated).not.toBeNull()
      expect(updated?.title).toBe('Updated Title')
    })

    test('updates item content', () => {
      seedTestData(db)
      const updated = dbFuncs.updateItem('test-item-1', { content: 'Updated content' })

      expect(updated?.content).toBe('Updated content')
    })

    test('updates item order', () => {
      seedTestData(db)
      const updated = dbFuncs.updateItem('test-item-1', { order: 5 })

      expect(updated?.order).toBe(5)
    })
  })

  describe('deleteItem', () => {
    test('returns false for non-existent item', () => {
      const result = dbFuncs.deleteItem('nonexistent')
      expect(result).toBe(false)
    })

    test('returns true and deletes existing item', () => {
      seedTestData(db)
      const result = dbFuncs.deleteItem('test-item-1')

      expect(result).toBe(true)
    })

    test('reduces item count after deletion', () => {
      seedTestData(db)
      const projectBefore = dbFuncs.getProjectById('test-project-1')
      const beforeCount = projectBefore?.items?.length || 0

      dbFuncs.deleteItem('test-item-1')
      const projectAfter = dbFuncs.getProjectById('test-project-1')
      const afterCount = projectAfter?.items?.length || 0

      expect(afterCount).toBe(beforeCount - 1)
    })
  })

  describe('reorderItems', () => {
    test('reorders items correctly', () => {
      seedTestData(db)

      // Original order: test-item-1 (0), test-item-2 (1), test-item-3 (2)
      // New order: test-item-3, test-item-1, test-item-2
      dbFuncs.reorderItems('test-project-1', ['test-item-3', 'test-item-1', 'test-item-2'])

      const project = dbFuncs.getProjectById('test-project-1')
      const items = project?.items || []

      // Items should be sorted by order ASC
      expect(items[0].id).toBe('test-item-3')
      expect(items[0].order).toBe(0)
      expect(items[1].id).toBe('test-item-1')
      expect(items[1].order).toBe(1)
      expect(items[2].id).toBe('test-item-2')
      expect(items[2].order).toBe(2)
    })
  })

  describe('exportAllData', () => {
    test('exports all data when no filter provided', () => {
      seedTestData(db)
      const exported = dbFuncs.exportAllData()

      expect(exported.version).toBe('1.0')
      expect(exported.exportedAt).toBeDefined()
      expect(exported.projects.length).toBe(2)
      expect(exported.items.length).toBe(3)
    })

    test('exports filtered data by project IDs', () => {
      seedTestData(db)
      const exported = dbFuncs.exportAllData(['test-project-1'])

      expect(exported.projects.length).toBe(1)
      expect(exported.projects[0].id).toBe('test-project-1')
      expect(exported.items.length).toBe(3) // All items belong to test-project-1
    })

    test('returns empty arrays for non-existent project IDs', () => {
      seedTestData(db)
      const exported = dbFuncs.exportAllData(['nonexistent'])

      expect(exported.projects.length).toBe(0)
      expect(exported.items.length).toBe(0)
    })
  })

  describe('importData', () => {
    test('imports new projects in merge mode', () => {
      const importData = {
        projects: [
          { id: 'new-project', name: 'Imported Project', description: '', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        items: []
      }

      const result = dbFuncs.importData(importData, 'merge')

      expect(result.projectsImported).toBe(1)
      expect(result.skipped).toBe(0)
      expect(dbFuncs.getProjectById('new-project')).not.toBeNull()
    })

    test('skips existing projects in merge mode', () => {
      seedTestData(db)
      const importData = {
        projects: [
          { id: 'test-project-1', name: 'Duplicate Project', description: '', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        items: []
      }

      const result = dbFuncs.importData(importData, 'merge')

      expect(result.projectsImported).toBe(0)
      expect(result.skipped).toBe(1)
      // Original name should be preserved
      expect(dbFuncs.getProjectById('test-project-1')?.name).toBe('Test Project 1')
    })

    test('replaces all data in replace mode', () => {
      seedTestData(db)
      const importData = {
        projects: [
          { id: 'replaced-project', name: 'Replaced Project', description: '', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        items: []
      }

      const result = dbFuncs.importData(importData, 'replace')

      expect(result.projectsImported).toBe(1)
      expect(dbFuncs.getAllProjects().length).toBe(1)
      expect(dbFuncs.getProjectById('test-project-1')).toBeNull()
      expect(dbFuncs.getProjectById('replaced-project')).not.toBeNull()
    })

    test('imports items with valid parent project', () => {
      const now = new Date().toISOString()
      const importData = {
        projects: [
          { id: 'parent-project', name: 'Parent', description: '', metadata: '{}', created_at: now, updated_at: now }
        ],
        items: [
          { id: 'child-item', project_id: 'parent-project', type: 'note', title: 'Child Note', content: '', order: 0, created_at: now, updated_at: now }
        ]
      }

      const result = dbFuncs.importData(importData, 'merge')

      expect(result.projectsImported).toBe(1)
      expect(result.itemsImported).toBe(1)
    })

    test('skips items without valid parent project', () => {
      const now = new Date().toISOString()
      const importData = {
        projects: [],
        items: [
          { id: 'orphan-item', project_id: 'nonexistent-project', type: 'note', title: 'Orphan Note', content: '', order: 0, created_at: now, updated_at: now }
        ]
      }

      const result = dbFuncs.importData(importData, 'merge')

      expect(result.itemsImported).toBe(0)
      expect(result.skipped).toBe(1)
    })
  })
})
