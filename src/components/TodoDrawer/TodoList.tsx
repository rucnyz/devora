import { useState, forwardRef, useImperativeHandle } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { TodoItem as TodoItemType } from '../../types'
import SortableTodo from './SortableTodo'
import TodoItem from './TodoItem'

interface TodoListProps {
  todos: TodoItemType[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (todoIds: string[]) => void
  onIndent: (id: string, delta: number) => void
  onUpdate: (id: string, updates: Partial<Pick<TodoItemType, 'content'>>) => Promise<void>
  onAdd: (content: string, indentLevel?: number) => Promise<TodoItemType>
}

export interface TodoListRef {
  editTodo: (id: string) => void
}

const TodoList = forwardRef<TodoListRef, TodoListProps>(
  ({ todos, onToggle, onDelete, onReorder, onIndent, onUpdate, onAdd }, ref) => {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    useImperativeHandle(ref, () => ({
      editTodo: (id: string) => setEditingId(id),
    }))

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      })
    )

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = todos.findIndex((t) => t.id === active.id)
        const newIndex = todos.findIndex((t) => t.id === over.id)
        const newOrder = arrayMove(todos, oldIndex, newIndex)
        onReorder(newOrder.map((t) => t.id))
      }
    }

    const handleCreateNew = async () => {
      if (isCreating) return
      setIsCreating(true)
      try {
        const newTodo = await onAdd('')
        // Start editing the new todo
        setEditingId(newTodo.id)
      } finally {
        setIsCreating(false)
      }
    }

    if (todos.length === 0) {
      return (
        <div
          onClick={handleCreateNew}
          className="flex flex-col items-center justify-center h-32 text-(--text-muted) cursor-pointer hover:text-(--text-secondary) transition-colors"
        >
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm">Click to add first todo</p>
        </div>
      )
    }

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {todos.map((todo, index) => (
              <SortableTodo key={todo.id} id={todo.id}>
                {(dragHandleProps) => (
                  <TodoItem
                    todo={todo}
                    onToggle={() => onToggle(todo.id)}
                    onDelete={() => onDelete(todo.id)}
                    onUpdate={async (content) => onUpdate(todo.id, { content })}
                    onIndent={(delta) => onIndent(todo.id, delta)}
                    dragHandleProps={dragHandleProps}
                    isEditing={editingId === todo.id}
                    onStartEdit={() => setEditingId(todo.id)}
                    onStopEdit={() => setEditingId(null)}
                    onEditNext={() => {
                      const nextTodo = todos[index + 1]
                      if (nextTodo) {
                        setEditingId(nextTodo.id)
                      } else {
                        setEditingId(null)
                      }
                    }}
                    onEditPrev={() => {
                      const prevTodo = todos[index - 1]
                      if (prevTodo) {
                        setEditingId(prevTodo.id)
                      }
                    }}
                    isLast={index === todos.length - 1}
                    isFirst={index === 0}
                    onAddNew={handleCreateNew}
                  />
                )}
              </SortableTodo>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }
)

TodoList.displayName = 'TodoList'

export default TodoList
