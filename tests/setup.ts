import { afterEach } from 'bun:test'
import { mock } from 'bun:test'

// Try to register happy-dom globally for React testing
// This may fail in environments where happy-dom is not installed
try {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  GlobalRegistrator.register()
} catch {
  // happy-dom not available, skip DOM setup (server-only tests don't need it)
}

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null
  },
  setItem(key: string, value: string) {
    this.store[key] = value
  },
  removeItem(key: string) {
    delete this.store[key]
  },
  clear() {
    this.store = {}
  },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Reset all mocks after each test
afterEach(() => {
  mock.restore()
  localStorageMock.clear()
})
