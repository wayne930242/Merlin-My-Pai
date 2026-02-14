# pai-bot

Personal AI bot service for Telegram + Discord, integrated with Claude Code.

中文版本: [README.md](README.md)

## Core Capabilities

- Claude Code task execution (headless flow)
- Multi-platform messaging (Telegram and Discord)
- MCP server tools (Google, Scheduler, Memory, Notify, Garmin, System)
- Intel Feed digest pipeline
- Voice transcription and Discord voice features

## Memory Integration

- Short-term memory APIs:
  - `POST /api/memory/save`
  - `POST /api/memory/search`
  - `GET /api/memory/stats`
  - `POST /api/memory/cleanup`
- Runtime path uses local adapter (`src/memory/capability.ts`) to avoid deploy-time monorepo path dependencies.
- Long-term memory is injected through `pai-claude` hooks and queried by keyword at prompt time.

## Bot Commands (Highlights)

- Telegram: `/start`, `/status`, `/memory`, `/workspace`
- Discord text: `/help`, `/status`, `/memory`, `/workspace`
- Discord slash: `/help`, `/status`, `/memory`, `/workspace`

`/workspace` prints:
- current workspace root
- directory tree (bounded depth / entry count)
- file/dir summary
- git status summary (when repo is available)

## Development

```bash
cd pai-bot
bun install
bun run db:init
bun run dev
```

## Checks

```bash
bun run typecheck
bun run lint
```
