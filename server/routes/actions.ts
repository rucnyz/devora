import { Hono } from 'hono'
import { openWithIde, openFile, type IdeType } from '../utils/launchers'

const app = new Hono()

// Open IDE with project path
app.post('/ide', async (c) => {
  const body = await c.req.json()
  const { ide_type, path } = body as { ide_type: IdeType; path: string }

  if (!ide_type || !path) {
    return c.json({ error: 'ide_type and path are required' }, 400)
  }

  try {
    await openWithIde(ide_type, path)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: `Failed to open ${ide_type}: ${error}` }, 500)
  }
})

// Open file
app.post('/file', async (c) => {
  const body = await c.req.json()
  const { path } = body as { path: string }

  if (!path) {
    return c.json({ error: 'path is required' }, 400)
  }

  try {
    await openFile(path)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: `Failed to open file: ${error}` }, 500)
  }
})

export default app
