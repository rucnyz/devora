import { describe, test, expect } from 'bun:test'

// Import launchers directly without mocking to test the launcher definitions
import { launchers, type IdeType, type RemoteIdeType } from '../../../server/utils/launchers'

describe('Launchers', () => {
  describe('launchers object', () => {
    test('contains all IDE types', () => {
      const ideTypes: (IdeType | 'file')[] = ['pycharm', 'cursor', 'vscode', 'zed', 'antigravity', 'file']
      for (const type of ideTypes) {
        expect(launchers[type]).toBeDefined()
        expect(typeof launchers[type]).toBe('function')
      }
    })

    test('does not contain obsolete obsidian type', () => {
      expect((launchers as any).obsidian).toBeUndefined()
    })

    describe('pycharm launcher', () => {
      test('returns correct command and args', () => {
        const result = launchers.pycharm('/test/path')
        expect(result.command).toContain('pycharm.cmd')
        expect(result.args).toEqual(['/test/path'])
      })
    })

    describe('cursor launcher', () => {
      test('returns correct command and args', () => {
        const result = launchers.cursor('/test/path')
        expect(result.command).toMatch(/cursor(\.cmd)?$/)
        expect(result.args).toEqual(['/test/path'])
      })
    })

    describe('vscode launcher', () => {
      test('returns correct command and args', () => {
        const result = launchers.vscode('/test/path')
        expect(result.command).toMatch(/code(\.cmd)?$/)
        expect(result.args).toEqual(['/test/path'])
      })
    })

    describe('zed launcher', () => {
      test('returns correct command and args', () => {
        const result = launchers.zed('/test/path')
        expect(result.command).toBe('zed')
        expect(result.args).toEqual(['/test/path'])
      })
    })

    describe('antigravity launcher', () => {
      test('returns correct command and args', () => {
        const result = launchers.antigravity('/test/path')
        expect(result.command).toBe('antigravity')
        expect(result.args).toEqual(['/test/path'])
      })

      test('handles paths with spaces', () => {
        const result = launchers.antigravity('/test/path with spaces')
        expect(result.command).toBe('antigravity')
        expect(result.args).toEqual(['/test/path with spaces'])
      })
    })

    describe('file launcher', () => {
      test('returns explorer.exe for files', () => {
        const result = launchers.file('/test/file.txt')
        expect(result.command).toBe('explorer.exe')
        expect(result.args).toEqual(['/test/file.txt'])
      })
    })
  })
})
