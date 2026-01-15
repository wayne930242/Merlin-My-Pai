/**
 * HTTP API Server
 * 提供 REST API + WebSocket endpoints
 */

import type { ServerWebSocket } from "bun";
import type { Client as DiscordClient, TextChannel } from "discord.js";
import { config } from "../config";
import { contextManager } from "../context/manager";
import { type PaiEvents, paiEvents } from "../events";
import { memoryManager } from "../memory";
import * as google from "../services/google";
import { generateDigest } from "../services/intel-feed";
import { type Session, sessionService } from "../storage/sessions";
import { logger } from "../utils/logger";
import {
  broadcast,
  handleClose,
  handleMessage,
  handleOpen,
  initEventBroadcast,
  type WsClientData,
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
async function notifyBySession(session: Session, message: string): Promise<void> {
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

          // 廣播到 WebSocket（讓 WebUI 即時顯示）
          paiEvents.emit("notify:message", {
            message: formattedMessage,
            timestamp: Date.now(),
          });

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
              logger.warn({ error }, "Failed to notify HQ, falling back to default");
            }
          }

          // Fallback to allowedUserIds[0]
          if (!telegramBot || allowedUserIds.length === 0) {
            return Response.json(
              { error: "No HQ configured and Telegram bot not available" },
              { status: 500 },
            );
          }

          await telegramBot.sendMessage(allowedUserIds[0], formattedMessage);
          return Response.json({ success: true, target: "fallback" });
        }

        // Session-based notify API
        if (path === "/api/notify/session" && method === "POST") {
          const body = await req.json();
          const { sessionId, message }: { sessionId: number; message: string } = body;

          if (!sessionId || !message) {
            return Response.json({ error: "Missing sessionId or message" }, { status: 400 });
          }

          const session = sessionService.get(sessionId);
          if (!session) {
            return Response.json({ error: "Session not found" }, { status: 404 });
          }

          await notifyBySession(session, message);
          return Response.json({ success: true, platform: session.platform });
        }

        // Intel Feed - trigger digest
        if (path === "/api/intel/trigger" && method === "POST") {
          if (!validateApiKey(req)) {
            return new Response("Unauthorized", { status: 401 });
          }

          logger.info("Manually triggering Intel Feed digest...");
          const result = await generateDigest();
          if (result.ok) {
            return Response.json({
              success: true,
              itemCount: result.itemCount,
              categories: result.categories,
            });
          }
          return Response.json({ success: false, error: result.error }, { status: 500 });
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
            return Response.json({ error: "Invalid session ID" }, { status: 400 });
          }
          const session = sessionService.get(id);
          if (!session) {
            return Response.json({ error: "Session not found" }, { status: 404 });
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
            const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);
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
          const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

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
          const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);

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
          const pageSize = parseInt(url.searchParams.get("pageSize") || "100", 10);
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

        // === Chat History API ===
        if (path === "/api/chat/history" && method === "GET") {
          // 驗證 API Key
          if (!validateApiKey(req)) {
            return new Response("Unauthorized", { status: 401 });
          }

          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500, headers: corsHeaders },
            );
          }

          const limit = parseInt(url.searchParams.get("limit") || "50", 10);
          const messages = contextManager.getMessages(userId, limit);
          return Response.json({ messages }, { headers: corsHeaders });
        }

        // === Memory APIs ===

        // Memory - save
        if (path === "/api/memory/save" && method === "POST") {
          const body = await req.json();
          const { content, category = "general", importance = 3 } = body;

          if (!content) {
            return Response.json(
              { error: "content required" },
              { status: 400, headers: corsHeaders },
            );
          }

          // 使用預設 user_id
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500, headers: corsHeaders },
            );
          }

          const id = await memoryManager.save({
            userId,
            content,
            category,
            importance,
          });
          if (id === null) {
            return Response.json({ success: true, duplicate: true }, { headers: corsHeaders });
          }
          return Response.json({ success: true, id }, { headers: corsHeaders });
        }

        // Memory - list
        if (path === "/api/memory/list" && method === "GET") {
          const limit = parseInt(url.searchParams.get("limit") || "20", 10);
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500, headers: corsHeaders },
            );
          }
          const memories = memoryManager.getRecent(userId, limit);
          return Response.json({ memories }, { headers: corsHeaders });
        }

        // Memory - search
        if (path === "/api/memory/search" && method === "GET") {
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json(
              { error: "query required" },
              { status: 400, headers: corsHeaders },
            );
          }
          const limit = parseInt(url.searchParams.get("limit") || "5", 10);
          const userId = allowedUserIds[0];
          if (!userId) {
            return Response.json(
              { error: "No user configured" },
              { status: 500, headers: corsHeaders },
            );
          }
          const memories = memoryManager.search(userId, query, limit);
          return Response.json({ memories }, { headers: corsHeaders });
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

        // === RAG APIs ===
        const VAULT_PATH = process.env.OBSIDIAN_VAULT || "~/obsidian";
        const PYTHON_PATH = process.env.RAG_PYTHON || `${process.env.HOME}/.venv/bin/python`;
        const obsidianRagScript = new URL("../rag/obsidian_rag.py", import.meta.url).pathname;
        const agenticRagScript = new URL("../rag/agentic_rag.py", import.meta.url).pathname;

        // Helper to run Python scripts
        async function runPython(args: string[]): Promise<unknown> {
          const proc = Bun.spawn([PYTHON_PATH, ...args], {
            stdout: "pipe",
            stderr: "pipe",
          });
          const exitCode = await proc.exited;
          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          if (exitCode !== 0) {
            throw new Error(stderr || `Exit code ${exitCode}`);
          }
          return JSON.parse(stdout);
        }

        // RAG - stats
        if (path === "/api/rag/stats" && method === "GET") {
          const result = await runPython([
            obsidianRagScript,
            "stats",
            "--vault",
            VAULT_PATH,
            "--json",
          ]);
          return Response.json(result, { headers: corsHeaders });
        }

        // RAG - query (agentic)
        if (path === "/api/rag/query" && method === "POST") {
          const body = await req.json();
          const { question, max_retries = 2 } = body;
          if (!question) {
            return Response.json(
              { error: "question required" },
              { status: 400, headers: corsHeaders },
            );
          }
          const result = await runPython([
            agenticRagScript,
            "query",
            "-q",
            question,
            "--vault",
            VAULT_PATH,
            "-r",
            String(max_retries),
            "--json",
          ]);
          return Response.json(result, { headers: corsHeaders });
        }

        // RAG - search (simple)
        if (path === "/api/rag/search" && method === "POST") {
          const body = await req.json();
          const { query, top_k = 5 } = body;
          if (!query) {
            return Response.json(
              { error: "query required" },
              { status: 400, headers: corsHeaders },
            );
          }
          const result = await runPython([
            obsidianRagScript,
            "search",
            "-q",
            query,
            "--vault",
            VAULT_PATH,
            "-k",
            String(top_k),
            "--json",
          ]);
          return Response.json({ results: result }, { headers: corsHeaders });
        }

        // RAG - sync
        if (path === "/api/rag/sync" && method === "POST") {
          const result = await runPython([
            obsidianRagScript,
            "sync",
            "--vault",
            VAULT_PATH,
            "--json",
          ]);
          return Response.json(result, { headers: corsHeaders });
        }

        // === File Upload API ===
        if (path === "/api/upload" && method === "POST") {
          // 驗證 API Key
          if (!validateApiKey(req)) {
            return new Response("Unauthorized", { status: 401 });
          }

          const formData = await req.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return Response.json(
              { error: "No file provided" },
              { status: 400, headers: corsHeaders },
            );
          }

          // 限制檔案大小（10MB）
          const MAX_SIZE = 10 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            return Response.json(
              { error: "File too large (max 10MB)" },
              { status: 400, headers: corsHeaders },
            );
          }

          // 儲存到 workspace/uploads
          const { join, basename } = await import("node:path");
          const { mkdir, writeFile } = await import("node:fs/promises");

          const uploadsDir = join(
            process.env.WORKSPACE_ROOT || join(process.env.HOME || "", "merlin", "workspace"),
            "uploads",
          );

          await mkdir(uploadsDir, { recursive: true });

          // 產生唯一檔名
          const timestamp = Date.now();
          const safeName = basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
          const filename = `${timestamp}_${safeName}`;
          const filepath = join(uploadsDir, filename);

          // 寫入檔案
          const buffer = await file.arrayBuffer();
          await writeFile(filepath, Buffer.from(buffer));

          return Response.json(
            {
              success: true,
              filename,
              path: `uploads/${filename}`,
              size: file.size,
              type: file.type,
            },
            { headers: corsHeaders },
          );
        }

        // === Workspace File Browser APIs ===
        const WORKSPACE_ROOT =
          process.env.WORKSPACE_ROOT ||
          (await import("node:path")).join(process.env.HOME || "", "merlin", "workspace");

        // Workspace - list directory
        if (path === "/api/workspace/list" && method === "GET") {
          const { readdir, stat } = await import("node:fs/promises");
          const { join, relative } = await import("node:path");

          const dirPath = url.searchParams.get("path") || "";
          const fullPath = join(WORKSPACE_ROOT, dirPath);

          // 安全檢查：確保路徑在 workspace 內
          if (!fullPath.startsWith(WORKSPACE_ROOT)) {
            return Response.json({ error: "Access denied" }, { status: 403, headers: corsHeaders });
          }

          try {
            const entries = await readdir(fullPath, { withFileTypes: true });
            const items = await Promise.all(
              entries.map(async (entry) => {
                const entryPath = join(fullPath, entry.name);
                const stats = await stat(entryPath).catch(() => null);
                return {
                  name: entry.name,
                  path: relative(WORKSPACE_ROOT, entryPath),
                  isDirectory: entry.isDirectory(),
                  size: stats?.size || 0,
                  modified: stats?.mtime?.toISOString() || null,
                };
              }),
            );

            // 排序：目錄在前，然後按名稱
            items.sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });

            return Response.json({ items, currentPath: dirPath || "/" }, { headers: corsHeaders });
          } catch (_err) {
            return Response.json(
              { error: "Directory not found" },
              { status: 404, headers: corsHeaders },
            );
          }
        }

        // Workspace - read file
        if (path === "/api/workspace/read" && method === "GET") {
          const { readFile, stat } = await import("node:fs/promises");
          const { join } = await import("node:path");

          const filePath = url.searchParams.get("path");
          if (!filePath) {
            return Response.json({ error: "path required" }, { status: 400, headers: corsHeaders });
          }

          const fullPath = join(WORKSPACE_ROOT, filePath);

          // 安全檢查
          if (!fullPath.startsWith(WORKSPACE_ROOT)) {
            return Response.json({ error: "Access denied" }, { status: 403, headers: corsHeaders });
          }

          try {
            const stats = await stat(fullPath);
            if (stats.isDirectory()) {
              return Response.json(
                { error: "Cannot read directory" },
                { status: 400, headers: corsHeaders },
              );
            }

            // 限制檔案大小（1MB）
            if (stats.size > 1024 * 1024) {
              return Response.json(
                { error: "File too large (max 1MB)" },
                { status: 400, headers: corsHeaders },
              );
            }

            const content = await readFile(fullPath, "utf-8");
            return Response.json(
              {
                content,
                path: filePath,
                size: stats.size,
                modified: stats.mtime.toISOString(),
              },
              { headers: corsHeaders },
            );
          } catch (_err) {
            return Response.json(
              { error: "File not found" },
              { status: 404, headers: corsHeaders },
            );
          }
        }

        // === Internal API (for Claude hook heartbeat) ===
        if (path === "/internal/heartbeat" && method === "POST") {
          // 只允許本地連線
          const host = req.headers.get("host") || "";
          if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          const body = await req.json();
          const { sessionId } = body as { sessionId?: string };

          if (!sessionId) {
            return Response.json({ error: "sessionId required" }, { status: 400 });
          }

          // 重置對應 session 的 idle timeout
          const { resetIdleTimeoutBySession } = await import("../claude/client");
          const reset = resetIdleTimeoutBySession(sessionId);

          logger.debug({ sessionId, reset }, "Heartbeat received");
          return Response.json({ success: true, reset });
        }

        // === Internal API (for MCP process to broadcast events) ===
        if (path === "/internal/broadcast" && method === "POST") {
          // 只允許本地連線
          const host = req.headers.get("host") || "";
          if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          const body = await req.json();
          const { event, data } = body as {
            event: keyof PaiEvents;
            data: PaiEvents[keyof PaiEvents];
          };

          if (!event || !data) {
            return Response.json({ error: "event and data required" }, { status: 400 });
          }

          // 廣播事件到所有 WebSocket 客戶端（加入 buffer 供新連線使用）
          broadcast(event, data, true);
          logger.debug({ event, data }, "Internal broadcast");

          return Response.json({ success: true });
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
