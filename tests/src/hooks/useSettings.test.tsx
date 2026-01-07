import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SettingsProvider, useSetting, DEFAULT_SETTINGS } from '../../../src/hooks/useSettings'
import type { ReactNode } from 'react'

describe('useSettings', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  )

  describe('SettingsProvider', () => {
    test('loads settings from API on mount', async () => {
      const apiSettings = { fileCardMaxSize: '2097152' } // 2MB
      globalThis.fetch = async () => new Response(JSON.stringify(apiSettings), { status: 200 })

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.value).toBe(2097152)
    })

    test('uses default settings when API returns empty', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200 })

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.value).toBe(DEFAULT_SETTINGS.fileCardMaxSize)
    })

    test('uses default settings on API error', async () => {
      globalThis.fetch = async () => new Response('', { status: 500 })

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.value).toBe(DEFAULT_SETTINGS.fileCardMaxSize)
    })

    test('shows loading state initially', async () => {
      globalThis.fetch = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('useSetting', () => {
    test('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = () => {}

      expect(() => {
        renderHook(() => useSetting('fileCardMaxSize'))
      }).toThrow('useSetting must be used within a SettingsProvider')

      console.error = originalError
    })

    test('returns correct value for setting key', async () => {
      const apiSettings = { fileCardMaxSize: '524288' } // 512KB
      globalThis.fetch = async () => new Response(JSON.stringify(apiSettings), { status: 200 })

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.value).toBe(524288)
    })

    test('updateValue calls API and updates state', async () => {
      let capturedUrl: string | undefined
      let capturedBody: any
      let callCount = 0

      globalThis.fetch = async (url, options) => {
        callCount++
        if (callCount === 1) {
          // Initial fetch
          return new Response(JSON.stringify({}), { status: 200 })
        }
        // Update setting
        capturedUrl = typeof url === 'string' ? url : url.toString()
        capturedBody = JSON.parse(options?.body as string)
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateValue(2097152)
      })

      expect(capturedUrl).toContain('/settings/fileCardMaxSize')
      expect(capturedBody.value).toBe('2097152')
      expect(result.current.value).toBe(2097152)
    })

    test('updateValue updates state optimistically', async () => {
      let callCount = 0

      globalThis.fetch = async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify({}), { status: 200 })
        }
        // Delay API response
        await new Promise((resolve) => setTimeout(resolve, 100))
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Start update (don't await)
      act(() => {
        result.current.updateValue(999999)
      })

      // State should update immediately (optimistic)
      expect(result.current.value).toBe(999999)
    })
  })

  describe('DEFAULT_SETTINGS', () => {
    test('has fileCardMaxSize default of 1MB', () => {
      expect(DEFAULT_SETTINGS.fileCardMaxSize).toBe(1024 * 1024)
    })
  })

  describe('number parsing', () => {
    test('parses numeric strings correctly', async () => {
      const apiSettings = { fileCardMaxSize: '123456' }
      globalThis.fetch = async () => new Response(JSON.stringify(apiSettings), { status: 200 })

      const { result } = renderHook(() => useSetting('fileCardMaxSize'), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.value).toBe('number')
      expect(result.current.value).toBe(123456)
    })
  })
})
