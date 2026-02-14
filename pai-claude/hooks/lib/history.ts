/**
 * History 工具 - 自動分類和保存工作脈絡
 *
 * 分類規則：
 * - sessions: 一般對話摘要
 * - learnings: 問題解決紀錄（包含 "問題"、"解決"、"根本原因" 等關鍵字）
 * - decisions: 架構決策（包含 "決定"、"選擇"、"架構" 等關鍵字）
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getHistoryRoot } from "./paths";

const HISTORY_ROOT = getHistoryRoot();

export type HistoryType = "sessions" | "learnings" | "decisions";

interface ClassifyResult {
  type: HistoryType;
  confidence: number;
}

/**
 * 分析回應內容，判斷類型
 */
export function classifyResponse(content: string): ClassifyResult {
  const lower = content.toLowerCase();

  // 學習紀錄關鍵字
  const learningKeywords = [
    "問題", "解決", "根本原因", "修復", "bug", "error", "fix",
    "原來是", "發現", "排查", "調試", "debug", "issue"
  ];

  // 決策紀錄關鍵字
  const decisionKeywords = [
    "決定", "選擇", "架構", "設計", "方案", "取捨", "trade-off",
    "採用", "改用", "遷移", "重構", "refactor"
  ];

  const learningScore = learningKeywords.filter(k => lower.includes(k)).length;
  const decisionScore = decisionKeywords.filter(k => lower.includes(k)).length;

  if (learningScore >= 2) {
    return { type: "learnings", confidence: Math.min(learningScore / 4, 1) };
  }

  if (decisionScore >= 2) {
    return { type: "decisions", confidence: Math.min(decisionScore / 4, 1) };
  }

  return { type: "sessions", confidence: 0.5 };
}

/**
 * 生成 Markdown 檔名
 */
function generateFileName(type: HistoryType): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "");
  return `${date}-${time}-${type.slice(0, -1)}.md`;
}

/**
 * 生成 Markdown 內容
 */
function generateMarkdown(
  type: HistoryType,
  content: string,
  metadata?: Record<string, string>
): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];

  const lines = ["---"];

  // YAML frontmatter
  lines.push(`date: ${date}`);
  lines.push(`type: ${type}`);
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---\n");

  // 根據類型添加標題
  switch (type) {
    case "learnings":
      lines.push("# Learning\n");
      break;
    case "decisions":
      lines.push("# Decision\n");
      break;
    default:
      lines.push("# Session Summary\n");
  }

  // 添加內容
  lines.push(content);

  return lines.join("\n");
}

/**
 * 保存到 history 目錄
 */
export async function saveToHistory(
  type: HistoryType,
  content: string,
  metadata?: Record<string, string>
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const dir = join(HISTORY_ROOT, type, yearMonth);
  await mkdir(dir, { recursive: true });

  const fileName = generateFileName(type);
  const filePath = join(dir, fileName);
  const markdown = generateMarkdown(type, content, metadata);

  await writeFile(filePath, markdown, "utf-8");

  return filePath;
}

/**
 * 從回應中提取摘要（取前 500 字元）
 */
export function extractSummary(content: string, maxLength: number = 500): string {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, maxLength) + "...";
}
