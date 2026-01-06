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

## Distribution

### Download Pre-built Release

Download from [GitHub Releases](../../releases) - available for Windows, macOS, and Linux.

Each release contains:
- `manage-note` executable (or `.exe` on Windows)
- `dist/` folder (frontend assets)
- `data/` folder (database created automatically)

**Usage**: Just run the executable, then visit http://localhost:3000

### Build Release Locally

```bash
bun run release              # Build for all platforms
bun run release:windows      # Windows x64 only
bun run release:macos        # macOS ARM64 only
bun run release:linux        # Linux x64 only
```

Output: `release/manage-note-{platform}/`

### Auto Release via GitHub Actions

Push a version tag to trigger automatic release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build for all platforms and create a release with downloadable zip files.

## Project Structure

```
manage-note/
├── package.json
├── vite.config.ts          # Vite config + Tailwind plugin
├── server/                 # Hono backend
├── src/                    # React frontend
├── scripts/
│   └── build-release.ts    # Cross-platform build script
├── .github/workflows/
│   └── release.yml         # GitHub Actions auto-release
├── dist/                   # Frontend build output (generated)
├── data/                   # Database (generated at runtime)
└── release/                # Release builds (generated)
```

## Core Features

1. **Project Management** - Create/edit/delete projects
2. **Project Links** - Support GitHub URL and custom URLs (GitLab, Bitbucket, etc.)
3. **Application Shortcuts** - One-click to open PyCharm/Cursor/VS Code/Zed/Obsidian (with path suggestions)
4. **Remote Application Shortcuts** - Open Cursor/VS Code on remote servers via SSH Remote
5. **File Links** - Click to open local files
6. **URL Links** - External links
7. **Inline Notes** - Click to create, click to edit, click outside to save