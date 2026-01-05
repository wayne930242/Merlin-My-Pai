/**
 * Notify MCP Tools
 * 透過 session 發送通知給用戶
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { emitEvent } from "../../events";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3000";

export function registerNotifyTools(server: McpServer): void {
  server.registerTool(
    "notify_user",
    {
      title: "Notify User",
      description: "透過 session ID 發送通知給用戶（Telegram 或 Discord）",
      inputSchema: {
        sessionId: z.number().describe("Session ID（來自對話）"),
        message: z.string().describe("要發送的訊息內容"),
      },
    },
    async ({ sessionId, message }) => {
      try {
        const response = await fetch(`${API_BASE}/api/notify/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            content: [{ type: "text", text: `發送失敗: ${data.error}` }],
            isError: true,
          };
        }

        // 廣播通知事件到 web
        emitEvent("notify:message", {
          sessionId,
          platform: data.platform,
          message,
        });

        return {
          content: [{ type: "text", text: `已發送通知至 ${data.platform}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `發送失敗: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_sessions",
    {
      title: "List Sessions",
      description: "列出所有可用的 sessions（用於選擇通知目標）",
      inputSchema: {
        platform: z.enum(["telegram", "discord", "all"]).optional().describe("篩選平台"),
      },
    },
    async ({ platform }) => {
      try {
        const url =
          platform && platform !== "all"
            ? `${API_BASE}/api/sessions?platform=${platform}`
            : `${API_BASE}/api/sessions`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          return {
            content: [{ type: "text", text: `查詢失敗: ${data.error}` }],
            isError: true,
          };
        }

        const sessions = data.sessions as Array<{
          session_id: number;
          platform: string;
          platform_user_id: string | null;
          chat_id: string | null;
          channel_id: string | null;
          session_type: string;
          updated_at: string;
        }>;

        if (sessions.length === 0) {
          return {
            content: [{ type: "text", text: "沒有找到任何 session" }],
          };
        }

        const lines = sessions.map((s) => {
          const id = `[${s.session_id}]`;
          const platform = s.platform.toUpperCase();
          const type = s.session_type;
          const target =
            s.platform === "telegram" ? `chat:${s.chat_id}` : `channel:${s.channel_id}`;
          return `${id} ${platform}/${type} - ${target}`;
        });

        return {
          content: [{ type: "text", text: `Sessions:\n${lines.join("\n")}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `查詢失敗: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_session",
    {
      title: "Get Session",
      description: "取得特定 session 的詳細資訊",
      inputSchema: {
        sessionId: z.number().describe("Session ID"),
      },
    },
    async ({ sessionId }) => {
      try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          return {
            content: [{ type: "text", text: `查詢失敗: ${data.error}` }],
            isError: true,
          };
        }

        const session = data.session;
        const info = [
          `Session ID: ${session.session_id}`,
          `Platform: ${session.platform}`,
          `Type: ${session.session_type}`,
          `Platform User ID: ${session.platform_user_id || "N/A"}`,
          `Chat ID: ${session.chat_id || "N/A"}`,
          `Channel ID: ${session.channel_id || "N/A"}`,
          `Guild ID: ${session.guild_id || "N/A"}`,
          `Updated: ${session.updated_at}`,
        ];

        return {
          content: [{ type: "text", text: info.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `查詢失敗: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
