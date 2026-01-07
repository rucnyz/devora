import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { Hono } from 'hono'
import * as db from '../../../server/db'

function createTestApp() {
  const app = new Hono()

  // Export data as JSON (optionally filter by project IDs)
  app.get('/export', (c) => {
    const projectIdsParam = c.req.query('projectIds')
    const projectIds = projectIdsParam ? projectIdsParam.split(',').filter(Boolean) : undefined
    const data = db.exportAllData(projectIds)
    return c.json(data)
  })

  // Import data from JSON
  app.post('/import', async (c) => {
    try {
      const body = await c.req.json()
      const mode = (c.req.query('mode') as 'merge' | 'replace') || 'merge'

      if (!body.projects || !body.items) {
        return c.json({ error: 'Invalid data format. Expected { projects: [], items: [] }' }, 400)
      }

      const result = db.importData(body, mode)
      return c.json({
        success: true,
        ...result,
        message: `Imported ${result.projectsImported} projects and ${result.itemsImported} items. Skipped ${result.skipped} existing entries.`
      })
    } catch (error) {
      return c.json({ error: 'Failed to import data: ' + (error as Error).message }, 400)
    }
  })

  return app
}

describe('Data Routes', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    mock.restore()
  })

  describe('GET /export', () => {
    test('exports all data without filter', async () => {
      const mockExportData = {
        version: '1.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        projects: [{ id: '1', name: 'Project 1' }],
        items: [{ id: 'item1', title: 'Item 1' }],
      }
      spyOn(db, 'exportAllData').mockReturnValue(mockExportData as any)

      const res = await app.request('/export')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.version).toBe('1.0')
      expect(data.projects.length).toBe(1)
      expect(data.items.length).toBe(1)
    })

    test('exports filtered data by projectIds', async () => {
      const exportSpy = spyOn(db, 'exportAllData').mockReturnValue({
        version: '1.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        projects: [],
        items: [],
      } as any)

      await app.request('/export?projectIds=id1,id2,id3')

      expect(exportSpy).toHaveBeenCalledWith(['id1', 'id2', 'id3'])
    })

    test('handles empty projectIds parameter', async () => {
      const exportSpy = spyOn(db, 'exportAllData').mockReturnValue({
        version: '1.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        projects: [],
        items: [],
      } as any)

      await app.request('/export?projectIds=')

      expect(exportSpy).toHaveBeenCalledWith(undefined)
    })
  })

  describe('POST /import', () => {
    test('returns 400 for invalid data format - missing projects', async () => {
      const res = await app.request('/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Invalid data format')
    })

    test('returns 400 for invalid data format - missing items', async () => {
      const res = await app.request('/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [] }),
      })

      expect(res.status).toBe(400)
    })

    test('imports data in merge mode by default', async () => {
      const importSpy = spyOn(db, 'importData').mockReturnValue({
        projectsImported: 2,
        itemsImported: 5,
        skipped: 1,
      })

      const res = await app.request('/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [], items: [] }),
      })

      expect(res.status).toBe(200)
      expect(importSpy).toHaveBeenCalledWith({ projects: [], items: [] }, 'merge')
    })

    test('imports data in replace mode when specified', async () => {
      const importSpy = spyOn(db, 'importData').mockReturnValue({
        projectsImported: 1,
        itemsImported: 3,
        skipped: 0,
      })

      await app.request('/import?mode=replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [], items: [] }),
      })

      expect(importSpy).toHaveBeenCalledWith({ projects: [], items: [] }, 'replace')
    })

    test('returns import statistics', async () => {
      spyOn(db, 'importData').mockReturnValue({
        projectsImported: 3,
        itemsImported: 10,
        skipped: 2,
      })

      const res = await app.request('/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [], items: [] }),
      })

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.projectsImported).toBe(3)
      expect(data.itemsImported).toBe(10)
      expect(data.skipped).toBe(2)
      expect(data.message).toContain('3 projects')
      expect(data.message).toContain('10 items')
    })

    test('returns 400 on import error', async () => {
      spyOn(db, 'importData').mockImplementation(() => {
        throw new Error('Database error')
      })

      const res = await app.request('/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [], items: [] }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Failed to import data')
    })
  })
})
