import { describe, test, expect } from 'bun:test'
import {
  IDE_LABELS,
  IDE_TAG_CLASS,
  IDE_TYPES,
  REMOTE_IDE_LABELS,
  REMOTE_IDE_TAG_CLASS,
  REMOTE_IDE_TYPES,
} from '../../../src/constants/itemTypes'
import type { IdeType } from '../../../src/types'

describe('IDE Constants', () => {
  describe('IDE_LABELS', () => {
    test('contains all IDE types', () => {
      const ideTypes: IdeType[] = ['pycharm', 'cursor', 'vscode', 'zed', 'antigravity']
      for (const type of ideTypes) {
        expect(IDE_LABELS[type]).toBeDefined()
        expect(typeof IDE_LABELS[type]).toBe('string')
      }
    })

    test('has correct labels', () => {
      expect(IDE_LABELS.pycharm).toBe('PyCharm')
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

  describe('IDE_TYPES', () => {
    test('contains 5 IDE options', () => {
      expect(IDE_TYPES.length).toBe(5)
    })

    test('contains all expected IDE types', () => {
      const values = IDE_TYPES.map(t => t.value)
      expect(values).toContain('pycharm')
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
