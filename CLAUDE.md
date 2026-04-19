# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Locally runnable, patched build of the (leaked) Claude Code CLI source. The root package is a Bun-based TypeScript monorepo that ships three cooperating pieces:

1. **CLI / TUI** in [src/](src/) — React + Ink terminal UI, MCP/Skills/Agents/Memory runtime, launched by [bin/claude-haha](bin/claude-haha).
2. **Local HTTP + WebSocket server** in [src/server/](src/server/) — the backend for the desktop app and IM adapters. Reads/writes the same `~/.claude/` filesystem state as the CLI so the two stay in sync.
3. **Desktop client** in [desktop/](desktop/) — standalone Tauri 2 + React 18 + Zustand app. Lives in its own workspace (own `package.json`, `node_modules`, tsconfig, Vitest).

[adapters/](adapters/) is a fourth, smaller workspace for Telegram / Feishu IM bridges that relay messages into the local server's session API.

## Commands

Root (Bun + the root `package.json`):

```bash
bun install                                   # install CLI + server deps
./bin/claude-haha                             # run the CLI/TUI (also: bun run start)
./bin/claude-haha -p "prompt"                 # headless/--print mode
CLAUDE_CODE_FORCE_RECOVERY_CLI=1 ./bin/claude-haha   # degrade to readline REPL (no Ink)
SERVER_PORT=3456 bun run src/server/index.ts  # start the desktop/IM backend
bun run docs:dev                              # VitePress docs at /docs
./start.sh                                    # installs deps in all 3 workspaces, starts LiteLLM(4000)+server(3456)+tauri dev
```

Desktop (`cd desktop`, own workspace):

```bash
bun install
bun run dev                                   # Vite dev server for the web UI
bun run tauri dev                             # full Tauri shell (requires server running on 3456)
bun run build                                 # tsc -b && vite build
bun run lint                                  # tsc --noEmit (this is the lint command)
bun run test                                  # Vitest (jsdom + Testing Library)
bun run test -- path/to/file.test.tsx         # run a single test file
bun run build:sidecars                        # build CLI/server sidecar binaries embedded in the app
./scripts/build-macos-arm64.sh                # signed macOS build
.\scripts\build-windows-x64.ps1               # signed Windows build
```

Server tests (root workspace, uses `bun test`):

```bash
bun test src/server                           # full server test suite
bun test src/server/__tests__/sessions.test.ts
```

Adapters (`cd adapters`, own workspace):

```bash
bun install
bun run telegram                              # start the Telegram bridge
bun run feishu                                # start the Feishu bridge
bun test                                      # or: bun test common/ | telegram/ | feishu/
```

There is no global lint/format config beyond `tsc --noEmit` in each workspace.

## Architecture

### Boot path (CLI)

[bin/claude-haha](bin/claude-haha) → `bun --env-file=.env ./src/entrypoints/cli.tsx` (with `CALLER_DIR` exported so [preload.ts](preload.ts) can `chdir` back to the user's invocation dir). [preload.ts](preload.ts) also installs the `MACRO` global (VERSION, PACKAGE_URL, BUILD_TIME) that the bundled code expects from the original build. When spawned *by* the desktop server, `CC_HAHA_SKIP_DOTENV=1` is set so stale provider keys in `.env` do not override the server-selected provider.

[src/entrypoints/cli.tsx](src/entrypoints/cli.tsx) keeps early imports dynamic to preserve fast paths (`--version`, `--dump-system-prompt`, etc.) and gates Anthropic-internal features behind `feature('…')` macros that DCE in external builds. The normal path hands off to [src/main.tsx](src/main.tsx), which wires Commander.js + Ink + the full tool/command/skill stack, or to [src/localRecoveryCli.ts](src/localRecoveryCli.ts) when the recovery env var is set.

### Agent runtime (src/)

Core loop lives in [src/QueryEngine.ts](src/QueryEngine.ts), [src/Task.ts](src/Task.ts), [src/Tool.ts](src/Tool.ts), [src/query/](src/query/). Each capability is a folder, not a file — scale your mental model accordingly:

- [src/tools/](src/tools/) — one folder per agent-callable tool (Bash, FileEdit, Agent, Task*, MCP, PushNotification, ScheduleCron, etc.). New tools plug in here.
- [src/commands/](src/commands/) — slash commands (`/commit`, `/review`, `/init`, `/fast`, …). Many delegate to a Skill or Tool.
- [src/skills/](src/skills/) — Skills system; [src/skills/bundled/](src/skills/bundled/) ships in-tree skills (including `claude-api` scaffolds in [src/skills/bundled/claude-api/](src/skills/bundled/claude-api/)).
- [src/services/](src/services/) — long-lived subsystems: API clients, MCP manager, OAuth, memory extraction, team memory sync, LSP, compaction, voice, rate limits. Services are the right home for "runs in the background" logic.
- [src/screens/](src/screens/) + [src/components/](src/components/) + [src/ink/](src/ink/) — Ink-rendered TUI. `src/ink/` is a vendored Ink variant; prefer editing higher-level components unless you are deliberately touching the renderer.
- [src/remote/](src/remote/), [src/bridge/](src/bridge/), [src/daemon/](src/daemon/), [src/coordinator/](src/coordinator/) — multi-agent / IM-channel plumbing.
- [src/memdir/](src/memdir/), [src/services/SessionMemory/](src/services/SessionMemory/), [src/services/extractMemories/](src/services/extractMemories/) — persistent memory under `~/.claude/`.

The TypeScript path alias `src/*` → `./src/*` is defined in [tsconfig.json](tsconfig.json); [stubs/](stubs/) stands in for two Anthropic-internal packages (`@ant/claude-for-chrome-mcp`, `color-diff-napi`).

### Server (src/server/)

Single Bun HTTP server that also upgrades to WebSocket. [src/server/index.ts](src/server/index.ts) → [src/server/router.ts](src/server/router.ts) dispatches `/api/{sessions,conversations,settings,models,scheduled-tasks,agents,teams,providers,adapters,skills,computer-use,haha-oauth,…}` to handlers in [src/server/api/](src/server/api/). WS traffic is in [src/server/ws/](src/server/ws/), and [src/server/proxy/](src/server/proxy/) is the Anthropic-compatible proxy that maps desktop-configured providers onto `ANTHROPIC_*` env vars for spawned CLI sessions. Background services:

- [src/server/services/teamWatcher.ts](src/server/services/teamWatcher.ts) — watches team memory files.
- [src/server/services/cronScheduler.ts](src/server/services/cronScheduler.ts) — runs scheduled tasks.
- [src/server/sessionManager.ts](src/server/sessionManager.ts) — spawns and tracks CLI child processes per session.

Critical invariant: **the server and the CLI share state through the filesystem (`~/.claude/`), not through RPC.** When you change a data shape, update both readers.

### Desktop app (desktop/)

React 18 + Vite + Tailwind v4 + Zustand, wrapped in Tauri 2 ([desktop/src-tauri/](desktop/src-tauri/) Rust side). UI layout:

- [desktop/src/stores/](desktop/src/stores/) — one Zustand store per domain (session, chat, provider, skill, team, update, …). Store tests sit next to the store.
- [desktop/src/pages/](desktop/src/pages/), [desktop/src/components/](desktop/src/components/) — routed views and shared components.
- [desktop/src/api/](desktop/src/api/) — typed clients that talk to the root `src/server` over REST + WebSocket.
- [desktop/src-tauri/binaries/](desktop/src-tauri/binaries/) + [desktop/sidecars/](desktop/sidecars/) — sidecar CLI/server binaries bundled into release builds via `build:sidecars`.

Desktop dev loop requires the root server running on `127.0.0.1:3456` (unless you're using the full `tauri dev` flow, where the sidecar is launched for you).

### Adapters (adapters/)

Thin IM bridges (`telegram/`, `feishu/`, shared `common/`) that a user pairs with a session through the desktop Settings UI. Flow is documented in [adapters/README.md](adapters/README.md):
`Desktop Settings → /api/adapters → ~/.claude/adapters.json → adapters/<platform>/index.ts → /api/sessions + /ws/:sessionId`.
The desktop app does **not** auto-spawn adapter processes — users (or you, during dev) run `bun run telegram|feishu` manually.

## Config-directory isolation (important)

Every subsystem in this repo (CLI, server, adapters, spawned children) reads/writes `process.env.CLAUDE_CONFIG_DIR ?? ~/.claude/` — the **same path used by the official Claude Code CLI**. Without an override the two share settings, sessions, skills, agents, memory, team data, and OAuth tokens.

This checkout is pinned to an isolated directory:

- [.env](.env) sets `CLAUDE_CONFIG_DIR=/Users/felix/.claude-haha` (picked up by `./bin/claude-haha` via `bun --env-file=.env` and by the server when launched with the same wrapper).
- [start.sh](start.sh) `export`s the same value so the Tauri dev flow, LiteLLM, server, and any spawned CLI children inherit it.
- [adapters/package.json](adapters/package.json) scripts use `--env-file=../.env` so `bun run telegram|feishu` from `adapters/` stay isolated.

If you invoke anything else (`bun test src/server`, raw `bun run src/server/index.ts`, `bun run dev` inside `desktop/`, an ad-hoc `bun` script) from a shell where `CLAUDE_CONFIG_DIR` is unset, it will fall back to `~/.claude/` and leak into the user's official config. Either `export CLAUDE_CONFIG_DIR=$HOME/.claude-haha` in the shell or prefix commands with it.

## Conventions that are easy to miss

- **No semicolons, 2-space indent, ESM imports**, per [AGENTS.md](AGENTS.md). Match the surrounding file style — server code and desktop code share this.
- Names: `PascalCase` React components, `camelCase` functions/hooks/stores, descriptive file names (`teamWatcher.ts`, `AgentTranscript.tsx`).
- Tool folder pattern: each tool in [src/tools/](src/tools/) is a directory with its own prompt, schema, and handler. Copy the shape of a neighbor rather than inventing a new layout.
- Conventional Commits (`feat:`, `fix:`, `docs:`, …) — see recent `git log`.
- Don't add new root-level dependencies casually: the root `package.json` is a patched redistribution surface, and the desktop workspace keeps its own deps deliberately separated.
- Provider / model selection flows through `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` + `ANTHROPIC_MODEL` (+ `_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL`). See [.env.example](.env.example) and [docs/guide/third-party-models.md](docs/guide/third-party-models.md). LiteLLM ([litellm_config.yaml](litellm_config.yaml)) is the adapter for non-Anthropic-native providers.

## Docs worth reading before big changes

Source of truth for subsystem behavior — prefer these over spelunking:

- [docs/reference/project-structure.md](docs/reference/project-structure.md), [docs/reference/fixes.md](docs/reference/fixes.md) — structure + deltas vs. leaked source.
- [docs/agent/](docs/agent/), [docs/skills/](docs/skills/), [docs/memory/](docs/memory/), [docs/channel/](docs/channel/) — the four big subsystems, each with a usage guide and implementation doc.
- [docs/desktop/](docs/desktop/) — desktop architecture and build/installer details.
- [docs/features/computer-use.md](docs/features/computer-use.md), [docs/features/computer-use-architecture.md](docs/features/computer-use-architecture.md) — cross-platform (macOS/Windows) desktop-control feature; Python helpers live in [runtime/](runtime/).
