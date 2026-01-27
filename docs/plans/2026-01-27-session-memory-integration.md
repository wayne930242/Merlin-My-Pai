# Session Memory Integration - 雙層記憶架構

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立雙層記憶系統：中短期記憶（SQLite，有上限）+ 長期記憶（文件，含 metadata），在 session 結束時由 LLM 自動分類整理。

**Architecture:**
- **中短期記憶**：SQLite，散亂的日常記憶，有導入上限（如 100 條），定期汰換
- **長期記憶**：Markdown 文件，包含摘要和路徑 metadata，永久保存
- **Stop Hook**：使用 LLM 分析對話，自動分類到兩種記憶
- **UserPromptSubmit Hook**：搜尋兩層記憶，注入相關脈絡

**Tech Stack:** Bun, TypeScript, SQLite, Markdown with YAML frontmatter, Gemini Flash 2.5

---

## 記憶架構設計

### 中短期記憶（SQLite）

```sql
-- 現有 memories 表，新增過期機制
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  importance INTEGER DEFAULT 0,  -- 1-5
  created_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL
);

-- 上限：100 條/用戶
-- 清理策略：超過上限時，刪除最舊且低重要性的
```

**用途**：
- 最近討論的話題
- 臨時偏好
- 對話脈絡

### 長期記憶（文件系統）

```
~/merlin/workspace/memory/
├── index.md                    # 記憶索引（摘要 + 路徑）
├── user-profile.md             # 用戶基本資訊
├── preferences/
│   ├── coding.md               # 程式偏好
│   ├── tools.md                # 工具偏好
│   └── communication.md        # 溝通偏好
├── knowledge/
│   ├── projects.md             # 專案知識
│   └── domain.md               # 領域知識
└── events/
    └── 2026-01-important.md    # 重要事件
```

**文件格式**：

```markdown
---
title: 程式偏好
path: preferences/coding.md
summary: TypeScript、Bun、簡潔風格
updated: 2026-01-27
tags: [preference, coding]
---

## 語言與框架
- 偏好 TypeScript，使用 strict mode
- Runtime 使用 Bun 而非 Node.js

## 風格
- 函式保持簡短（< 50 行）
- 避免過度抽象
- 優先使用 const
```

**索引文件 (index.md)**：

```markdown
---
title: Memory Index
updated: 2026-01-27
---

# 長期記憶索引

## preferences/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|
| coding.md | TypeScript、Bun、簡潔風格 | 2026-01-27 |
| tools.md | Claude Code、Obsidian、Git | 2026-01-27 |

## knowledge/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|
| projects.md | Merlin PAI 專案架構 | 2026-01-27 |
```

---

## 流程設計

### Stop Hook 處理流程

```
對話結束
    ↓
LLM 分析回應
    ↓
分類判斷
    ├── 中短期記憶 → SQLite
    │   ├── 檢查上限（100 條）
    │   └── 超過則清理最舊的
    │
    └── 長期記憶 → 文件
        ├── 判斷屬於哪個分類
        ├── 更新現有文件 or 新增
        └── 更新 index.md
```

### UserPromptSubmit 搜尋流程

```
收到 prompt
    ↓
並行搜尋
    ├── 中短期：SQLite 關鍵字搜尋
    └── 長期：讀取 index.md，匹配相關文件
    ↓
合併結果，格式化輸出
    ↓
注入 Claude context
```

---

## 實作計畫

### Task 1: 定義長期記憶文件結構

**Files:**
- Create: `pai-claude/workspace/memory/index.md`
- Create: `pai-claude/workspace/memory/user-profile.md`
- Create: `pai-claude/workspace/memory/preferences/coding.md`

**Step 1: Create directory structure**

```bash
mkdir -p ~/merlin/workspace/memory/{preferences,knowledge,events}
```

**Step 2: Create index.md template**

```markdown
---
title: Memory Index
updated: 2026-01-27
total_files: 0
---

# 長期記憶索引

此文件由系統自動維護，記錄所有長期記憶文件的摘要和路徑。

## preferences/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## knowledge/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## events/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|
```

**Step 3: Create user-profile.md template**

```markdown
---
title: 用戶資料
path: user-profile.md
summary: 基本資訊、身份、角色
updated: 2026-01-27
tags: [profile, identity]
---

# 用戶資料

（由系統自動填充）
```

**Step 4: Commit**

```bash
git add pai-claude/workspace/memory/
git commit -m "feat: create long-term memory file structure"
```

---

### Task 2: 新增 pai-bot 記憶 API（支援雙層）

**Files:**
- Modify: `pai-bot/src/memory/manager.ts`
- Create: `pai-bot/src/memory/constants.ts`
- Create: `pai-bot/src/api/routes/memory.ts`
- Modify: `pai-bot/src/api/server.ts`

**Step 1: Create memory constants**

```typescript
// pai-bot/src/memory/constants.ts
/**
 * 記憶系統常數
 */

// 中短期記憶上限（每用戶）
export const SHORT_TERM_MEMORY_LIMIT = 100;

// 整合閾值
export const CONSOLIDATION_THRESHOLD = 50;

// 記憶分類
export const MEMORY_CATEGORIES = {
  shortTerm: ["context", "temp", "recent"],
  longTerm: ["preference", "personal", "knowledge", "event"],
} as const;
```

**Step 2: Add enforceLimit to memory manager**

```typescript
// pai-bot/src/memory/manager.ts
import { SHORT_TERM_MEMORY_LIMIT } from "./constants";

// Update enforceLimit method
private enforceLimit(userId: number): number {
  const count = this.count(userId);
  if (count <= SHORT_TERM_MEMORY_LIMIT) return 0;

  const db = getDb();
  const toRemove = count - SHORT_TERM_MEMORY_LIMIT;

  // 刪除最舊且低重要性的記憶
  const result = db.run(
    `DELETE FROM memories WHERE id IN (
      SELECT id FROM memories
      WHERE user_id = ?
      ORDER BY importance ASC, last_accessed ASC
      LIMIT ?
    )`,
    [userId, toRemove]
  );

  logger.info({ userId, removed: result.changes }, "Enforced memory limit");
  return result.changes;
}

// Add new method for keyword search
searchByKeywords(userId: number, keywords: string[], limit: number = 10): Memory[] {
  const db = getDb();

  if (keywords.length === 0) {
    return this.getRecent(userId, limit);
  }

  const conditions = keywords.map(() => "content LIKE ?").join(" OR ");
  const params = keywords.map((k) => `%${k}%`);

  return db
    .query<Memory, [number, ...string[], number]>(
      `SELECT id, user_id as userId, content, category, importance,
              created_at as createdAt, last_accessed as lastAccessed
       FROM memories
       WHERE user_id = ? AND (${conditions})
       ORDER BY importance DESC, created_at DESC
       LIMIT ?`
    )
    .all(userId, ...params, limit);
}
```

**Step 3: Create memory routes**

```typescript
// pai-bot/src/api/routes/memory.ts
import { Hono } from "hono";
import { consolidateMemories } from "../../memory/consolidation";
import { memoryManager } from "../../memory/manager";
import { SHORT_TERM_MEMORY_LIMIT } from "../../memory/constants";
import { logger } from "../../utils/logger";

const DEFAULT_USER_ID = parseInt(
  process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0",
  10
);

export const memoryRoutes = new Hono();

// 保存中短期記憶（帶上限檢查）
memoryRoutes.post("/save", async (c) => {
  const body = await c.req.json<{
    content: string;
    category?: string;
    importance?: number;
  }>();

  const id = await memoryManager.save({
    userId: DEFAULT_USER_ID,
    content: body.content,
    category: body.category || "context",
    importance: body.importance || 1,
  });

  return c.json({ ok: true, id });
});

// 搜尋記憶
memoryRoutes.post("/search", async (c) => {
  const body = await c.req.json<{
    keywords?: string[];
    query?: string;
    limit?: number;
  }>();

  let keywords = body.keywords || [];
  if (body.query && keywords.length === 0) {
    keywords = extractKeywords(body.query);
  }

  const memories = memoryManager.searchByKeywords(
    DEFAULT_USER_ID,
    keywords,
    body.limit || 10
  );

  return c.json({
    ok: true,
    count: memories.length,
    memories: memories.map((m) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
    })),
  });
});

// 統計
memoryRoutes.get("/stats", (c) => {
  const count = memoryManager.count(DEFAULT_USER_ID);
  return c.json({
    total: count,
    limit: SHORT_TERM_MEMORY_LIMIT,
    usage: `${count}/${SHORT_TERM_MEMORY_LIMIT}`,
  });
});

// 整合
memoryRoutes.post("/consolidate", async (c) => {
  try {
    const consolidated = await consolidateMemories(DEFAULT_USER_ID);
    return c.json({ ok: true, consolidated });
  } catch (error) {
    logger.error({ error }, "Consolidation failed");
    return c.json({ ok: false, error: String(error) }, 500);
  }
});

// 清理舊記憶
memoryRoutes.post("/cleanup", (c) => {
  const removed = memoryManager["enforceLimit"](DEFAULT_USER_ID);
  return c.json({ ok: true, removed });
});

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的", "是", "在", "了", "和", "與", "有", "我", "你",
    "這", "那", "什麼", "怎麼", "可以", "需要", "想要", "請",
    "the", "a", "an", "is", "are", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "be", "was", "were",
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w))
    .slice(0, 10);
}
```

**Step 4: Register routes**

```typescript
// pai-bot/src/api/server.ts
import { memoryRoutes } from "./routes/memory";

app.route("/api/memory", memoryRoutes);
```

**Step 5: Commit**

```bash
git add pai-bot/src/memory/constants.ts pai-bot/src/memory/manager.ts \
        pai-bot/src/api/routes/memory.ts pai-bot/src/api/server.ts
git commit -m "feat: add dual-layer memory API with limit enforcement"
```

---

### Task 3: 建立長期記憶 CLI 腳本

**目的**：使用獨立腳本確保記憶文件格式正確，可獨立執行和測試。

**Files:**
- Create: `pai-claude/workspace/scripts/memory-cli.ts` (主腳本)
- Create: `pai-claude/workspace/scripts/lib/long-term-memory.ts` (核心邏輯)

**Step 1: Create core memory module**

```typescript
// pai-claude/workspace/scripts/lib/long-term-memory.ts
/**
 * 長期記憶核心邏輯
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const MEMORY_ROOT = process.env.MEMORY_ROOT || join(import.meta.dir, "..", "..", "memory");

export interface MemoryFile {
  title: string;
  path: string;
  summary: string;
  updated: string;
  tags: string[];
  content: string;
}

export interface MemoryIndexEntry {
  path: string;
  summary: string;
  updated: string;
  category: string;
}

// ============ Frontmatter 處理 ============

export function parseFrontmatter(content: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Parse arrays [a, b, c]
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      }
      meta[key] = value;
    }
  }

  return { meta, body: match[2].trim() };
}

export function generateFrontmatter(meta: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---\n");
  return lines.join("\n");
}

// ============ 索引操作 ============

export async function readIndex(): Promise<MemoryIndexEntry[]> {
  const indexPath = join(MEMORY_ROOT, "index.md");

  if (!existsSync(indexPath)) {
    return [];
  }

  const content = await readFile(indexPath, "utf-8");
  const { body } = parseFrontmatter(content);

  const entries: MemoryIndexEntry[] = [];
  let currentCategory = "";

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      currentCategory = line.slice(3).trim().replace("/", "");
    }

    // 解析表格行: | filename.md | summary | 2026-01-27 |
    const match = line.match(/^\|\s*(\S+\.md)\s*\|\s*([^|]+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|$/);
    if (match && currentCategory) {
      entries.push({
        path: `${currentCategory}/${match[1]}`,
        summary: match[2].trim(),
        updated: match[3],
        category: currentCategory,
      });
    }
  }

  return entries;
}

export async function updateIndex(relativePath: string, summary: string): Promise<void> {
  const indexPath = join(MEMORY_ROOT, "index.md");
  const today = new Date().toISOString().split("T")[0];

  let content: string;
  if (existsSync(indexPath)) {
    content = await readFile(indexPath, "utf-8");
  } else {
    content = generateEmptyIndex(today);
  }

  const category = relativePath.split("/")[0] || "other";
  const fileName = relativePath.split("/").pop() || relativePath;
  const newRow = `| ${fileName} | ${summary} | ${today} |`;

  // 檢查是否已存在該文件
  const existingRowRegex = new RegExp(`^\\|\\s*${escapeRegex(fileName)}\\s*\\|[^|]+\\|[^|]+\\|$`, "gm");

  if (existingRowRegex.test(content)) {
    content = content.replace(existingRowRegex, newRow);
  } else {
    // 在對應分類的表格末尾新增（表格 header 後）
    const sectionRegex = new RegExp(`(## ${category}/\\n\\|[^\\n]+\\n\\|[-|]+\\|)`, "g");
    if (sectionRegex.test(content)) {
      content = content.replace(sectionRegex, `$1\n${newRow}`);
    }
  }

  // 更新 frontmatter 日期
  content = content.replace(/^(updated:\s*)\d{4}-\d{2}-\d{2}/m, `$1${today}`);

  await writeFile(indexPath, content, "utf-8");
}

function generateEmptyIndex(date: string): string {
  return `---
title: Memory Index
updated: ${date}
---

# 長期記憶索引

此文件由系統自動維護。

## preferences/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## knowledge/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## events/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|
`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============ 記憶文件操作 ============

export async function getMemory(relativePath: string): Promise<MemoryFile | null> {
  const filePath = join(MEMORY_ROOT, relativePath);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(content);

  return {
    title: String(meta.title || ""),
    path: relativePath,
    summary: String(meta.summary || ""),
    updated: String(meta.updated || ""),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    content: body,
  };
}

export async function saveMemory(
  relativePath: string,
  data: {
    title: string;
    summary: string;
    content: string;
    tags?: string[];
  }
): Promise<string> {
  const filePath = join(MEMORY_ROOT, relativePath);
  const dir = dirname(filePath);

  // 確保目錄存在
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const today = new Date().toISOString().split("T")[0];
  const meta = {
    title: data.title,
    path: relativePath,
    summary: data.summary,
    updated: today,
    tags: data.tags || [],
  };

  const fileContent = generateFrontmatter(meta) + data.content;
  await writeFile(filePath, fileContent, "utf-8");

  // 更新索引
  await updateIndex(relativePath, data.summary);

  return filePath;
}

export async function searchMemory(
  keywords: string[],
  limit: number = 5
): Promise<Array<{ path: string; summary: string; score: number }>> {
  const entries = await readIndex();

  if (keywords.length === 0) {
    return entries.slice(0, limit).map((e) => ({
      path: e.path,
      summary: e.summary,
      score: 0,
    }));
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  const scored = entries.map((entry) => {
    const text = `${entry.path} ${entry.summary} ${entry.category}`.toLowerCase();
    const score = lowerKeywords.filter((k) => text.includes(k)).length;
    return { path: entry.path, summary: entry.summary, score };
  });

  return scored
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function listMemory(): Promise<MemoryIndexEntry[]> {
  return readIndex();
}

export function getMemoryRoot(): string {
  return MEMORY_ROOT;
}
```

**Step 2: Create CLI script**

```typescript
#!/usr/bin/env bun
// pai-claude/workspace/scripts/memory-cli.ts
/**
 * 長期記憶 CLI
 *
 * 用法：
 *   bun run scripts/memory-cli.ts save <path> --title "..." --summary "..." --content "..." [--tags "a,b,c"]
 *   bun run scripts/memory-cli.ts get <path>
 *   bun run scripts/memory-cli.ts search <keywords...> [--limit N]
 *   bun run scripts/memory-cli.ts list
 *   bun run scripts/memory-cli.ts init
 *
 * 範例：
 *   bun run scripts/memory-cli.ts save preferences/coding.md --title "程式偏好" --summary "TypeScript, Bun" --content "## 偏好\n- Bun"
 *   bun run scripts/memory-cli.ts get preferences/coding.md
 *   bun run scripts/memory-cli.ts search typescript bun --limit 3
 */

import {
  saveMemory,
  getMemory,
  searchMemory,
  listMemory,
  getMemoryRoot,
} from "./lib/long-term-memory";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
長期記憶 CLI

用法：
  memory-cli.ts save <path> --title "..." --summary "..." --content "..." [--tags "a,b"]
  memory-cli.ts get <path>
  memory-cli.ts search <keywords...> [--limit N]
  memory-cli.ts list
  memory-cli.ts init

範例：
  save preferences/coding.md --title "程式偏好" --summary "TS, Bun" --content "內容"
  get preferences/coding.md
  search typescript bun
  list
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      result[key] = value;
    }
  }
  return result;
}

async function main() {
  if (!command || command === "help" || command === "--help") {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case "init": {
      const root = getMemoryRoot();
      const dirs = ["preferences", "knowledge", "events"];

      for (const dir of dirs) {
        const path = join(root, dir);
        if (!existsSync(path)) {
          await mkdir(path, { recursive: true });
          console.log(`Created: ${path}`);
        }
      }

      // Create index.md if not exists
      const indexPath = join(root, "index.md");
      if (!existsSync(indexPath)) {
        const today = new Date().toISOString().split("T")[0];
        await writeFile(indexPath, `---
title: Memory Index
updated: ${today}
---

# 長期記憶索引

此文件由系統自動維護。

## preferences/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## knowledge/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|

## events/
| 檔案 | 摘要 | 更新日期 |
|------|------|----------|
`);
        console.log(`Created: ${indexPath}`);
      }

      console.log("Memory structure initialized.");
      break;
    }

    case "save": {
      const path = args[1];
      if (!path) {
        console.error("Error: path required");
        process.exit(1);
      }

      const opts = parseArgs(args.slice(2));
      if (!opts.title || !opts.summary || !opts.content) {
        console.error("Error: --title, --summary, --content required");
        process.exit(1);
      }

      const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [];
      const filePath = await saveMemory(path, {
        title: opts.title,
        summary: opts.summary,
        content: opts.content,
        tags,
      });

      console.log(JSON.stringify({ ok: true, path: filePath }));
      break;
    }

    case "get": {
      const path = args[1];
      if (!path) {
        console.error("Error: path required");
        process.exit(1);
      }

      const memory = await getMemory(path);
      if (!memory) {
        console.log(JSON.stringify({ ok: false, error: "not found" }));
        process.exit(1);
      }

      console.log(JSON.stringify({ ok: true, memory }));
      break;
    }

    case "search": {
      const keywords: string[] = [];
      let limit = 5;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--limit" && args[i + 1]) {
          limit = parseInt(args[++i], 10);
        } else if (!args[i].startsWith("--")) {
          keywords.push(args[i]);
        }
      }

      const results = await searchMemory(keywords, limit);
      console.log(JSON.stringify({ ok: true, count: results.length, results }));
      break;
    }

    case "list": {
      const entries = await listMemory();
      console.log(JSON.stringify({ ok: true, count: entries.length, entries }));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(1);
});
```

**Step 3: Test CLI**

```bash
cd pai-claude/workspace

# 初始化
bun run scripts/memory-cli.ts init

# 保存記憶
bun run scripts/memory-cli.ts save preferences/coding.md \
  --title "程式偏好" \
  --summary "TypeScript, Bun, 簡潔風格" \
  --content "## 語言\n- TypeScript strict mode\n\n## Runtime\n- Bun 優先" \
  --tags "preference,coding"

# 獲取記憶
bun run scripts/memory-cli.ts get preferences/coding.md

# 搜尋記憶
bun run scripts/memory-cli.ts search typescript bun --limit 3

# 列出所有
bun run scripts/memory-cli.ts list
```

**Step 4: Commit**

```bash
git add pai-claude/workspace/scripts/memory-cli.ts \
        pai-claude/workspace/scripts/lib/long-term-memory.ts
git commit -m "feat: add long-term memory CLI with proper format validation"
```

---

### Task 4: 更新 Stop Hook（LLM 分類 + 智慧更新長期記憶）

**目的**：使用 LLM 分類對話內容，**先搜尋現有記憶再決定新增或更新**，避免記憶碎片化。

**Files:**
- Modify: `pai-claude/workspace/scripts/lib/llm.ts`
- Modify: `pai-claude/workspace/scripts/on-stop.ts`

**Step 1: Update LLM classification prompt（新增 keywords 欄位）**

```typescript
// pai-claude/workspace/scripts/lib/llm.ts
// Replace CLASSIFY_PROMPT

const CLASSIFY_PROMPT = `分析以下 AI 助理的回應內容，進行記憶分類和提取。

回應內容：
---
{content}
---

請以 JSON 格式回覆，包含：

1. historyType: 回應的主要類型（用於 history 保存）
   - "learnings": 問題解決、bug 修復、調試經驗
   - "decisions": 架構決策、技術選型
   - "sessions": 一般對話摘要
   - "none": 太短或瑣碎

2. shortTermMemories: 中短期記憶（日常脈絡，會定期清理）
   - content: 記憶內容（簡潔）
   - category: context / temp / recent
   - importance: 1-3（3 最重要）

3. longTermMemories: 長期記憶（重要資訊，永久保存）
   - keywords: 用於搜尋相似記憶的關鍵字（3-5個）
   - category: preferences / knowledge / events
   - suggestedPath: 建議的檔案路徑（如 preferences/coding.md）
   - title: 標題
   - summary: 一句話摘要（用於索引）
   - content: 要新增/附加的 Markdown 內容
   - tags: 標籤陣列

4. summary: 回應的一句話摘要

**重要**：longTermMemories 的 content 應該是「增量」而非「完整」，
因為系統會先搜尋現有記憶，如果找到相似的會用 append 模式更新。

範例：
{
  "historyType": "learnings",
  "shortTermMemories": [
    {"content": "剛剛討論了 Bun 的效能問題", "category": "context", "importance": 2}
  ],
  "longTermMemories": [
    {
      "keywords": ["bun", "runtime", "效能"],
      "category": "preferences",
      "suggestedPath": "preferences/coding.md",
      "title": "程式偏好",
      "summary": "偏好使用 Bun 和 TypeScript",
      "content": "## Runtime 偏好\\n- 偏好 Bun 而非 Node.js\\n- 效能是主要考量",
      "tags": ["preference", "runtime"]
    }
  ],
  "summary": "討論並解決了 Bun 效能問題"
}

只返回 JSON。`;

export interface ClassifyResult {
  historyType: "sessions" | "learnings" | "decisions" | "none";
  shortTermMemories: Array<{
    content: string;
    category: string;
    importance: number;
  }>;
  longTermMemories: Array<{
    keywords: string[];
    category: string;
    suggestedPath: string;
    title: string;
    summary: string;
    content: string;
    tags: string[];
  }>;
  summary: string;
}
```

**Step 2: Update on-stop.ts（先搜尋再決定新增或更新）**

```typescript
#!/usr/bin/env bun
// pai-claude/workspace/scripts/on-stop.ts
/**
 * Stop Hook - 對話結束時整理記憶
 *
 * 流程：
 * 1. LLM 分類回應內容
 * 2. 保存 History
 * 3. 保存中短期記憶（API）
 * 4. 長期記憶：先搜尋相似記憶 → 更新或新增
 * 5. 清理超限的中短期記憶
 */

import { spawn } from "bun";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";
import { saveToHistory } from "./lib/history";
import { classifyWithLLM, type ClassifyResult } from "./lib/llm";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const SHORT_TERM_LIMIT = 100;
const SCRIPTS_DIR = import.meta.dir;
const SIMILARITY_THRESHOLD = 2; // 相似度分數閾值

interface StopEvent {
  stop_response?: string;
  session_id?: string;
}

interface SimilarResult {
  path: string;
  title: string;
  summary: string;
  score: number;
}

/**
 * 執行 memory-cli 指令
 */
async function runMemoryCli(args: string[]): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const proc = spawn({
      cmd: ["bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), ...args],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return { ok: false };
    return JSON.parse(output);
  } catch {
    return { ok: false };
  }
}

/**
 * 搜尋相似的長期記憶
 */
async function findSimilarMemory(
  keywords: string[],
  category: string
): Promise<SimilarResult | null> {
  const result = await runMemoryCli([
    "find-similar", ...keywords,
    "--category", category,
    "--limit", "1"
  ]);

  if (!result.ok) return null;

  const data = result.data as { results: SimilarResult[] };
  if (data.results.length === 0) return null;

  const best = data.results[0];
  if (best.score < SIMILARITY_THRESHOLD) return null;

  return best;
}

/**
 * 保存或更新長期記憶
 */
async function saveOrUpdateLongTermMemory(
  mem: ClassifyResult["longTermMemories"][0]
): Promise<{ action: "created" | "updated" | "failed"; path: string }> {
  // 1. 先搜尋相似記憶
  const similar = await findSimilarMemory(mem.keywords, mem.category);

  if (similar) {
    // 2a. 找到相似記憶 → 更新（append）
    const result = await runMemoryCli([
      "update", similar.path,
      "--content", mem.content,
      "--tags", mem.tags.join(","),
      "--append", "true"
    ]);

    return {
      action: result.ok ? "updated" : "failed",
      path: similar.path
    };
  } else {
    // 2b. 沒有相似記憶 → 新增
    const result = await runMemoryCli([
      "save", mem.suggestedPath,
      "--title", mem.title,
      "--summary", mem.summary,
      "--content", mem.content,
      "--tags", mem.tags.join(",")
    ]);

    return {
      action: result.ok ? "created" : "failed",
      path: mem.suggestedPath
    };
  }
}

/**
 * 保存中短期記憶（via API）
 */
async function saveShortTermMemory(
  content: string,
  category: string,
  importance: number
): Promise<boolean> {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, category, importance }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 取得記憶統計
 */
async function getMemoryStats(): Promise<{ total: number }> {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/stats`);
    if (!response.ok) return { total: 0 };
    return await response.json();
  } catch {
    return { total: 0 };
  }
}

/**
 * 清理中短期記憶
 */
async function cleanupMemory(): Promise<void> {
  await fetch(`${PAI_API_URL}/api/memory/cleanup`, { method: "POST" });
}

async function main() {
  if (!isMemoryEnabled()) return;

  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  let data: StopEvent;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const response = data.stop_response;
  if (!response || response.length < 50) return;

  // LLM 分類
  const result = await classifyWithLLM(response);

  // 1. 保存 History
  if (result.historyType !== "none" && result.summary) {
    try {
      const filePath = await saveToHistory(result.historyType, response, {
        summary: result.summary,
        session_id: data.session_id || "unknown",
      });
      console.log(`[History] Saved: ${filePath.split("/").pop()}`);
    } catch (error) {
      console.error(`[History] Failed: ${error}`);
    }
  }

  // 2. 保存中短期記憶（SQLite via API）
  for (const mem of result.shortTermMemories) {
    const saved = await saveShortTermMemory(mem.content, mem.category, mem.importance);
    if (saved) {
      console.log(`[ShortTerm] Saved: ${mem.content.slice(0, 40)}...`);
    }
  }

  // 3. 保存長期記憶（先搜尋再決定新增或更新）
  for (const mem of result.longTermMemories) {
    const { action, path } = await saveOrUpdateLongTermMemory(mem);
    if (action === "created") {
      console.log(`[LongTerm] Created: ${path}`);
    } else if (action === "updated") {
      console.log(`[LongTerm] Updated: ${path}`);
    } else {
      console.error(`[LongTerm] Failed: ${path}`);
    }
  }

  // 4. 檢查是否需要清理中短期記憶
  const stats = await getMemoryStats();
  if (stats.total > SHORT_TERM_LIMIT) {
    await cleanupMemory();
    console.log(`[Memory] Cleanup triggered (${stats.total}/${SHORT_TERM_LIMIT})`);
  }
}

main().catch(console.error);
```

**Step 3: Commit**

```bash
git add pai-claude/workspace/scripts/lib/llm.ts pai-claude/workspace/scripts/on-stop.ts
git commit -m "feat: smart long-term memory update in Stop hook (search before save)"
```

---

### Task 5: 更新 UserPromptSubmit Hook（搜尋雙層記憶）

**目的**：收到用戶 prompt 時搜尋雙層記憶，使用 CLI 腳本確保格式一致。

**Files:**
- Create: `pai-claude/workspace/scripts/on-user-prompt.ts`
- Modify: `pai-claude/workspace/.claude/settings.json`

**Step 1: Create on-user-prompt.ts（使用 CLI 搜尋長期記憶）**

```typescript
#!/usr/bin/env bun

/**
 * UserPromptSubmit Hook
 * 搜尋雙層記憶，注入相關脈絡
 *
 * 長期記憶使用 CLI 腳本確保格式正確
 */

import { spawn } from "bun";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const SCRIPTS_DIR = import.meta.dir;

interface UserPromptEvent {
  prompt: string;
}

interface ShortTermMemory {
  content: string;
  category: string;
  importance: number;
}

interface LongTermSearchResult {
  path: string;
  summary: string;
  score: number;
}

interface LongTermMemory {
  title: string;
  path: string;
  summary: string;
  content: string;
  tags: string[];
}

/**
 * 從文字提取關鍵字
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的", "是", "在", "了", "和", "與", "有", "我", "你",
    "這", "那", "什麼", "怎麼", "可以", "需要", "想要", "請",
    "幫", "看", "一下", "問題",
  ]);

  return text
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w))
    .slice(0, 8);
}

/**
 * 搜尋長期記憶（via CLI 腳本）
 */
async function searchLongTerm(keywords: string[], limit: number = 3): Promise<LongTermSearchResult[]> {
  try {
    const proc = spawn({
      cmd: [
        "bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), "search",
        ...keywords,
        "--limit", String(limit),
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return [];

    const data = JSON.parse(output);
    return data.ok ? data.results : [];
  } catch {
    return [];
  }
}

/**
 * 獲取長期記憶內容（via CLI 腳本）
 */
async function getLongTermMemory(path: string): Promise<LongTermMemory | null> {
  try {
    const proc = spawn({
      cmd: ["bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), "get", path],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return null;

    const data = JSON.parse(output);
    return data.ok ? data.memory : null;
  } catch {
    return null;
  }
}

/**
 * 搜尋中短期記憶（via API）
 */
async function searchShortTerm(keywords: string[]): Promise<ShortTermMemory[]> {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, limit: 5 }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.memories || [];
  } catch {
    return [];
  }
}

async function main() {
  if (!isMemoryEnabled()) return;

  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  let data: UserPromptEvent;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const prompt = data.prompt;
  if (!prompt || prompt.length < 5) return;

  const keywords = extractKeywords(prompt);
  const output: string[] = [];

  // 1. 搜尋長期記憶（文件 via CLI）
  const longTermResults = await searchLongTerm(keywords, 3);
  if (longTermResults.length > 0) {
    output.push("[Long-term Memory]");
    for (const result of longTermResults) {
      output.push(`- ${result.path}: ${result.summary}`);

      // 如果高度相關（score >= 2），讀取完整內容
      if (result.score >= 2) {
        const memory = await getLongTermMemory(result.path);
        if (memory && memory.content.length < 500) {
          output.push(`  ${memory.content.replace(/\n/g, "\n  ")}`);
        }
      }
    }
    output.push("");
  }

  // 2. 搜尋中短期記憶（SQLite via API）
  const shortTermResults = await searchShortTerm(keywords);
  if (shortTermResults.length > 0) {
    output.push("[Recent Context]");
    for (const mem of shortTermResults) {
      const stars = "★".repeat(mem.importance);
      output.push(`- ${mem.content} ${stars}`);
    }
  }

  if (output.length > 0) {
    console.log(output.join("\n"));
  }
}

main().catch(console.error);
```

**Step 2: Update settings.json**

```json
{
  "hooks": {
    "SessionStart": [...],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run --silent scripts/on-user-prompt.ts"
          }
        ]
      }
    ],
    "Stop": [...],
    ...
  }
}
```

**Step 3: Commit**

```bash
git add pai-claude/workspace/scripts/on-user-prompt.ts \
        pai-claude/workspace/.claude/settings.json
git commit -m "feat: UserPromptSubmit hook with dual-layer memory search"
```

---

### Task 6: 簡化 SessionStart

**目的**：SessionStart 僅顯示記憶統計，具體記憶由 UserPromptSubmit 注入。使用 CLI 腳本獲取長期記憶數量。

**Files:**
- Modify: `pai-claude/workspace/scripts/on-session-start.ts`

**Step 1: Update to show stats only（使用 CLI 統計長期記憶）**

```typescript
#!/usr/bin/env bun
// pai-claude/workspace/scripts/on-session-start.ts

import { spawn } from "bun";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const SCRIPTS_DIR = import.meta.dir;
const SHORT_TERM_LIMIT = 100;

/**
 * 取得中短期記憶統計（via API）
 */
async function getShortTermStats(): Promise<{ total: number }> {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/stats`);
    if (!response.ok) return { total: 0 };
    return await response.json();
  } catch {
    return { total: 0 };
  }
}

/**
 * 取得長期記憶數量（via CLI）
 */
async function getLongTermCount(): Promise<number> {
  try {
    const proc = spawn({
      cmd: ["bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), "list"],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return 0;

    const data = JSON.parse(output);
    return data.ok ? data.count : 0;
  } catch {
    return 0;
  }
}

async function main() {
  // 顯示 session 資訊
  const now = new Date();
  const timeStr = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  console.log(`[Session] ${timeStr}`);

  // 記憶統計（具體記憶由 UserPromptSubmit 注入）
  if (isMemoryEnabled()) {
    const [shortTermStats, longTermCount] = await Promise.all([
      getShortTermStats(),
      getLongTermCount(),
    ]);

    console.log(`[Memory] Short-term: ${shortTermStats.total}/${SHORT_TERM_LIMIT} | Long-term: ${longTermCount} files`);
  }
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add pai-claude/workspace/scripts/on-session-start.ts
git commit -m "refactor: simplify SessionStart to show memory stats via CLI"
```

---

## 驗證清單

- [ ] 長期記憶文件結構建立
- [ ] pai-bot `/api/memory/save` 帶上限檢查
- [ ] pai-bot `/api/memory/search` 關鍵字搜尋
- [ ] pai-bot `/api/memory/cleanup` 清理舊記憶
- [ ] `on-stop.ts` LLM 分類 → 雙層保存
- [ ] `on-user-prompt.ts` 雙層搜尋 → 注入
- [ ] `on-session-start.ts` 顯示統計

---

## 流程圖

```
┌─────────────────┐
│  SessionStart   │
│  (統計顯示)      │
│  Short: 45/100  │
│  Long: 12 files │
└────────┬────────┘
         ↓
┌─────────────────┐      ┌─────────────────┐
│ UserPromptSubmit│      │ 搜尋雙層記憶     │
│  (收到 prompt)  │ ───→ │ 1. 長期（文件）  │
│                 │      │ 2. 中短期（SQL） │
└────────┬────────┘      └────────┬────────┘
         ↓                        ↓
┌─────────────────┐      ┌─────────────────┐
│ Claude 對話     │ ←─── │ 相關記憶注入    │
└────────┬────────┘      └─────────────────┘
         ↓
┌─────────────────┐      ┌─────────────────┐
│     Stop        │      │ LLM 分類        │
│  (回應分析)     │ ───→ │ ├─ 中短期 → SQL │
│                 │      │ └─ 長期 → 文件  │
└─────────────────┘      └─────────────────┘
```

---

## 成本分析

| 操作 | 成本 |
|------|------|
| UserPromptSubmit 搜尋 | 免費（SQLite + 文件讀取）|
| Stop LLM 分類 | ~$0.002/次（Gemini Flash）|
| 整合 | ~$0.001/次（僅超閾值時）|

**預期每日成本**：~$0.01-0.03（取決於對話次數）
