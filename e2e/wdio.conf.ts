import type { Options } from '@wdio/types'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the Tauri application binary
const tauriAppPath = path.resolve(
  __dirname,
  '../src-tauri/target/release/devora'
)

let tauriDriver: ChildProcess | null = null

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  specs: ['./specs/**/*.ts'],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      // Use tauri as the browserName for tauri-driver
      browserName: 'wry',
      'tauri:options': {
        application: tauriAppPath,
      },
    } as WebdriverIO.Capabilities,
  ],

  logLevel: 'info',

  bail: 0,

  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',

  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Build Tauri application before tests (can be skipped in CI)
  onPrepare: async function () {
    if (process.env.SKIP_TAURI_BUILD === 'true') {
      console.log('Skipping Tauri build (SKIP_TAURI_BUILD=true)')
      return
    }

    console.log('Building Tauri application...')
    const { execSync } = await import('child_process')

    // Build the Tauri app in release mode
    execSync('cargo build --release', {
      cwd: path.resolve(__dirname, '../src-tauri'),
      stdio: 'inherit',
    })

    console.log('Tauri application built successfully')
  },

  beforeSession: async function () {
    console.log('Starting tauri-driver...')

    // Spawn tauri-driver on port 4444
    tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    tauriDriver.stdout?.on('data', (data: Buffer) => {
      console.log(`[tauri-driver] ${data.toString()}`)
    })

    tauriDriver.stderr?.on('data', (data: Buffer) => {
      console.error(`[tauri-driver] ${data.toString()}`)
    })

    // Wait for tauri-driver to start
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log('tauri-driver started')
  },

  afterSession: async function () {
    console.log('Stopping tauri-driver...')
    if (tauriDriver) {
      tauriDriver.kill()
      tauriDriver = null
    }
  },
}
