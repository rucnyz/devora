import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import FileSection from '../../../../src/components/ProjectDetail/FileSection'
import type { Item } from '../../../../src/types'

describe('FileSection', () => {
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
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
    onCreatingChange: mockOnCreatingChange,
  }

  test('returns null when no items and not creating', () => {
    const { container } = render(<FileSection {...defaultProps} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders section with Add button when has items', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'file',
        title: 'README.md',
        content: '/path/to/README.md',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<FileSection {...defaultProps} items={items} />)

    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
    expect(screen.getByText('README.md')).toBeTruthy()
  })

  test('calls onCreatingChange when Add button is clicked', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'file',
        title: 'README.md',
        content: '/path/to/README.md',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<FileSection {...defaultProps} items={items} />)

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    expect(mockOnCreatingChange).toHaveBeenCalledWith(true)
  })

  test('shows creator form when isCreating is true', () => {
    render(<FileSection {...defaultProps} isCreating={true} />)

    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByPlaceholderText('File or folder path...')).toBeTruthy()
    expect(screen.getByText('File')).toBeTruthy()
    expect(screen.getByText('Folder')).toBeTruthy()
    expect(screen.getByText('Click outside to save')).toBeTruthy()
  })

  test('hides Add button when isCreating is true', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'file',
        title: 'README.md',
        content: '/path/to/README.md',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<FileSection {...defaultProps} items={items} isCreating={true} />)

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  test('shows existing files suggestions when adding', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'file',
        title: 'README.md',
        content: '/path/to/README.md',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<FileSection {...defaultProps} items={items} isCreating={true} />)

    expect(screen.getByText('Existing files:')).toBeTruthy()
  })

  test('renders help tooltip', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'file',
        title: 'README.md',
        content: '/path/to/README.md',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<FileSection {...defaultProps} items={items} />)

    expect(screen.getByText('?')).toBeTruthy()
  })
})
