/**
 * Cross-platform build script
 * Builds executables for Windows, macOS, and Linux
 */

import { $ } from 'bun'
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs'
import { join } from 'path'

const TARGETS = [
  { name: 'windows-x64', target: 'bun-windows-x64', ext: '.exe' },
  { name: 'macos-x64', target: 'bun-darwin-x64', ext: '' },
  { name: 'macos-arm64', target: 'bun-darwin-arm64', ext: '' },
  { name: 'linux-x64', target: 'bun-linux-x64', ext: '' },
] as const

const releaseDir = 'release'
const appName = 'manage-note'

async function build() {
  console.log('Building frontend...')
  await $`bun run build`

  // Clean release directory
  if (existsSync(releaseDir)) {
    rmSync(releaseDir, { recursive: true })
  }
  mkdirSync(releaseDir)

  for (const { name, target, ext } of TARGETS) {
    console.log(`\nBuilding for ${name}...`)

    const platformDir = join(releaseDir, `${appName}-${name}`)
    mkdirSync(platformDir)

    // Compile executable
    const outFile = join(platformDir, `${appName}${ext}`)
    try {
      await $`bun build server/index.ts --compile --target=${target} --outfile=${outFile}`
      console.log(`  Compiled: ${outFile}`)
    } catch (e) {
      console.error(`  Failed to compile for ${name}:`, e)
      continue
    }

    // Copy dist folder (frontend assets)
    const distSrc = 'dist'
    const distDest = join(platformDir, 'dist')
    if (existsSync(distSrc)) {
      cpSync(distSrc, distDest, { recursive: true })
      console.log(`  Copied: dist/`)
    }

    // Create empty data folder
    const dataDir = join(platformDir, 'data')
    mkdirSync(dataDir)
    console.log(`  Created: data/`)

    console.log(`  Done: ${platformDir}`)
  }

  console.log('\n=== Build Complete ===')
  console.log(`Output: ${releaseDir}/`)
  console.log('\nEach platform folder contains:')
  console.log('  - manage-note executable')
  console.log('  - dist/ (frontend assets)')
  console.log('  - data/ (database will be created here)')
}

// Run single platform build
async function buildSingle(platform: string) {
  const target = TARGETS.find(t => t.name === platform)
  if (!target) {
    console.error(`Unknown platform: ${platform}`)
    console.log('Available platforms:', TARGETS.map(t => t.name).join(', '))
    process.exit(1)
  }

  console.log('Building frontend...')
  await $`bun run build`

  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir)
  }

  const { name, target: bunTarget, ext } = target
  console.log(`\nBuilding for ${name}...`)

  const platformDir = join(releaseDir, `${appName}-${name}`)
  if (existsSync(platformDir)) {
    rmSync(platformDir, { recursive: true })
  }
  mkdirSync(platformDir)

  const outFile = join(platformDir, `${appName}${ext}`)
  await $`bun build server/index.ts --compile --target=${bunTarget} --outfile=${outFile}`

  cpSync('dist', join(platformDir, 'dist'), { recursive: true })
  mkdirSync(join(platformDir, 'data'))

  console.log(`\nDone: ${platformDir}`)
}

// Parse arguments
const args = process.argv.slice(2)
if (args[0]) {
  buildSingle(args[0])
} else {
  build()
}
