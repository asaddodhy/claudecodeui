# CloudCLI UI (claudecodeui) — Backup & Restore Guide

Written 2026-10-12 before the web UI app was uninstalled from this Mac (user: dodhya).
This file is for any person or AI agent who needs to recover what existed. It contains
NO credentials. The same file is also on GitHub at branch `backup/restore-readme`
(file `BACKUP-RESTORE.md`).

## What the app was

- App: CloudCLI UI / claudecodeui, version 1.37.0 (upstream: https://github.com/siteboon/claudecodeui)
- User's fork (their "repo"): https://github.com/asaddodhy/claudecodeui (git remote `origin`)
- Local checkout was: ~/Documents/claudecodeui (branch `main` at 59472c0, identical to upstream/main)
- Runtime data dir: ~/.cloudcli (SQLite DB, pasted images, caches)
- `main` was 14 commits "ahead" of the fork's main only because the fork was behind upstream.
  Those 14 commits are other people's upstream commits. They are NOT user work and need no recovery.

## Where everything was saved

### A. Code work -> GitHub fork `asaddodhy/claudecodeui`, `backup/*` branches

| Branch | Commit | What it holds |
|---|---|---|
| `backup/native-claude-path` | 4dc06a8187596ca1354c50030b5b6acca549d7f9 | Was uncommitted work: resolve the `claude` CLI from `~/.local/bin` and PATH on macOS/Linux (native installer), add `~/.local/bin` to the desktop server PATH, plus tests. Files: `electron/localServer.js`, `server/shared/claude-cli-path.ts`, `server/shared/tests/claude-cli-path.test.ts`. Based on upstream 59472c0. |
| `backup/stash0-sessions-watcher-polling` | 1e9c86cbe8ed1a071d3ed45f177fa4f5be93459c | Was `git stash@{0}`. One change in `server/modules/providers/services/sessions-watcher.service.ts`: chokidar `usePolling: true` (+ interval settings) replaced with `usePolling: false`. Based on upstream 75ff8a5. |
| `backup/stash1-untracked-plan-and-wiki` | e794ccead45633409ec387a46d8852454b073ad8 | Was the untracked files in `git stash@{1}`: `PLAN-compat-api-proxy.md` (design plan for an OpenAI/Anthropic-compatible API proxy) and `WIKI.md`. Orphan commit with no parent. The stash itself had no tracked-file changes. |
| `backup/restore-readme` | (this file) | This README only. |

Nothing was pushed to `main`. The original local git stashes were left in place.

### B. App data -> LOCAL ONLY (never on GitHub, contains secrets)

- Location: `~/Documents/cloudcli-data-backup/cloudcli-2026-10-12/` (permissions 700, owner only)
- It is a byte-identical copy (`diff -r` verified) of `~/.cloudcli` taken on 2026-10-12.
- Contents:
  - `auth.db` — SQLite DB. Tables: `users` (1 account: username, password hash, git name/email),
    `app_config` (keys: `jwt_secret`, `browser_use_mcp_token`, `browser_use_settings`),
    `vapid_keys` (push-notification key pair), `user_notification_preferences`,
    `projects` (36 projects: path, custom name, starred/archived), `sessions` (349 sessions:
    51 claude, 298 opencode; name, project path, transcript path, model), `scan_state`;
    `api_keys`, `user_credentials`, `push_subscriptions`, `notification_channel_endpoints` were empty.
  - `auth.db.backup-*` (4 files, Aug 2026) — older automatic copies of `auth.db`.
  - `assets/` (85 files, ~48 MB) — images/screenshots attached in chats, named by timestamp.
  - `provider-models-cache.json` — cached model list (regenerated automatically; low value).
  - `provider-session-active-model-changes.json` — one session's model-change record.
- DO NOT commit or upload this folder: `auth.db` holds the JWT secret and password hash.

### C. Not backed up (still on disk, untouched by this backup)

- Chat transcripts (`.jsonl`) that the `sessions` table points to. For Claude sessions they are in
  `~/.claude/projects/` (about 14 MB). The web UI only indexes them; uninstalling the UI does not
  delete them. Opencode session transcripts are in opencode's own storage.
- Git stashes `stash@{0}` and `stash@{1}` in the old local checkout (their content is saved in A).

## How to restore

### Reinstall the app
```
git clone https://github.com/asaddodhy/claudecodeui.git && cd claudecodeui
# or upstream: git clone https://github.com/siteboon/claudecodeui.git
git checkout main        # app v1.37.0 at 59472c0 (fork main may be older; upstream/main is the same)
npm install
```
Note: Homebrew `node` on this Mac was broken (`libsimdjson.33.dylib` missing) on 2026-10-12.
`/opt/homebrew/opt/node@22/bin` (Node v22) worked. The repo's git pre-commit hook (husky + lint-staged)
needs a working Node: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" git commit ...`

### Restore the code work
```
git fetch origin
git switch backup/native-claude-path                  # or: git cherry-pick 4dc06a8
# stash0 as a patch on top of any checkout:
git diff 75ff8a5 origin/backup/stash0-sessions-watcher-polling | git apply
# stash1 files:
git checkout origin/backup/stash1-untracked-plan-and-wiki -- PLAN-compat-api-proxy.md WIKI.md
```

### Restore the app data (accounts, projects, sessions index, images)
```
# 1. Stop the app/server (it uses port 3001).
# 2. Move any new ~/.cloudcli aside, then:
cp -Rp ~/Documents/cloudcli-data-backup/cloudcli-2026-10-12 ~/.cloudcli
# 3. Start the app. Sign in with the original username/password.
```
Sessions only show their history if the transcript files in `~/.claude/projects/` (and opencode's
storage) still exist, since `auth.db` stores paths to them, not the conversations.

## Log of actions taken (2026-10-12)

1. Inspected repo: no unpushed user commits; 3 uncommitted files; 2 stashes; remotes `origin` (fork) and `upstream`.
2. Created branch `backup/native-claude-path`, committed the 3 files (pre-commit hook passed using Node 22), pushed.
3. Created branches directly at the two stashes (no working-tree changes), pushed.
4. Copied `~/.cloudcli` to the local backup folder above and verified it.
5. Wrote this README (local + `backup/restore-readme` branch).
6. Nothing was deleted or uninstalled by this backup process.
