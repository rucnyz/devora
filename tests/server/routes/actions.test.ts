import { describe, test, expect } from 'bun:test'
import { parseSSHConfig } from '../../../server/routes/actions'

describe('parseSSHConfig', () => {
  test('parses single host entry', () => {
    const config = 'Host myserver\n  HostName 192.168.1.1'
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('parses multiple host entries', () => {
    const config = `
Host server1
  HostName 192.168.1.1

Host server2
  HostName 192.168.1.2
`
    expect(parseSSHConfig(config)).toEqual(['server1', 'server2'])
  })

  test('handles multiple hosts on same line', () => {
    const config = 'Host server1 server2 server3'
    expect(parseSSHConfig(config)).toEqual(['server1', 'server2', 'server3'])
  })

  test('ignores wildcard * patterns', () => {
    const config = `
Host *
  ServerAliveInterval 60

Host myserver
  HostName 192.168.1.1
`
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('ignores question mark ? patterns', () => {
    const config = 'Host server?\nHost realserver'
    expect(parseSSHConfig(config)).toEqual(['realserver'])
  })

  test('ignores host line containing wildcard', () => {
    // When a host line contains wildcards, the whole line is skipped
    // This matches the actual behavior: if hostValue includes '*' or '?', skip it
    const config = 'Host prod-* staging-? myserver'
    // The whole hostValue contains '*' and '?', so the line is skipped
    expect(parseSSHConfig(config)).toEqual([])
  })

  test('returns empty array for empty config', () => {
    expect(parseSSHConfig('')).toEqual([])
  })

  test('returns empty array for config with only comments', () => {
    const config = `
# This is a comment
# Another comment
`
    expect(parseSSHConfig(config)).toEqual([])
  })

  test('handles case-insensitive Host keyword', () => {
    const config = 'HOST myserver\nhost anotherserver\nHoSt thirdserver'
    expect(parseSSHConfig(config)).toEqual(['myserver', 'anotherserver', 'thirdserver'])
  })

  test('trims whitespace around host names', () => {
    const config = 'Host   myserver   '
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles extra spaces after Host keyword', () => {
    const config = 'Host   myserver'
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles complex real-world config', () => {
    const config = `
# Global settings
Host *
  ServerAliveInterval 60
  ServerAliveCountMax 3

# Work servers
Host work-bastion
  HostName bastion.work.com
  User admin

Host work-app work-db
  ProxyJump work-bastion

# Personal
Host home-server
  HostName 192.168.1.100
  User pi

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/github
`
    const result = parseSSHConfig(config)
    expect(result).toEqual(['work-bastion', 'work-app', 'work-db', 'home-server', 'github.com'])
  })

  test('ignores lines that do not start with Host', () => {
    const config = `
HostName 192.168.1.1
User admin
Host myserver
Port 22
`
    expect(parseSSHConfig(config)).toEqual(['myserver'])
  })

  test('handles Windows line endings (CRLF)', () => {
    const config = 'Host server1\r\n  HostName 192.168.1.1\r\nHost server2\r\n  HostName 192.168.1.2'
    // \r will be part of the line but shouldn't affect parsing since we trim
    const result = parseSSHConfig(config)
    expect(result.length).toBe(2)
  })
})
