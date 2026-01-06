# Devora - Local Project Management Website

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/rucnyz/devora)

## Privacy

All your project data (notes, links, shortcuts) is stored locally in a SQLite database (`data/projects.db`) and never leaves your machine. The only external request is an optional GitHub API call to display the repository's star count — no user data is transmitted. [Learn more from DeepWiki](https://deepwiki.com/search/is-this-app-fully-local-does-i_02302a07-60cd-4ffd-9aba-cc06d33155fc)

## Quick Start

Download from [GitHub Releases](https://github.com/rucnyz/devora/releases) - available for Windows, macOS, and Linux.

## Development

Go to https://bun.sh/docs/installation to install Bun.

```shell
git clone https://github.com/rucnyz/devora.git
cd devora

bun install
bun run dev
```

or production mode

```shell
bun run preview
```