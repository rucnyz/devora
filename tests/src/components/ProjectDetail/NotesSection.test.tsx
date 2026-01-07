import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NotesSection from '../../../../src/components/ProjectDetail/NotesSection'
import type { Item } from '../../../../src/types'

describe('NotesSection', () => {
  const mockOnAdd = mock(() => Promise.resolve())
  const mockOnUpdate = mock(() => Promise.resolve())
  const mockOnDelete = mock(() => Promise.resolve())
  const mockOnCreatingChange = mock(() => {})

  beforeEach(() => {
    cleanup()
    mockOnCreatingChange.mockClear()
  })

  const defaultProps = {
    notes: [] as Item[],
    isCreating: false,
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
    onCreatingChange: mockOnCreatingChange,
  }

  test('renders section even when no notes', () => {
    render(<NotesSection {...defaultProps} />)

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
  })

  test('renders notes when provided', () => {
    const notes: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'note',
        title: 'My Note',
        content: 'Note content here',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<NotesSection {...defaultProps} notes={notes} />)

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText('My Note')).toBeTruthy()
    expect(screen.getByText('Note content here')).toBeTruthy()
  })

  test('calls onCreatingChange when Add button is clicked', () => {
    render(<NotesSection {...defaultProps} />)

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    expect(mockOnCreatingChange).toHaveBeenCalledWith(true)
  })

  test('shows creator form when isCreating is true', () => {
    render(<NotesSection {...defaultProps} isCreating={true} />)

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByPlaceholderText('Note title...')).toBeTruthy()
    expect(screen.getByPlaceholderText('Write your note here...')).toBeTruthy()
    // NoteCreator shows "cancel" when empty, "save" when has content
    expect(screen.getByText(/Click outside to (save|cancel)/)).toBeTruthy()
  })

  test('hides Add button when isCreating is true', () => {
    render(<NotesSection {...defaultProps} isCreating={true} />)

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  test('shows empty note placeholder', () => {
    const notes: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'note',
        title: 'Empty Note',
        content: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<NotesSection {...defaultProps} notes={notes} />)

    expect(screen.getByText('Empty note')).toBeTruthy()
  })

  test('shows created and updated timestamps', () => {
    const now = new Date()
    const notes: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'note',
        title: 'Timestamped Note',
        content: 'Some content',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ]

    render(<NotesSection {...defaultProps} notes={notes} />)

    expect(screen.getByText(/Created:/)).toBeTruthy()
    expect(screen.getByText(/Updated:/)).toBeTruthy()
  })

  test('renders multiple notes', () => {
    const notes: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'note',
        title: 'Note 1',
        content: 'Content 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        project_id: 'proj1',
        type: 'note',
        title: 'Note 2',
        content: 'Content 2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<NotesSection {...defaultProps} notes={notes} />)

    expect(screen.getByText('Note 1')).toBeTruthy()
    expect(screen.getByText('Note 2')).toBeTruthy()
    expect(screen.getByText('Content 1')).toBeTruthy()
    expect(screen.getByText('Content 2')).toBeTruthy()
  })
})
