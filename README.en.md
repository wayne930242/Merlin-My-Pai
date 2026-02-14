# weihung-pai

Personal AI Infrastructure - Merlin

中文版: [README.md](README.md)

## Project Structure

```text
weihung-pai/
├── pai-bot/          # Multi-platform bot service
├── pai-claude/       # Merlin runtime config on VPS
├── scripts/          # CLI toolkit
├── setup/            # Interactive setup wizard
├── ansible/          # VPS deployment
└── .claude/          # Local dev agent settings
```

## Architecture Highlights (2026-02)

- `packages/capabilities/memory`: capability contracts + tests (working / episodic / semantic / procedural)
- `pai-bot`: `/api/memory/*` is normalized through a local capability adapter (deploy-safe runtime path)
- `pai-claude/hooks`: memory CLI uses a capability facade and is isolated from workspace runtime data
- `pai-web`: memory client is aligned with capability-backed payloads (`POST /api/memory/search`, `POST /api/memory/save`)

## How Memory Reaches Agents

1. User input enters `pai-claude/hooks/on-user-prompt.ts`.
2. The hook extracts keywords and queries both:
`pai-claude/hooks/lib/memory-capability.ts` (long-term) and `pai-bot /api/memory/search` (short-term).
3. Matched memories are injected as context before Claude task execution.
4. On session stop, `pai-claude/hooks/on-stop.ts` extracts reusable facts and writes back to short-term + long-term memory.
5. `memory-cli` flows (`save/search/find-similar/update`) are routed through the capability facade to avoid implementation drift.

## Deploy

```bash
uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml
uv run pai ansible ansible-playbook ansible/playbooks/deploy-claude.yml
```
