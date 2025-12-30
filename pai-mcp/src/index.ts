#!/usr/bin/env bun
/**
 * PAI MCP Server
 * 提供 Merlin 與外部系統互動的工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const BOT_API_URL = process.env.PAI_BOT_API_URL || "http://localhost:3000";
const PAI_CLAUDE_ROOT = process.env.PAI_CLAUDE_ROOT || join(import.meta.dir, "../../pai-claude");

const server = new McpServer({
  name: "pai-mcp",
  version: "1.0.0",
});

/**
 * 向使用者請求執行權限
 */
server.tool(
  "request_permission",
  "向 Wei-Hung 請求執行危險操作的權限（如寫檔、執行指令、建立 repo 等）。會透過 Telegram 發送請求並等待回應。",
  {
    action: z.string().describe("要執行的操作（簡短描述）"),
    reason: z.string().describe("為什麼需要這個操作"),
    command: z.string().optional().describe("實際要執行的指令（選填）"),
  },
  async ({ action, reason, command }) => {
    try {
      const response = await fetch(`${BOT_API_URL}/api/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, command }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `無法發送權限請求：${response.statusText}`,
            },
          ],
        };
      }

      const result = await response.json();

      if (result.approved) {
        return {
          content: [
            {
              type: "text",
              text: `✅ 已授權：${action}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ 已拒絕：${action}${result.reason ? ` - ${result.reason}` : ""}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `權限請求失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 發送通知給使用者（不需要等待回應）
 */
server.tool(
  "notify_user",
  "發送通知訊息給 Wei-Hung（透過 Telegram），不需要等待回應。",
  {
    message: z.string().describe("通知內容"),
    level: z
      .enum(["info", "warning", "error", "success"])
      .optional()
      .describe("通知級別"),
  },
  async ({ message, level = "info" }) => {
    try {
      const response = await fetch(`${BOT_API_URL}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, level }),
      });

      if (!response.ok) {
        return {
          content: [{ type: "text", text: `通知發送失敗：${response.statusText}` }],
        };
      }

      return {
        content: [{ type: "text", text: "通知已發送" }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `通知發送失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 讀取歷史記錄
 */
server.tool(
  "get_history",
  "讀取 PAI 歷史記錄（sessions, learnings, research, decisions）",
  {
    type: z
      .enum(["sessions", "learnings", "research", "decisions"])
      .describe("歷史記錄類型"),
    limit: z.number().optional().describe("返回數量限制（預設 10）"),
  },
  async ({ type, limit = 10 }) => {
    try {
      const historyDir = join(PAI_CLAUDE_ROOT, "history", type);
      const files = await readdir(historyDir);
      const mdFiles = files
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, limit);

      if (mdFiles.length === 0) {
        return {
          content: [{ type: "text", text: `No ${type} found.` }],
        };
      }

      const results: string[] = [];
      for (const file of mdFiles) {
        const content = await readFile(join(historyDir, file), "utf-8");
        results.push(`## ${file}\n\n${content}\n---\n`);
      }

      return {
        content: [{ type: "text", text: results.join("\n") }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `無法讀取 ${type}：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 保存學習成果
 */
server.tool(
  "save_learning",
  "保存一個學習成果到 history/learnings/",
  {
    category: z.string().describe("分類（如 typescript, infrastructure, debugging）"),
    title: z.string().describe("標題"),
    content: z.string().describe("學習內容（Markdown 格式）"),
  },
  async ({ category, title, content }) => {
    try {
      const categoryDir = join(PAI_CLAUDE_ROOT, "history", "learnings", category);
      await mkdir(categoryDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
      const filename = `${date}-${slug}.md`;
      const filepath = join(categoryDir, filename);

      const fullContent = `# ${title}

Date: ${date}
Category: ${category}

${content}
`;

      await writeFile(filepath, fullContent, "utf-8");

      return {
        content: [{ type: "text", text: `✅ 已保存：learnings/${category}/${filename}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `保存失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 保存 Session 摘要
 */
server.tool(
  "save_session",
  "保存當前 Session 的摘要到 history/sessions/",
  {
    topic: z.string().describe("Session 主題"),
    summary: z.string().describe("摘要（1-3 句）"),
    keyActions: z.array(z.string()).describe("關鍵動作列表"),
    learnings: z.array(z.string()).optional().describe("學習成果列表"),
    followUps: z.array(z.string()).optional().describe("後續待辦事項"),
    durationMinutes: z.number().optional().describe("Session 時長（分鐘）"),
  },
  async ({ topic, summary, keyActions, learnings = [], followUps = [], durationMinutes }) => {
    try {
      const sessionsDir = join(PAI_CLAUDE_ROOT, "history", "sessions");
      await mkdir(sessionsDir, { recursive: true });

      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const time = now.toTimeString().split(" ")[0].replace(/:/g, "");
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      const filename = `${date}-${time}-${slug}.md`;
      const filepath = join(sessionsDir, filename);

      const content = `# Session: ${topic}

Date: ${date}
Duration: ${durationMinutes ? `${durationMinutes} minutes` : "unknown"}

## Summary

${summary}

## Key Actions

${keyActions.map((a) => `- ${a}`).join("\n")}

## Learnings

${learnings.length > 0 ? learnings.map((l) => `- ${l}`).join("\n") : "- (none)"}

## Follow-ups

${followUps.length > 0 ? followUps.map((f) => `- [ ] ${f}`).join("\n") : "- [ ] (none)"}
`;

      await writeFile(filepath, content, "utf-8");

      return {
        content: [{ type: "text", text: `✅ Session 已保存：sessions/${filename}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `保存失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 保存決策記錄
 */
server.tool(
  "save_decision",
  "保存一個重要決策到 history/decisions/",
  {
    title: z.string().describe("決策標題"),
    context: z.string().describe("背景說明"),
    options: z.array(z.object({
      name: z.string(),
      prosAndCons: z.string(),
    })).describe("考慮的選項"),
    decision: z.string().describe("最終決策"),
    rationale: z.string().describe("決策理由"),
  },
  async ({ title, context, options, decision, rationale }) => {
    try {
      const decisionsDir = join(PAI_CLAUDE_ROOT, "history", "decisions");
      await mkdir(decisionsDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
      const filename = `${date}-${slug}.md`;
      const filepath = join(decisionsDir, filename);

      const content = `# Decision: ${title}

Date: ${date}

## Context

${context}

## Options Considered

${options.map((o, i) => `${i + 1}. **${o.name}** - ${o.prosAndCons}`).join("\n")}

## Decision

${decision}

## Rationale

${rationale}
`;

      await writeFile(filepath, content, "utf-8");

      return {
        content: [{ type: "text", text: `✅ 決策已保存：decisions/${filename}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `保存失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 列出 Fabric patterns
 */
server.tool(
  "fabric_list_patterns",
  "列出所有可用的 Fabric patterns（可搜尋）",
  {
    search: z.string().optional().describe("搜尋關鍵字（選填）"),
  },
  async ({ search }) => {
    try {
      const proc = Bun.spawn(["fabric-ai", "-l"], { stdout: "pipe" });
      const output = await new Response(proc.stdout).text();
      const patterns = output.trim().split("\n").filter(Boolean);

      let filtered = patterns;
      if (search) {
        const keyword = search.toLowerCase();
        filtered = patterns.filter((p) => p.toLowerCase().includes(keyword));
      }

      return {
        content: [
          {
            type: "text",
            text: `可用 patterns (${filtered.length}):\n${filtered.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `無法列出 patterns：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 執行 Fabric pattern
 */
server.tool(
  "fabric_run",
  "執行 Fabric pattern 處理文字內容",
  {
    pattern: z.string().describe("Pattern 名稱（如 summarize, extract_wisdom）"),
    input: z.string().describe("要處理的內容"),
  },
  async ({ pattern, input }) => {
    try {
      const proc = Bun.spawn(["fabric-ai", "-p", pattern], {
        stdin: new Response(input),
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(stderr || "Pattern 執行失敗");
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `執行失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

/**
 * 從 YouTube 提取內容
 */
server.tool(
  "fabric_youtube",
  "用 Fabric 處理 YouTube 影片（提取字幕並套用 pattern）",
  {
    url: z.string().describe("YouTube 影片網址"),
    pattern: z
      .string()
      .default("extract_wisdom")
      .describe("Pattern 名稱（預設 extract_wisdom）"),
  },
  async ({ url, pattern }) => {
    try {
      const proc = Bun.spawn(["fabric-ai", "-y", url, "-p", pattern], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(stderr || "YouTube 處理失敗");
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `執行失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          },
        ],
      };
    }
  }
);

// 啟動 server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PAI MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
