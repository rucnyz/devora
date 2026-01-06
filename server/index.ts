import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import projectsRoutes from './routes/projects'
import itemsRoutes from './routes/items'
import actionsRoutes from './routes/actions'
import { existsSync } from 'fs'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// API Routes
app.route('/api/projects', projectsRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/open', actionsRoutes)
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Serve static files in production (when dist folder exists)
const distPath = './dist'
if (existsSync(distPath)) {
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: distPath }))

  // Serve index.html for all other routes (SPA)
  app.get('*', serveStatic({ root: distPath, path: 'index.html' }))

  console.log('Serving static files from dist/')
}

const port = 3000
console.log(`Server running at http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
