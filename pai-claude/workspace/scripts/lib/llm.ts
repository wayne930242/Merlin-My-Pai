/**
 * LLM 工具 - 使用 Gemini Flash 2.5 進行分類
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface ClassifyResult {
  historyType: "sessions" | "learnings" | "decisions" | "none";
  memories: Array<{
    content: string;
    category: string;
    importance: number;
  }>;
  longTermMemories: Array<{
    keywords: string[];
    category: "preferences" | "knowledge" | "events";
    suggestedPath: string;
    title: string;
    summary: string;
    content: string;
    tags: string[];
  }>;
  summary: string;
}

const CLASSIFY_PROMPT = `分析以下 AI 助理的回應內容，進行分類和提取。

回應內容：
---
{content}
---

請以 JSON 格式回覆，包含：

1. historyType: 回應的主要類型
   - "learnings": 包含問題解決、bug 修復、錯誤排查、調試經驗
   - "decisions": 包含架構決策、技術選型、設計方案、重構計畫
   - "sessions": 一般對話摘要（有實質內容但不屬於上述兩類）
   - "none": 太短、太瑣碎、或純粹是確認訊息

2. memories: 值得長期記住的事實（關於用戶的偏好、習慣、重要資訊）
   - content: 事實描述（簡潔）
   - category: preference / personal / work / event / general
   - importance: 1-5（5 最重要）
   - 如果沒有值得記住的，返回空陣列 []

3. longTermMemories: 值得保存到長期記憶庫的知識（用於搜尋和更新）
   - keywords: 用於搜尋相似記憶的關鍵字陣列（3-5 個）
   - category: preferences / knowledge / events
   - suggestedPath: 建議的檔案路徑（如 preferences/coding-style 或 knowledge/typescript-tips）
   - title: 記憶標題
   - summary: 一句話摘要
   - content: 增量內容（新學到或需要補充的部分）
   - tags: 標籤陣列
   - 如果沒有值得保存的，返回空陣列 []

4. summary: 回應的一句話摘要（用於 history 標題）

只返回 JSON，不要其他文字。範例格式：
{
  "historyType": "learnings",
  "memories": [
    {"content": "偏好使用 Bun 而非 Node.js", "category": "preference", "importance": 4}
  ],
  "longTermMemories": [
    {
      "keywords": ["bun", "runtime", "nodejs"],
      "category": "preferences",
      "suggestedPath": "preferences/runtime-choice",
      "title": "Runtime 偏好",
      "summary": "偏好使用 Bun 作為主要 runtime",
      "content": "- 偏好 Bun 而非 Node.js\\n- 原因：更快、內建 TypeScript 支援",
      "tags": ["bun", "nodejs", "runtime"]
    }
  ],
  "summary": "解決了 TypeScript 編譯錯誤"
}`;

/**
 * 使用 Gemini 分類回應
 */
export async function classifyWithLLM(content: string): Promise<ClassifyResult> {
  if (!GEMINI_API_KEY) {
    console.error("[LLM] GEMINI_API_KEY not set, using fallback");
    return {
      historyType: "none",
      memories: [],
      longTermMemories: [],
      summary: "",
    };
  }

  // 截斷過長的內容
  const truncated = content.length > 4000 ? content.slice(0, 4000) + "..." : content;
  const prompt = CLASSIFY_PROMPT.replace("{content}", truncated);

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 512,
        temperature: 0.1,
      },
    });

    const text = response.text?.trim() || "";

    // 嘗試解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[LLM] Failed to extract JSON from response");
      return { historyType: "none", memories: [], longTermMemories: [], summary: "" };
    }

    const result = JSON.parse(jsonMatch[0]) as ClassifyResult;

    // 驗證結構
    if (!["sessions", "learnings", "decisions", "none"].includes(result.historyType)) {
      result.historyType = "none";
    }
    if (!Array.isArray(result.memories)) {
      result.memories = [];
    }
    if (!Array.isArray(result.longTermMemories)) {
      result.longTermMemories = [];
    }
    if (typeof result.summary !== "string") {
      result.summary = "";
    }

    return result;
  } catch (error) {
    console.error("[LLM] Classification failed:", error);
    return { historyType: "none", memories: [], longTermMemories: [], summary: "" };
  }
}
