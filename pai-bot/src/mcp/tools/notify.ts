/**
 * Notify MCP Tools
 * 透過 session 發送通知給用戶
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

        // 廣播通知事件到 web（透過內部 API，因為 MCP 是獨立 process）
        await fetch(`${API_BASE}/internal/broadcast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "notify:message",
            data: { sessionId, platform: data.platform, message, timestamp: Date.now() },
          }),
        }).catch(() => {}); // 忽略錯誤

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
    "notify_image",
    {
      title: "Send Image to User",
      description: "透過 session ID 發送圖片給用戶（Telegram 或 Discord）。支援 base64 或檔案路徑",
      inputSchema: {
        sessionId: z.number().describe("Session ID（來自對話）"),
        image_path: z.string().optional().describe("圖片檔案路徑（與 image 二選一）"),
        image: z.string().optional().describe("Base64 編碼的圖片資料（與 image_path 二選一）"),
        caption: z.string().optional().describe("圖片說明文字"),
      },
    },
    async ({ sessionId, image_path, image, caption }) => {
      if (!image_path && !image) {
        return {
          content: [{ type: "text", text: "必須提供 image_path 或 image（base64）" }],
          isError: true,
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/notify/session/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, image, image_path, caption }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            content: [{ type: "text", text: `發送失敗: ${data.error}` }],
            isError: true,
          };
        }

        // Broadcast to web UI
        const imageBase64 = image || "";
        if (imageBase64 || image_path) {
          let broadcastImage = imageBase64;
          if (!broadcastImage && image_path) {
            const file = Bun.file(image_path);
            if (await file.exists()) {
              broadcastImage = Buffer.from(await file.arrayBuffer()).toString("base64");
            }
          }
          await fetch(`${API_BASE}/internal/broadcast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "notify:image",
              data: {
                sessionId,
                platform: data.platform,
                image: broadcastImage,
                caption,
                timestamp: Date.now(),
              },
            }),
          }).catch(() => {});
        }

        return {
          content: [{ type: "text", text: `圖片已發送至 ${data.platform}` }],
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
    "prompt_user",
    {
      title: "Prompt User with Options",
      description:
        "透過 session ID 發送選項按鈕給用戶，等待用戶選擇後回傳結果。支援 Telegram 和 Discord",
      inputSchema: {
        sessionId: z.number().describe("Session ID（來自對話）"),
        question: z.string().describe("要問用戶的問題"),
        options: z.array(z.string()).min(2).max(10).describe("選項列表（2-10 個）"),
        timeoutMs: z.number().optional().default(60000).describe("等待超時（毫秒），預設 60 秒"),
      },
    },
    async ({ sessionId, question, options, timeoutMs }) => {
      try {
        // Create prompt and send buttons
        const createRes = await fetch(`${API_BASE}/api/prompt/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, question, options, timeoutMs }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          return {
            content: [{ type: "text", text: `發送失敗: ${createData.error}` }],
            isError: true,
          };
        }

        const { promptId } = createData;

        // Poll for result
        const pollInterval = 1000;
        const maxAttempts = Math.ceil(timeoutMs / pollInterval);

        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, pollInterval));

          const pollRes = await fetch(`${API_BASE}/api/prompt/${promptId}/result`);
          const pollData = await pollRes.json();

          if (pollData.resolved) {
            return {
              content: [
                {
                  type: "text",
                  text: `用戶選擇了: ${pollData.selectedOption} (index: ${pollData.selectedIndex})`,
                },
              ],
            };
          }

          if (pollData.expired) {
            return {
              content: [{ type: "text", text: "用戶未在時間內回應" }],
              isError: true,
            };
          }
        }

        return {
          content: [{ type: "text", text: "等待超時，用戶未回應" }],
          isError: true,
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
