# Project Manager - 本地项目管理网站

用 Bun 启动的本地网站，用于管理个人项目。每个项目包含笔记、IDE 快捷入口、文件链接和 URL 链接。

## 详细文档

- [前端文档](frontend.md) - React 组件、UI 交互、样式
- [API 文档](api.md) - 后端路由、IDE 启动器
- [数据库文档](database.md) - 数据模型、表结构

## 快速启动

```bash
bun run dev          # 开发模式，访问 http://localhost:5173
bun run preview      # 生产模式，访问 http://localhost:3000
```

## 项目结构

```
manage-note/
├── package.json
├── vite.config.ts          # Vite 配置 + Tailwind 插件
├── server/                 # Hono 后端
├── src/                    # React 前端
├── data/projects.db        # SQLite 数据库
└── dist/                   # 构建输出
```

## 核心功能

1. **项目管理** - 创建/编辑/删除项目
2. **IDE 快捷入口** - 一键打开 PyCharm/Cursor/VS Code/Zed/Obsidian
3. **文件链接** - 点击打开本地文件
4. **URL 链接** - 外部链接
5. **内联笔记** - 点击创建，点击编辑，点击外部保存