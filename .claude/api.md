# API 文档

## 技术栈

- **运行时**: Bun
- **框架**: Hono (轻量级 web 框架)

## 服务器结构

```
server/
├── index.ts            # Hono 服务器入口
├── db.ts               # SQLite 数据库操作 (CRUD)
├── routes/
│   ├── projects.ts     # 项目 CRUD API
│   ├── items.ts        # 区块 CRUD API
│   └── actions.ts      # 打开 IDE/文件 API
└── utils/
    └── launchers.ts    # IDE/文件启动器
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取所有项目 |
| POST | /api/projects | 创建项目 |
| GET | /api/projects/:id | 获取单个项目（含 items） |
| PUT | /api/projects/:id | 更新项目 |
| DELETE | /api/projects/:id | 删除项目 |
| POST | /api/projects/:id/items | 添加区块 |
| PUT | /api/projects/:id/items/reorder | 重排序区块 |
| PUT | /api/items/:id | 更新区块 |
| DELETE | /api/items/:id | 删除区块 |
| POST | /api/open/ide | 打开 IDE |
| POST | /api/open/file | 打开文件 |
| GET | /api/health | 健康检查 |

## IDE 启动器

支持的 IDE（通过 `server/utils/launchers.ts`）：

| IDE | 命令 |
|-----|------|
| PyCharm | JetBrains Toolbox scripts/pycharm.cmd |
| Cursor | cursor |
| VS Code | code |
| Zed | zed |
| Obsidian | obsidian:// URI scheme |
| 文件 | Windows `start` 命令 |

## 依赖

- hono - Web 框架
- concurrently - 并行运行命令
