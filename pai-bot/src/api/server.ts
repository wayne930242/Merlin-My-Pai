/**
 * HTTP API Server
 * 提供 REST API + WebSocket endpoints
 */

import type { Client as DiscordClient, TextChannel } from "discord.js";
import type { ServerWebSocket } from "bun";
import { memoryManager } from "../memory";
import * as google from "../services/google";
import { type Session, sessionService } from "../storage/sessions";
import { logger } from "../utils/logger";
import { config } from "../config";
import {
  type WsClientData,
  handleOpen,
  handleMessage,
  handleClose,
  initEventBroadcast,
} from "./websocket";

/**
 * 驗證 API Key
 */
function validateApiKey(req: Request): boolean {
  // 如果沒有設定 API Key，允許所有請求（開發模式）
  if (!config.api.key) {
    return true;
  }

  // 從 query param 或 header 取得 API Key
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  const headerKey = req.headers.get("Authorization")?.replace("Bearer ", "");

  return queryKey === config.api.key || headerKey === config.api.key;
}

// Telegram bot 實例（稍後注入）
let telegramBot: {
  sendMessage: (userId: number, text: string) => Promise<void>;
} | null = null;

// Discord client 實例（稍後注入）
let discordClient: DiscordClient | null = null;

// 允許的用戶 ID
let allowedUserIds: number[] = [];

export function setTelegramBot(bot: typeof telegramBot, userIds: number[]) {
  telegramBot = bot;
  allowedUserIds = userIds;
}

export function setDiscordClient(client: DiscordClient) {
  discordClient = client;
}

/**
 * 透過 session 發送通知
 */
async function notifyBySession(
  session: Session,
  message: string
): Promise<void> {
  if (session.platform === "telegram") {
    if (!telegramBot || !session.chat_id) {
      throw new Error("Telegram bot not configured or missing chat_id");
    }
    await telegramBot.sendMessage(parseInt(session.chat_id, 10), message);
  } else if (session.platform === "discord") {
    if (!discordClient || !session.channel_id) {
      throw new Error("Discord client not configured or missing channel_id");
    }
    const channel = await discordClient.channels.fetch(session.channel_id);
    if (!channel || !channel.isTextBased()) {
      throw new Error("Discord channel not found or not text-based");
    }
    await (channel as TextChannel).send(message);
  }
}

/**
 * 啟動 HTTP API server（含 WebSocket）
 */
export function startApiServer(port = 3000) {
  // 初始化事件廣播
  initEventBroadcast();

  const server = Bun.serve<WsClientData>({
    port,
    hostname: "0.0.0.0", // 監聽所有介面（透過 Cloudflare 保護）
    async fetch(req, server) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      try {
        // WebSocket 升級
        if (path === "/ws") {
          // 驗證 API Key
          if (!validateApiKey(req)) {
            return new Response("Unauthorized", { status: 401 });
          }

          const clientId = crypto.randomUUID();
          const upgraded = server.upgrade(req, {
            data: {
              id: clientId,
              subscribedChannels: new Set<string>(),
              connectedAt: Date.now(),
            },
          });
          if (upgraded) {
            return undefined;
          }
          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // CORS headers
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Preflight
        if (method === "OPTIONS") {
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Health check
        if (path === "/health" && method === "GET") {
          return Response.json({ status: "ok" }, { headers: corsHeaders });
        }

        // Notify API - sends to HQ session (fallback to allowedUserIds[0])
        if (path === "/api/notify" && method === "POST") {
          const body = await req.json();
          const { message, level = "info" } = body;

          if (!message) {
            return Response.json({ error: "Missing message" }, { status: 400 });
          }

          const icons: Record<string, string> = {
            info: "ℹ️",
            warning: "⚠️",
            error: "❌",
            success: "✅",
          };
          const icon = icons[level] || icons.info;
          const formattedMessage = `${icon} ${message}`;

          // Try HQ session first
          const hqSession = sessionService.getHQ();
          if (hqSession) {
            try {
              await notifyBySession(hqSession, formattedMessage);
              return Response.json({
                success: true,
                target: "hq",
                platform: hqSession.platform,
              });
            } catch (error) {
              logger.warn(
                { error },
                "Failed to notify HQ, falling back to default"
              );
            }
          }

          // Fallback to allowedUserIds[0]
          if (!telegramBot || allowedUserIds.length === 0) {
            return Response.json(
              { error: "No HQ configured and Telegram bot not available" },
              { status: 500 }
            );
          }

          await telegramBot.sendMessage(allowedUserIds[0], formattedMessage);
          return Response.json({ success: true, target: "fallback" });
        }

        // Session-based notify API
        if (path === "/api/notify/session" && method === "POST") {
          const body = await req.json();
          const { sessionId, message }: { sessionId: number; message: string } =
            body;

          if (!sessionId || !message) {
            return Response.json(
              { error: "Missing sessionId or message" },
              { status: 400 }
            );
          }

          const session = sessionService.get(sessionId);
          if (!session) {
            return Response.json(
              { error: "Session not found" },
              { status: 404 }
            );
          }

          await notifyBySession(session, message);
          return Response.json({ success: true, platform: session.platform });
        }

        // List sessions API
        if (path === "/api/sessions" && method === "GET") {
          const platform = url.searchParams.get("platform");
          const sessions = platform
            ? sessionService.getByPlatform(platform as "telegram" | "discord")
            : sessionService.getAll();
          return Response.json({ sessions });
        }

        // Get session API
        if (path.startsWith("/api/sessions/") && method === "GET") {
          const id = parseInt(path.split("/").pop()!, 10);
          if (Number.isNaN(id)) {
            return Response.json(
              { error: "Invalid session ID" },
              { status: 400 }
            );
          }
          const session = sessionService.get(id);
          if (!session) {
            return Response.json(
              { error: "Session not found" },
              { status: 404 }
            );
          }
          return Response.json({ session });
        }

        // === Google APIs ===

        // Status
        if (path === "/api/google/status" && method === "GET") {
          return Response.json({ configured: google.isGoogleConfigured() });
        }

        // Calendar - list calendars
        if (path === "/api/google/calendar/list" && method === "GET") {
          const calendars = await google.calendar.listCalendars();
          return Response.json({ calendars });
        }

        // Calendar - events
        if (path === "/api/google/calendar/events") {
          if (method === "GET") {
            const calendarId = url.searchParams.get("calendarId") || "primary";
            const timeMin = url.searchParams.get("timeMin") || undefined;
            const timeMax = url.searchParams.get("timeMax") || undefined;
            const maxResults = parseInt(
              url.searchParams.get("maxResults") || "10",
              10
            );
            const q = url.searchParams.get("q") || undefined;

            const events = await google.calendar.listEvents(calendarId, {
              timeMin,
              timeMax,
              maxResults,
              q,
            });
            return Response.json({ events });
          }
          if (method === "POST") {
            const body = await req.json();
            const { event, calendarId = "primary" } = body;
            const created = await google.calendar.createEvent(
              event,
              calendarId
            );
            return Response.json({ event: created });
          }
        }

        // Drive - list files
        if (path === "/api/google/drive/files" && method === "GET") {
          const q = url.searchParams.get("q") || undefined;
          const folderId = url.searchParams.get("folderId") || undefined;
          const pageSize = parseInt(
            url.searchParams.get("pageSize") || "20",
            10
          );

          const files = await google.drive.listFiles({ q, folderId, pageSize });
          return Response.json({ files });
        }

        // Drive - search
        if (path === "/api/google/drive/search" && method === "GET") {
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json({ error: "query required" }, { status: 400 });
          }
          const files = await google.drive.searchFiles(query);
          return Response.json({ files });
        }

        // Drive - get file
        if (path.startsWith("/api/google/drive/file/") && method === "GET") {
          const id = path.split("/").pop()!;
          const content = url.searchParams.get("content") === "true";

          if (content) {
            const data = await google.drive.getFileContent(id);
            return Response.json({ content: data });
          } else {
            const file = await google.drive.getFile(id);
            return Response.json({ file });
          }
        }

        // Gmail - list messages
        if (path === "/api/google/gmail/messages" && method === "GET") {
          const q = url.searchParams.get("q") || undefined;
          const maxResults = parseInt(
            url.searchParams.get("maxResults") || "10",
            10
          );

          const messages = await google.gmail.listMessages({ q, maxResults });
          return Response.json({ messages });
        }

        // Gmail - get message
        if (path.startsWith("/api/google/gmail/message/") && method === "GET") {
          const id = path.split("/").pop()!;
          const message = await google.gmail.getMessageContent(id);
          return Response.json({ message });
        }

        // Gmail - send
        if (path === "/api/google/gmail/send" && method === "POST") {
          const body = await req.json();
          const { to, subject, body: messageBody, cc, bcc } = body;
          if (!to || !subject || !messageBody) {
            return Response.json(
              { error: "to, subject, body required" },
              { status: 400 }
            );
          }
          const result = await google.gmail.sendMessage(
            to,
            subject,
            messageBody,
            { cc, bcc }
          );
          return Response.json({ result });
        }

        // Contacts - list
        if (path === "/api/google/contacts" && method === "GET") {
          const pageSize = parseInt(
            url.searchParams.get("pageSize") || "100",
            10
          );
          const result = await google.contacts.listContacts({ pageSize });
          return Response.json(result);
        }

        // Contacts - search
        if (path === "/api/google/contacts/search" && method === "GET") {
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json({ error: "query required" }, { status: 400 });
          }
          const contacts = await google.contacts.searchContacts(query);
          return Response.json({ contacts });
        }

        // === Memory APIs ===

        // Memory - save
        if (path === "/api/memory/save" && method === "POST") {
          const body = await req.json();
          const { content, category = "general", importance = 3 } = body;

          if (!content) {
            return Response.json(
              { error: "content required" },
              { status: 400 }
            );
          }

          // 使用預設 user_id
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500 }
            );
          }

          const id = await memoryManager.save({
            userId,
            content,
            category,
            importance,
          });
          if (id === null) {
            return Response.json({ success: true, duplicate: true });
          }
          return Response.json({ success: true, id });
        }

        // Memory - list
        if (path === "/api/memory/list" && method === "GET") {
          const limit = parseInt(url.searchParams.get("limit") || "20", 10);
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500 }
            );
          }
          const memories = memoryManager.getRecent(userId, limit);
          return Response.json({ memories });
        }

        // Memory - search
        if (path === "/api/memory/search" && method === "GET") {
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json({ error: "query required" }, { status: 400 });
          }
          const limit = parseInt(url.searchParams.get("limit") || "5", 10);
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500 }
            );
          }
          const memories = memoryManager.search(userId, query, limit);
          return Response.json({ memories });
        }

        // History - list
        if (path === "/api/history/list" && method === "GET") {
          const { listHistory } = await import("../mcp/tools/history-utils");
          const type = url.searchParams.get("type") || "all";
          const limit = parseInt(url.searchParams.get("limit") || "20", 10);
          const items = await listHistory(type as any, limit);
          return Response.json({ items }, { headers: corsHeaders });
        }

        // History - search
        if (path === "/api/history/search" && method === "GET") {
          const { searchHistory } = await import("../mcp/tools/history-utils");
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json({ error: "query required" }, { status: 400 });
          }
          const type = url.searchParams.get("type") || "all";
          const limit = parseInt(url.searchParams.get("limit") || "10", 10);
          const items = await searchHistory(query, type as any, limit);
          return Response.json({ items }, { headers: corsHeaders });
        }

        // History - read
        if (path.startsWith("/api/history/read/") && method === "GET") {
          const { readHistory } = await import("../mcp/tools/history-utils");
          const parts = path.split("/");
          const type = parts[4];
          const filename = parts.slice(5).join("/");
          if (!type || !filename) {
            return Response.json({ error: "type and filename required" }, { status: 400 });
          }
          const content = await readHistory(type as any, filename);
          return Response.json({ content }, { headers: corsHeaders });
        }

        // 404
        return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      } catch (error) {
        logger.error({ error, path }, "API error");
        return Response.json({ error: String(error) }, { status: 500 });
      }
    },

    // WebSocket handlers
    websocket: {
      open(ws: ServerWebSocket<WsClientData>) {
        handleOpen(ws);
      },
      message(ws: ServerWebSocket<WsClientData>, message: string | Buffer) {
        handleMessage(ws, message);
      },
      close(ws: ServerWebSocket<WsClientData>) {
        handleClose(ws);
      },
    },
  });

  logger.info({ port }, "API server started (HTTP + WebSocket)");
  return server;
}
