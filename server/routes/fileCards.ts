import { Hono } from 'hono'
import * as db from '../db'

const app = new Hono()

// Default max file size: 1MB
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024

function getMaxFileSize(): number {
  const setting = db.getSetting('fileCardMaxSize')
  return setting ? Number(setting) : DEFAULT_MAX_FILE_SIZE
}

// GET /api/projects/:projectId/file-cards - Get all file cards for a project
app.get('/:projectId/file-cards', (c) => {
  const projectId = c.req.param('projectId')
  const cards = db.getFileCardsByProject(projectId)
  return c.json(cards)
})

// POST /api/projects/:projectId/file-cards - Create a new file card
app.post('/:projectId/file-cards', async (c) => {
  const projectId = c.req.param('projectId')
  const body = await c.req.json()
  const { filename, content, position_x, position_y } = body

  // Validation
  if (!filename || typeof filename !== 'string') {
    return c.json({ error: 'filename is required' }, 400)
  }
  if (!content || typeof content !== 'string') {
    return c.json({ error: 'content is required' }, 400)
  }

  const maxSize = getMaxFileSize()
  if (content.length > maxSize) {
    const maxMb = (maxSize / (1024 * 1024)).toFixed(1)
    return c.json({ error: `File too large (max ${maxMb}MB)` }, 400)
  }

  const card = db.createFileCard(projectId, filename, content, position_x ?? 100, position_y ?? 100)
  return c.json(card, 201)
})

export default app

// Separate routes for direct file card access (update/delete)
export const fileCardsDirectRoutes = new Hono()

// PUT /api/file-cards/:id - Update a file card
fileCardsDirectRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { filename, content, position_x, position_y, is_expanded, is_minimized, z_index } = body

  const card = db.updateFileCard(id, {
    filename,
    content,
    position_x,
    position_y,
    is_expanded,
    is_minimized,
    z_index,
  })

  if (!card) {
    return c.json({ error: 'File card not found' }, 404)
  }

  return c.json(card)
})

// DELETE /api/file-cards/:id - Delete a file card
fileCardsDirectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const success = db.deleteFileCard(id)

  if (!success) {
    return c.json({ error: 'File card not found' }, 404)
  }

  return c.json({ success: true })
})
