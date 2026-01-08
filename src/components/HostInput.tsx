import { useState, useRef, useEffect } from 'react'

interface HostInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export default function HostInput({
  value,
  onChange,
  suggestions,
  placeholder = 'host or user@host',
  className = '',
  autoFocus = false,
}: HostInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      const selected = filteredSuggestions[highlightIndex]
      if (selected) onChange(selected)
      setShowSuggestions(false)
      setHighlightIndex(-1)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }
  }

  const handleSelect = (host: string) => {
    onChange(host)
    setShowSuggestions(false)
    setHighlightIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
          setHighlightIndex(-1)
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`input-terminal ${className}`}
        autoFocus={autoFocus}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2 left-full ml-1 z-50 rounded-lg bg-(--bg-surface) border border-(--border-visible) shadow-lg overflow-hidden min-w-[120px] max-h-80 overflow-y-auto">
          {filteredSuggestions.map((host, index) => (
            <button
              key={host}
              type="button"
              onClick={() => handleSelect(host)}
              className={`w-full px-3 py-1.5 text-left text-sm font-mono whitespace-nowrap transition-colors ${
                index === highlightIndex
                  ? 'bg-(--accent-remote)/20 text-(--accent-remote)'
                  : 'text-(--text-secondary) hover:bg-(--bg-elevated)'
              }`}
            >
              {host}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
