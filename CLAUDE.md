# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Devora is a cross-platform desktop application for local project management built with **Tauri 2 + React 19**. Each project contains notes, IDE shortcuts, file links, URL links, commands, and coding agent integrations. All data is stored locally in SQLite (~/.devora/projects.db).

## Development Commands

```bash
# Install dependencies
bun install

# Development with hot reload
bun run dev

# Build for production
bun run build

# Run all tests
bun run test

# Run a single test file
bun test tests/src/hooks/useTheme.test.tsx

# Watch mode for tests
bun run test:watch

# Lint and format
bun run lint
bun run format
```

## Architecture

### Frontend (src/)
- **React 19** with TypeScript, **Tailwind CSS v4**, and **react-router-dom** for routing
- Single entry point: `src/main.tsx` → `src/App.tsx`
- **Providers hierarchy** in App.tsx: ThemeProvider → SettingsProvider → CustomIdesProvider → ToastProvider → BrowserRouter
- **API layer**: `src/api/tauri.ts` wraps all Tauri invoke calls with TypeScript types
- **Hooks**: `src/hooks/useProjects.ts` (CRUD operations), `useSettings.tsx` (settings management), `useTheme.tsx`, `useCustomIdes.tsx`, `useToast.tsx`
- **Types**: `src/types/index.ts` defines all TypeScript types (ItemType, IdeType, Project, Item, etc.)

### Backend (src-tauri/)
- **Rust 2024 edition** with Tauri 2
- **Entry**: `src/lib.rs` initializes plugins and registers commands
- **Commands**: `src/commands.rs` - Tauri commands for projects, items, file cards, settings, IDE operations
- **Database**: `src/db.rs` - SQLite with migration system (PRAGMA user_version), uses rusqlite
- **Models**: `src/models.rs` - Rust structs with serde serialization matching frontend types

### Key Data Flow
1. Frontend calls `src/api/tauri.ts` functions
2. Tauri `invoke()` calls Rust commands in `src/commands.rs`
3. Commands use `Database` struct methods from `src/db.rs`
4. SQLite stores data in `~/.devora/projects.db`

### Item Types
Items belong to projects and have types: `note`, `ide`, `file`, `url`, `remote-ide`, `command`, `coding-agent`

### IDE Support
- Built-in IDEs: JetBrains suite, VS Code, Cursor, Zed, Antigravity
- Custom IDEs: Stored in settings as JSON, use `{path}` placeholder in command templates
- Remote IDEs: VS Code Remote, Cursor Remote, custom with `{host}` and `{path}` placeholders

## Testing

Tests use Bun's built-in test runner with `@testing-library/react` and `happy-dom`. Test files are in `tests/` directory mirroring `src/` structure.

## Rust Backend Notes

- Uses Tauri plugins: dialog, opener, updater, process, log
- Database migrations are version-controlled (current: v5)
- Commands use `State<Database>` for thread-safe database access
- Windows-specific code uses `creation_flags` to hide console windows

## Multi-Instance Architecture

Devora supports running multiple independent instances, ideal for Windows multi-virtual-desktop workflows where each desktop can have its own Devora instance with a different project.

### SQLite Concurrent Access
Multiple instances share the same database file (`~/.devora/projects.db`). Safe concurrent access is enabled via:
- **WAL mode** (`PRAGMA journal_mode = WAL`): Allows concurrent reads and writes
- **Busy timeout** (`PRAGMA busy_timeout = 5000`): Waits up to 5 seconds for locks instead of failing immediately

### Multi-Window Support (within single instance)
- Each project can be opened in its own window via right-click context menu or Ctrl+Click
- Window labels follow the pattern: `project-{projectId}`
- If a window for a project already exists, it's focused instead of creating a duplicate

### Tauri Command
- `open_project_window(projectId, projectName)` - Creates a new window or focuses existing one
  - URL: `/project/{projectId}`
  - Title: `Devora - {projectName}`
  - Window size: 1200x800 (min: 800x600)

### Capabilities
- `src-tauri/capabilities/default.json` includes:
  - `windows: ["main", "project-*"]` - Allows dynamic project windows
  - `core:webview:allow-create-webview-window` - Permission to create windows

### Frontend Integration
- `src/api/tauri.ts`: `openProjectWindow(projectId, projectName)` API function
- `src/components/Sidebar.tsx`:
  - Right-click context menu with "Open in new window" option
  - Ctrl+Click (Cmd+Click on macOS) shortcut to open in new window
  - Tooltip hint showing the keyboard shortcut
  - **Event handling**: Context menu uses `click` event (not `mousedown`) for closing to avoid timing issues with button clicks; `stopPropagation()` prevents bubbling

## TODO Feature

Each project has an associated TODO list accessible via a slide-out drawer.

### Architecture Decision
Uses **hybrid storage + Markdown content** approach:
- Each TODO is stored as an independent database record (enables drag-and-drop sorting, progress stats)
- Content field supports inline Markdown (URLs auto-rendered as clickable links)

### Database Schema (v5)
```sql
CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    indent_level INTEGER DEFAULT 0,  -- 0-3 levels
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### Tauri Commands
- `get_todos(projectId)` - Get all TODOs for a project
- `create_todo(projectId, content, indentLevel?)` - Create new TODO
- `update_todo(id, content?, completed?, indentLevel?, order?)` - Update TODO
- `delete_todo(id)` - Delete TODO
- `reorder_todos(projectId, todoIds)` - Batch reorder TODOs
- `get_todo_progress(projectId)` - Get completion stats (total, completed, percentage)

### Frontend Components
```
src/components/TodoDrawer/
  index.tsx          # Main drawer (right-side slide-in, uses createPortal)
  TodoList.tsx       # DnD container (@dnd-kit/core + sortable)
  TodoItem.tsx       # Single item (checkbox, content, indent, edit)
  TodoCreator.tsx    # Bottom input for adding TODOs
  TodoProgress.tsx   # Progress bar (3/10 completed)
  SortableTodo.tsx   # DnD wrapper
```

### Hook: useTodos
`src/hooks/useTodos.ts` manages TODO state:
```typescript
const {
  todos,           // TodoItem[]
  progress,        // TodoProgress
  loading,
  addTodo,         // (content: string, indentLevel?: number) => Promise
  updateTodo,      // (id: string, updates: Partial) => Promise
  toggleComplete,  // (id: string) => Promise
  deleteTodo,      // (id: string) => Promise
  reorderTodos,    // (todoIds: string[]) => Promise
  changeIndent,    // (id: string, delta: number) => Promise
  refreshTodos,    // () => Promise
} = useTodos(projectId)
```

### Features
- Click checkbox to toggle completion
- Tab/Shift+Tab for indent/outdent (0-3 levels)
- URLs in content auto-rendered as clickable links
- Drag handle for reordering
- Inline editing (click content to edit)
- Progress indicator in project header

## State Persistence

### Project State (useProjectState)
`src/hooks/useProjectState.ts` manages in-memory state that persists across project switches during a session:
- **Scroll position**: Restored when returning to a project
- **Todo drawer state**: Remembers if the drawer was open

```typescript
const { restoreScrollPosition, setTodoDrawerOpen } = useProjectState(projectId)
```