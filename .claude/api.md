# API Documentation

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono (lightweight web framework)

## Server Structure

```
server/
├── index.ts            # Hono server entry
├── db.ts               # SQLite database operations (CRUD)
├── routes/
│   ├── projects.ts     # Project CRUD API
│   ├── items.ts        # Item CRUD API
│   └── actions.ts      # Open IDE/file API
└── utils/
    └── launchers.ts    # IDE/file launchers
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | Get all projects |
| POST | /api/projects | Create project |
| GET | /api/projects/:id | Get single project (with items) |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| POST | /api/projects/:id/items | Add item |
| PUT | /api/projects/:id/items/reorder | Reorder items |
| PUT | /api/items/:id | Update item |
| DELETE | /api/items/:id | Delete item |
| POST | /api/open/ide | Open IDE |
| POST | /api/open/remote-ide | Open remote IDE (SSH) |
| POST | /api/open/file | Open file |
| POST | /api/open/select-folder | Open folder selection dialog |
| POST | /api/open/select-file | Open file selection dialog |
| GET | /api/open/ssh-hosts | Get SSH hosts from ~/.ssh/config |
| POST | /api/open/ssh/list-dir | List remote directory via SSH |
| POST | /api/open/url-metadata | Fetch URL metadata (title) |
| GET | /api/health | Health check |

## Application Launchers

Supported applications (via `server/utils/launchers.ts`):

| Application | Command |
|-------------|---------|
| PyCharm | JetBrains Toolbox scripts/pycharm.cmd |
| Cursor | cursor |
| VS Code | code |
| Zed | zed |
| Obsidian | obsidian:// URI scheme |
| File | Windows `start` command |

### Remote IDE Launchers

Support opening remote projects via SSH (Cursor and VS Code only):

| Application | Command |
|-------------|---------|
| Cursor | `cursor --remote ssh-remote+{host} {path}` |
| VS Code | `code --remote ssh-remote+{host} {path}` |

**Request Parameters**:
```json
{
  "remote_ide_type": "cursor" | "vscode",
  "host": "user@server",
  "path": "/home/user/project"
}
```

### Path Handling
- Supports paths with spaces (e.g., OneDrive paths)
- IDE commands use `shell: false` to properly handle spaces
- File opening wraps paths in quotes

### SSH Config Integration

The `/api/open/ssh-hosts` endpoint parses `~/.ssh/config` and returns all Host entries:
- Skips wildcard patterns (`Host *`, `Host ?`)
- Handles multiple hosts on same line (`Host server1 server2`)
- Returns empty array if config file doesn't exist

**Response**:
```json
{
  "hosts": ["myserver", "devbox", "production"]
}
```

Frontend shows a dropdown to select from configured SSH hosts when adding Remote IDE items.

### Remote Directory Browser

The `/api/open/ssh/list-dir` endpoint lists directories on remote SSH hosts:
- Uses `ssh host "cd path && pwd && ls -1F"` to list directories
- Returns current absolute path and directory entries
- Filters hidden files (starting with `.`)

**Request**:
```json
{
  "host": "myserver",
  "path": "~"
}
```

**Response**:
```json
{
  "path": "/home/user",
  "entries": [
    { "name": "projects", "isDir": true },
    { "name": "documents", "isDir": true }
  ]
}
```

Frontend shows a modal browser to navigate and select remote directories.

### URL Metadata Extraction

The `/api/open/url-metadata` endpoint fetches page title from a URL:
- Tries `og:title` meta tag first (Open Graph)
- Falls back to `<title>` tag
- 5 second timeout to prevent hanging
- Returns `null` if fetch fails or no title found

**Request**:
```json
{
  "url": "https://github.com/user/repo"
}
```

**Response**:
```json
{
  "title": "user/repo: Repository description"
}
```

Frontend uses this to auto-populate link titles when adding URLs.

## File Selector

Uses Windows 11 native IFileOpenDialog COM interface:
- `selectFolder()` - Select folder (FOS_PICKFOLDERS)
- `selectFile()` - Select file
- Invoked via PowerShell calling C# COM interop

## Dependencies

- hono - Web framework
- concurrently - Run commands in parallel
