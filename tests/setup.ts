import { afterEach } from 'bun:test'
import { mock } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Register happy-dom globally for React testing
GlobalRegistrator.register()

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
