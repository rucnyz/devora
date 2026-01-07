# Devora - Local Project Management Website

[![CI](https://github.com/rucnyz/devora/actions/workflows/ci.yml/badge.svg)](https://github.com/rucnyz/devora/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rucnyz/devora/branch/main/graph/badge.svg)](https://codecov.io/gh/rucnyz/devora)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/rucnyz/devora)

## Privacy

All your project data (notes, links, shortcuts) is stored locally in a SQLite database (`data/projects.db`) and never leaves your machine. The only external request is an optional GitHub API call to display the repository's star count — no user data is transmitted. [Learn more from DeepWiki](https://deepwiki.com/search/is-this-app-fully-local-does-i_02302a07-60cd-4ffd-9aba-cc06d33155fc)

## Download

Download the latest release from [GitHub Releases](https://github.com/rucnyz/devora/releases):

| Platform | File |
|----------|------|
| Windows | `devora-windows-x64.zip` |
| macOS (Apple Silicon) | `devora-macos-arm64.zip` |
| Linux | `devora-linux-x64.zip` |

1. Extract the zip file
2. Run `devora.exe` (Windows) or `./devora` (macOS/Linux)
3. Open http://localhost:13000 in your browser

**Update**: Run `update.ps1` (Windows) or `./update.sh` (macOS/Linux) to check for updates.

## Development

```bash
# Install Bun: https://bun.sh
git clone https://github.com/rucnyz/devora.git
cd devora
bun install

# Development mode
bun run dev      # http://localhost:5173

# Production mode
bun run preview  # http://localhost:13000
```

## Configuration

Create a `.env` file in the project root:

```env
PORT=13000                  # Server port (default: 13000)
DISABLE_OPEN_BROWSER=true   # Disable auto-open browser
```
