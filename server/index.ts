import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import projectsRoutes from './routes/projects'
import itemsRoutes from './routes/items'
import actionsRoutes from './routes/actions'
import dataRoutes from './routes/data'
import { existsSync } from 'fs'
import { join } from 'path'

// Use current working directory as app root
// - Development: run from project root with `bun run dev`
// - Compiled: run executable from its directory
export const APP_DIR = process.cwd()

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// API Routes
app.route('/api/projects', projectsRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/open', actionsRoutes)
app.route('/api/data', dataRoutes)
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Serve static files in production (when dist folder exists)
const distPath = join(APP_DIR, 'dist')
const isProduction = existsSync(distPath)

if (isProduction) {
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: distPath }))

  // Serve index.html for all other routes (SPA)
  app.get('*', serveStatic({ root: distPath, path: 'index.html' }))

  console.log(`Serving static files from ${distPath}`)
}

// Default port 13000 (high port to avoid conflicts)
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

    // Auto open browser in production mode
    if (isProduction && !process.env.DISABLE_OPEN_BROWSER) {
      setTimeout(() => {
        openBrowser(url)
        console.log(`Opened browser at ${url}`)
      }, 300)
    }
  } catch (error) {
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
