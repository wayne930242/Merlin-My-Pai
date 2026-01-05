/**
 * PAI Event System
 * 統一事件流 - 所有平台的訊息和 Claude 執行事件都會廣播
 */

import { EventEmitter } from "node:events";

// 事件類型定義
export interface PaiEvents {
  // 訊息進入（來自任何平台）
  "message:in": {
    platform: "telegram" | "discord" | "web";
    userId: number;
    username?: string;
    content: string;
    timestamp: number;
  };

  // Claude 執行事件
  "claude:start": {
    sessionId: string;
    platform: string;
    userId: number;
    prompt: string;
    timestamp: number;
  };

  "claude:thinking": {
    sessionId: string;
    content: string;
    timestamp: number;
  };

  "claude:text": {
    sessionId: string;
    content: string;
    timestamp: number;
  };

  "claude:tool": {
    sessionId: string;
    tool: string;
    input: unknown;
    timestamp: number;
  };

  "claude:done": {
    sessionId: string;
    response: string;
    totalTokens?: number;
    timestamp: number;
  };

  "claude:error": {
    sessionId: string;
    error: string;
    timestamp: number;
  };

  // 系統事件
  "system:status": {
    activeSessions: number;
    queueLength: number;
    timestamp: number;
  };

  // Web 平台內部事件
  "web:chat": {
    clientId: string;
    content: string;
    timestamp: number;
  };

  // 通知事件（來自 HQ）
  "notify:message": {
    sessionId?: number;
    platform?: string;
    message: string;
    timestamp: number;
  };

  // Log 事件（bot 日誌串流）
  "log:entry": {
    level: "debug" | "info" | "warn" | "error" | "fatal";
    msg: string;
    context?: string;
    timestamp: number;
  };
}

// 型別安全的 EventEmitter
class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof PaiEvents>(event: K, data: PaiEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof PaiEvents>(
    event: K,
    listener: (data: PaiEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof PaiEvents>(
    event: K,
    listener: (data: PaiEvents[K]) => void
  ): this {
    return super.once(event, listener);
  }

  off<K extends keyof PaiEvents>(
    event: K,
    listener: (data: PaiEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
}

// 全域單例
export const paiEvents = new TypedEventEmitter();

// 便捷函數
export function emitEvent<K extends keyof PaiEvents>(
  event: K,
  data: Omit<PaiEvents[K], "timestamp">
): void {
  paiEvents.emit(event, {
    ...data,
    timestamp: Date.now(),
  } as PaiEvents[K]);
}
