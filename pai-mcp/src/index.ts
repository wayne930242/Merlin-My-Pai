#!/usr/bin/env bun
/**
 * PAI MCP Server
 * 提供 Merlin 與 Telegram 互動的工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BOT_API_URL = process.env.PAI_BOT_API_URL || "http://localhost:3000";

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
