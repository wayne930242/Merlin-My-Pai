/**
 * History utilities for REST API
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// History 目錄路徑（VPS 上的 Merlin workspace）
const HISTORY_ROOT =
  process.env.HISTORY_ROOT || join(process.env.HOME || "", "merlin", "workspace", "history");

export type HistoryType = "sessions" | "learnings" | "decisions";

export interface HistoryEntry {
  filename: string;
  type: HistoryType;
  summary?: string;
  date: string;
}

/**
 * 解析 history 檔案的 frontmatter
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(":").trim();
    }
  }
  return frontmatter;
}

/**
 * 列出指定類型的 history 檔案
 */
async function listHistoryByType(type: HistoryType, limit: number): Promise<HistoryEntry[]> {
  const dir = join(HISTORY_ROOT, type);
  const entries: HistoryEntry[] = [];

  try {
    const files = await readdir(dir);
    const mdFiles = files
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);

    for (const filename of mdFiles) {
      const content = await readFile(join(dir, filename), "utf-8");
      const frontmatter = parseFrontmatter(content);

      entries.push({
        filename,
        type,
        summary: frontmatter.summary,
        date: frontmatter.date || filename.split("_")[0],
      });
    }
  } catch {
    // 目錄不存在
  }

  return entries;
}

/**
 * 列出 history（供 REST API 使用）
 */
export async function listHistory(type: string, limit: number): Promise<HistoryEntry[]> {
  const types: HistoryType[] =
    type === "all" ? ["sessions", "learnings", "decisions"] : [type as HistoryType];

  const allEntries: HistoryEntry[] = [];
  for (const t of types) {
    const entries = await listHistoryByType(t, limit);
    allEntries.push(...entries);
  }

  // 按日期排序
  allEntries.sort((a, b) => b.date.localeCompare(a.date));
  return allEntries.slice(0, limit);
}

/**
 * 搜尋 history（供 REST API 使用）
 */
export async function searchHistory(
  query: string,
  type: string,
  limit: number,
): Promise<HistoryEntry[]> {
  const types: HistoryType[] =
    type === "all" ? ["sessions", "learnings", "decisions"] : [type as HistoryType];

  const results: HistoryEntry[] = [];
  const queryLower = query.toLowerCase();

  for (const t of types) {
    const dir = join(HISTORY_ROOT, t);

    try {
      const files = await readdir(dir);
      const mdFiles = files
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse();

      for (const filename of mdFiles) {
        if (results.length >= limit) break;

        const content = await readFile(join(dir, filename), "utf-8");
        if (content.toLowerCase().includes(queryLower)) {
          const frontmatter = parseFrontmatter(content);
          results.push({
            filename,
            type: t,
            summary: frontmatter.summary,
            date: frontmatter.date || filename.split("_")[0],
          });
        }
      }
    } catch {
      // 目錄不存在
    }
  }

  return results.slice(0, limit);
}

/**
 * 讀取 history 內容（供 REST API 使用）
 */
export async function readHistory(type: HistoryType, filename: string): Promise<string> {
  const filepath = join(HISTORY_ROOT, type, filename);

  try {
    return await readFile(filepath, "utf-8");
  } catch {
    throw new Error(`找不到檔案：${type}/${filename}`);
  }
}
