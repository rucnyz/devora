# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Devora is a cross-platform desktop application for local project management built with **Tauri 2 + React 19**. Each project contains notes, IDE shortcuts, file links, URL links, commands, and coding agent integrations. All data is stored locally in JSON files, enabling cloud sync via OneDrive/Dropbox when the app is closed.

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
- **Entry**: `src/lib.rs` initializes plugins, runs migration, and registers commands
- **Commands**: `src/commands.rs` - Tauri commands for projects, items, file cards, settings, IDE operations
- **Storage**: `src/json_store.rs` - JSON-based storage with multi-file structure and atomic writes
- **Migration**: `src/migration.rs` - Automatic SQLite to JSON migration on first run
- **Models**: `src/models.rs` - Rust structs with serde serialization matching frontend types
- **Settings**: `src/settings.rs` - App settings stored in `~/.devora/settings.json`
- **Legacy**: `src/db.rs` - SQLite module (kept for migration compatibility)

### Key Data Flow
1. Frontend calls `src/api/tauri.ts` functions
2. Tauri `invoke()` calls Rust commands in `src/commands.rs`
3. Commands use `JsonStore` struct methods from `src/json_store.rs`
4. Data is saved immediately to JSON files in the configured data path

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
- Commands use `State<JsonStore>` for thread-safe storage access
- Windows-specific code uses `creation_flags` to hide console windows

## JSON Storage Architecture

Data is stored in JSON files instead of SQLite, enabling cloud sync (OneDrive/Dropbox) when the app is closed.

### File Layout
```
~/.devora/                      # Fixed config location
  ├── settings.json             # App settings (includes data_path)
  └── projects.db.migrated      # OLD: Renamed after migration

{data_path}/                    # Default: ~/.devora/ OR user custom (e.g. OneDrive)
  ├── metadata.json             # Project list & global settings
  └── projects/
      ├── {uuid-1}.json         # Project 1 with items, todos, file_cards
      ├── {uuid-2}.json         # Project 2
      └── ...
```

### JsonStore Module (`src/json_store.rs`)
Core storage struct with key methods:
- `new(data_path)` - Initialize store, create directories, load metadata
- `get_all_projects()` / `get_project_by_id(id)` - Read projects
- `create_project()` / `update_project()` / `delete_project()` - Project CRUD
- `create_item()` / `update_item()` / `delete_item()` / `reorder_items()` - Item CRUD
- `get_project_todos()` / `set_project_todos()` - Markdown notes per project
- `get_setting()` / `set_setting()` - Settings stored in metadata.json

### Atomic Writes
All file writes use atomic pattern to prevent corruption:
1. Ensure parent directory exists (`fs::create_dir_all`)
2. Write to `{file}.json.tmp`
3. Sync to disk (`file.sync_all()`)
4. Rename to `{file}.json`

This allows creating files even after the data directory was deleted.

### Immediate Saves
Every create/update/delete operation immediately saves to disk. No batching or caching delays.

### Migration System (`src/migration.rs`)
Automatic SQLite to JSON migration on first run:
1. Check if `metadata.json` exists → skip migration
2. Check if `projects.db` exists → migrate
3. For each project: gather items, todos, file_cards → write `projects/{id}.json`
4. Write `metadata.json` with project IDs and settings
5. Rename `projects.db` → `projects.db.migrated`

### Data Path Configuration
- **Default**: `~/.devora/` (stores both settings and data)
- **Custom**: User can set via Settings → Data Path (e.g., OneDrive folder)
- **Settings location**: Always `~/.devora/settings.json` (never synced)
- **API**: `get_data_path()`, `set_data_path()`, `validate_data_path()`

### External Change Detection (Cloud Sync Support)
When using a cloud-synced folder (OneDrive, Dropbox), data may change externally while the app is running. The app automatically detects and reloads these changes:

- **On window focus**: Immediately checks if `metadata.json` was modified externally
- **Periodic check**: Every 5 minutes while the app is running
- **Auto-reload**: If changes detected, clears cache, reloads metadata, and refreshes the page

**Implementation:**
- `JsonStore::has_external_changes()` - Compares file mtime using `!=` (detects both newer and older files from sync, and file deletion)
- `JsonStore::reload()` - Clears project cache, reloads metadata from disk. If metadata.json was deleted, creates empty file.
- `App.tsx` - Uses Tauri's `getCurrentWindow().onFocusChanged()` API (not browser's `window.focus` event, which doesn't work reliably in Tauri webviews)

**Detection cases:**
- File mtime changed (newer OR older due to sync reversion)
- File created (didn't exist before)
- File deleted (existed before, now gone → creates empty metadata.json)

**API:**
- `check_external_changes()` - Returns `true` if files were modified externally
- `reload_store()` - Clears cache and reloads metadata from disk

## Multi-Instance Architecture

Devora supports running multiple independent instances, ideal for Windows multi-virtual-desktop workflows where each desktop can have its own Devora instance with a different project.

### Concurrent Access
Multiple instances can read from the same data directory. Write conflicts are possible but unlikely in typical single-user scenarios. Each write is atomic, so files are never left in a corrupted state.

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

## TODO Feature (Markdown Notes)

Each project has an associated notes/todos section accessible via a slide-out drawer, stored as plain Markdown.

### Architecture Decision
Uses **plain Markdown storage** approach:
- Single `todos` field (String) in project JSON - user writes free-form Markdown
- WYSIWYG editing via `@milkdown/react` (Notion-like experience)
- No structured todo items, progress tracking, or drag-and-drop - just text

### JSON Schema
Notes are stored in `projects/{projectId}.json`:
```json
{
  "todos": "# My Notes\n\n- [ ] Task 1\n- [x] Task 2 (done)\n\nFree-form markdown content..."
}
```

### Migration
When loading old project files with structured `Vec<TodoItem>` format, auto-converts to Markdown:
- Completed items → `- [x] content`
- Uncompleted items → `- [ ] content`
- Indentation preserved via spaces

### Tauri Commands
- `get_project_todos(projectId)` - Get markdown string for a project
- `set_project_todos(projectId, content)` - Save markdown string

### Frontend Components
```
src/components/NotesDrawer/
  index.tsx            # Main drawer (right-side slide-in, uses createPortal)
  MilkdownEditor.tsx   # WYSIWYG Milkdown editor wrapper
```

### Hook: useTodos
`src/hooks/useTodos.ts` manages markdown content:
```typescript
const { content, loading, saveTodos, refreshTodos } = useTodos(projectId)
```

### Editor: Milkdown
Uses `@milkdown/react` for WYSIWYG Markdown editing:
- **Core packages**: `@milkdown/core`, `@milkdown/preset-commonmark`, `@milkdown/preset-gfm`, `@milkdown/react`, `@milkdown/theme-nord`
- **Plugins**: `@milkdown/plugin-listener` (markdown change events), `@milkdown/plugin-history` (Ctrl+Z undo/redo)
- **Components**: `@milkdown/components` (listItemBlockComponent for interactive task list checkboxes)
- Real-time WYSIWYG rendering (type `**bold**` → instant bold text)
- GFM task lists with clickable checkboxes (`- [ ]` / `- [x]`)

### Auto-save
`NotesDrawer` implements debounced auto-save:
- Content changes trigger a 500ms debounce timer
- Saves automatically after user stops typing
- "Saving..." indicator shown during save

## State Persistence

### Project State (useProjectState)
`src/hooks/useProjectState.ts` manages in-memory state that persists across project switches during a session:
- **Scroll position**: Restored when returning to a project
- **Notes drawer state**: Remembers if the drawer was open

```typescript
const { restoreScrollPosition, setTodoDrawerOpen } = useProjectState(projectId)
```