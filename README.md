# Devora - Local Project Management Desktop App

[![CI](https://github.com/rucnyz/devora/actions/workflows/ci.yml/badge.svg)](https://github.com/rucnyz/devora/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rucnyz/devora/branch/main/graph/badge.svg)](https://codecov.io/gh/rucnyz/devora)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/rucnyz/devora)

A cross-platform desktop application built with **Tauri + React** for managing personal projects. Each project contains notes, application shortcuts, file links, and URL links.

## Privacy

All your project data (notes, links, shortcuts) is stored locally in a SQLite database and never leaves your machine. The only external request is an optional GitHub API call to display the repository's star count - no user data is transmitted.

## Download

Download the latest release from [GitHub Releases](https://github.com/rucnyz/devora/releases):

| Platform              | File                         |
|-----------------------|------------------------------|
| Windows               | `Devora_x.x.x_x64_en-US.msi` |
| macOS (Apple Silicon) | `Devora_x.x.x_aarch64.dmg`   |
| Linux                 | `devora_x.x.x_amd64.deb`     |

## Development

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) - Required for Tauri backend
- [Bun](https://bun.sh/) - JavaScript runtime and package manager

### Getting Started

```bash
git clone https://github.com/rucnyz/devora.git
cd devora
bun install

# Development mode (hot reload)
bun run dev

# Build for production
bun run build
```

### Testing & Quality

```bash
bun run test            # Run all unit tests
bun run lint            # Run ESLint
bun run format          # Format code with Prettier
```
