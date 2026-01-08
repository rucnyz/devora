import { describe, test, expect } from 'bun:test'
import {
  IDE_LABELS,
  IDE_TAG_CLASS,
  IDE_TYPES,
  IDE_GROUPS,
  REMOTE_IDE_LABELS,
  REMOTE_IDE_TAG_CLASS,
  REMOTE_IDE_TYPES,
} from '../../../src/constants/itemTypes'
import type { IdeType } from '../../../src/types'

describe('IDE Constants', () => {
  describe('IDE_LABELS', () => {
    test('contains all IDE types', () => {
      const jetbrainsIdes: IdeType[] = ['idea', 'pycharm', 'webstorm', 'phpstorm', 'rubymine', 'clion', 'goland', 'rider', 'datagrip', 'rustrover', 'aqua']
      const otherIdes: IdeType[] = ['cursor', 'vscode', 'zed', 'antigravity']
      const allIdes = [...jetbrainsIdes, ...otherIdes]
      for (const type of allIdes) {
        expect(IDE_LABELS[type]).toBeDefined()
        expect(typeof IDE_LABELS[type]).toBe('string')
      }
    })

    test('has correct labels for JetBrains IDEs', () => {
      expect(IDE_LABELS.idea).toBe('IntelliJ IDEA')
      expect(IDE_LABELS.pycharm).toBe('PyCharm')
      expect(IDE_LABELS.webstorm).toBe('WebStorm')
      expect(IDE_LABELS.clion).toBe('CLion')
      expect(IDE_LABELS.rustrover).toBe('RustRover')
    })

    test('has correct labels for other IDEs', () => {
      expect(IDE_LABELS.cursor).toBe('Cursor')
      expect(IDE_LABELS.vscode).toBe('VS Code')
      expect(IDE_LABELS.zed).toBe('Zed')
      expect(IDE_LABELS.antigravity).toBe('Antigravity')
    })

    test('does not contain obsolete obsidian type', () => {
      expect((IDE_LABELS as any).obsidian).toBeUndefined()
    })
  })

  describe('IDE_TAG_CLASS', () => {
    test('is the unified tag-ide class', () => {
      expect(IDE_TAG_CLASS).toBe('tag-ide')
    })
  })

  describe('IDE_GROUPS', () => {
    test('has JetBrains and Other groups', () => {
      expect(IDE_GROUPS.length).toBe(2)
      expect(IDE_GROUPS[0].group).toBe('JetBrains')
      expect(IDE_GROUPS[1].group).toBe('Other')
    })

    test('JetBrains group contains 11 IDEs', () => {
      expect(IDE_GROUPS[0].items.length).toBe(11)
    })

    test('Other group contains 4 IDEs', () => {
      expect(IDE_GROUPS[1].items.length).toBe(4)
    })
  })

  describe('IDE_TYPES', () => {
    test('contains 15 IDE options (flattened from groups)', () => {
      expect(IDE_TYPES.length).toBe(15)
    })

    test('contains all expected IDE types', () => {
      const values = IDE_TYPES.map(t => t.value)
      // JetBrains
      expect(values).toContain('idea')
      expect(values).toContain('pycharm')
      expect(values).toContain('rustrover')
      expect(values).toContain('clion')
      // Other
      expect(values).toContain('cursor')
      expect(values).toContain('vscode')
      expect(values).toContain('zed')
      expect(values).toContain('antigravity')
    })

    test('does not contain obsolete obsidian type', () => {
      const values = IDE_TYPES.map(t => t.value)
      expect(values).not.toContain('obsidian')
    })

    test('has matching value and label pairs', () => {
      for (const item of IDE_TYPES) {
        expect(item.label).toBe(IDE_LABELS[item.value])
      }
    })
  })
})

describe('Remote IDE Constants', () => {
  describe('REMOTE_IDE_LABELS', () => {
    test('contains only cursor and vscode', () => {
      expect(REMOTE_IDE_LABELS.cursor).toBeDefined()
      expect(REMOTE_IDE_LABELS.vscode).toBeDefined()
      expect(Object.keys(REMOTE_IDE_LABELS).length).toBe(2)
    })

    test('has correct labels', () => {
      expect(REMOTE_IDE_LABELS.cursor).toBe('Cursor')
      expect(REMOTE_IDE_LABELS.vscode).toBe('VS Code')
    })
  })

  describe('REMOTE_IDE_TAG_CLASS', () => {
    test('is the unified tag-remote-ide class', () => {
      expect(REMOTE_IDE_TAG_CLASS).toBe('tag-remote-ide')
    })
  })

  describe('REMOTE_IDE_TYPES', () => {
    test('contains 2 remote IDE options', () => {
      expect(REMOTE_IDE_TYPES.length).toBe(2)
    })

    test('contains only cursor and vscode', () => {
      const values = REMOTE_IDE_TYPES.map(t => t.value)
      expect(values).toContain('cursor')
      expect(values).toContain('vscode')
      expect(values.length).toBe(2)
    })
  })
})
