# 前端设计文档

## 设计系统：Neo-Terminal

一个工业风格的开发者美学设计，带有霓虹强调色，支持深色和浅色主题。

### 设计理念

- **深色主题**：深邃的黑色背景 + 荧光绿/青色强调 + 网格纹理
- **浅色主题**：干净的白色背景 + 翡翠绿/青蓝色强调 + 微妙网格
- **字体**：Outfit (显示字体) + JetBrains Mono (等宽字体)
- **交互**：流畅的过渡动画、发光效果、卡片入场动画

### 颜色系统

#### 深色主题
```css
--bg-void: #050508;      /* 最深背景 */
--bg-deep: #0a0a0f;      /* 深背景 */
--bg-surface: #12121a;   /* 卡片背景 */
--bg-elevated: #1a1a24;  /* 悬浮元素 */
--accent-primary: #00ff88;   /* 荧光绿 */
--accent-secondary: #00d4ff; /* 青色 */
--accent-warning: #ffaa00;   /* 琥珀色 */
```

#### 浅色主题
```css
--bg-void: #f8fafb;      /* 页面背景 */
--bg-deep: #ffffff;      /* 白色 */
--bg-surface: #ffffff;   /* 卡片背景 */
--bg-elevated: #f1f5f9;  /* 悬浮元素 */
--accent-primary: #059669;   /* 翡翠绿 */
--accent-secondary: #0891b2; /* 青蓝色 */
--accent-warning: #d97706;   /* 琥珀色 */
```

## 技术栈

- **框架**: React 19 + Vite 7
- **样式**: Tailwind CSS 4 + CSS 变量主题系统
- **路由**: react-router-dom 7
- **笔记编辑器**: @uiw/react-md-editor
- **字体**: Google Fonts (Outfit, JetBrains Mono)

## 组件结构

```
src/
├── main.tsx              # React 入口
├── index.css             # 全局样式 + 主题变量 + 组件类
├── App.tsx               # 主应用 + 路由 + 主题 Provider
├── components/
│   ├── ProjectList.tsx   # 项目列表页（卡片网格）
│   ├── ProjectDetail.tsx # 项目详情页（标签系统 + 内联笔记）
│   ├── NoteEditor.tsx    # Markdown 编辑器弹窗
│   └── AddItemModal.tsx  # 添加 IDE/File/URL 弹窗
├── hooks/
│   ├── useProjects.ts    # 数据获取 hooks
│   └── useTheme.tsx      # 主题切换 Context
└── types/
    └── index.ts          # TypeScript 类型定义
```

## 核心样式类

### 按钮
- `.btn-neon` - 霓虹边框按钮，hover 时填充
- `.btn-solid` - 实心主色按钮
- `.btn-ghost` - 幽灵按钮
- `.btn-delete` - 删除按钮（红色 hover）

### 输入
- `.input-terminal` - 终端风格输入框
- `.textarea-terminal` - 终端风格文本域

### 卡片
- `.glass-card` - 玻璃态卡片，带 hover 发光效果
- `.note-card` - 笔记卡片，带左侧边框
- `.note-card-editing` - 编辑状态的笔记卡片

### 标签
- `.tag` - 基础标签样式
- `.tag-ide-pycharm` - PyCharm 绿色
- `.tag-ide-cursor` - Cursor 紫色
- `.tag-ide-vscode` - VS Code 蓝色
- `.tag-ide-zed` - Zed 橙色
- `.tag-ide-obsidian` - Obsidian 紫罗兰
- `.tag-file` - 文件灰色
- `.tag-url` - URL 青色

### 弹窗
- `.modal-overlay` - 弹窗遮罩（背景模糊）
- `.modal-content` - 弹窗内容（动画入场）

### 动画
- `.animate-card-enter` - 卡片入场动画（淡入 + 上滑）

### 布局
- `.section-label` - 区块标题（带渐变线条）

## 主题切换

使用 React Context + localStorage 实现：

```tsx
// 使用主题
const { theme, toggleTheme } = useTheme()

// theme: 'dark' | 'light'
// toggleTheme: () => void
```

主题状态存储在 localStorage，支持系统偏好检测。

## UI 交互

### 项目列表
- 卡片网格布局，带交错入场动画
- hover 时显示删除按钮
- GitHub 链接图标

### 项目详情
- 快捷操作按钮区（Note/IDE/File/URL）
- IDE 标签点击打开对应 IDE
- 文件标签点击打开文件
- URL 标签点击新窗口打开
- 笔记点击进入内联编辑模式
- 点击外部自动保存

### 添加弹窗
- 类型选择按钮（颜色区分）
- 终端风格输入框
- 动画入场效果

## 依赖

### 生产依赖
- react, react-dom - UI 框架
- react-router-dom - 路由
- @uiw/react-md-editor - Markdown 编辑器
- uuid - 生成 UUID

### 开发依赖
- vite, @vitejs/plugin-react - 构建工具
- tailwindcss, @tailwindcss/vite - 样式
- typescript, @types/* - 类型支持