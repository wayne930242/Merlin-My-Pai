# pai-web

Merlin web console built with React + Vite.

中文版: [README.md](README.md)

## Features

- Chat: real-time conversation with streamed responses
- Memory: short-term memory view aligned with `pai-bot /api/memory/*`
- History: sessions / learnings / decisions browsing
- Workspace: directory and file viewer
- RAG: query and sync flows
- Logs: live log and notification events
- Settings: UI and behavior preferences

## Environment

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
VITE_API_KEY=
```

## Development

```bash
cd pai-web
bun install
bun run dev
```

## Checks

```bash
bunx tsc --noEmit
bun run lint
```
