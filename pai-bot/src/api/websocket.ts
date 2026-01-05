/**
 * WebSocket Handler
 * 處理 Web 平台的即時通訊
 */

import type { ServerWebSocket } from "bun";
import { paiEvents, type PaiEvents } from "../events";

// WebSocket 客戶端資料
export interface WsClientData {
  id: string;
  userId?: number;
  subscribedChannels: Set<string>;
  connectedAt: number;
}

// 所有連接的 clients
const clients = new Map<string, ServerWebSocket<WsClientData>>();

// Log buffer（保留最近 N 筆）
const MAX_LOG_BUFFER = 200;
const MAX_NOTIFICATION_BUFFER = 50;
const logBuffer: PaiEvents["log:entry"][] = [];
const notificationBuffer: PaiEvents["notify:message"][] = [];

// Client → Server 訊息格式
interface WsCommand {
  type: "subscribe" | "unsubscribe" | "chat" | "ping";
  channels?: string[];
  content?: string;
}

/**
 * WebSocket 連接開啟
 */
export function handleOpen(ws: ServerWebSocket<WsClientData>): void {
  const clientId = ws.data.id;
  clients.set(clientId, ws);

  console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

  // 發送歡迎訊息
  ws.send(
    JSON.stringify({
      type: "connected",
      clientId,
      timestamp: Date.now(),
    })
  );

  // 發送現有的 logs 和 notifications
  if (logBuffer.length > 0) {
    ws.send(
      JSON.stringify({
        type: "log:init",
        logs: logBuffer,
      })
    );
  }

  if (notificationBuffer.length > 0) {
    ws.send(
      JSON.stringify({
        type: "notify:init",
        notifications: notificationBuffer,
      })
    );
  }
}

/**
 * 處理 WebSocket 訊息
 */
export function handleMessage(
  ws: ServerWebSocket<WsClientData>,
  message: string | Buffer
): void {
  try {
    const data: WsCommand = JSON.parse(message.toString());

    switch (data.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      case "subscribe":
        if (data.channels) {
          for (const channel of data.channels) {
            ws.data.subscribedChannels.add(channel);
          }
          ws.send(
            JSON.stringify({
              type: "subscribed",
              channels: Array.from(ws.data.subscribedChannels),
            })
          );
        }
        break;

      case "unsubscribe":
        if (data.channels) {
          for (const channel of data.channels) {
            ws.data.subscribedChannels.delete(channel);
          }
        }
        break;

      case "chat":
        // 由 web platform handler 處理
        if (data.content) {
          paiEvents.emit("web:chat", {
            clientId: ws.data.id,
            content: data.content,
            timestamp: Date.now(),
          } as any);
        }
        break;
    }
  } catch (error) {
    console.error("[WS] Failed to parse message:", error);
  }
}

/**
 * WebSocket 連接關閉
 */
export function handleClose(ws: ServerWebSocket<WsClientData>): void {
  const clientId = ws.data.id;
  clients.delete(clientId);
  console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
}

/**
 * 廣播事件到所有客戶端
 * @param addToBuffer 是否加入 buffer（供新連線使用）
 */
export function broadcast<K extends keyof PaiEvents>(
  event: K,
  data: PaiEvents[K],
  addToBuffer = false
): void {
  // 加入 buffer（如果需要）
  if (addToBuffer) {
    if (event === "log:entry") {
      logBuffer.push(data as PaiEvents["log:entry"]);
      if (logBuffer.length > MAX_LOG_BUFFER) {
        logBuffer.shift();
      }
    } else if (event === "notify:message") {
      notificationBuffer.push(data as PaiEvents["notify:message"]);
      if (notificationBuffer.length > MAX_NOTIFICATION_BUFFER) {
        notificationBuffer.shift();
      }
    }
  }

  const message = JSON.stringify({ type: event, ...data });

  for (const [, ws] of clients) {
    try {
      ws.send(message);
    } catch (error) {
      console.error("[WS] Failed to send message:", error);
    }
  }
}

/**
 * 發送訊息到特定客戶端
 */
export function sendToClient(clientId: string, data: unknown): boolean {
  const ws = clients.get(clientId);
  if (!ws) return false;

  try {
    ws.send(JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 取得連接數
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * 初始化事件監聽（訂閱 paiEvents 並廣播）
 */
export function initEventBroadcast(): void {
  // 監聽所有事件並廣播
  const events: (keyof PaiEvents)[] = [
    "message:in",
    "claude:start",
    "claude:thinking",
    "claude:text",
    "claude:tool",
    "claude:done",
    "claude:error",
    "system:status",
    "notify:message",
    "log:entry",
  ];

  for (const event of events) {
    paiEvents.on(event, (data) => {
      // 特別處理：儲存到 buffer
      if (event === "log:entry") {
        logBuffer.push(data as PaiEvents["log:entry"]);
        if (logBuffer.length > MAX_LOG_BUFFER) {
          logBuffer.shift();
        }
      } else if (event === "notify:message") {
        notificationBuffer.push(data as PaiEvents["notify:message"]);
        if (notificationBuffer.length > MAX_NOTIFICATION_BUFFER) {
          notificationBuffer.shift();
        }
      }

      broadcast(event, data);
    });
  }

  console.log("[WS] Event broadcast initialized");
}
