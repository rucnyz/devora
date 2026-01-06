import { Hono } from 'hono'
import { openWithIde, openFile, selectFolder, selectFile, openRemoteIde, type IdeType, type RemoteIdeType } from '../utils/launchers'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const app = new Hono()

// Parse SSH config to extract Host entries
export function parseSSHConfig(content: string): string[] {
  const hosts: string[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Match "Host hostname" but skip wildcards like "Host *"
    if (trimmed.toLowerCase().startsWith('host ')) {
      const hostValue = trimmed.substring(5).trim()
      // Skip wildcards and patterns
      if (hostValue && !hostValue.includes('*') && !hostValue.includes('?')) {
        // Handle multiple hosts on same line (e.g., "Host server1 server2")
        const hostNames = hostValue.split(/\s+/)
        hosts.push(...hostNames.filter(h => h && !h.includes('*') && !h.includes('?')))
      }
    }
  }

  return hosts
}

// Get SSH hosts from ~/.ssh/config
app.get('/ssh-hosts', async (c) => {
  try {
    const sshConfigPath = join(homedir(), '.ssh', 'config')
    const content = await readFile(sshConfigPath, 'utf-8')
    const hosts = parseSSHConfig(content)
    return c.json({ hosts })
  } catch {
    // If file doesn't exist or can't be read, return empty array
    return c.json({ hosts: [] })
  }
})

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

// Open remote IDE (Cursor or VS Code) via SSH
app.post('/remote-ide', async (c) => {
  const body = await c.req.json()
  const { remote_ide_type, host, path } = body as { remote_ide_type: RemoteIdeType; host: string; path: string }

  if (!remote_ide_type || !host || !path) {
    return c.json({ error: 'remote_ide_type, host, and path are required' }, 400)
  }

  try {
    await openRemoteIde(remote_ide_type, host, path)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: `Failed to open remote ${remote_ide_type}: ${error}` }, 500)
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

// Open folder picker dialog
app.post('/select-folder', async (c) => {
  try {
    const path = await selectFolder()
    return c.json({ path })
  } catch (error) {
    return c.json({ error: `Failed to open folder picker: ${error}` }, 500)
  }
})

// Open file picker dialog
app.post('/select-file', async (c) => {
  try {
    const path = await selectFile()
    return c.json({ path })
  } catch (error) {
    return c.json({ error: `Failed to open file picker: ${error}` }, 500)
  }
})

// Fetch URL metadata (title)
app.post('/url-metadata', async (c) => {
  const body = await c.req.json()
  const { url } = body as { url: string }

  if (!url) {
    return c.json({ error: 'url is required' }, 400)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProjectManager/1.0)',
        'Accept': 'text/html',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return c.json({ title: null })
    }

    const html = await response.text()

    // Try to extract og:title first
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    if (ogTitleMatch) {
      return c.json({ title: ogTitleMatch[1].trim() })
    }

    // Fallback to <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      return c.json({ title: titleMatch[1].trim() })
    }

    return c.json({ title: null })
  } catch {
    // On error (timeout, network, etc.), return null
    return c.json({ title: null })
  }
})

// Run custom command (local or remote via SSH)
app.post('/command', async (c) => {
  const body = await c.req.json()
  const { command, mode, cwd, host } = body as { command: string; mode: 'background' | 'output'; cwd?: string; host?: string }

  if (!command) {
    return c.json({ error: 'command is required' }, 400)
  }

  try {
    // Remote command via SSH
    if (host) {
      const cdCommand = cwd ? `cd "${cwd}" && ` : ''
      const fullCommand = `${cdCommand}${command}`

      if (mode === 'background') {
        // Background mode: run via SSH and return immediately (nohup to detach)
        Bun.spawn(['ssh', host, `nohup sh -c '${fullCommand.replace(/'/g, "'\\''")}' > /dev/null 2>&1 &`], {
          stdout: 'ignore',
          stderr: 'ignore',
        })
        return c.json({ success: true })
      } else {
        // Output mode: wait for SSH command completion
        const proc = Bun.spawn(['ssh', host, fullCommand], {
          stdout: 'pipe',
          stderr: 'pipe',
        })

        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        return c.json({
          success: exitCode === 0,
          output: stdout,
          error: stderr || undefined,
          exitCode,
        })
      }
    }

    // Local command
    const spawnOptions = {
      cwd: cwd || process.cwd(),
      shell: true as const,
    }

    if (mode === 'background') {
      // Background mode: spawn detached and return immediately
      Bun.spawn(['cmd', '/c', command], {
        ...spawnOptions,
        stdout: 'ignore',
        stderr: 'ignore',
      })
      return c.json({ success: true })
    } else {
      // Output mode: wait for completion and return stdout/stderr
      const proc = Bun.spawn(['cmd', '/c', command], {
        ...spawnOptions,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      return c.json({
        success: exitCode === 0,
        output: stdout,
        error: stderr || undefined,
        exitCode,
      })
    }
  } catch (error) {
    return c.json({ error: `Failed to run command: ${error}` }, 500)
  }
})

// List remote directory via SSH
app.post('/ssh/list-dir', async (c) => {
  const body = await c.req.json()
  const { host, path = '~' } = body as { host: string; path?: string }

  if (!host) {
    return c.json({ error: 'host is required' }, 400)
  }

  try {
    // Use ssh to list directory, output format: type|name (d for dir, f for file)
    // Note: ~ must not be quoted for shell expansion, use $HOME for home directory
    const cdPath = path === '~' ? '$HOME' : `"${path}"`
    const proc = Bun.spawn(['ssh', host, `cd ${cdPath} && pwd && ls -1F`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return c.json({ error: stderr || 'SSH command failed' }, 500)
    }

    const lines = output.trim().split('\n')
    const currentPath = lines[0] // First line is pwd output
    const entries = lines.slice(1).map(line => {
      const isDir = line.endsWith('/')
      const name = isDir ? line.slice(0, -1) : line.replace(/[@*|]$/, '')
      return { name, isDir }
    }).filter(e => e.name && !e.name.startsWith('.')) // Filter hidden files

    return c.json({ path: currentPath, entries })
  } catch (error) {
    return c.json({ error: `SSH error: ${error}` }, 500)
  }
})

export default app
