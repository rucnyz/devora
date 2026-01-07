import { Hono } from 'hono'
import { getSetting, setSetting, deleteSetting, getAllSettings } from '../db'

const app = new Hono()

// Get all settings
app.get('/', (c) => {
  const settings = getAllSettings()
  return c.json(settings)
})

// Get a specific setting
app.get('/:key', (c) => {
  const key = c.req.param('key')
  const value = getSetting(key)
  return c.json({ key, value })
})

// Set a setting
app.put('/:key', async (c) => {
  const key = c.req.param('key')
  const body = await c.req.json()
  setSetting(key, body.value)
  return c.json({ key, value: body.value })
})

// Delete a setting
app.delete('/:key', (c) => {
  const key = c.req.param('key')
  deleteSetting(key)
  return c.json({ success: true })
})

export default app
