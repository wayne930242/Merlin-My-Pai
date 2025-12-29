# TDD 工作流程

## 流程

### 1. Red（寫測試）

先寫一個會失敗的測試：

```typescript
// example.test.ts
import { describe, it, expect } from "vitest";
import { add } from "./math";

describe("add", () => {
  it("should add two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

### 2. Green（實作）

寫最少的程式碼讓測試通過：

```typescript
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

### 3. Refactor（重構）

在測試保護下重構程式碼：
- 消除重複
- 改善命名
- 優化結構

## 執行測試

```bash
# 執行所有測試
bun test

# 監聽模式
bun test --watch

# 單一檔案
bun test example.test.ts

# 覆蓋率
bun test --coverage
```

## Best Practices

1. **一次只測一件事**
2. **測試行為，不測實作**
3. **使用描述性的測試名稱**
4. **Arrange-Act-Assert 模式**
