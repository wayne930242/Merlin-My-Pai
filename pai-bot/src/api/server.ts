/**
 * HTTP API Server
 * 提供 MCP server 呼叫的 API endpoints
 */

import { logger } from "../utils/logger";

interface PermissionRequest {
  action: string;
  reason: string;
  command?: string;
  resolve: (result: { approved: boolean; reason?: string }) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// 待處理的權限請求（userId -> request）
const pendingPermissions = new Map<number, PermissionRequest>();

// Telegram bot 實例（稍後注入）
let telegramBot: { sendMessage: (userId: number, text: string) => Promise<void> } | null = null;

// 允許的用戶 ID（從 config 取得）
let allowedUserIds: number[] = [];

const PERMISSION_TIMEOUT = 5 * 60 * 1000; // 5 分鐘

export function setTelegramBot(bot: typeof telegramBot, userIds: number[]) {
  telegramBot = bot;
  allowedUserIds = userIds;
}

/**
 * 處理用戶的授權回應
 */
export function handlePermissionResponse(userId: number, approved: boolean, reason?: string): boolean {
  const pending = pendingPermissions.get(userId);
  if (!pending) return false;

  clearTimeout(pending.timeout);
  pendingPermissions.delete(userId);
  pending.resolve({ approved, reason });
  return true;
}

/**
 * 檢查用戶是否有待處理的權限請求
 */
export function hasPendingPermission(userId: number): boolean {
  return pendingPermissions.has(userId);
}

/**
 * 啟動 HTTP API server
 */
export function startApiServer(port = 3000) {
  const server = Bun.serve({
    port,
    routes: {
      "/api/permission": {
        POST: async (req) => {
          try {
            const body = await req.json();
            const { action, reason, command } = body;

            if (!action || !reason) {
              return Response.json(
                { error: "Missing action or reason" },
                { status: 400 }
              );
            }

            if (!telegramBot || allowedUserIds.length === 0) {
              return Response.json(
                { error: "Telegram bot not configured" },
                { status: 500 }
              );
            }

            // 目前只支援單一用戶
            const userId = allowedUserIds[0];

            // 發送權限請求到 Telegram
            const message =
              `🔐 *權限請求*\n\n` +
              `*操作*: ${action}\n` +
              `*原因*: ${reason}` +
              (command ? `\n*指令*: \`${command}\`` : "") +
              `\n\n回覆「是」或「OK」授權，「不」拒絕`;

            await telegramBot.sendMessage(userId, message);

            // 等待用戶回應
            const result = await new Promise<{ approved: boolean; reason?: string }>(
              (resolve) => {
                const timeout = setTimeout(() => {
                  pendingPermissions.delete(userId);
                  resolve({ approved: false, reason: "請求超時" });
                }, PERMISSION_TIMEOUT);

                pendingPermissions.set(userId, {
                  action,
                  reason,
                  command,
                  resolve,
                  timeout,
                });
              }
            );

            return Response.json(result);
          } catch (error) {
            logger.error({ error }, "Permission API error");
            return Response.json(
              { error: "Internal server error" },
              { status: 500 }
            );
          }
        },
      },

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
