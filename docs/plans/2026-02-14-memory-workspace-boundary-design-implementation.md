# Memory Capability + Workspace Boundary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolate runtime workspace data from hook/tooling code and establish a memory capability skeleton for future bot/web/cli reuse.

**Architecture:** Move all Claude hook scripts out of `pai-claude/workspace/scripts` into `pai-claude/hooks`, keep `workspace/` for runtime state only, and introduce a `packages/capabilities/memory` contract-first module. Update hook paths in Claude settings and normalize path resolution via shared helpers.

**Tech Stack:** Bun, TypeScript, Claude hooks, monorepo packages.

---

### Task 1: Add failing boundary tests

**Files:**
- Create: `pai-claude/tests/workspace-boundary.test.ts`

1. Write tests that assert:
- Hook commands in `pai-claude/workspace/.claude/settings.json` point to `../hooks/*.ts`.
- Shared path helper resolves workspace root and memory root under `pai-claude/workspace`.
2. Run: `cd pai-claude && bun test tests/workspace-boundary.test.ts`
3. Expect: failing (paths/helper not implemented yet).

### Task 2: Move hooks out of workspace and fix runtime paths

**Files:**
- Create: `pai-claude/hooks/**`
- Modify: `pai-claude/workspace/.claude/settings.json`
- Modify: `pai-claude/workspace/.gitignore`
- Modify: `pai-claude/workspace/README.md`
- Modify: `pai-claude/README.md`

1. Move `workspace/scripts/*.ts` and `workspace/scripts/lib/*.ts` to `hooks/` and `hooks/lib/`.
2. Add shared path helper to ensure scripts reference `workspace/` for memory/history/skills.
3. Update hook command paths in settings to `../hooks/*.ts`.
4. Remove script whitelist from workspace `.gitignore`.

### Task 3: Create memory capability skeleton package

**Files:**
- Create: `packages/capabilities/memory/package.json`
- Create: `packages/capabilities/memory/src/{domain,application,interfaces,infrastructure}/...`
- Create: `packages/capabilities/memory/src/index.ts`
- Create: `packages/capabilities/memory/README.md`

1. Add contract-first interfaces for four-tier memory (working/episodic/semantic/procedural).
2. Provide no-op in-memory adapter stubs and typed command/query interfaces.
3. Keep implementation minimal, compile-safe, no behavior wiring yet.

### Task 4: Verify

1. Run: `cd pai-claude && bun test tests/workspace-boundary.test.ts`
2. Run: `cd pai-claude && bunx tsc --noEmit`
3. Confirm moved files no longer exist under `workspace/scripts`.

## Implementation Status (2026-02-14)

- Completed: Task 1, Task 2, Task 3
- Verification notes:
  - `cd pai-claude && bun test tests/workspace-boundary.test.ts` passed.
  - `workspace/scripts` 已移除，hooks 已遷移到 `pai-claude/hooks`.
  - `pai-claude` 的 `bunx tsc --noEmit` 受限於目前 Bun type 與 TS 選項相容性，不作為本次變更阻斷條件；改以行為測試與 `pai-bot` / `pai-web` type/lint gate 驗證整體整合。
