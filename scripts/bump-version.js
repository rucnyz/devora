#!/usr/bin/env node
/* global process, console */
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const type = process.argv[2]
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/bump-version.js <patch|minor|major>')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

const newVersion =
  type === 'major'
    ? `${major + 1}.0.0`
    : type === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`

// Update package.json
pkg.version = newVersion
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

// Update tauri.conf.json
const tauriConf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'))
tauriConf.version = newVersion
writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(tauriConf, null, 2) + '\n')

// Update Cargo.toml
const cargoToml = readFileSync('src-tauri/Cargo.toml', 'utf-8')
const updatedCargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`)
writeFileSync('src-tauri/Cargo.toml', updatedCargoToml)

console.log(`Version bumped to ${newVersion}`)

// Git commit, tag, and push
const run = (cmd) => {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

run('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml')
run(`git commit -m "chore: release v${newVersion}"`)
run(`git tag v${newVersion}`)
run('git push')
run('git push --tags')

console.log(`\nReleased v${newVersion}`)
