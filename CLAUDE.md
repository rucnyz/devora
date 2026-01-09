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
- Database migrations are version-controlled (current: v3)
- Commands use `State<Database>` for thread-safe database access
- Windows-specific code uses `creation_flags` to hide console windows