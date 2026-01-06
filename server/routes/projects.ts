import { Hono } from 'hono'
import * as db from '../db'

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
  const { type, title, content, ide_type, remote_ide_type, command_mode, command_cwd, command_host } = body

  if (!type || !title) {
    return c.json({ error: 'Type and title are required' }, 400)
  }

  const item = db.createItem(projectId, type, title, content, ide_type, remote_ide_type, command_mode, command_cwd, command_host)
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

export default app
