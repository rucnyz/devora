import { Hono } from 'hono'
import { exportAllData, importData } from '../db'

const app = new Hono()

// Export data as JSON (optionally filter by project IDs)
app.get('/export', (c) => {
  const projectIdsParam = c.req.query('projectIds')
  const projectIds = projectIdsParam ? projectIdsParam.split(',').filter(Boolean) : undefined
  const data = exportAllData(projectIds)
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

    const result = importData(body, mode)
    return c.json({
      success: true,
      ...result,
      message: `Imported ${result.projectsImported} projects and ${result.itemsImported} items. Skipped ${result.skipped} existing entries.`,
    })
  } catch (error) {
    return c.json({ error: 'Failed to import data: ' + (error as Error).message }, 400)
  }
})

export default app
