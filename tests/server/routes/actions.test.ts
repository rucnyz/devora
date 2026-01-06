import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import { Hono } from 'hono'

// Mock launchers module before importing actions
const mockOpenWithIde = mock(async () => {})
const mockOpenRemoteIde = mock(async () => {})
const mockOpenFile = mock(async () => {})
const mockSelectFolder = mock(async () => '/mock/folder')
const mockSelectFile = mock(async () => '/mock/file.txt')

mock.module('../../../server/utils/launchers', () => ({
  openWithIde: mockOpenWithIde,
  openRemoteIde: mockOpenRemoteIde,
  openFile: mockOpenFile,
  selectFolder: mockSelectFolder,
  selectFile: mockSelectFile,
}))

// Mock fs/promises readFile for SSH config tests
let mockReadFileResult: string | Error = ''
const mockReadFile = mock(async () => {
  if (mockReadFileResult instanceof Error) {
    throw mockReadFileResult
  }
  return mockReadFileResult
})

mock.module('fs/promises', () => ({
  readFile: mockReadFile,
}))

// Import after mocking
import actionsApp, { parseSSHConfig } from '../../../server/routes/actions'

// Create test app
const app = new Hono()
app.route('/actions', actionsApp)

describe('parseSSHConfig', () => {
  test('parses single host entry', () => {
    const config = 'Host myserver\n  HostName 192.168.1.1'
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('parses multiple host entries', () => {
    const config = `
Host server1
  HostName 192.168.1.1

Host server2
  HostName 192.168.1.2
`
    expect(parseSSHConfig(config)).toEqual(['server1', 'server2'])
  })

  test('handles multiple hosts on same line', () => {
    const config = 'Host server1 server2 server3'
    expect(parseSSHConfig(config)).toEqual(['server1', 'server2', 'server3'])
  })

  test('ignores wildcard * patterns', () => {
    const config = `
Host *
  ServerAliveInterval 60

Host myserver
  HostName 192.168.1.1
`
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('ignores question mark ? patterns', () => {
    const config = 'Host server?\nHost realserver'
    expect(parseSSHConfig(config)).toEqual(['realserver'])
  })

  test('ignores host line containing wildcard', () => {
    // When a host line contains wildcards, the whole line is skipped
    // This matches the actual behavior: if hostValue includes '*' or '?', skip it
    const config = 'Host prod-* staging-? myserver'
    // The whole hostValue contains '*' and '?', so the line is skipped
    expect(parseSSHConfig(config)).toEqual([])
  })

  test('returns empty array for empty config', () => {
    expect(parseSSHConfig('')).toEqual([])
  })

  test('returns empty array for config with only comments', () => {
    const config = `
# This is a comment
# Another comment
`
    expect(parseSSHConfig(config)).toEqual([])
  })

  test('handles case-insensitive Host keyword', () => {
    const config = 'HOST myserver\nhost anotherserver\nHoSt thirdserver'
    expect(parseSSHConfig(config)).toEqual(['myserver', 'anotherserver', 'thirdserver'])
  })

  test('trims whitespace around host names', () => {
    const config = 'Host   myserver   '
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles extra spaces after Host keyword', () => {
    const config = 'Host   myserver'
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles complex real-world config', () => {
    const config = `
# Global settings
Host *
  ServerAliveInterval 60
  ServerAliveCountMax 3

# Work servers
Host work-bastion
  HostName bastion.work.com
  User admin

Host work-app work-db
  ProxyJump work-bastion

# Personal
Host home-server
  HostName 192.168.1.100
  User pi

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/github
`
    const result = parseSSHConfig(config)
    expect(result).toEqual(['work-bastion', 'work-app', 'work-db', 'home-server', 'github.com'])
  })

  test('ignores lines that do not start with Host', () => {
    const config = `
 HostName 192.168.1.1
User admin
Host myserver
Port 22
`
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles Windows line endings (CRLF)', () => {
    const config = 'Host server1\r\n  HostName 192.168.1.1\r\nHost server2\r\n  HostName 192.168.1.2'
    // \r will be part of the line but shouldn't affect parsing since we trim
    const result = parseSSHConfig(config)
    expect(result.length).toBe(2)
  })
})

describe('POST /actions/ide', () => {
  beforeEach(() => {
    mockOpenWithIde.mockClear()
    mockOpenWithIde.mockImplementation(async () => {})
  })

  test('opens IDE with valid parameters', async () => {
    const res = await app.request('/actions/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ide_type: 'vscode', path: '/test/path' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true })
    expect(mockOpenWithIde).toHaveBeenCalledWith('vscode', '/test/path')
  })

  test('returns 400 when ide_type is missing', async () => {
    const res = await app.request('/actions/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test/path' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('ide_type and path are required')
  })

  test('returns 400 when path is missing', async () => {
    const res = await app.request('/actions/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ide_type: 'vscode' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('ide_type and path are required')
  })

  test('returns 500 when openWithIde throws', async () => {
    mockOpenWithIde.mockImplementation(async () => {
      throw new Error('IDE not found')
    })

    const res = await app.request('/actions/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ide_type: 'vscode', path: '/test/path' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to open vscode')
  })
})

describe('POST /actions/remote-ide', () => {
  beforeEach(() => {
    mockOpenRemoteIde.mockClear()
    mockOpenRemoteIde.mockImplementation(async () => {})
  })

  test('opens remote IDE with valid parameters', async () => {
    const res = await app.request('/actions/remote-ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote_ide_type: 'cursor', host: 'myserver', path: '/remote/path' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true })
    expect(mockOpenRemoteIde).toHaveBeenCalledWith('cursor', 'myserver', '/remote/path')
  })

  test('returns 400 when remote_ide_type is missing', async () => {
    const res = await app.request('/actions/remote-ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/remote/path' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('remote_ide_type, host, and path are required')
  })

  test('returns 400 when host is missing', async () => {
    const res = await app.request('/actions/remote-ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote_ide_type: 'vscode', path: '/remote/path' }),
    })

    expect(res.status).toBe(400)
  })

  test('returns 400 when path is missing', async () => {
    const res = await app.request('/actions/remote-ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote_ide_type: 'vscode', host: 'myserver' }),
    })

    expect(res.status).toBe(400)
  })

  test('returns 500 when openRemoteIde throws', async () => {
    mockOpenRemoteIde.mockImplementation(async () => {
      throw new Error('Connection failed')
    })

    const res = await app.request('/actions/remote-ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote_ide_type: 'cursor', host: 'myserver', path: '/remote/path' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to open remote cursor')
  })
})

describe('POST /actions/file', () => {
  beforeEach(() => {
    mockOpenFile.mockClear()
    mockOpenFile.mockImplementation(async () => {})
  })

  test('opens file with valid path', async () => {
    const res = await app.request('/actions/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test/file.txt' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true })
    expect(mockOpenFile).toHaveBeenCalledWith('/test/file.txt')
  })

  test('returns 400 when path is missing', async () => {
    const res = await app.request('/actions/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('path is required')
  })

  test('returns 500 when openFile throws', async () => {
    mockOpenFile.mockImplementation(async () => {
      throw new Error('File not found')
    })

    const res = await app.request('/actions/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/nonexistent/file.txt' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to open file')
  })
})

describe('POST /actions/select-folder', () => {
  beforeEach(() => {
    mockSelectFolder.mockClear()
    mockSelectFolder.mockImplementation(async () => '/selected/folder')
  })

  test('returns selected folder path', async () => {
    const res = await app.request('/actions/select-folder', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ path: '/selected/folder' })
  })

  test('returns null when no folder selected', async () => {
    mockSelectFolder.mockImplementation(async () => null)

    const res = await app.request('/actions/select-folder', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ path: null })
  })

  test('returns 500 when selectFolder throws', async () => {
    mockSelectFolder.mockImplementation(async () => {
      throw new Error('Dialog error')
    })

    const res = await app.request('/actions/select-folder', {
      method: 'POST',
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to open folder picker')
  })
})

describe('POST /actions/select-file', () => {
  beforeEach(() => {
    mockSelectFile.mockClear()
    mockSelectFile.mockImplementation(async () => '/selected/file.txt')
  })

  test('returns selected file path', async () => {
    const res = await app.request('/actions/select-file', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ path: '/selected/file.txt' })
  })

  test('returns null when no file selected', async () => {
    mockSelectFile.mockImplementation(async () => null)

    const res = await app.request('/actions/select-file', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ path: null })
  })

  test('returns 500 when selectFile throws', async () => {
    mockSelectFile.mockImplementation(async () => {
      throw new Error('Dialog error')
    })

    const res = await app.request('/actions/select-file', {
      method: 'POST',
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to open file picker')
  })
})

describe('POST /actions/url-metadata', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  test('returns 400 when url is missing', async () => {
    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('url is required')
  })

  test('extracts title from og:title meta tag', async () => {
    globalThis.fetch = mock(async () => new Response(
      '<html><head><meta property="og:title" content="OG Title Here"></head></html>',
      { status: 200 }
    ))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('OG Title Here')
  })

  test('extracts title from og:title with content first', async () => {
    globalThis.fetch = mock(async () => new Response(
      '<html><head><meta content="Content First OG" property="og:title"></head></html>',
      { status: 200 }
    ))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Content First OG')
  })

  test('falls back to title tag when no og:title', async () => {
    globalThis.fetch = mock(async () => new Response(
      '<html><head><title>Page Title</title></head></html>',
      { status: 200 }
    ))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Page Title')
  })

  test('returns null when no title found', async () => {
    globalThis.fetch = mock(async () => new Response(
      '<html><body>No title here</body></html>',
      { status: 200 }
    ))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBeNull()
  })

  test('returns null when fetch response is not ok', async () => {
    globalThis.fetch = mock(async () => new Response('Not found', { status: 404 }))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/404' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBeNull()
  })

  test('returns null when fetch throws error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('Network error')
    })

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBeNull()
  })

  test('trims whitespace from title', async () => {
    globalThis.fetch = mock(async () => new Response(
      '<html><head><title>  Spaced Title  </title></head></html>',
      { status: 200 }
    ))

    const res = await app.request('/actions/url-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Spaced Title')
  })
})

describe('POST /actions/command', () => {
  let originalBunSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalBunSpawn = Bun.spawn
  })

  test('returns 400 when command is missing', async () => {
    const res = await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'output' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('command is required')
  })

  test('runs command in background mode', async () => {
    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      pid: 12345,
    }))

    const res = await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo hello', mode: 'background' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true })

    Bun.spawn = originalBunSpawn
  })

  test('runs command in output mode and returns stdout', async () => {
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Hello World'))
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(0),
    }))

    const res = await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo Hello World', mode: 'output' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.output).toBe('Hello World')
    expect(data.exitCode).toBe(0)

    Bun.spawn = originalBunSpawn
  })

  test('runs command with custom cwd', async () => {
    let capturedOptions: any

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock((cmd: string[], options: any) => {
      capturedOptions = options
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    })

    await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'dir', mode: 'output', cwd: 'C:\\temp' }),
    })

    expect(capturedOptions.cwd).toBe('C:\\temp')

    Bun.spawn = originalBunSpawn
  })

  test('returns stderr when command fails', async () => {
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Command failed'))
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(1),
    }))

    const res = await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'invalid-command', mode: 'output' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Command failed')
    expect(data.exitCode).toBe(1)

    Bun.spawn = originalBunSpawn
  })

  test('returns 500 when spawn throws', async () => {
    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => {
      throw new Error('Spawn error')
    })

    const res = await app.request('/actions/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'test', mode: 'output' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Failed to run command')

    Bun.spawn = originalBunSpawn
  })
})

describe('POST /actions/ssh/list-dir', () => {
  let originalBunSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalBunSpawn = Bun.spawn
  })

  test('returns 400 when host is missing', async () => {
    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/home/user' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('host is required')
  })

  test('lists directory contents via SSH', async () => {
    const mockOutput = '/home/user\nfile1.txt\ndir1/\nfile2.js\n'
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockOutput))
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(0),
    }))

    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/home/user' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe('/home/user')
    expect(data.entries).toEqual([
      { name: 'file1.txt', isDir: false },
      { name: 'dir1', isDir: true },
      { name: 'file2.js', isDir: false },
    ])

    Bun.spawn = originalBunSpawn
  })

  test('uses default path ~ when not specified', async () => {
    let capturedCmd: string[]

    const mockStdout = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('/home/user\n'))
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock((cmd: string[]) => {
      capturedCmd = cmd
      return {
        stdout: mockStdout,
        stderr: mockStderr,
        exited: Promise.resolve(0),
      }
    })

    await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver' }),
    })

    // Check that $HOME is used for ~ path
    expect(capturedCmd![2]).toContain('$HOME')

    Bun.spawn = originalBunSpawn
  })

  test('filters hidden files', async () => {
    const mockOutput = '/home/user\n.hidden\nvisible.txt\n.config/\n'
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockOutput))
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(0),
    }))

    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/home/user' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    // Hidden files should be filtered out
    expect(data.entries).toEqual([
      { name: 'visible.txt', isDir: false },
    ])

    Bun.spawn = originalBunSpawn
  })

  test('returns 500 when SSH command fails', async () => {
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Permission denied'))
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(1),
    }))

    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/root' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Permission denied')

    Bun.spawn = originalBunSpawn
  })

  test('returns 500 when spawn throws', async () => {
    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => {
      throw new Error('SSH connection failed')
    })

    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/home' }),
    })

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('SSH error')

    Bun.spawn = originalBunSpawn
  })

  test('strips special characters from file names', async () => {
    const mockOutput = '/home/user\nexecutable*\nlink@\npipe|\n'
    const mockStdout = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockOutput))
        controller.close()
      },
    })
    const mockStderr = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    // @ts-ignore - mocking Bun.spawn
    Bun.spawn = mock(() => ({
      stdout: mockStdout,
      stderr: mockStderr,
      exited: Promise.resolve(0),
    }))

    const res = await app.request('/actions/ssh/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'myserver', path: '/home/user' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.entries).toEqual([
      { name: 'executable', isDir: false },
      { name: 'link', isDir: false },
      { name: 'pipe', isDir: false },
    ])

    Bun.spawn = originalBunSpawn
  })
})

describe('GET /actions/ssh-hosts', () => {
  beforeEach(() => {
    mockReadFile.mockClear()
  })

  test('returns hosts from SSH config', async () => {
    mockReadFileResult = `
Host server1
  HostName 192.168.1.1

Host server2
  HostName 192.168.1.2
`

    const res = await app.request('/actions/ssh-hosts', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.hosts).toEqual(['server1', 'server2'])
  })

  test('returns empty array when config file does not exist', async () => {
    mockReadFileResult = new Error('ENOENT: no such file or directory')

    const res = await app.request('/actions/ssh-hosts', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.hosts).toEqual([])
  })
})
