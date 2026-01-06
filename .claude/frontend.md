# Frontend Design Documentation

## Design System: Neo-Terminal

An industrial-style developer aesthetic with neon accent colors, supporting dark and light themes.

### Design Philosophy

- **Dark Theme**: Deep black background + fluorescent green/cyan accents + grid texture
- **Light Theme**: Clean white background + emerald green/teal accents + subtle grid
- **Typography**: Outfit (display font) + JetBrains Mono (monospace font)
- **Interactions**: Smooth transition animations, glow effects, card entrance animations

### Color System

#### Dark Theme
```css
--bg-void: #050508;      /* Deepest background */
--bg-deep: #0a0a0f;      /* Deep background */
--bg-surface: #12121a;   /* Card background */
--bg-elevated: #1a1a24;  /* Elevated elements */
--accent-primary: #00ff88;   /* Fluorescent green */
--accent-secondary: #00d4ff; /* Cyan */
--accent-warning: #ffaa00;   /* Amber */
--glow-warning: 0 0 20px rgba(255, 170, 0, 0.3);
--glow-warning-soft: 0 0 40px rgba(255, 170, 0, 0.15);
--border-warning: rgba(255, 170, 0, 0.4);
```

#### Light Theme
```css
--bg-void: #f8fafb;      /* Page background */
--bg-deep: #ffffff;      /* White */
--bg-surface: #ffffff;   /* Card background */
--bg-elevated: #f1f5f9;  /* Elevated elements */
--accent-primary: #059669;   /* Emerald green */
--accent-secondary: #0891b2; /* Teal */
--accent-warning: #d97706;   /* Amber */
--glow-warning: 0 4px 14px rgba(217, 119, 6, 0.2);
--glow-warning-soft: 0 8px 30px rgba(217, 119, 6, 0.12);
--border-warning: rgba(217, 119, 6, 0.4);
```

#### Light Theme Style Overrides
Light theme has specific style overrides for the following components:
- `.glass-card` - White gradient background + soft shadows
- `.modal-overlay` - More transparent overlay `rgba(15, 23, 42, 0.4)`
- `.input-terminal:focus` / `.textarea-terminal:focus` - Emerald green focus ring
- `.tag-*:hover` - Hover effects adapted for light background
- `.note-card:hover` - Lighter shadows
- `::selection` - Emerald green selection highlight
- `.glow-text` - Emerald green glow effect

## Tech Stack

- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS 4 + CSS variables theme system
- **Routing**: react-router-dom 7
- **Note Editor**: @uiw/react-md-editor
- **Fonts**: Google Fonts (Outfit, JetBrains Mono)

## Component Structure

```
src/
├── main.tsx              # React entry
├── index.css             # Global styles + theme variables + component classes
├── App.tsx               # Main app + routing + theme Provider
├── components/
│   ├── ProjectList.tsx      # Project list page (card grid)
│   ├── ProjectDetail.tsx    # Project detail page (tag system + inline editing)
│   ├── NoteEditor.tsx       # Markdown editor modal
│   └── RemoteDirBrowser.tsx # Remote directory browser modal (SSH)
├── hooks/
│   ├── useProjects.ts    # Data fetching hooks + IDE/file operations
│   └── useTheme.tsx      # Theme toggle Context
└── types/
    └── index.ts          # TypeScript type definitions
```

## Core Style Classes

### Buttons
- `.btn-neon` - Neon border button, fills on hover
- `.btn-solid` - Solid primary color button
- `.btn-ghost` - Ghost button
- `.btn-delete` - Delete button (red on hover)

### Inputs
- `.input-terminal` - Terminal-style input
- `.textarea-terminal` - Terminal-style textarea

### Cards
- `.glass-card` - Glass-morphism card with hover glow effect
- `.note-card` - Note card with left border
- `.note-card-editing` - Note card in editing state

### Tags
- `.tag` - Base tag style
- `.tag-ide-pycharm` - PyCharm green
- `.tag-ide-cursor` - Cursor purple
- `.tag-ide-vscode` - VS Code blue
- `.tag-ide-zed` - Zed orange
- `.tag-ide-obsidian` - Obsidian violet
- `.tag-remote-ide-cursor` - Remote Cursor pink
- `.tag-remote-ide-vscode` - Remote VS Code lavender
- `.tag-file` - File gray
- `.tag-url` - URL cyan

### Modals
- `.modal-overlay` - Modal overlay (background blur)
- `.modal-content` - Modal content (animated entrance)

### Animations
- `.animate-card-enter` - Card entrance animation (fade in + slide up)

### Layout
- `.section-label` - Section title (with gradient line)

## Theme Toggle

Implemented using React Context + localStorage:

```tsx
// Using theme
const { theme, toggleTheme } = useTheme()

// theme: 'dark' | 'light'
// toggleTheme: () => void
```

Theme state is stored in localStorage with system preference detection support.

## UI Interactions

### Project List
- Card grid layout with staggered entrance animations
- Delete button shows on hover
- GitHub link icon (GitHub repository)
- Custom URL link icon (GitLab, Bitbucket, and other platforms)

### Project Detail
- **Side Navigation**: Fixed sidebar on left for quick section navigation
  - md screens (768px+): Shows colored dots only (compact mode)
  - lg screens (1024px+): Shows dots + text labels
  - Semi-transparent background with backdrop blur
  - Only displays sections that have content (Apps/Remote/Files) or are always visible (Links/Notes)
  - Smooth scroll to section on click
- Quick action button area (Note/App/File/Remote) - URL removed, see Links section below
- All add operations are inline - clicking a button shows the editor directly in the corresponding section
- **Applications Section** (formerly IDE Shortcuts, since Obsidian is not an IDE)
  - App add: Dropdown to select app type + input/browse to select folder path (supports paths with spaces)
  - **Path Suggestions**: When adding a new App, shows a list of existing paths for quick selection
  - App tag click opens the corresponding application, shows Edit button on hover, click to enter inline edit mode
  - App edit mode: Can modify app type and path, click outside to save
  - App tag shows Edit button on hover (attached to the right)
- **Remote Applications Section** (Remote IDE shortcuts)
  - Only supports Cursor and VS Code (via SSH Remote)
  - Remote add: Dropdown to select IDE type + SSH host selection + input remote path (e.g., `/home/user/project`)
  - **SSH hosts dropdown**: Reads `~/.ssh/config` to show available hosts as dropdown options
  - Can also manually enter host (dropdown + text input side by side)
  - **Remote directory browser**: Click "Browse" button to open modal and navigate remote directories via SSH
  - Data storage format: `content = "host:path"`
  - Remote tag click opens remote IDE, shows Edit button on hover
  - Remote edit mode: Can modify IDE type, host, and path
  - Uses pink (fuchsia) theme color to distinguish from local Apps
- File add: Optional title + input/browse to select file path
- **Links Section** (always visible)
  - Inline URL input: Small text input next to URL tags, press Enter to add
  - **Global Ctrl+V shortcut**: Paste URL anywhere on page (when not editing) to auto-add
  - Auto-detects URLs starting with `http://`, `https://`, or `www.`
  - **Optimistic update**: URL appears immediately with fallback title (path segment or hostname), then auto-updates when metadata is fetched
  - **Smart title extraction**: Fetches page metadata (og:title or `<title>`) from server in background
- File tag click opens file
- URL tag click opens in new window
- Note click enters inline edit mode
- All cards show × delete button on hover
- Click outside to auto-save
- **Ctrl+S / Cmd+S keyboard shortcut to save** (applies to all inline editors: Note/App/File/URL, prevents browser default save page behavior)
- **Note title Enter to save**: Press Enter in title input to save, press Tab to jump to content editor
- Note editing uses amber (warning) theme color to distinguish from other elements (green App, cyan URL)
- Silent data refresh after save/add/delete operations (no loading state shown)

## Dependencies

### Production Dependencies
- react, react-dom - UI framework
- react-router-dom - Routing
- @uiw/react-md-editor - Markdown editor
- uuid - Generate UUID

### Development Dependencies
- vite, @vitejs/plugin-react - Build tools
- tailwindcss, @tailwindcss/vite - Styling
- typescript, @types/* - Type support