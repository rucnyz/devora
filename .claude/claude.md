# Project Manager - Local Project Management Website

A local website powered by Bun for managing personal projects. Each project contains notes, application shortcuts, file links, and URL links.

**Remember: Every time you edit something, please update the documentation here accordingly. and always use English.**



## Detailed Documentation

- [Frontend Documentation](frontend.md) - React components, UI interactions, styles
- [API Documentation](api.md) - Backend routes, IDE launchers
- [Database Documentation](database.md) - Data models, table structures

## Quick Start

```bash
bun run dev          # Development mode, visit http://localhost:5173
bun run preview      # Production mode, visit http://localhost:3000
```

## Project Structure

```
manage-note/
├── package.json
├── vite.config.ts          # Vite config + Tailwind plugin
├── server/                 # Hono backend
├── src/                    # React frontend
├── data/projects.db        # SQLite database
└── dist/                   # Build output
```

## Core Features

1. **Project Management** - Create/edit/delete projects
2. **Project Links** - Support GitHub URL and custom URLs (GitLab, Bitbucket, etc.)
3. **Application Shortcuts** - One-click to open PyCharm/Cursor/VS Code/Zed/Obsidian (with path suggestions)
4. **Remote Application Shortcuts** - Open Cursor/VS Code on remote servers via SSH Remote
5. **File Links** - Click to open local files
6. **URL Links** - External links
7. **Inline Notes** - Click to create, click to edit, click outside to save