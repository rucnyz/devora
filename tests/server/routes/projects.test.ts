import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { Hono } from 'hono'
import * as db from '../../../server/db'

// Create a fresh app for each test to avoid state pollution
function createTestApp() {
  const app = new Hono()

  // Get all projects
  app.get('/', (c) => {
    const projects = db.getAllProjects()
    return c.json(projects)
  })

  // Get single project with items
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const project = db.getProjectById(id)

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(project)
  })

  // Create project
  app.post('/', async (c) => {
    const body = await c.req.json()
    const { name, description, metadata } = body

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const project = db.createProject(name, description, metadata)
    return c.json(project, 201)
  })

  // Update project
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()

    const project = db.updateProject(id, body)

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(project)
  })

  // Delete project
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = db.deleteProject(id)

    if (!deleted) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ success: true })
  })

  // Add item to project
  app.post('/:id/items', async (c) => {
    const projectId = c.req.param('id')
    const body = await c.req.json()
    const { type, title, content, ide_type, remote_ide_type, command_mode, command_cwd } = body

    if (!type || !title) {
      return c.json({ error: 'Type and title are required' }, 400)
    }

    const item = db.createItem(projectId, type, title, content, ide_type, remote_ide_type, command_mode, command_cwd)
    return c.json(item, 201)
  })

  // Reorder items
  app.put('/:id/items/reorder', async (c) => {
    const projectId = c.req.param('id')
    const body = await c.req.json()
    const { itemIds } = body

    if (!Array.isArray(itemIds)) {
      return c.json({ error: 'itemIds array is required' }, 400)
    }

    db.reorderItems(projectId, itemIds)
    return c.json({ success: true })
  })

  return app
}

describe('Projects Routes', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    mock.restore()
  })

  describe('GET /', () => {
    test('returns empty array when no projects', async () => {
      spyOn(db, 'getAllProjects').mockReturnValue([])

      const res = await app.request('/')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual([])
    })

    test('returns all projects', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', description: '', metadata: {}, created_at: '', updated_at: '' },
        { id: '2', name: 'Project 2', description: '', metadata: {}, created_at: '', updated_at: '' },
      ]
      spyOn(db, 'getAllProjects').mockReturnValue(mockProjects)

      const res = await app.request('/')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.length).toBe(2)
    })
  })

  describe('GET /:id', () => {
    test('returns 404 for non-existent project', async () => {
      spyOn(db, 'getProjectById').mockReturnValue(null)

      const res = await app.request('/nonexistent')

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('Project not found')
    })

    test('returns project with items', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        description: 'Test',
        metadata: {},
        created_at: '',
        updated_at: '',
        items: [{ id: 'item1', title: 'Item 1' }],
      }
      spyOn(db, 'getProjectById').mockReturnValue(mockProject as any)

      const res = await app.request('/1')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Test Project')
      expect(data.items.length).toBe(1)
    })
  })

  describe('POST /', () => {
    test('returns 400 when name is missing', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No name' }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Name is required')
    })

    test('creates project and returns 201', async () => {
      const mockProject = {
        id: 'new-id',
        name: 'New Project',
        description: '',
        metadata: {},
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'createProject').mockReturnValue(mockProject)

      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project' }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.name).toBe('New Project')
      expect(data.id).toBe('new-id')
    })

    test('passes metadata to createProject', async () => {
      const createProjectSpy = spyOn(db, 'createProject').mockReturnValue({
        id: '1', name: 'Test', description: '', metadata: { github_url: 'https://github.com/test' }, created_at: '', updated_at: ''
      })

      await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          description: 'Desc',
          metadata: { github_url: 'https://github.com/test' }
        }),
      })

      expect(createProjectSpy).toHaveBeenCalledWith('Test', 'Desc', { github_url: 'https://github.com/test' })
    })

    test('creates project with working_dirs in metadata', async () => {
      const workingDirs = [
        { name: 'main', path: '/home/user/project' },
        { name: 'remote', path: '/var/www', host: 'server1' },
      ]
      const createProjectSpy = spyOn(db, 'createProject').mockReturnValue({
        id: '1', name: 'Test', description: '', metadata: { working_dirs: workingDirs }, created_at: '', updated_at: ''
      })

      await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          metadata: { working_dirs: workingDirs }
        }),
      })

      expect(createProjectSpy).toHaveBeenCalledWith('Test', undefined, { working_dirs: workingDirs })
    })
  })

  describe('PUT /:id', () => {
    test('returns 404 for non-existent project', async () => {
      spyOn(db, 'updateProject').mockReturnValue(null)

      const res = await app.request('/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      })

      expect(res.status).toBe(404)
    })

    test('updates and returns project', async () => {
      const mockProject = {
        id: '1',
        name: 'Updated Project',
        description: '',
        metadata: {},
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'updateProject').mockReturnValue(mockProject)

      const res = await app.request('/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Project' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Updated Project')
    })

    test('updates project metadata with working_dirs', async () => {
      const workingDirs = [
        { name: 'local-project', path: 'C:\\Users\\test\\project' },
        { name: 'remote-server', path: '/home/user/project', host: 'myserver' },
      ]
      const mockProject = {
        id: '1',
        name: 'Project',
        description: '',
        metadata: { working_dirs: workingDirs },
        created_at: '',
        updated_at: '',
      }
      const updateSpy = spyOn(db, 'updateProject').mockReturnValue(mockProject)

      const res = await app.request('/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { working_dirs: workingDirs } }),
      })

      expect(res.status).toBe(200)
      expect(updateSpy).toHaveBeenCalledWith('1', { metadata: { working_dirs: workingDirs } })
      const data = await res.json()
      expect(data.metadata.working_dirs).toEqual(workingDirs)
    })

    test('working_dirs supports local dirs without host', async () => {
      const workingDirs = [
        { name: 'main', path: '/home/user/project' },
      ]
      const mockProject = {
        id: '1',
        name: 'Project',
        description: '',
        metadata: { working_dirs: workingDirs },
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'updateProject').mockReturnValue(mockProject)

      const res = await app.request('/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { working_dirs: workingDirs } }),
      })

      const data = await res.json()
      expect(data.metadata.working_dirs[0].host).toBeUndefined()
    })

    test('working_dirs supports remote dirs with host', async () => {
      const workingDirs = [
        { name: 'remote', path: '/var/www/app', host: 'production-server' },
      ]
      const mockProject = {
        id: '1',
        name: 'Project',
        description: '',
        metadata: { working_dirs: workingDirs },
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'updateProject').mockReturnValue(mockProject)

      const res = await app.request('/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { working_dirs: workingDirs } }),
      })

      const data = await res.json()
      expect(data.metadata.working_dirs[0].name).toBe('remote')
      expect(data.metadata.working_dirs[0].path).toBe('/var/www/app')
      expect(data.metadata.working_dirs[0].host).toBe('production-server')
    })
  })

  describe('DELETE /:id', () => {
    test('returns 404 for non-existent project', async () => {
      spyOn(db, 'deleteProject').mockReturnValue(false)

      const res = await app.request('/nonexistent', { method: 'DELETE' })

      expect(res.status).toBe(404)
    })

    test('deletes project and returns success', async () => {
      spyOn(db, 'deleteProject').mockReturnValue(true)

      const res = await app.request('/1', { method: 'DELETE' })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('POST /:id/items', () => {
    test('returns 400 when type is missing', async () => {
      const res = await app.request('/1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No type' }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Type and title are required')
    })

    test('returns 400 when title is missing', async () => {
      const res = await app.request('/1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note' }),
      })

      expect(res.status).toBe(400)
    })

    test('creates item and returns 201', async () => {
      const mockItem = {
        id: 'item-id',
        project_id: '1',
        type: 'note',
        title: 'New Note',
        content: 'Content',
        order: 0,
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'createItem').mockReturnValue(mockItem as any)

      const res = await app.request('/1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: 'New Note', content: 'Content' }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.title).toBe('New Note')
    })
  })

  describe('PUT /:id/items/reorder', () => {
    test('returns 400 when itemIds is not an array', async () => {
      const res = await app.request('/1/items/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: 'not-an-array' }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('itemIds array is required')
    })

    test('reorders items and returns success', async () => {
      const reorderSpy = spyOn(db, 'reorderItems').mockReturnValue(undefined)

      const res = await app.request('/1/items/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ['item1', 'item2', 'item3'] }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(reorderSpy).toHaveBeenCalledWith('1', ['item1', 'item2', 'item3'])
    })
  })
})
