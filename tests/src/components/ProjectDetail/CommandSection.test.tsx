import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import CommandSection from '../../../../src/components/ProjectDetail/CommandSection'
import type { Item, WorkingDir } from '../../../../src/types'

describe('CommandSection', () => {
  const mockOnAdd = mock(() => Promise.resolve())
  const mockOnUpdate = mock(() => Promise.resolve())
  const mockOnDelete = mock(() => Promise.resolve())
  const mockOnCreatingChange = mock(() => {})

  beforeEach(() => {
    cleanup()
    mockOnCreatingChange.mockClear()
  })

  const defaultProps = {
    items: [] as Item[],
    isCreating: false,
    workingDirs: [] as WorkingDir[],
    sshHosts: [] as string[],
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
    onCreatingChange: mockOnCreatingChange,
  }

  test('returns null when no items and not creating', () => {
    const { container } = render(<CommandSection {...defaultProps} />)
    expect(container.querySelector('section')).toBeNull()
  })

  test('renders section with Add button when has items', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'command',
        title: 'npm start',
        content: 'npm start',
        command_mode: 'background',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CommandSection {...defaultProps} items={items} />)

    expect(screen.getByText('Commands')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
    expect(screen.getByText('npm start')).toBeTruthy()
  })

  test('calls onCreatingChange when Add button is clicked', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'command',
        title: 'npm start',
        content: 'npm start',
        command_mode: 'background',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CommandSection {...defaultProps} items={items} />)

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    expect(mockOnCreatingChange).toHaveBeenCalledWith(true)
  })

  test('shows creator form when isCreating is true', () => {
    render(<CommandSection {...defaultProps} isCreating={true} />)

    expect(screen.getByText('Commands')).toBeTruthy()
    expect(screen.getByPlaceholderText('Command to run...')).toBeTruthy()
    expect(screen.getByPlaceholderText('Working directory (optional)...')).toBeTruthy()
    expect(screen.getByText('Browse')).toBeTruthy()
    expect(screen.getByText('Click outside to save')).toBeTruthy()
  })

  test('hides Add button when isCreating is true', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'command',
        title: 'npm start',
        content: 'npm start',
        command_mode: 'background',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CommandSection {...defaultProps} items={items} isCreating={true} />)

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  test('shows working dirs suggestions when available', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
    ]

    render(<CommandSection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText('Working dirs:')).toBeTruthy()
    expect(screen.getByText(/frontend/)).toBeTruthy()
  })

  test('shows both local and remote working dirs', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
      { name: 'remote-project', path: '/home/user/project', host: 'server1' },
    ]

    render(<CommandSection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText(/frontend/)).toBeTruthy()
    expect(screen.getByText(/remote-project/)).toBeTruthy()
    expect(screen.getByText(/@server1/)).toBeTruthy()
  })

  test('shows remote indicator for remote commands', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'command',
        title: 'npm build',
        content: 'npm run build',
        command_mode: 'background',
        command_host: 'myserver',
        command_cwd: '/home/user/project',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CommandSection {...defaultProps} items={items} />)

    expect(screen.getByText('npm build')).toBeTruthy()
    expect(screen.getByText('@myserver')).toBeTruthy()
  })

  test('shows output indicator for output mode commands', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'command',
        title: 'npm test',
        content: 'npm test',
        command_mode: 'output',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CommandSection {...defaultProps} items={items} />)

    expect(screen.getByText('[out]')).toBeTruthy()
  })
})
