# Capability Rollout Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the cross-app memory capability rollout so `pai-web`, `pai-claude` hooks/CLI, and `pai-bot` all use the same capability contracts with verified type/lint/test gates at each step.

**Architecture:** Keep `packages/capabilities/memory` as the single behavior contract and move app-specific logic into thin adapters. Preserve current API behavior while replacing internal call paths incrementally behind adapter boundaries. Enforce TDD per task and run type/lint after every implementation step.

**Tech Stack:** Bun, TypeScript, Biome, existing REST API in `pai-bot`, React hooks in `pai-web`.

---

### Task 1: Stabilize package import boundary for capability consumption

**Files:**
- Modify: `pai-bot/tsconfig.json`
- Create: `packages/capabilities/memory/tsconfig.json`
- Create: `packages/capabilities/memory/src/index.test.ts`
- Modify: `packages/capabilities/memory/src/index.ts`

**Step 1: Write the failing test**

Add `packages/capabilities/memory/src/index.test.ts` to assert public exports include `MemoryService` and `InMemoryStore`.

```ts
import { expect, test } from "bun:test";
import { InMemoryStore, MemoryService } from "./index";

test("public API exports service and store", () => {
  expect(typeof MemoryService).toBe("function");
  expect(typeof InMemoryStore).toBe("function");
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/capabilities/memory && bun test src/index.test.ts`
Expected: FAIL if exports are incomplete.

**Step 3: Write minimal implementation**

Update `packages/capabilities/memory/src/index.ts` exports as needed.

**Step 4: Run test to verify it passes**

Run: `cd packages/capabilities/memory && bun test src/index.test.ts`
Expected: PASS.

**Step 5: Verify type and lint**

Run: `cd pai-bot && bun run typecheck`
Expected: PASS.

Run: `cd pai-bot && bun run lint`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/capabilities/memory/src/index.ts packages/capabilities/memory/src/index.test.ts packages/capabilities/memory/tsconfig.json pai-bot/tsconfig.json
git commit -m "refactor: stabilize memory capability package boundary"
```

### Task 2: Move `pai-claude` memory CLI operations to capability adapter API only

**Files:**
- Modify: `pai-claude/hooks/memory-cli.ts`
- Modify: `pai-claude/hooks/lib/memory-capability.ts`
- Create: `pai-claude/tests/memory-cli-capability.test.ts`

**Step 1: Write the failing test**

Add `pai-claude/tests/memory-cli-capability.test.ts` for `search` and `save` code paths to ensure CLI calls adapter functions (not direct long-term-memory writes).

```ts
import { expect, test, mock } from "bun:test";

// mock adapter module and verify calls from CLI command handlers
```

**Step 2: Run test to verify it fails**

Run: `cd pai-claude && bun test tests/memory-cli-capability.test.ts`
Expected: FAIL because CLI still bypasses adapter in at least one path.

**Step 3: Write minimal implementation**

Refactor `memory-cli.ts` so `save/search/find-similar/update` only go through `memory-capability.ts` functions.

**Step 4: Run test to verify it passes**

Run: `cd pai-claude && bun test tests/memory-cli-capability.test.ts`
Expected: PASS.

**Step 5: Verify type and lint**

Run: `cd pai-bot && bun run typecheck`
Expected: PASS.

Run: `cd pai-bot && bun run lint`
Expected: PASS.

**Step 6: Commit**

```bash
git add pai-claude/hooks/memory-cli.ts pai-claude/hooks/lib/memory-capability.ts pai-claude/tests/memory-cli-capability.test.ts
git commit -m "refactor: route claude memory cli through capability adapter"
```

### Task 3: Integrate `pai-web` memory view with capability-backed API contract

**Files:**
- Modify: `pai-web/src/lib/api.ts`
- Modify: `pai-web/src/hooks/use-memory.ts`
- Create: `pai-web/src/hooks/use-memory.test.ts`
- Modify: `pai-web/src/components/memory/*` (exact file based on current render entry)

**Step 1: Write the failing test**

Create `pai-web/src/hooks/use-memory.test.ts` that asserts memory search/stat calls use the expected API payload (`query`/`keywords`, `limit`) and response mapping (`{ content, category, importance }`).

**Step 2: Run test to verify it fails**

Run: `cd pai-web && bun test src/hooks/use-memory.test.ts`
Expected: FAIL due to mismatch with current API integration.

**Step 3: Write minimal implementation**

Update API client and hook mapping to match capability-backed route behavior in `pai-bot`.

**Step 4: Run test to verify it passes**

Run: `cd pai-web && bun test src/hooks/use-memory.test.ts`
Expected: PASS.

**Step 5: Verify type and lint**

Run: `cd pai-web && bunx tsc --noEmit`
Expected: PASS.

Run: `cd pai-web && bunx biome check src`
Expected: PASS.

**Step 6: Commit**

```bash
git add pai-web/src/lib/api.ts pai-web/src/hooks/use-memory.ts pai-web/src/hooks/use-memory.test.ts
git commit -m "refactor: align web memory hooks with capability-backed api"
```

### Task 4: Add API-level regression tests for memory routes in `pai-bot`

**Files:**
- Create: `pai-bot/src/api/routes/memory.test.ts`
- Modify: `pai-bot/src/api/routes/memory.ts` (only if test requires tiny seam for dependency injection)

**Step 1: Write the failing test**

Test these route behaviors:
- `POST /api/memory/save` returns `{ok:true,id}` or `{ok:true,duplicate:true}`
- `POST /api/memory/search` returns `count` + mapped memories
- `GET /api/memory/stats` returns `{total,limit,usage}`
- `POST /api/memory/cleanup` returns `{ok:true,removed}`

**Step 2: Run test to verify it fails**

Run: `cd pai-bot && bun test src/api/routes/memory.test.ts`
Expected: FAIL before adapter seam is complete.

**Step 3: Write minimal implementation**

Add lightweight injection seam if needed, keep existing response schema unchanged.

**Step 4: Run test to verify it passes**

Run: `cd pai-bot && bun test src/api/routes/memory.test.ts`
Expected: PASS.

**Step 5: Verify type and lint**

Run: `cd pai-bot && bun run typecheck`
Expected: PASS.

Run: `cd pai-bot && bun run lint`
Expected: PASS.

**Step 6: Commit**

```bash
git add pai-bot/src/api/routes/memory.ts pai-bot/src/api/routes/memory.test.ts
git commit -m "test: add memory route regression coverage for capability adapter"
```

### Task 5: Final integration verification + docs

**Files:**
- Modify: `README.md`
- Modify: `pai-claude/README.md`
- Modify: `docs/plans/2026-02-14-memory-workspace-boundary-design-implementation.md`
- Create: `docs/plans/2026-02-14-capability-rollout-phase2-report.md`

**Step 1: Write the failing verification checklist**

Create a checklist in `docs/plans/2026-02-14-capability-rollout-phase2-report.md` with unchecked items for all required commands.

**Step 2: Run integration commands**

Run:
- `cd packages/capabilities/memory && bun test src/application/service.test.ts src/index.test.ts`
- `cd pai-claude && bun test tests/workspace-boundary.test.ts tests/memory-cli-capability.test.ts`
- `cd pai-bot && bun test src/memory/capability.test.ts src/api/routes/memory.test.ts`
- `cd pai-bot && bun run typecheck`
- `cd pai-bot && bun run lint`
- `cd pai-web && bunx tsc --noEmit`
- `cd pai-web && bunx biome check src`

Expected: all PASS.

**Step 3: Write minimal documentation updates**

Document final architecture and command paths (hooks location, capability ownership, API compatibility notes).

**Step 4: Verify docs formatting and references**

Run: `rg -n "workspace/scripts|../hooks|capability" README.md pai-claude/README.md docs/plans/*.md`
Expected: references are consistent.

**Step 5: Commit**

```bash
git add README.md pai-claude/README.md docs/plans/2026-02-14-capability-rollout-phase2-report.md docs/plans/2026-02-14-memory-workspace-boundary-design-implementation.md
git commit -m "docs: finalize capability rollout phase2 verification report"
```

## Notes

- Required process skills during execution: `@test-driven-development`, `@verification-before-completion`.
- Recommended execution style: keep commits small and one task per commit.
