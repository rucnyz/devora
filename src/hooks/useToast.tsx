import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Toast icons for each type
const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'error':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    case 'warning':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )
    case 'info':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
  }
}

// Get toast styles based on type
const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        container: 'bg-(--bg-elevated) border-l-4 border-l-(--accent-primary)',
        icon: 'text-(--accent-primary)',
      }
    case 'error':
      return {
        container: 'bg-(--bg-elevated) border-l-4 border-l-(--accent-danger)',
        icon: 'text-(--accent-danger)',
      }
    case 'warning':
      return {
        container: 'bg-(--bg-elevated) border-l-4 border-l-(--accent-warning)',
        icon: 'text-(--accent-warning)',
      }
    case 'info':
      return {
        container: 'bg-(--bg-elevated) border-l-4 border-l-(--accent-secondary)',
        icon: 'text-(--accent-secondary)',
      }
  }
}

// Individual toast item component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const styles = getToastStyles(toast.type)

  return (
    <div
      className={`${styles.container} border border-(--border-subtle) rounded-lg shadow-lg p-4 min-w-72 max-w-96 animate-toast-enter`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={`${styles.icon} shrink-0 mt-0.5`}>
          <ToastIcon type={toast.type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-(--text-primary)">{toast.message}</p>
          {toast.description && <p className="text-xs text-(--text-muted) mt-1">{toast.description}</p>}
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-1 rounded hover:bg-(--bg-surface) text-(--text-muted) hover:text-(--text-primary) transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Toast container component
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>,
    document.body
  )
}

// Generate unique ID
let toastIdCounter = 0
const generateId = () => `toast-${++toastIdCounter}-${Date.now()}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = generateId()
      const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000)

      setToasts((prev) => [...prev, { ...toast, id }])

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration)
      }
    },
    [removeToast]
  )

  const success = useCallback(
    (message: string, description?: string) => {
      addToast({ type: 'success', message, description })
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, description?: string) => {
      addToast({ type: 'error', message, description, duration: 5000 })
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, description?: string) => {
      addToast({ type: 'warning', message, description, duration: 4000 })
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, description?: string) => {
      addToast({ type: 'info', message, description })
    },
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
