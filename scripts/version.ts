/**
 * Version bump script with git tag
 *
 * Usage:
 *   bun run version patch     # 0.1.2 -> 0.1.3
 *   bun run version minor     # 0.1.2 -> 0.2.0
 *   bun run version major     # 0.1.2 -> 1.0.0
 *   bun run version 1.2.3     # Set specific version
 *   bun run version patch --push  # Also push to remote
 *   bun run version patch --commit "message" --push  # Commit changes first
 */

import { $ } from 'bun'
import pkg from '../package.json'

const args = process.argv.slice(2)
const bumpType = args[0]
const shouldPush = args.includes('--push')

// Parse --commit option
const commitIndex = args.indexOf('--commit')
const commitMessage = commitIndex !== -1 ? args[commitIndex + 1] : null

if (!bumpType) {
  console.log('Usage: bun run version <patch|minor|major|x.y.z> [--commit "message"] [--push]')
  console.log(`Current version: ${pkg.version}`)
  process.exit(1)
}

function bumpVersion(current: string, type: string): string {
  // If type is a valid semver, use it directly
  if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type
  }

  const [major, minor, patch] = current.split('.').map(Number)

  switch (type) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    default:
      console.error(`Invalid bump type: ${type}`)
      console.log('Use: patch, minor, major, or a specific version (x.y.z)')
      process.exit(1)
  }
}

const currentVersion = pkg.version
const newVersion = bumpVersion(currentVersion, bumpType)

// Commit current changes first if --commit is provided
if (commitMessage) {
  console.log(`Committing current changes: ${commitMessage}`)
  await $`git add -A`
  await $`git commit -m ${commitMessage}`
  console.log('Changes committed')
}

console.log(`Bumping version: ${currentVersion} -> ${newVersion}`)

// Update package.json
pkg.version = newVersion
await Bun.write('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('Updated package.json')

// Git operations
await $`git add package.json`
await $`git commit -m "v${newVersion}"`
console.log(`Created commit: v${newVersion}`)

await $`git tag v${newVersion}`
console.log(`Created tag: v${newVersion}`)

if (shouldPush) {
  await $`git push && git push --tags`
  console.log('Pushed to remote')
}

console.log(`\nVersion ${newVersion} released!`)
if (!shouldPush) {
  console.log('Run `git push && git push --tags` to push to remote')
}
