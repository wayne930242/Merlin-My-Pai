#!/usr/bin/env bun

/**
 * Session Stop Hook
 *
 * 功能：
 * 1. 使用 Gemini Flash 2.5 分析 Claude 回應
 * 2. 自動分類（learning / decision / session）
 * 3. 保存到對應的 history 目錄
 * 4. 提取值得記住的事實，保存到 Memory
 * 5. 智慧更新長期記憶（先搜尋再決定新增或更新）
 *
 * 參考：PAI (Personal AI Infrastructure) 的 Stop Hook 設計
 */

import { isMemoryEnabled } from "./lib/config";
import { saveToHistory } from "./lib/history";
import { classifyWithLLM, type ClassifyResult } from "./lib/llm";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const MEMORY_CLI_PATH = new URL("./memory-cli.ts", import.meta.url).pathname;
const SIMILARITY_THRESHOLD = 2;

interface StopEvent {
  stop_response?: string;
  session_id?: string;
}

/**
 * 保存記憶到 pai-bot API
 */
async function saveMemory(
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

type LongTermMemory = ClassifyResult["longTermMemories"][number];

interface MemoryCliResult {
  ok: boolean;
  output?: string;
  error?: string;
}

/**
 * 執行 memory-cli 命令
 */
async function runMemoryCli(args: string[]): Promise<MemoryCliResult> {
  try {
    const proc = Bun.spawn(["bun", MEMORY_CLI_PATH, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return {
      ok: exitCode === 0,
      output: stdout.trim(),
      error: stderr.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface SimilarMemory {
  path: string;
  score: number;
}

/**
 * 搜尋相似記憶
 */
async function findSimilarMemory(
  keywords: string[],
  category: string
): Promise<SimilarMemory | null> {
  const result = await runMemoryCli([
    "find-similar",
    ...keywords,
    "--category",
    category,
    "--limit",
    "1",
  ]);

  if (!result.ok || !result.output) {
    return null;
  }

  try {
    const data = JSON.parse(result.output);
    if (!data.ok || !data.data?.results?.length) {
      return null;
    }

    const best = data.data.results[0];
    return {
      score: best.score,
      path: best.path,
    };
  } catch {
    return null;
  }
}

/**
 * 保存或更新長期記憶
 */
async function saveOrUpdateLongTermMemory(
  mem: LongTermMemory
): Promise<{ action: "created" | "updated" | "failed"; path: string }> {
  // 1. 先搜尋相似記憶
  const similar = await findSimilarMemory(mem.keywords, mem.category);

  if (similar && similar.score >= SIMILARITY_THRESHOLD) {
    // 2a. 找到相似記憶 → 更新（append）
    const result = await runMemoryCli([
      "update",
      similar.path,
      "--content",
      mem.content,
      "--tags",
      mem.tags.join(","),
      "--append",
      "true",
    ]);
    return { action: result.ok ? "updated" : "failed", path: similar.path };
  } else {
    // 2b. 沒有相似記憶 → 新增
    const result = await runMemoryCli([
      "save",
      mem.suggestedPath,
      "--title",
      mem.title,
      "--summary",
      mem.summary,
      "--content",
      mem.content,
      "--tags",
      mem.tags.join(","),
    ]);
    return { action: result.ok ? "created" : "failed", path: mem.suggestedPath };
  }
}

async function main() {
  // 檢查 memory 功能是否啟用
  if (!isMemoryEnabled()) {
    return;
  }

  // 從 stdin 讀取事件資料
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  let data: StopEvent;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const response = data.stop_response;
  if (!response || response.length < 50) {
    // 回應太短，跳過
    return;
  }

  // 使用 LLM 分類
  const result = await classifyWithLLM(response);

  // 保存 History（如果有意義）
  if (result.historyType !== "none" && result.summary) {
    try {
      const filePath = await saveToHistory(result.historyType, response, {
        summary: result.summary,
        session_id: data.session_id || "unknown",
      });
      console.log(`[History] Saved ${result.historyType}: ${filePath.split("/").pop()}`);
    } catch (error) {
      console.error(`[History] Failed to save: ${error}`);
    }
  }

  // 保存 Memory（短期，如果有提取到）
  if (result.memories.length > 0) {
    for (const mem of result.memories) {
      const saved = await saveMemory(mem.content, mem.category, mem.importance);
      if (saved) {
        console.log(`[Memory] Saved: ${mem.content.slice(0, 50)}...`);
      }
    }
  }

  // 保存/更新 Long-term Memory（如果有提取到）
  if (result.longTermMemories.length > 0) {
    for (const mem of result.longTermMemories) {
      const { action, path } = await saveOrUpdateLongTermMemory(mem);
      if (action === "created") {
        console.log(`[LongTermMemory] Created: ${path}`);
      } else if (action === "updated") {
        console.log(`[LongTermMemory] Updated: ${path}`);
      } else {
        console.error(`[LongTermMemory] Failed: ${path}`);
      }
    }
  }
}

main().catch(console.error);
