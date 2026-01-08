import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import IDESection from '../../../../src/components/ProjectDetail/IDESection'
import type { Item, WorkingDir } from '../../../../src/types'

describe('IDESection', () => {
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
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
    onCreatingChange: mockOnCreatingChange,
  }

  test('returns null when no items and not creating', () => {
    const { container } = render(<IDESection {...defaultProps} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders section with Add button when has items', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'ide',
        title: 'MyProject',
        content: '/path/to/project',
        ide_type: 'pycharm',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<IDESection {...defaultProps} items={items} />)

    expect(screen.getByText('IDE')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
    expect(screen.getByText('MyProject')).toBeTruthy()
  })

  test('calls onCreatingChange when Add button is clicked', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'ide',
        title: 'MyProject',
        content: '/path/to/project',
        ide_type: 'pycharm',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<IDESection {...defaultProps} items={items} />)

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    expect(mockOnCreatingChange).toHaveBeenCalledWith(true)
  })

  test('shows creator form when isCreating is true', () => {
    render(<IDESection {...defaultProps} isCreating={true} />)

    expect(screen.getByText('IDE')).toBeTruthy()
    expect(screen.getByPlaceholderText('Project folder path...')).toBeTruthy()
    expect(screen.getByText('Browse')).toBeTruthy()
    expect(screen.getByText('Click outside to save')).toBeTruthy()
  })

  test('hides Add button when isCreating is true', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'ide',
        title: 'MyProject',
        content: '/path/to/project',
        ide_type: 'pycharm',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<IDESection {...defaultProps} items={items} isCreating={true} />)

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  test('shows working dirs suggestions when available', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
    ]

    render(<IDESection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText('Working dirs:')).toBeTruthy()
    expect(screen.getByText(/frontend/)).toBeTruthy()
  })

  test('does not show remote working dirs', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
      { name: 'remote-project', path: '/home/user/project', host: 'server1' },
    ]

    render(<IDESection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText(/frontend/)).toBeTruthy()
    expect(screen.queryByText(/remote-project/)).toBeNull()
  })
})
