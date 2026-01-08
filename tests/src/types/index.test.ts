import { describe, test, expect } from 'bun:test'
import { WINDOWS_TERMINALS, MACOS_TERMINALS, LINUX_TERMINALS, DEFAULT_SECTION_ORDER } from '../../../src/types'
import type { SectionKey } from '../../../src/types'

describe('Type Constants', () => {
  describe('WINDOWS_TERMINALS', () => {
    test('contains expected Windows terminal options', () => {
      expect(WINDOWS_TERMINALS.length).toBe(5)
      const values = WINDOWS_TERMINALS.map((t) => t.value)
      expect(values).toContain('cmd')
      expect(values).toContain('power-shell')
      expect(values).toContain('pwsh-core')
      expect(values).toContain('windows-terminal')
      expect(values).toContain('git-bash')
    })

    test('has correct labels for Windows terminals', () => {
      const cmdTerminal = WINDOWS_TERMINALS.find((t) => t.value === 'cmd')
      expect(cmdTerminal?.label).toBe('Command Prompt')

      const psTerminal = WINDOWS_TERMINALS.find((t) => t.value === 'power-shell')
      expect(psTerminal?.label).toBe('PowerShell')

      const wtTerminal = WINDOWS_TERMINALS.find((t) => t.value === 'windows-terminal')
      expect(wtTerminal?.label).toBe('Windows Terminal')
    })

    test('all entries have valid value and label', () => {
      for (const terminal of WINDOWS_TERMINALS) {
        expect(terminal.value).toBeDefined()
        expect(typeof terminal.value).toBe('string')
        expect(terminal.label).toBeDefined()
        expect(typeof terminal.label).toBe('string')
        expect(terminal.label.length).toBeGreaterThan(0)
      }
    })
  })

  describe('MACOS_TERMINALS', () => {
    test('contains expected macOS terminal options', () => {
      expect(MACOS_TERMINALS.length).toBe(4)
      const values = MACOS_TERMINALS.map((t) => t.value)
      expect(values).toContain('mac-terminal')
      expect(values).toContain('i-term2')
      expect(values).toContain('kitty')
      expect(values).toContain('alacritty')
    })

    test('has correct labels for macOS terminals', () => {
      const macTerminal = MACOS_TERMINALS.find((t) => t.value === 'mac-terminal')
      expect(macTerminal?.label).toBe('Terminal')

      const iterm = MACOS_TERMINALS.find((t) => t.value === 'i-term2')
      expect(iterm?.label).toBe('iTerm2')
    })

    test('all entries have valid value and label', () => {
      for (const terminal of MACOS_TERMINALS) {
        expect(terminal.value).toBeDefined()
        expect(typeof terminal.value).toBe('string')
        expect(terminal.label).toBeDefined()
        expect(typeof terminal.label).toBe('string')
        expect(terminal.label.length).toBeGreaterThan(0)
      }
    })
  })

  describe('LINUX_TERMINALS', () => {
    test('contains expected Linux terminal options', () => {
      expect(LINUX_TERMINALS.length).toBe(5)
      const values = LINUX_TERMINALS.map((t) => t.value)
      expect(values).toContain('gnome-terminal')
      expect(values).toContain('konsole')
      expect(values).toContain('xterm')
      expect(values).toContain('kitty')
      expect(values).toContain('alacritty')
    })

    test('has correct labels for Linux terminals', () => {
      const gnome = LINUX_TERMINALS.find((t) => t.value === 'gnome-terminal')
      expect(gnome?.label).toBe('GNOME Terminal')

      const konsole = LINUX_TERMINALS.find((t) => t.value === 'konsole')
      expect(konsole?.label).toBe('Konsole')
    })

    test('shares cross-platform terminals with macOS', () => {
      const linuxValues = LINUX_TERMINALS.map((t) => t.value)
      const macValues = MACOS_TERMINALS.map((t) => t.value)

      // kitty and alacritty should be on both platforms
      expect(linuxValues).toContain('kitty')
      expect(linuxValues).toContain('alacritty')
      expect(macValues).toContain('kitty')
      expect(macValues).toContain('alacritty')
    })

    test('all entries have valid value and label', () => {
      for (const terminal of LINUX_TERMINALS) {
        expect(terminal.value).toBeDefined()
        expect(typeof terminal.value).toBe('string')
        expect(terminal.label).toBeDefined()
        expect(typeof terminal.label).toBe('string')
        expect(terminal.label.length).toBeGreaterThan(0)
      }
    })
  })

  describe('DEFAULT_SECTION_ORDER', () => {
    test('contains all 8 section keys', () => {
      expect(DEFAULT_SECTION_ORDER.length).toBe(8)
    })

    test('contains expected section keys', () => {
      const expectedKeys: SectionKey[] = [
        'workingDirs',
        'ide',
        'remoteIde',
        'codingAgent',
        'file',
        'command',
        'links',
        'notes',
      ]
      for (const key of expectedKeys) {
        expect(DEFAULT_SECTION_ORDER).toContain(key)
      }
    })

    test('has workingDirs as first section', () => {
      expect(DEFAULT_SECTION_ORDER[0]).toBe('workingDirs')
    })

    test('has notes as last section', () => {
      expect(DEFAULT_SECTION_ORDER[DEFAULT_SECTION_ORDER.length - 1]).toBe('notes')
    })

    test('has no duplicate entries', () => {
      const uniqueKeys = new Set(DEFAULT_SECTION_ORDER)
      expect(uniqueKeys.size).toBe(DEFAULT_SECTION_ORDER.length)
    })

    test('IDE sections are grouped together', () => {
      const ideIndex = DEFAULT_SECTION_ORDER.indexOf('ide')
      const remoteIdeIndex = DEFAULT_SECTION_ORDER.indexOf('remoteIde')
      const codingAgentIndex = DEFAULT_SECTION_ORDER.indexOf('codingAgent')

      // ide, remoteIde, codingAgent should be consecutive
      expect(remoteIdeIndex).toBe(ideIndex + 1)
      expect(codingAgentIndex).toBe(remoteIdeIndex + 1)
    })
  })

  describe('Terminal type uniqueness', () => {
    test('no duplicate values across all terminal arrays', () => {
      const allTerminals = [...WINDOWS_TERMINALS, ...MACOS_TERMINALS, ...LINUX_TERMINALS]
      const valueCount = new Map<string, number>()

      for (const terminal of allTerminals) {
        valueCount.set(terminal.value, (valueCount.get(terminal.value) || 0) + 1)
      }

      // kitty and alacritty appear in both macOS and Linux (2 times each)
      expect(valueCount.get('kitty')).toBe(2)
      expect(valueCount.get('alacritty')).toBe(2)

      // All other terminals should appear exactly once
      for (const [value, count] of valueCount) {
        if (value !== 'kitty' && value !== 'alacritty') {
          expect(count).toBe(1)
        }
      }
    })
  })
})
