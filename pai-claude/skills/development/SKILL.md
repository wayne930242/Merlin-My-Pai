---
name: development
description: TypeScript/Vue/React 開發工作流程。USE WHEN 使用者提到 code, develop, 開發, 程式, component, test, 測試, refactor, debug, TypeScript, Vue, React。
---

# Development Skill

TypeScript/Vue/React 開發的專業技能。

## Workflow Routing

- TDD 開發 → [workflows/tdd.md](workflows/tdd.md)
- Code Review → [workflows/code-review.md](workflows/code-review.md)

## 技術棧

### Frontend
- Vue 3 + Composition API
- React + Hooks
- TypeScript 5.x
- Tailwind CSS
- Vite

### Backend
- Bun / Node.js
- Hono (API framework)
- Drizzle ORM

### Testing
- Vitest
- Playwright (E2E)

## Best Practices

1. **Type Safety**：善用 TypeScript 的型別系統
2. **Composition**：優先使用 composables/hooks 抽取邏輯
3. **Testing**：關鍵邏輯必須有測試覆蓋
4. **Error Handling**：使用 Result 模式處理錯誤

## Common Patterns

```typescript
// Result 模式
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Vue Composable
function useCounter(initial = 0) {
  const count = ref(initial);
  const increment = () => count.value++;
  return { count, increment };
}
```
