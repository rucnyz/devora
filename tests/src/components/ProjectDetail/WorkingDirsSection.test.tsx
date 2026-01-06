import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import WorkingDirsSection from '../../../../src/components/ProjectDetail/WorkingDirsSection'
import type { Item, WorkingDir } from '../../../../src/types'

describe('WorkingDirsSection', () => {
  const mockOnUpdate = mock(() => Promise.resolve())

  beforeEach(() => {
    cleanup()
    mockOnUpdate.mockClear()
  })

  const defaultProps = {
    workingDirs: [] as WorkingDir[],
    sshHosts: ['server1', 'server2'] as string[],
    ideItems: [] as Item[],
    remoteIdeItems: [] as Item[],
    fileItems: [] as Item[],
    commandItems: [] as Item[],
    onUpdate: mockOnUpdate,
  }

  test('renders Working Dirs section with Add button', () => {
    render(<WorkingDirsSection {...defaultProps} />)

    expect(screen.getByText('Working Dirs')).toBeTruthy()
    expect(screen.getByText('Add dir')).toBeTruthy()
  })

  test('renders existing working dirs', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
      { name: 'backend', path: '/home/user/backend', host: 'server1' },
    ]

    render(<WorkingDirsSection {...defaultProps} workingDirs={workingDirs} />)

    expect(screen.getByText('frontend')).toBeTruthy()
    expect(screen.getByText('local')).toBeTruthy()
    expect(screen.getByText('backend')).toBeTruthy()
    expect(screen.getByText('@server1')).toBeTruthy()
  })

  describe('suggestedPaths computation', () => {
    test('shows suggestions from IDE items', async () => {
      const ideItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'ide',
          title: 'PyCharm',
          content: '/home/user/project1',
          ide_type: 'pycharm',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(<WorkingDirsSection {...defaultProps} ideItems={ideItems} />)

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Should show "From IDE:" suggestion
      await waitFor(() => {
        expect(screen.getByText('From IDE:')).toBeTruthy()
      })
      expect(screen.getByText(/project1/)).toBeTruthy()
    })

    test('shows suggestions from file items', async () => {
      const fileItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'file',
          title: 'Documents',
          content: '/home/user/documents',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(<WorkingDirsSection {...defaultProps} fileItems={fileItems} />)

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Should show "From Open:" suggestion
      await waitFor(() => {
        expect(screen.getByText('From Open:')).toBeTruthy()
      })
      expect(screen.getByText(/documents/)).toBeTruthy()
    })

    test('shows suggestions from local command working directories', async () => {
      const commandItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'command',
          title: 'npm start',
          content: 'npm start',
          command_mode: 'background',
          command_cwd: '/home/user/app',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(<WorkingDirsSection {...defaultProps} commandItems={commandItems} />)

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Should show "From Command:" suggestion
      await waitFor(() => {
        expect(screen.getByText('From Command:')).toBeTruthy()
      })
      expect(screen.getByText(/app/)).toBeTruthy()
    })

    test('shows multiple source groups when available', async () => {
      const ideItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'ide',
          title: 'PyCharm',
          content: '/home/user/ide-project',
          ide_type: 'pycharm',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      const fileItems: Item[] = [
        {
          id: '2',
          project_id: 'proj1',
          type: 'file',
          title: 'Folder',
          content: '/home/user/folder',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(
        <WorkingDirsSection
          {...defaultProps}
          ideItems={ideItems}
          fileItems={fileItems}
        />
      )

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Should show both source groups
      await waitFor(() => {
        expect(screen.getByText('From IDE:')).toBeTruthy()
        expect(screen.getByText('From Open:')).toBeTruthy()
      })
    })

    test('excludes paths that are already in working dirs', async () => {
      const workingDirs: WorkingDir[] = [
        { name: 'existing', path: '/home/user/existing' },
      ]

      const ideItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'ide',
          title: 'PyCharm',
          content: '/home/user/existing', // Same path as working dir
          ide_type: 'pycharm',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          project_id: 'proj1',
          type: 'ide',
          title: 'VS Code',
          content: '/home/user/new-project',
          ide_type: 'vscode',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(
        <WorkingDirsSection
          {...defaultProps}
          workingDirs={workingDirs}
          ideItems={ideItems}
        />
      )

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Should only show the new project, not the existing one
      await waitFor(() => {
        expect(screen.getByText(/new-project/)).toBeTruthy()
      })
      // The "existing" path should not appear in suggestions (it's already a working dir name)
      const suggestions = screen.queryAllByText(/\+ existing/)
      expect(suggestions.length).toBe(0)
    })

    test('shows remote suggestions from Remote IDE items', async () => {
      const remoteIdeItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'remote-ide',
          title: 'Remote VS Code',
          content: 'server1:/home/user/remote-project',
          remote_ide_type: 'vscode',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(
        <WorkingDirsSection {...defaultProps} remoteIdeItems={remoteIdeItems} />
      )

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Wait for form to appear, then click Remote toggle
      await waitFor(() => {
        expect(screen.getByText('Local')).toBeTruthy()
      })
      fireEvent.click(screen.getByText('Local'))

      // Should show "From Remote IDE:" suggestion
      await waitFor(() => {
        expect(screen.getByText('From Remote IDE:')).toBeTruthy()
      })
      expect(screen.getByText(/remote-project/)).toBeTruthy()
    })

    test('shows remote suggestions from remote command working directories', async () => {
      const commandItems: Item[] = [
        {
          id: '1',
          project_id: 'proj1',
          type: 'command',
          title: 'remote build',
          content: 'npm run build',
          command_mode: 'output',
          command_cwd: '/home/user/remote-app',
          command_host: 'server2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      render(
        <WorkingDirsSection {...defaultProps} commandItems={commandItems} />
      )

      // Click Add dir to show the form
      fireEvent.click(screen.getByText('Add dir'))

      // Wait for form to appear, then click Remote toggle
      await waitFor(() => {
        expect(screen.getByText('Local')).toBeTruthy()
      })
      fireEvent.click(screen.getByText('Local'))

      // Should show "From Command:" suggestion for remote
      await waitFor(() => {
        expect(screen.getByText('From Command:')).toBeTruthy()
      })
      expect(screen.getByText(/remote-app/)).toBeTruthy()
      expect(screen.getByText(/@server2/)).toBeTruthy()
    })
  })
})
