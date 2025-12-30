/**
 * HTTP API Server
 * 提供基本的 API endpoints
 */

import { logger } from "../utils/logger";

// Telegram bot 實例（稍後注入）
let telegramBot: {
  sendMessage: (userId: number, text: string) => Promise<void>;
} | null = null;

// 允許的用戶 ID
let allowedUserIds: number[] = [];

export function setTelegramBot(
  bot: typeof telegramBot,
  userIds: number[]
) {
  telegramBot = bot;
  allowedUserIds = userIds;
}

/**
 * 啟動 HTTP API server
 */
export function startApiServer(port = 3000) {
  const server = Bun.serve({
    port,
    routes: {
      "/api/notify": {
        POST: async (req) => {
          try {
            const body = await req.json();
            const { message, level = "info" } = body;

            if (!message) {
              return Response.json(
                { error: "Missing message" },
                { status: 400 }
              );
            }

            if (!telegramBot || allowedUserIds.length === 0) {
              return Response.json(
                { error: "Telegram bot not configured" },
                { status: 500 }
              );
            }

            const userId = allowedUserIds[0];

            const icons: Record<string, string> = {
              info: "ℹ️",
              warning: "⚠️",
              error: "❌",
              success: "✅",
            };

            const icon = icons[level] || icons.info;
            await telegramBot.sendMessage(userId, `${icon} ${message}`);

            return Response.json({ success: true });
          } catch (error) {
            logger.error({ error }, "Notify API error");
            return Response.json(
              { error: "Internal server error" },
              { status: 500 }
            );
          }
        },
      },

      "/health": {
        GET: () => Response.json({ status: "ok" }),
      },
    },
  });

  logger.info({ port }, "API server started");
  return server;
}
