import { Hono } from 'hono'
import * as db from '../db'

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

export default app
