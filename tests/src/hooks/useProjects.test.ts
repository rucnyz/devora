import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useProjects, useProject, openIde, openFile, selectFolder, selectFile, fetchSSHHosts, fetchUrlMetadata, runCommand } from '../../../src/hooks/useProjects'

describe('useProjects hook', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('fetches projects on mount', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1', description: '', metadata: {}, created_at: '', updated_at: '' },
    ]

    globalThis.fetch = async () => new Response(JSON.stringify(mockProjects), { status: 200 })

    const { result } = renderHook(() => useProjects())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.projects).toEqual(mockProjects)
    expect(result.current.error).toBeNull()
  })

  test('sets error on fetch failure', async () => {
    globalThis.fetch = async () => new Response('', { status: 500 })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch projects')
  })

  test('createProject adds new project to state', async () => {
    const initialProjects = [{ id: '1', name: 'Existing', description: '', metadata: {}, created_at: '', updated_at: '' }]
    const newProject = { id: '2', name: 'New Project', description: '', metadata: {}, created_at: '', updated_at: '' }

    let callCount = 0
    globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      callCount++
      if (callCount === 1) {
        // Initial fetch
        return new Response(JSON.stringify(initialProjects), { status: 200 })
      }
      // Create project
      return new Response(JSON.stringify(newProject), { status: 201 })
    }

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.createProject('New Project')
    })

    expect(result.current.projects.length).toBe(2)
    expect(result.current.projects[0].name).toBe('New Project')
  })

  test('deleteProject removes project from state', async () => {
    const initialProjects = [
      { id: '1', name: 'Project 1', description: '', metadata: {}, created_at: '', updated_at: '' },
      { id: '2', name: 'Project 2', description: '', metadata: {}, created_at: '', updated_at: '' },
    ]

    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(initialProjects), { status: 200 })
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteProject('1')
    })

    expect(result.current.projects.length).toBe(1)
    expect(result.current.projects[0].id).toBe('2')
  })

  test('updateProject updates project in state', async () => {
    const initialProjects = [
      { id: '1', name: 'Original', description: '', metadata: {}, created_at: '', updated_at: '' },
    ]
    const updatedProject = { id: '1', name: 'Updated', description: 'New desc', metadata: {}, created_at: '', updated_at: '' }

    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(initialProjects), { status: 200 })
      }
      return new Response(JSON.stringify(updatedProject), { status: 200 })
    }

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.updateProject('1', { name: 'Updated', description: 'New desc' })
    })

    expect(result.current.projects[0].name).toBe('Updated')
    expect(result.current.projects[0].description).toBe('New desc')
  })
})

describe('useProject hook', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('fetches single project on mount', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: '',
      metadata: {},
      created_at: '',
      updated_at: '',
      items: [{ id: 'item1', title: 'Item 1' }],
    }

    globalThis.fetch = async () => new Response(JSON.stringify(mockProject), { status: 200 })

    const { result } = renderHook(() => useProject('1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.project).not.toBeNull()
    expect(result.current.project?.name).toBe('Test Project')
  })

  test('sets error on fetch failure', async () => {
    globalThis.fetch = async () => new Response('', { status: 404 })

    const { result } = renderHook(() => useProject('nonexistent'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch project')
  })
})

describe('API helper functions', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('openIde', () => {
    test('calls API with correct parameters', async () => {
      let capturedBody: any

      globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options?.body as string)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }

      await openIde('vscode', '/path/to/project')

      expect(capturedBody.ide_type).toBe('vscode')
      expect(capturedBody.path).toBe('/path/to/project')
    })

    test('throws on API error', async () => {
      globalThis.fetch = async () => new Response('', { status: 500 })

      expect(openIde('vscode', '/path')).rejects.toThrow('Failed to open IDE')
    })
  })

  describe('openFile', () => {
    test('calls API with correct path', async () => {
      let capturedBody: any

      globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options?.body as string)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }

      await openFile('/path/to/file.txt')

      expect(capturedBody.path).toBe('/path/to/file.txt')
    })
  })

  describe('selectFolder', () => {
    test('returns selected path', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ path: '/selected/folder' }), { status: 200 })

      const result = await selectFolder()

      expect(result).toBe('/selected/folder')
    })

    test('returns null when no path', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ path: null }), { status: 200 })

      const result = await selectFolder()

      expect(result).toBeNull()
    })
  })

  describe('selectFile', () => {
    test('returns selected file path', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ path: '/selected/file.txt' }), { status: 200 })

      const result = await selectFile()

      expect(result).toBe('/selected/file.txt')
    })
  })

  describe('fetchSSHHosts', () => {
    test('returns hosts array', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ hosts: ['server1', 'server2'] }), { status: 200 })

      const result = await fetchSSHHosts()

      expect(result).toEqual(['server1', 'server2'])
    })

    test('returns empty array on error', async () => {
      globalThis.fetch = async () => new Response('', { status: 500 })

      const result = await fetchSSHHosts()

      expect(result).toEqual([])
    })
  })

  describe('fetchUrlMetadata', () => {
    test('returns title from API', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ title: 'Page Title' }), { status: 200 })

      const result = await fetchUrlMetadata('https://example.com')

      expect(result).toBe('Page Title')
    })

    test('returns null on API error', async () => {
      globalThis.fetch = async () => new Response('', { status: 500 })

      const result = await fetchUrlMetadata('https://example.com')

      expect(result).toBeNull()
    })

    test('returns null when no title', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ title: null }), { status: 200 })

      const result = await fetchUrlMetadata('https://example.com')

      expect(result).toBeNull()
    })
  })

  describe('runCommand', () => {
    test('returns command result', async () => {
      const mockResult = { success: true, output: 'Hello World', exitCode: 0 }
      globalThis.fetch = async () => new Response(JSON.stringify(mockResult), { status: 200 })

      const result = await runCommand('echo Hello World', 'output')

      expect(result.success).toBe(true)
      expect(result.output).toBe('Hello World')
      expect(result.exitCode).toBe(0)
    })

    test('passes working directory to API', async () => {
      let capturedBody: any

      globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options?.body as string)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }

      await runCommand('ls', 'output', '/home/user')

      expect(capturedBody.command).toBe('ls')
      expect(capturedBody.mode).toBe('output')
      expect(capturedBody.cwd).toBe('/home/user')
    })

    test('throws on API error', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Command failed' }), { status: 500 })

      expect(runCommand('invalid', 'output')).rejects.toThrow()
    })
  })
})
