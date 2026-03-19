# Orion IDE

**AI-powered desktop code editor for Windows.**

Ghost-text completions, Git integration, project memory, and a full AI assistant — built on Monaco Editor and Electron, powered by the Orion backend.

![Orion IDE screenshot](https://www.mallydev.xyz/orion/screenshot-wide.png)

---

## Download

| Platform | Link |
|----------|------|
| Windows Installer | [Orion-IDE-Setup-0.4.0.exe](https://github.com/Mallydev2/orion-ide/releases/latest/download/Orion-IDE-Setup-0.4.0.exe) |
| Windows Portable  | [Orion-IDE-Portable-0.4.0.exe](https://github.com/Mallydev2/orion-ide/releases/latest/download/Orion-IDE-Portable-0.4.0.exe) |

Or grab the [latest release](https://github.com/Mallydev2/orion-ide/releases/latest).

> **macOS and Linux** builds are planned — Windows only for now.

---

## Features

- **Monaco editor** — same engine as VS Code, with syntax highlighting for 30+ languages
- **Ghost-text completions** — AI suggests the next line as you type (Alt+\ to trigger manually)
- **AI chat sidebar** — ask Orion to build, debug, review, or explain anything in your project
- **Workspace memory** — Orion learns your project conventions and applies them automatically
- **Git UI** — stage hunks, view commit diffs, switch branches, generate AI commit messages
- **Symbol outline** — jump to any function or class in the current file instantly
- **Generate tests** — one click creates a full test file for the active file
- **Session restore** — reopens your exact tabs and cursor positions on every launch
- **Auto-updates** — silent background updates via GitHub Releases, one-click install

---

## Requirements

- Windows 10 or 11
- 4 GB RAM
- 300 MB disk space
- An [Orion account](https://www.mallydev.xyz/orion) for AI features (free tier included)

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/Mallydev2/orion-ide.git
cd orion-ide
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
ORION_BACKEND_URL=https://ai.mallydev.xyz/ask
ORION_HEALTH_URL=https://ai.mallydev.xyz/health
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Run in development

```bash
npm start
```

### Build

```bash
# Windows installer + portable
npm run dist

# Output goes to /release
```

---

## Releasing a new version

1. Bump `"version"` in `package.json`
2. Run `npm run dist`
3. Create a GitHub Release tagged `v{version}`
4. Attach from `/release`:
   - `Orion-IDE-Setup-{version}.exe`
   - `Orion-IDE-Setup-{version}.exe.blockmap`
   - `latest.yml`
5. Publish the release

Existing users will see the "Restart to update" banner on next launch. Full guide in [`ide-update-guide.md`](ide-update-guide.md).

---

## Project structure

```
orion-ide/
├── main.js              # Electron main process — window, IPC, auto-updater
├── preload.js           # Context bridge — exposes safe APIs to renderer
├── main/
│   ├── git.js           # Git operations (status, diff, log, commit, show)
│   ├── workspace.js     # File system — read/write/rename/delete
│   ├── preview.js       # In-app browser preview
│   └── logger.js        # Structured logging
├── app/
│   ├── index.html       # Renderer entry point
│   ├── app.js           # Main renderer — editor, UI, session restore
│   ├── styles.css       # All styles
│   └── modules/
│       ├── state.js         # App state + localStorage persistence
│       ├── completions.js   # Ghost-text inline completions
│       ├── diffEditor.js    # Monaco diff view
│       ├── gitCommit.js     # Git commit UI
│       ├── memory.js        # Workspace memory panel
│       ├── streaming.js     # SSE streaming for AI responses
│       └── ...
├── shared/
│   └── constants.js     # IPC channel names, storage keys
└── tests/               # Node --test unit tests
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron |
| Editor | Monaco Editor |
| AI completions | Orion backend (`/api/complete`) |
| AI chat | Orion backend (`/ask`) |
| Auth + quota | Supabase |
| Auto-updates | electron-updater + GitHub Releases |
| Git | child_process → git CLI |
| Build | electron-builder |

---

## License

Private — all rights reserved. Built by [MallyDev](https://mallydev.xyz).
