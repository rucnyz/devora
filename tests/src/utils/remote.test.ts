import { describe, test, expect } from 'bun:test'
import { parseRemoteContent, buildRemoteContent, getPathName } from '../../../src/utils/remote'

describe('Remote Utils', () => {
  describe('parseRemoteContent', () => {
    test('should parse host:path format correctly', () => {
      const result = parseRemoteContent('myhost:/home/user/project')
      expect(result.host).toBe('myhost')
      expect(result.path).toBe('/home/user/project')
    })

    test('should handle host with no path', () => {
      const result = parseRemoteContent('myhost:')
      expect(result.host).toBe('myhost')
      expect(result.path).toBe('')
    })

    test('should handle content without colon', () => {
      const result = parseRemoteContent('myhost')
      expect(result.host).toBe('myhost')
      expect(result.path).toBe('')
    })

    test('should handle empty string', () => {
      const result = parseRemoteContent('')
      expect(result.host).toBe('')
      expect(result.path).toBe('')
    })

    test('should handle path with multiple colons', () => {
      // First colon separates host from path
      const result = parseRemoteContent('myhost:/path/with:colon')
      expect(result.host).toBe('myhost')
      expect(result.path).toBe('/path/with:colon')
    })

    test('should handle Windows-style paths in content', () => {
      // This would be an unusual case, but should still work
      const result = parseRemoteContent('server:C:/Users/project')
      expect(result.host).toBe('server')
      expect(result.path).toBe('C:/Users/project')
    })
  })

  describe('buildRemoteContent', () => {
    test('should build host:path format', () => {
      const result = buildRemoteContent('myhost', '/home/user/project')
      expect(result).toBe('myhost:/home/user/project')
    })

    test('should trim whitespace', () => {
      const result = buildRemoteContent('  myhost  ', '  /home/user/project  ')
      expect(result).toBe('myhost:/home/user/project')
    })

    test('should handle empty host', () => {
      const result = buildRemoteContent('', '/home/user')
      expect(result).toBe(':/home/user')
    })

    test('should handle empty path', () => {
      const result = buildRemoteContent('myhost', '')
      expect(result).toBe('myhost:')
    })
  })

  describe('getPathName', () => {
    test('should extract last segment from Unix path', () => {
      expect(getPathName('/home/user/project')).toBe('project')
    })

    test('should extract last segment from Windows path', () => {
      expect(getPathName('C:\\Users\\project')).toBe('project')
    })

    test('should extract last segment from mixed path', () => {
      expect(getPathName('/home/user\\project')).toBe('project')
    })

    test('should handle trailing slash', () => {
      // Note: trailing slash results in empty last segment, returns default
      expect(getPathName('/home/user/project/')).toBe('Project')
    })

    test('should handle single segment', () => {
      expect(getPathName('project')).toBe('project')
    })

    test('should return default name for empty path', () => {
      expect(getPathName('')).toBe('Project')
    })

    test('should return custom default name for empty path', () => {
      expect(getPathName('', 'CustomDefault')).toBe('CustomDefault')
    })

    test('should trim whitespace', () => {
      expect(getPathName('  /home/user/project  ')).toBe('project')
    })

    test('should handle root path', () => {
      expect(getPathName('/')).toBe('Project')
    })

    test('should handle Windows root path', () => {
      expect(getPathName('C:\\')).toBe('Project')
    })

    test('should extract filename with extension', () => {
      expect(getPathName('/home/user/file.txt')).toBe('file.txt')
    })
  })
})
