import { describe, test, expect, beforeEach, spyOn } from 'bun:test'
import { Hono } from 'hono'
import * as db from '../../../server/db'

// Create test app that mirrors settings.ts
function createTestApp() {
  const app = new Hono()

  // Get all settings
  app.get('/', (c) => {
    const settings = db.getAllSettings()
    return c.json(settings)
  })

  // Get a specific setting
  app.get('/:key', (c) => {
    const key = c.req.param('key')
    const value = db.getSetting(key)
    return c.json({ key, value })
  })

  // Set a setting
  app.put('/:key', async (c) => {
    const key = c.req.param('key')
    const body = await c.req.json()
    db.setSetting(key, body.value)
    return c.json({ key, value: body.value })
  })

  // Delete a setting
  app.delete('/:key', (c) => {
    const key = c.req.param('key')
    db.deleteSetting(key)
    return c.json({ success: true })
  })

  return app
}

describe('Settings Routes', () => {
  beforeEach(() => {
    spyOn(db, 'getAllSettings').mockReturnValue({ theme: 'dark', fileCardMaxSize: '1048576' })
    spyOn(db, 'getSetting').mockReturnValue('dark')
    spyOn(db, 'setSetting').mockReturnValue(undefined)
    spyOn(db, 'deleteSetting').mockReturnValue(undefined)
  })

  describe('GET /', () => {
    test('should return all settings', async () => {
      const app = createTestApp()
      const res = await app.request('/')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ theme: 'dark', fileCardMaxSize: '1048576' })
    })

    test('should return empty object when no settings exist', async () => {
      spyOn(db, 'getAllSettings').mockReturnValue({})
      const app = createTestApp()
      const res = await app.request('/')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({})
    })
  })

  describe('GET /:key', () => {
    test('should return a specific setting', async () => {
      const app = createTestApp()
      const res = await app.request('/theme')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ key: 'theme', value: 'dark' })
      expect(db.getSetting).toHaveBeenCalledWith('theme')
    })

    test('should return null for non-existent setting', async () => {
      spyOn(db, 'getSetting').mockReturnValue(null)
      const app = createTestApp()
      const res = await app.request('/nonexistent')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ key: 'nonexistent', value: null })
    })
  })

  describe('PUT /:key', () => {
    test('should set a setting value', async () => {
      const app = createTestApp()
      const res = await app.request('/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'light' }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ key: 'theme', value: 'light' })
      expect(db.setSetting).toHaveBeenCalledWith('theme', 'light')
    })

    test('should set a numeric setting value', async () => {
      const app = createTestApp()
      const res = await app.request('/fileCardMaxSize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: '2097152' }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ key: 'fileCardMaxSize', value: '2097152' })
      expect(db.setSetting).toHaveBeenCalledWith('fileCardMaxSize', '2097152')
    })
  })

  describe('DELETE /:key', () => {
    test('should delete a setting', async () => {
      const app = createTestApp()
      const res = await app.request('/theme', { method: 'DELETE' })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ success: true })
      expect(db.deleteSetting).toHaveBeenCalledWith('theme')
    })
  })
})
