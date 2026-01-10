# Features

## TODO Section

Each project has an independent TODO list, accessible via a slide-out drawer on the right side.

### Architecture Decision

Uses a **hybrid structured storage + Markdown content** approach:
- Each TODO is stored as an independent database record (enables drag-and-drop sorting, progress tracking)
- Content field supports inline Markdown (URLs auto-rendered as clickable links)

### Database Schema (v5)

```sql
CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    indent_level INTEGER DEFAULT 0,  -- 0-3 indent levels
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_todos_project ON todos(project_id);
```

### Tauri Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `get_todos` | `projectId` | Get all TODOs for a project |
| `create_todo` | `projectId, content, indentLevel?` | Create a TODO |
| `update_todo` | `id, content?, completed?, indentLevel?, order?` | Update a TODO |
| `delete_todo` | `id` | Delete a TODO |
| `reorder_todos` | `projectId, todoIds[]` | Batch reorder |
| `get_todo_progress` | `projectId` | Get progress statistics |

### Frontend Components

```
src/components/TodoDrawer/
├── index.tsx          # Main drawer (right-side slide-in, createPortal)
├── TodoList.tsx       # DnD container (@dnd-kit/core + sortable)
├── TodoItem.tsx       # Single item (checkbox, content, indent, edit)
├── TodoCreator.tsx    # Bottom input field
├── TodoProgress.tsx   # Progress bar (3/10)
└── SortableTodo.tsx   # DnD wrapper
```

### Hook: useTodos

`src/hooks/useTodos.ts` manages TODO state:

```typescript
const {
  todos,           // TodoItem[]
  progress,        // TodoProgress { total, completed, percentage }
  loading,
  addTodo,         // (content: string, indentLevel?: number) => Promise<TodoItem>
  updateTodo,      // (id, updates) => Promise<void>
  toggleComplete,  // (id: string) => Promise<void>
  deleteTodo,      // (id: string) => Promise<void>
  reorderTodos,    // (todoIds: string[]) => Promise<void>
  changeIndent,    // (id: string, delta: number) => Promise<void>
  refreshTodos,    // () => Promise<void>
} = useTodos(projectId)
```

### State Management

State is held by `ProjectDetail` and passed to `TodoDrawer` via props, ensuring the header progress stays in sync with the drawer content.

```tsx
// ProjectDetail/index.tsx
const { todos, progress, loading, addTodo, ... } = useTodos(id!)

<TodoDrawer
  todos={todos}
  progress={progress}
  loading={loading}
  onAdd={addTodo}
  ...
/>
```

### Feature Checklist

- [x] Click checkbox to toggle completion status
- [x] Tab / Shift+Tab to indent/outdent (0-3 levels)
- [x] URLs auto-rendered as clickable links
- [x] Drag handle for sorting (@dnd-kit)
- [x] Inline editing (click content to edit)
- [x] Progress indicator (header shows x/y)
- [x] Escape to close drawer
- [x] Click backdrop to close drawer
