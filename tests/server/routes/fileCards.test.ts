import { describe, test, expect, beforeEach, spyOn } from 'bun:test'
import { Hono } from 'hono'
import * as db from '../../../server/db'

// Create test app that mirrors fileCards.ts
function createTestApp() {
  const DEFAULT_MAX_FILE_SIZE = 1024 * 1024

  function getMaxFileSize(): number {
    const setting = db.getSetting('fileCardMaxSize')
    return setting ? Number(setting) : DEFAULT_MAX_FILE_SIZE
  }

  const app = new Hono()

  // GET /api/projects/:projectId/file-cards
  app.get('/:projectId/file-cards', (c) => {
    const projectId = c.req.param('projectId')
    const cards = db.getFileCardsByProject(projectId)
    return c.json(cards)
  })

  // POST /api/projects/:projectId/file-cards
  app.post('/:projectId/file-cards', async (c) => {
    const projectId = c.req.param('projectId')
    const body = await c.req.json()
    const { filename, content, position_x, position_y } = body

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

  // PUT /api/file-cards/:id
  app.put('/:id', async (c) => {
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

  // DELETE /api/file-cards/:id
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const success = db.deleteFileCard(id)

    if (!success) {
      return c.json({ error: 'File card not found' }, 404)
    }

    return c.json({ success: true })
  })

  return app
}

describe('File Cards Routes', () => {
  const mockCard = {
    id: 'card-1',
    project_id: 'project-1',
    filename: 'test.txt',
    content: 'Hello World',
    position_x: 50,
    position_y: 50,
    is_expanded: 0,
    is_minimized: 0,
    z_index: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    spyOn(db, 'getFileCardsByProject').mockReturnValue([mockCard])
    spyOn(db, 'createFileCard').mockReturnValue(mockCard)
    spyOn(db, 'updateFileCard').mockReturnValue(mockCard)
    spyOn(db, 'deleteFileCard').mockReturnValue(true)
    spyOn(db, 'getSetting').mockReturnValue(null)
  })

  describe('GET /:projectId/file-cards', () => {
    test('should return all file cards for a project', async () => {
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual([mockCard])
      expect(db.getFileCardsByProject).toHaveBeenCalledWith('project-1')
    })

    test('should return empty array when no cards exist', async () => {
      spyOn(db, 'getFileCardsByProject').mockReturnValue([])
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual([])
    })
  })

  describe('POST /:projectId/file-cards', () => {
    test('should create a new file card', async () => {
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'Hello World',
          position_x: 50,
          position_y: 50,
        }),
      })
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.filename).toBe('test.txt')
    })

    test('should use default position when not provided', async () => {
      const app = createTestApp()
      await app.request('/project-1/file-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'Hello World',
        }),
      })
      expect(db.createFileCard).toHaveBeenCalledWith('project-1', 'test.txt', 'Hello World', 100, 100)
    })

    test('should return 400 when filename is missing', async () => {
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello World' }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('filename is required')
    })

    test('should return 400 when content is missing', async () => {
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'test.txt' }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('content is required')
    })

    test('should return 400 when file is too large', async () => {
      // Set max file size to 10 bytes
      spyOn(db, 'getSetting').mockReturnValue('10')
      const app = createTestApp()
      const res = await app.request('/project-1/file-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'This content is longer than 10 bytes',
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('File too large')
    })
  })

  describe('PUT /:id', () => {
    test('should update a file card', async () => {
      const app = createTestApp()
      const res = await app.request('/card-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_x: 75,
          position_y: 25,
        }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('card-1')
    })

    test('should return 404 when card not found', async () => {
      spyOn(db, 'updateFileCard').mockReturnValue(null)
      const app = createTestApp()
      const res = await app.request('/non-existent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_x: 50 }),
      })
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('File card not found')
    })

    test('should update is_minimized state', async () => {
      const app = createTestApp()
      await app.request('/card-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_minimized: 1 }),
      })
      expect(db.updateFileCard).toHaveBeenCalledWith('card-1', expect.objectContaining({ is_minimized: 1 }))
    })
  })

  describe('DELETE /:id', () => {
    test('should delete a file card', async () => {
      const app = createTestApp()
      const res = await app.request('/card-1', { method: 'DELETE' })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    test('should return 404 when card not found', async () => {
      spyOn(db, 'deleteFileCard').mockReturnValue(false)
      const app = createTestApp()
      const res = await app.request('/non-existent', { method: 'DELETE' })
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('File card not found')
    })
  })
})
