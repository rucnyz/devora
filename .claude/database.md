# Database Documentation

## Tech Stack

- **Database**: SQLite (bun:sqlite built-in)
- **Storage Location**: `data/projects.db` (auto-created)

## Data Model

### projects Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | UUID primary key |
| name | TEXT | Project name |
| description | TEXT | Project description |
| metadata | TEXT | JSON: { github_url?, custom_url?, other_links? } |
| created_at | TEXT | Creation time |
| updated_at | TEXT | Update time |

### items Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | UUID primary key |
| project_id | TEXT | Foreign key -> projects.id |
| type | TEXT | 'note' \| 'ide' \| 'file' \| 'url' \| 'remote-ide' |
| title | TEXT | Title |
| content | TEXT | Content/path/URL, remote IDE format: `host:path` |
| ide_type | TEXT | 'pycharm' \| 'cursor' \| 'vscode' \| 'zed' \| 'obsidian' |
| remote_ide_type | TEXT | 'cursor' \| 'vscode' (only for remote-ide type) |
| order | INTEGER | Sort order |
| created_at | TEXT | Creation time |
| updated_at | TEXT | Update time |

## Database Operations

All CRUD operations are implemented in `server/db.ts`:
- `createProject()` / `updateProject()` / `deleteProject()`
- `createItem()` / `updateItem()` / `deleteItem()`
- `getProjectWithItems()` - Get project with all its items