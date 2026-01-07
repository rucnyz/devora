# Devora - Local Project Management Website

[![CI](https://github.com/rucnyz/devora/actions/workflows/ci.yml/badge.svg)](https://github.com/rucnyz/devora/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rucnyz/devora/branch/main/graph/badge.svg)](https://codecov.io/gh/rucnyz/devora)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/rucnyz/devora)

## Privacy

All your project data (notes, links, shortcuts) is stored locally in a SQLite database (`data/projects.db`) and never leaves your machine. The only external request is an optional GitHub API call to display the repository's star count — no user data is transmitted. [Learn more from DeepWiki](https://deepwiki.com/search/is-this-app-fully-local-does-i_02302a07-60cd-4ffd-9aba-cc06d33155fc)

## Quick Start

Download from [GitHub Releases](https://github.com/rucnyz/devora/releases) - available for Windows, macOS, and Linux.

## Development

```shell
# Install Bun: https://bun.sh
git clone https://github.com/rucnyz/devora.git
cd devora
bun install
# Run development server
bun run dev      # http://localhost:5173

# Build for production
bun run preview  # http://localhost:13000
```

