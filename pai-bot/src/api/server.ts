/**
 * HTTP API Server
 * 提供基本的 API endpoints
 */

import { logger } from "../utils/logger";
import * as google from "../services/google";

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
    hostname: "127.0.0.1", // 只監聽本機，不暴露到公網
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      try {
        // Health check
        if (path === "/health" && method === "GET") {
          return Response.json({ status: "ok" });
        }

        // Notify API
        if (path === "/api/notify" && method === "POST") {
          const body = await req.json();
          const { message, level = "info" } = body;

          if (!message) {
            return Response.json({ error: "Missing message" }, { status: 400 });
          }

          if (!telegramBot || allowedUserIds.length === 0) {
            return Response.json({ error: "Telegram bot not configured" }, { status: 500 });
          }

          const userId = allowedUserIds[0];
          const icons: Record<string, string> = {
            info: "ℹ️",
            warning: "⚠️",
            error: "❌",
            success: "➡️",
          };

          const icon = icons[level] || icons.info;
          await telegramBot.sendMessage(userId, `${icon} ${message}`);

          return Response.json({ success: true });
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
            const maxResults = parseInt(url.searchParams.get("maxResults") || "10");
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
            const created = await google.calendar.createEvent(event, calendarId);
            return Response.json({ event: created });
          }
        }

        // Drive - list files
        if (path === "/api/google/drive/files" && method === "GET") {
          const q = url.searchParams.get("q") || undefined;
          const folderId = url.searchParams.get("folderId") || undefined;
          const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

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
          const maxResults = parseInt(url.searchParams.get("maxResults") || "10");

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
            return Response.json({ error: "to, subject, body required" }, { status: 400 });
          }
          const result = await google.gmail.sendMessage(to, subject, messageBody, { cc, bcc });
          return Response.json({ result });
        }

        // Contacts - list
        if (path === "/api/google/contacts" && method === "GET") {
          const pageSize = parseInt(url.searchParams.get("pageSize") || "100");
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

        // 404
        return Response.json({ error: "Not found" }, { status: 404 });

      } catch (error) {
        logger.error({ error, path }, "API error");
        return Response.json({ error: String(error) }, { status: 500 });
      }
    },
  });

  logger.info({ port }, "API server started");
  return server;
}
