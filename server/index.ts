import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import projectsRoutes from './routes/projects'
import itemsRoutes from './routes/items'
import actionsRoutes from './routes/actions'
import dataRoutes from './routes/data'
import settingsRoutes from './routes/settings'
import fileCardsRoutes, { fileCardsDirectRoutes } from './routes/fileCards'
import { existsSync } from 'fs'

export { APP_DIR, DATA_DIR, DIST_DIR, APP_VERSION } from './config'
import { DIST_DIR, APP_VERSION } from './config'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// API Routes
app.route('/api/projects', projectsRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/open', actionsRoutes)
app.route('/api/data', dataRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/projects', fileCardsRoutes) // File cards nested under projects
app.route('/api/file-cards', fileCardsDirectRoutes) // Direct file card operations
app.get('/api/health', (c) => c.json({ status: 'ok', version: APP_VERSION }))

// Serve static files when dist folder exists
const hasDistFolder = existsSync(DIST_DIR)

if (hasDistFolder) {
  app.use('/assets/*', serveStatic({ root: DIST_DIR }))
  app.get('*', serveStatic({ root: DIST_DIR, path: 'index.html' }))
  console.log(`Serving static files from ${DIST_DIR}`)
}

// Default port 13000
const DEFAULT_PORT = 13000
const MAX_PORT_ATTEMPTS = 10

function openBrowser(url: string) {
  const platform = process.platform
  let command: string[]
  if (platform === 'win32') {
    command = ['cmd', '/c', 'start', '', url]
  } else if (platform === 'darwin') {
    command = ['open', url]
  } else {
    command = ['xdg-open', url]
  }
  Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' })
}

async function startServer(port: number, attempt: number = 1): Promise<void> {
  try {
    const server = Bun.serve({
      port,
      fetch: app.fetch,
    })

    const url = `http://localhost:${server.port}`
    console.log(`Server running at ${url}`)

    // Auto open browser when dist folder exists (production build)
    if (hasDistFolder && !process.env.DISABLE_OPEN_BROWSER) {
      setTimeout(() => {
        openBrowser(url)
        console.log(`Opened browser at ${url}`)
      }, 300)
    }
  } catch {
    if (attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1
      console.log(`Port ${port} is in use, trying ${nextPort}...`)
      return startServer(nextPort, attempt + 1)
    } else {
      console.error(`Failed to start server after ${MAX_PORT_ATTEMPTS} attempts`)
      process.exit(1)
    }
  }
}

const initialPort = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_PORT
startServer(initialPort)
