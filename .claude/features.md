# Features

## TODO Section

每个项目有独立的 TODO 列表，通过右侧滑出抽屉访问。

### 架构决策

采用**结构化存储 + Markdown 内容**混合方案：
- 每个 TODO 独立存储为数据库记录（支持拖拽排序、进度统计）
- 内容字段支持 inline Markdown（URL 自动渲染为可点击链接）

### 数据库 Schema (v5)

```sql
CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    indent_level INTEGER DEFAULT 0,  -- 0-3 级缩进
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_todos_project ON todos(project_id);
```

### Tauri 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `get_todos` | `projectId` | 获取项目所有 TODO |
| `create_todo` | `projectId, content, indentLevel?` | 创建 TODO |
| `update_todo` | `id, content?, completed?, indentLevel?, order?` | 更新 TODO |
| `delete_todo` | `id` | 删除 TODO |
| `reorder_todos` | `projectId, todoIds[]` | 批量重排序 |
| `get_todo_progress` | `projectId` | 获取进度统计 |

### 前端组件

```
src/components/TodoDrawer/
├── index.tsx          # 主抽屉（右侧滑入，createPortal）
├── TodoList.tsx       # DnD 容器（@dnd-kit/core + sortable）
├── TodoItem.tsx       # 单项（checkbox, 内容, 缩进, 编辑）
├── TodoCreator.tsx    # 底部输入框
├── TodoProgress.tsx   # 进度条（3/10）
└── SortableTodo.tsx   # DnD 包装器
```

### Hook: useTodos

`src/hooks/useTodos.ts` 管理 TODO 状态：

```typescript
const {
  todos,           // TodoItem[]
  progress,        // TodoProgress { total, completed, percentage }
  loading,
  addTodo,         // (content: string, indentLevel?: number) => Promise<TodoItem>
  updateTodo,      // (id, updates) => Promise<void>
  toggleComplete,  // (id: string) => Promise<void>
  deleteTodo,      // (id: string) => Promise<void>
  reorderTodos,    // (todoIds: string[]) => Promise<void>
  changeIndent,    // (id: string, delta: number) => Promise<void>
  refreshTodos,    // () => Promise<void>
} = useTodos(projectId)
```

### 状态管理

状态由 `ProjectDetail` 持有并通过 props 传递给 `TodoDrawer`，确保 header 进度与抽屉内同步。

```tsx
// ProjectDetail/index.tsx
const { todos, progress, loading, addTodo, ... } = useTodos(id!)

<TodoDrawer
  todos={todos}
  progress={progress}
  loading={loading}
  onAdd={addTodo}
  ...
/>
```

### 功能清单

- [x] 点击 checkbox 切换完成状态
- [x] Tab / Shift+Tab 缩进/减少缩进（0-3 级）
- [x] URL 自动渲染为可点击链接
- [x] 拖拽手柄排序（@dnd-kit）
- [x] 内联编辑（点击内容进入编辑）
- [x] 进度指示器（header 显示 x/y）
- [x] Escape 关闭抽屉
- [x] 点击背景关闭抽屉
