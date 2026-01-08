import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RemoteIDESection from '../../../../src/components/ProjectDetail/RemoteIDESection'
import { CustomIdesProvider } from '../../../../src/hooks/useCustomIdes'
import type { Item, WorkingDir } from '../../../../src/types'

// Mock Tauri API
mock.module('../../../../src/api/tauri', () => ({
  getSetting: mock(() => Promise.resolve(null)),
  setSetting: mock(() => Promise.resolve()),
}))

// Helper to wrap component with provider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CustomIdesProvider>{ui}</CustomIdesProvider>)
}

describe('RemoteIDESection', () => {
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
    sshHosts: [] as string[],
    workingDirs: [] as WorkingDir[],
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
    onCreatingChange: mockOnCreatingChange,
  }

  test('returns null when no items and not creating', () => {
    const { container } = renderWithProvider(<RemoteIDESection {...defaultProps} />)
    expect(container.querySelector('section')).toBeNull()
  })

  test('renders section with Add button when has items', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'remote-ide',
        title: 'RemoteProject',
        content: 'server1:/home/user/project',
        remote_ide_type: 'cursor',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    renderWithProvider(<RemoteIDESection {...defaultProps} items={items} />)

    expect(screen.getByText('Remote IDE')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
    expect(screen.getByText('RemoteProject')).toBeTruthy()
  })

  test('calls onCreatingChange when Add button is clicked', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'remote-ide',
        title: 'RemoteProject',
        content: 'server1:/home/user/project',
        remote_ide_type: 'cursor',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    renderWithProvider(<RemoteIDESection {...defaultProps} items={items} />)

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    expect(mockOnCreatingChange).toHaveBeenCalledWith(true)
  })

  test('shows creator form when isCreating is true', () => {
    renderWithProvider(<RemoteIDESection {...defaultProps} isCreating={true} />)

    expect(screen.getByText('Remote IDE')).toBeTruthy()
    expect(screen.getByPlaceholderText('/home/user/project')).toBeTruthy()
    expect(screen.getByText('Browse')).toBeTruthy()
    expect(screen.getByText('Click outside to save')).toBeTruthy()
  })

  test('hides Add button when isCreating is true', () => {
    const items: Item[] = [
      {
        id: '1',
        project_id: 'proj1',
        type: 'remote-ide',
        title: 'RemoteProject',
        content: 'server1:/home/user/project',
        remote_ide_type: 'cursor',
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    renderWithProvider(<RemoteIDESection {...defaultProps} items={items} isCreating={true} />)

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  test('shows remote working dirs suggestions when available', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'remote-project', path: '/home/user/project', host: 'server1' },
    ]

    renderWithProvider(<RemoteIDESection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText('Working dirs:')).toBeTruthy()
    expect(screen.getByText(/remote-project/)).toBeTruthy()
  })

  test('does not show local working dirs', () => {
    const workingDirs: WorkingDir[] = [
      { name: 'frontend', path: '/home/user/frontend' },
      { name: 'remote-project', path: '/home/user/project', host: 'server1' },
    ]

    renderWithProvider(<RemoteIDESection {...defaultProps} isCreating={true} workingDirs={workingDirs} />)

    expect(screen.getByText(/remote-project/)).toBeTruthy()
    expect(screen.queryByText(/frontend.*local/)).toBeNull()
  })
})
