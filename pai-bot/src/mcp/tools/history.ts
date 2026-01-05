import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

// History 目錄路徑（VPS 上的 Merlin workspace）
const HISTORY_ROOT = process.env.HISTORY_ROOT || join(process.env.HOME || "", "merlin", "workspace", "history");

type HistoryType = "sessions" | "learnings" | "decisions";

interface HistoryEntry {
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
async function listHistory(type: HistoryType, limit: number): Promise<HistoryEntry[]> {
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
 * 搜尋 history 內容
 */
async function searchHistory(query: string, types: HistoryType[], limit: number): Promise<HistoryEntry[]> {
  const results: HistoryEntry[] = [];
  const queryLower = query.toLowerCase();

  for (const type of types) {
    const dir = join(HISTORY_ROOT, type);

    try {
      const files = await readdir(dir);
      const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();

      for (const filename of mdFiles) {
        if (results.length >= limit) break;

        const content = await readFile(join(dir, filename), "utf-8");
        if (content.toLowerCase().includes(queryLower)) {
          const frontmatter = parseFrontmatter(content);
          results.push({
            filename,
            type,
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

export function registerHistoryTools(server: McpServer): void {
  server.registerTool(
    "history_list",
    {
      title: "List History",
      description: "列出最近的工作歷史記錄",
      inputSchema: {
        type: z
          .enum(["sessions", "learnings", "decisions", "all"])
          .optional()
          .describe("歷史類型（預設 all）"),
        limit: z.number().optional().describe("最多顯示幾條（預設 10）"),
      },
    },
    async ({ type = "all", limit = 10 }) => {
      const types: HistoryType[] =
        type === "all" ? ["sessions", "learnings", "decisions"] : [type as HistoryType];

      const allEntries: HistoryEntry[] = [];
      for (const t of types) {
        const entries = await listHistory(t, limit);
        allEntries.push(...entries);
      }

      // 按日期排序
      allEntries.sort((a, b) => b.date.localeCompare(a.date));
      const limited = allEntries.slice(0, limit);

      if (limited.length === 0) {
        return { content: [{ type: "text", text: "沒有找到歷史記錄" }] };
      }

      const lines = [`工作歷史（顯示 ${limited.length} 條）：\n`];
      for (const entry of limited) {
        const summary = entry.summary ? ` - ${entry.summary}` : "";
        lines.push(`- [${entry.type}] ${entry.filename}${summary}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "history_search",
    {
      title: "Search History",
      description: "搜尋工作歷史記錄",
      inputSchema: {
        query: z.string().describe("搜尋關鍵字"),
        type: z
          .enum(["sessions", "learnings", "decisions", "all"])
          .optional()
          .describe("限定類型（預設 all）"),
        limit: z.number().optional().describe("最多顯示幾條（預設 5）"),
      },
    },
    async ({ query, type = "all", limit = 5 }) => {
      const types: HistoryType[] =
        type === "all" ? ["sessions", "learnings", "decisions"] : [type as HistoryType];

      const results = await searchHistory(query, types, limit);

      if (results.length === 0) {
        return { content: [{ type: "text", text: `沒有找到與「${query}」相關的歷史記錄` }] };
      }

      const lines = [`與「${query}」相關的歷史記錄：\n`];
      for (const entry of results) {
        const summary = entry.summary ? ` - ${entry.summary}` : "";
        lines.push(`- [${entry.type}] ${entry.filename}${summary}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "history_read",
    {
      title: "Read History",
      description: "讀取特定歷史記錄的完整內容",
      inputSchema: {
        type: z.enum(["sessions", "learnings", "decisions"]).describe("歷史類型"),
        filename: z.string().describe("檔案名稱（從 history_list 或 history_search 取得）"),
      },
    },
    async ({ type, filename }) => {
      const filepath = join(HISTORY_ROOT, type, filename);

      try {
        const content = await readFile(filepath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch {
        return { content: [{ type: "text", text: `找不到檔案：${type}/${filename}` }] };
      }
    },
  );
}
