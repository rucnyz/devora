import { mock } from 'bun:test'
import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'

// Mock Tauri API before importing providers that use it
mock.module('../src/api/tauri', () => ({
  getSetting: mock(() => Promise.resolve(null)),
  setSetting: mock(() => Promise.resolve()),
}))

// Import providers after mocking
import { ToastProvider } from '../src/hooks/useToast'
import { CustomIdesProvider } from '../src/hooks/useCustomIdes'

// Wrapper that includes all providers needed for testing
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CustomIdesProvider>{children}</CustomIdesProvider>
    </ToastProvider>
  )
}

// Custom render function that wraps components with all providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with custom render
export { customRender as render }
