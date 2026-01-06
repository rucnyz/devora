# 数据库文档

## 技术栈

- **数据库**: SQLite (bun:sqlite 内置)
- **存储位置**: `data/projects.db`（自动创建）

## 数据模型

### projects 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | UUID 主键 |
| name | TEXT | 项目名称 |
| description | TEXT | 项目描述 |
| metadata | TEXT | JSON: { github_url?, other_links? } |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### items 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | UUID 主键 |
| project_id | TEXT | 外键 -> projects.id |
| type | TEXT | 'note' \| 'ide' \| 'file' \| 'url' |
| title | TEXT | 标题 |
| content | TEXT | 内容/路径/URL |
| ide_type | TEXT | 'pycharm' \| 'cursor' \| 'vscode' \| 'zed' \| 'obsidian' |
| order | INTEGER | 排序顺序 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

## 数据库操作

所有 CRUD 操作在 `server/db.ts` 中实现：
- `createProject()` / `updateProject()` / `deleteProject()`
- `createItem()` / `updateItem()` / `deleteItem()`
- `getProjectWithItems()` - 获取项目及其所有区块