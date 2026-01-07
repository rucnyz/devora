/**
 * Build release script for Devora
 * Creates distributable packages for different platforms
 *
 * Usage:
 *   bun run scripts/build-release.ts [platform]
 *
 * Platforms:
 *   windows-x64 (default on Windows)
 *   macos-arm64 (default on macOS ARM)
 *   macos-x64
 *   linux-x64 (default on Linux)
 */

import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import pkg from '../package.json'

type Platform = 'windows-x64' | 'macos-arm64' | 'macos-x64' | 'linux-x64'
type BunTarget = 'bun-windows-x64' | 'bun-darwin-arm64' | 'bun-darwin-x64' | 'bun-linux-x64'

const PLATFORM_CONFIG: Record<Platform, { bunTarget: BunTarget; exeName: string; updaterScript: string }> = {
  'windows-x64': { bunTarget: 'bun-windows-x64', exeName: 'devora.exe', updaterScript: 'update.ps1' },
  'macos-arm64': { bunTarget: 'bun-darwin-arm64', exeName: 'devora', updaterScript: 'update.sh' },
  'macos-x64': { bunTarget: 'bun-darwin-x64', exeName: 'devora', updaterScript: 'update.sh' },
  'linux-x64': { bunTarget: 'bun-linux-x64', exeName: 'devora', updaterScript: 'update.sh' },
}

function getDefaultPlatform(): Platform {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'win32') return 'windows-x64'
  if (platform === 'darwin') return arch === 'arm64' ? 'macos-arm64' : 'macos-x64'
  return 'linux-x64'
}

async function buildFrontend(): Promise<void> {
  console.log('\n📦 Building frontend...')

  const proc = Bun.spawn(['bun', 'run', 'build'], {
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error('Frontend build failed')
  }

  console.log('✅ Frontend build complete')
}

async function compileExecutable(entrypoint: string, outPath: string, target: BunTarget): Promise<void> {
  console.log(`\n🔨 Compiling ${outPath}...`)

  const proc = Bun.spawn(['bun', 'build', entrypoint, '--compile', '--target', target, '--outfile', outPath], {
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to compile ${entrypoint}`)
  }

  console.log(`✅ Compiled ${outPath}`)
}

async function createZip(sourceDir: string, zipPath: string): Promise<void> {
  console.log(`\n📁 Creating ${zipPath}...`)

  const platform = process.platform

  if (platform === 'win32') {
    const proc = Bun.spawn(
      ['powershell', '-Command', `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${zipPath}" -Force`],
      {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      }
    )
    await proc.exited
    if (proc.exitCode !== 0) {
      throw new Error('Failed to create zip')
    }
  } else {
    const proc = Bun.spawn(['zip', '-r', zipPath, '.'], {
      cwd: sourceDir,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    await proc.exited
    if (proc.exitCode !== 0) {
      throw new Error('Failed to create zip')
    }
  }

  console.log(`✅ Created ${zipPath}`)
}

async function main() {
  const args = process.argv.slice(2)
  const targetPlatform = (args[0] as Platform) || getDefaultPlatform()

  if (!PLATFORM_CONFIG[targetPlatform]) {
    console.error(`Unknown platform: ${targetPlatform}`)
    console.error('Available platforms:', Object.keys(PLATFORM_CONFIG).join(', '))
    process.exit(1)
  }

  const config = PLATFORM_CONFIG[targetPlatform]
  const version = pkg.version
  const releaseDir = join(process.cwd(), 'release')
  const platformDir = join(releaseDir, `devora-${targetPlatform}`)

  console.log('========================================')
  console.log(`  Devora Release Builder`)
  console.log('========================================')
  console.log(`  Version:  ${version}`)
  console.log(`  Platform: ${targetPlatform}`)
  console.log(`  Output:   ${platformDir}`)
  console.log('========================================')

  // Clean up previous build
  if (existsSync(platformDir)) {
    console.log('\n🧹 Cleaning previous build...')
    rmSync(platformDir, { recursive: true })
  }
  mkdirSync(platformDir, { recursive: true })

  // Build frontend
  await buildFrontend()

  // Compile main executable
  await compileExecutable('server/index.ts', join(platformDir, config.exeName), config.bunTarget)

  // Copy updater script
  console.log('\n📜 Copying updater script...')
  const updaterSrc = join(process.cwd(), 'updater', config.updaterScript)
  const updaterDest = join(platformDir, config.updaterScript)
  copyFileSync(updaterSrc, updaterDest)
  console.log(`✅ Copied ${config.updaterScript}`)

  // Copy dist folder
  console.log('\n📂 Copying dist folder...')
  cpSync(join(process.cwd(), 'dist'), join(platformDir, 'dist'), { recursive: true })
  console.log('✅ Copied dist/')

  // Create VERSION file
  console.log('\n📝 Creating VERSION file...')
  writeFileSync(join(platformDir, 'VERSION'), version)
  console.log(`✅ Created VERSION (${version})`)

  // Create zip archive
  const zipPath = join(releaseDir, `devora-${targetPlatform}.zip`)
  if (existsSync(zipPath)) {
    rmSync(zipPath)
  }
  await createZip(platformDir, zipPath)

  console.log('\n========================================')
  console.log('  Build Complete!')
  console.log('========================================')
  console.log(`  Output directory: ${platformDir}`)
  console.log(`  Zip archive:      ${zipPath}`)
  console.log('========================================')
}

main().catch((error) => {
  console.error('\n❌ Build failed:', error)
  process.exit(1)
})
