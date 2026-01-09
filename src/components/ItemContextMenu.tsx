import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react'

interface ContextMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

interface ItemContextMenuProps {
  children: ReactNode
  items: ContextMenuItem[]
  className?: string
}

interface MenuPosition {
  x: number
  y: number
}

export default function ItemContextMenu({ children, items, className }: ItemContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Calculate position relative to viewport
      const x = e.clientX
      const y = e.clientY

      // Adjust position if menu would go off screen
      const menuWidth = 160
      const menuHeight = items.length * 36 + 8 // Approximate menu height

      const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
      const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y

      setPosition({ x: adjustedX, y: adjustedY })
      setIsOpen(true)
    },
    [items.length]
  )

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    // Use setTimeout to avoid closing immediately from the context menu event
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleItemClick = (item: ContextMenuItem) => {
    setIsOpen(false)
    item.onClick()
  }

  return (
    <div ref={containerRef} onContextMenu={handleContextMenu} className={className}>
      {children}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[140px] py-1 bg-(--bg-elevated) border border-(--border-visible) rounded-lg shadow-lg animate-card-enter"
          style={{ left: position.x, top: position.y }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-mono transition-colors
                ${
                  item.danger
                    ? 'text-(--text-primary) hover:bg-(--accent-danger)/10 hover:text-(--accent-danger)'
                    : 'text-(--text-primary) hover:bg-(--accent-primary)/10 hover:text-(--accent-primary)'
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Duplicate icon component
export function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}
