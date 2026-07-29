# CloudCLI (Claude Code UI) — Complete Technical Wiki

## 1. Overview

CloudCLI is a web/desktop UI for Claude Code, Cursor CLI, and OpenAI Codex. It auto-discovers existing CLI sessions and provides chat, file explorer, git, terminal, and more.

- Web: http://localhost:3001 | Dev: http://localhost:5173
- DB: SQLite at ~/.cloudcli/auth.db
- Tech: React 18 + Tailwind + CodeMirror + xterm.js (frontend), Express + TypeScript + SQLite + WebSocket (backend), Electron (desktop)

---

## 2. Project Structure

```
server/                     # Backend
  index.js                  # Main entry: Express, middleware, routes
  claude-sdk.js             # Claude Agent SDK integration
  cursor-cli.js             # Cursor CLI wrapper
  openai-codex.js           # Codex integration
  middleware/auth.js         # JWT + API key auth
  routes/                   # auth, git, commands, settings, plugins, user, agent, taskmaster
  modules/database/         # SQLite schema, migrations, repositories
  modules/websocket/        # Chat, shell, plugin WS services
  modules/providers/        # Claude/Cursor/Codex/OpenCode session discovery
  modules/projects/         # Project management, file ops, cloning
  modules/notifications/    # Push, Telegram, Discord, Slack
  modules/browser-use/      # Browser automation

src/                        # Frontend
  App.tsx                   # Providers, routing, layout
  components/chat/          # Chat interface (largest module)
  components/file-tree/     # File explorer
  components/git-panel/     # Git UI (changes, history, branches)
  components/shell/         # Terminal (xterm.js)
  components/code-editor/   # CodeMirror editor
  components/sidebar/       # Project/session navigation
  components/command-palette/ # Cmd+K search
  components/settings/      # Multi-tab settings
  components/task-master/   # Kanban task board
  components/browser-use/   # Browser automation
  components/plugins/       # Plugin tabs
  contexts/                 # 8 global state providers
  hooks/                    # 11 custom hooks
  utils/api.js              # API client

electron/                   # Desktop app
  main.js, preload.cjs, tabs.js, cloud.js, localServer.js
```

---

## 3. Backend Server

### Startup Flow
1. Load .env -> init SQLite (~/.cloudcli/auth.db) -> apply migrations
2. Express app with CORS, JSON (50MB limit), JWT auth middleware
3. Mount route handlers, create WebSocket server (chat + shell + plugin proxy)
4. Start session watcher (scans ~/.claude/projects/ etc.)
5. Spawn enabled plugin servers, listen on port 3001

### Authentication
- **JWT Token** (Authorization: Bearer): 7-day expiry, auto-refresh at 50% via X-Refreshed-Token header
- **API Key** (X-API-Key): For external integrations
- **Platform mode** (VITE_IS_PLATFORM=true): Bypasses local auth
- Passwords: bcrypt 12 rounds. First run shows setup form.

### Database Tables (SQLite)
- users: username, password_hash, git_name, git_email, onboarding
- projects: project_id (UUID), project_path, custom_name, isStarred, isArchived
- sessions: session_id, provider, provider_session_id, jsonl_path
- api_keys, user_credentials, push_subscriptions, notification_channel_endpoints, app_config

### Session Discovery
- Claude: ~/.claude/projects/<encoded-path>/<session-id>.jsonl (JSONL)
- Cursor: ~/.cursor/sessions/<session-id>/ (SQLite)
- Codex: ~/.codex/sessions/<session-id>.jsonl (JSONL)
- OpenCode: OpenCode database (SQLite)
Auto-discovered on startup + file watchers for real-time updates.

### WebSocket Services
- /ws/chat — AI chat streaming (message -> provider -> response chunks)
- /ws/shell — Terminal I/O (keystrokes -> PTY -> stdout)
- /ws/plugin-proxy/:name — Forward to plugin servers

### Chat Flow (Claude)
1. Frontend sends message via WebSocket
2. Server loads session transcript from .jsonl
3. Calls Claude Agent SDK with message + history + tools
4. Handles tool approvals (pause, wait for user, resume)
5. Streams response chunks back via WebSocket
6. Persists to .jsonl transcript file

Chat message types (server -> client): assistant, tool-call, tool-result, complete, permission_request, error, session_created, status, stream_delta, thinking

---

## 4. API Endpoints

### Auth
- GET /api/auth/status — Check if setup needed
- POST /api/auth/register — Create first user, returns JWT
- POST /api/auth/login — Login, returns JWT
- GET /api/auth/user — Current user

### Projects
- GET /api/projects/ — List with sessions
- GET /api/projects/:id/sessions — Paginated sessions
- POST /api/projects/create-project — Create folder
- PUT /api/projects/:id — Update
- DELETE /api/projects/:id — Archive/delete
- POST /api/projects/:id/restore — Restore
- PUT /api/projects/:id/star — Toggle star
- GET /api/projects/:id/files — File tree (recursive)
- GET /api/projects/:id/file?filePath= — Read file
- PUT /api/projects/:id/file — Write file
- POST /api/projects/:id/files/create — Create file/dir
- PUT /api/projects/:id/files/rename — Rename
- DELETE /api/projects/:id/files — Delete
- POST /api/projects/:id/files/upload — Upload (max 200MB, 20 files)
- GET /api/projects/:id/files/content?path= — Stream binary
- GET /api/projects/:id/sessions/:sid/token-usage — Token breakdown

### Git
- GET /api/git/status — Branch, staged/modified/untracked
- GET /api/git/diff — File diff
- GET /api/git/file-with-diff — File content + diff
- POST /api/git/stage — Stage files
- POST /api/git/unstage — Unstage
- POST /api/git/commit — Commit
- POST /api/git/initial-commit — First commit
- POST /api/git/discard — Discard changes
- POST /api/git/delete-untracked — Delete untracked
- POST /api/git/revert-local-commit — Soft reset last commit
- GET /api/git/branches — List branches
- GET /api/git/commits — History
- GET /api/git/commit-diff — Commit changes
- POST /api/git/checkout — Switch branch
- POST /api/git/create-branch — Create
- POST /api/git/delete-branch — Delete
- POST /api/git/generate-commit-message — AI commit message
- GET /api/git/remote-status — Ahead/behind
- POST /api/git/fetch, /pull, /push, /publish

### Commands
- POST /api/commands/list — Built-in + custom
- POST /api/commands/execute — Run command

### Settings
- GET/POST/DELETE /api/settings/api-keys
- GET/POST/DELETE /api/settings/credentials
- GET/PUT /api/settings/notification-preferences
- GET /api/settings/push/vapid-public-key
- POST /api/settings/push/subscribe

### Plugins
- GET /api/plugins/ — List
- GET /api/plugins/:name/manifest — Metadata
- GET /api/plugins/:name/assets/* — Static files
- PUT /api/plugins/:name/enable — Toggle (starts/stops server)
- POST /api/plugins/install — Install from git URL
- POST /api/plugins/:name/update — Update
- DELETE /api/plugins/:name — Uninstall
- ALL /api/plugins/:name/rpc/* — Proxy to plugin server

### Other
- GET /health — Health check (no auth)
- GET/POST /api/user/git-config — Git identity
- POST /api/user/complete-onboarding
- GET /api/taskmaster/tasks/:projectId
- GET /api/browser-use/status
- GET /api/browse-filesystem?path= — Directory listing

---

## 5. Frontend

### Provider Hierarchy (App.tsx)
I18nextProvider -> ThemeProvider -> AuthProvider -> WebSocketProvider -> PluginsProvider -> TasksSettingsProvider -> TaskMasterProvider -> ProtectedRoute -> Router -> AppContent

### Main Layout
- Sidebar (left): Projects (starred first), sessions per project, new chat, search, settings
- MainContent (right): Tab bar (Chat | Files | Git | Terminal | Tasks | Browser | Plugins), active tab content, EditorSidebar (resizable CodeMirror), CommandPalette (Cmd+K)

### Key Components

**ChatInterface** (components/chat/) — Largest module
- 4 hooks: useChatProviderState, useChatSessionState, useChatRealtimeHandlers, useChatComposerState
- Features: streaming display, tool execution + permission UI, provider switching (Claude/Cursor/Codex/OpenCode), permission modes (default/auto/acceptEdits/bypassPermissions/plan), file/image attachments, slash commands, voice I/O, token usage
- Message types: text, tool_use, tool_result, thinking, stream_delta, complete, error, permission_request

**FileTree** (components/file-tree/)
- Expandable tree, create/rename/delete, drag-drop upload, image preview, search/filter, copy/cut/paste

**GitPanel** (components/git-panel/) — 3 tabs:
1. Changes: staged vs unstaged, inline diff, stage/unstage/discard, commit with AI-generated messages
2. History: commit log with diff viewer
3. Branches: local/remote, create/switch/delete, fetch/pull/push/publish

**Shell** (components/shell/) — xterm.js terminal via WebSocket, per-project shell

**CodeEditor** (components/code-editor/) — CodeMirror 6 with syntax highlighting, diff view, minimap, markdown preview

**CommandPalette** (components/command-palette/) — Cmd+K search: files, sessions, commits, branches, actions

**TaskMasterPanel** (components/task-master/) — Kanban board with task cards, creation, filtering

**Settings** (components/settings/) — Tabs: API, Git, Notifications, Voice, Appearance, Agents, TaskMaster, Browser Use, About

### State Management (no Redux/Zustand)

Contexts:
- AuthContext: user, token, needsSetup, login/register/logout
- WebSocketContext: ws, sendMessage, subscribe (ref-based listeners for performance)
- ThemeContext: isDarkMode (localStorage, respects system preference)
- PluginsContext: plugins list, install/uninstall/toggle
- TaskMasterContext: projects, tasks, MCP status
- PermissionContext: pending tool permissions
- PaletteOpsContext: command palette callback registry

Key hooks:
- useProjectsState: projects, sessions, active selection, tab state
- useSessionStore: per-session message arrays
- useUiPreferences: sidebar visibility, ctrl+enter setting (localStorage)
- useDeviceSettings: mobile/PWA detection
- useVersionCheck: GitHub release update checks

### API Client (utils/api.js)
Fetch-based, JWT from localStorage("auth-token"), auto-refresh via X-Refreshed-Token header.
Methods: api.projects(), api.getFiles(), api.readFile(), api.auth.login(), api.taskmaster.addTask(), etc.

---

## 6. Desktop App (Electron)

- Multi-tab BrowserView architecture (one WebView per tab)
- Local server management: auto-starts bundled server, health checks, port selection
- Cloud integration: connect to CloudCLI cloud environments via API
- Native notifications via WebSocket subscription
- OAuth: cloudcli://auth/callback protocol handler
- Tray menu with quick actions
- LAN sharing: expose server on network for mobile access
- IPC bridge: window.cloudcliDesktop (context-isolated preload)

---

## 7. Plugin System

### Structure
```
~/.claude-code-ui/plugins/<name>/
  manifest.json    # name, version, entry, server, slot, icon
  dist/index.js    # Frontend React component
  server.js        # Optional backend server
  assets/          # Static files
```

### Manifest
```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "1.0.0",
  "type": "module",
  "slot": "tab",
  "entry": "dist/index.js",
  "server": "server.js",
  "icon": "Puzzle"
}
```

### Lifecycle
1. Install: git clone -> npm install -> build -> auto-enable
2. Enable: spawn server on auto-allocated port
3. RPC: /api/plugins/:name/rpc/* proxied, secrets as X-Plugin-Secret-* headers
4. WebSocket: /ws/plugin-proxy/:name forwarded
5. Update: git pull --ff-only -> rebuild -> restart
6. Uninstall: stop server -> delete directory

Plugin server gets minimal env (PATH, HOME, PLUGIN_NAME) for security.

---

## 8. Configuration

### Environment Variables
- SERVER_PORT (3001): Express server port
- HOST (0.0.0.0): Bind address
- VITE_PORT (5173): Dev frontend port
- DATABASE_PATH (~/.cloudcli/auth.db): SQLite location
- VITE_IS_PLATFORM (false): Platform mode (bypass auth)
- CONTEXT_WINDOW (160000): Token context window
- CLAUDE_TOOL_APPROVAL_TIMEOUT_MS (55000): Tool approval timeout
- FS_CONCURRENCY (64): File system concurrency
- JWT_SECRET (auto-generated): JWT signing secret
- API_KEY: Global API key requirement

### Key File Locations
- ~/.cloudcli/auth.db — App database
- ~/.cloudcli/assets/ — Chat image attachments
- ~/.claude/projects/ — Claude session transcripts
- ~/.claude/commands/ — User-level custom commands
- .claude/commands/ — Project-level custom commands
- ~/.claude-code-ui/plugins/ — Installed plugins
- .taskmaster/ — TaskMaster project data

---

## 9. Theming & Styling
- Tailwind CSS 3 with class-based dark mode (dark class on html)
- CSS variables for colors (HSL-based)
- Persisted to localStorage("theme"), respects prefers-color-scheme
- Fonts: Encode Sans (UI), Merriweather (content)
- Icons: Lucide React

## 10. Internationalization
10 languages: English, Japanese, German, French, Italian, Russian, Chinese (Simplified + Traditional), Korean, Turkish
Namespace-based: src/i18n/locales/<lang>/*.json

## 11. Build & Deploy
- npm run dev: Server (:3001) + Vite (:5173) with hot-reload
- npm run build: Vite -> dist/ + TSC -> dist-server/
- npm start: Build + serve production
- npm run desktop:dist:mac: macOS DMG
- npm run desktop:dist:win: Windows installer
- npx @cloudcli-ai/cloudcli: Quick start

## 12. Security
- Passwords: bcrypt (12 rounds)
- Tokens: JWT with auto-generated secret, 7-day expiry, auto-refresh
- Path traversal: realpath validation against project root
- Git input: regex validation on refs, branches, remotes
- File uploads: 200MB limit, 20 files max
- Plugin isolation: minimal env vars, no secrets in process
- WebSocket auth: token in query param
- Symlinks: detected and flagged in file tree

## 13. Custom Commands
Built-in: /help, /models, /cost, /status, /memory, /config
Custom: .claude/commands/*.md (project) or ~/.claude/commands/*.md (user)
Supports: $1, $ARGUMENTS substitution, @filename includes, !command bash execution

## 14. Notifications
Channels: Desktop (browser native), Web Push (VAPID), Telegram (bot), Discord (webhook), Slack (bot)
Events: run-complete, run-failed, tool-approval, system messages

## 15. How to Make Common Changes

### Add API endpoint
1. Create/edit route in server/routes/
2. Mount in server/index.js: app.use('/api/route', router)
3. Add auth middleware if needed

### Add frontend tab
1. Create component in src/components/your-feature/
2. Add tab to MainContentHeader
3. Render in MainContent based on active tab

### Change port
Create .env: SERVER_PORT=4000

### Install plugin
UI: Settings -> Plugins -> Install from URL
API: POST /api/plugins/install with {"url": "https://github.com/user/repo"}
