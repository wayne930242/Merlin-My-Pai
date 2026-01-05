#!/usr/bin/env bun

/**
 * Session Stop Hook
 *
 * 功能：
 * 1. 使用 Gemini Flash 2.5 分析 Claude 回應
 * 2. 自動分類（learning / decision / session）
 * 3. 保存到對應的 history 目錄
 * 4. 提取值得記住的事實，保存到 Memory
 *
 * 參考：PAI (Personal AI Infrastructure) 的 Stop Hook 設計
 */

import { saveToHistory } from "./lib/history";
import { classifyWithLLM } from "./lib/llm";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";

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

async function main() {
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

  // 保存 Memory（如果有提取到）
  if (result.memories.length > 0) {
    for (const mem of result.memories) {
      const saved = await saveMemory(mem.content, mem.category, mem.importance);
      if (saved) {
        console.log(`[Memory] Saved: ${mem.content.slice(0, 50)}...`);
      }
    }
  }
}

main().catch(console.error);
