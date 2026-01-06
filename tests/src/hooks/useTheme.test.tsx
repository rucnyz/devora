import { describe, test, expect, beforeEach, spyOn } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../../../src/hooks/useTheme'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset document attribute
    document.documentElement.removeAttribute('data-theme')
    // Mock matchMedia to return false for light scheme (defaults to dark)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, // Simulate preferring dark mode
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  })

  test('throws error when used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useTheme())
    }).toThrow('useTheme must be used within a ThemeProvider')

    consoleSpy.mockRestore()
  })

  test('defaults to dark theme when no preference', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')
  })

  test('uses stored theme from localStorage', () => {
    localStorage.setItem('theme', 'light')

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('light')
  })

  test('toggles theme from dark to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
  })

  test('toggles theme from light to dark', () => {
    localStorage.setItem('theme', 'light')

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
  })

  test('persists theme to localStorage on change', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.toggleTheme()
    })

    expect(localStorage.getItem('theme')).toBe('light')
  })

  test('sets data-theme attribute on document', () => {
    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  test('updates data-theme attribute on toggle', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.toggleTheme()
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  test('ignores invalid stored theme value', () => {
    localStorage.setItem('theme', 'invalid')

    const { result } = renderHook(() => useTheme(), { wrapper })

    // Should fall back to default (dark) when stored value is invalid
    expect(result.current.theme).toBe('dark')
  })
})
