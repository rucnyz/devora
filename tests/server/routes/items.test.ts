import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { Hono } from 'hono'
import * as db from '../../../server/db'

function createTestApp() {
  const app = new Hono()

  // Update item
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()

    const item = db.updateItem(id, body)

    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }

    return c.json(item)
  })

  // Delete item
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = db.deleteItem(id)

    if (!deleted) {
      return c.json({ error: 'Item not found' }, 404)
    }

    return c.json({ success: true })
  })

  return app
}

describe('Items Routes', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    mock.restore()
  })

  describe('PUT /:id', () => {
    test('returns 404 for non-existent item', async () => {
      spyOn(db, 'updateItem').mockReturnValue(null)

      const res = await app.request('/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('Item not found')
    })

    test('updates and returns item', async () => {
      const mockItem = {
        id: 'item-1',
        project_id: 'project-1',
        type: 'note',
        title: 'Updated Title',
        content: 'Updated content',
        order: 0,
        created_at: '',
        updated_at: '',
      }
      spyOn(db, 'updateItem').mockReturnValue(mockItem as any)

      const res = await app.request('/item-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title', content: 'Updated content' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.title).toBe('Updated Title')
      expect(data.content).toBe('Updated content')
    })

    test('passes updates to updateItem', async () => {
      const updateSpy = spyOn(db, 'updateItem').mockReturnValue({
        id: '1', project_id: '1', type: 'note', title: 'Test', content: '', order: 0, created_at: '', updated_at: ''
      } as any)

      await app.request('/item-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title', content: 'New Content' }),
      })

      expect(updateSpy).toHaveBeenCalledWith('item-1', { title: 'New Title', content: 'New Content' })
    })
  })

  describe('DELETE /:id', () => {
    test('returns 404 for non-existent item', async () => {
      spyOn(db, 'deleteItem').mockReturnValue(false)

      const res = await app.request('/nonexistent', { method: 'DELETE' })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('Item not found')
    })

    test('deletes item and returns success', async () => {
      spyOn(db, 'deleteItem').mockReturnValue(true)

      const res = await app.request('/item-1', { method: 'DELETE' })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    test('calls deleteItem with correct id', async () => {
      const deleteSpy = spyOn(db, 'deleteItem').mockReturnValue(true)

      await app.request('/test-item-id', { method: 'DELETE' })

      expect(deleteSpy).toHaveBeenCalledWith('test-item-id')
    })
  })
})
