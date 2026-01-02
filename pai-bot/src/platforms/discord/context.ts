/**
 * Discord Channel Context Management
 * 記錄頻道最近訊息，提供對話背景
 */

import { getDb } from "../../storage/db";
import { logger } from "../../utils/logger";

export interface ChannelMessage {
  id: number;
  channel_id: string;
  author_id: string;
  author_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
}

const MAX_CONTEXT_MESSAGES = 5;

/**
 * 初始化 channel_messages 表
 */
export function initChannelContextTable(): void {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS discord_channel_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_bot INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON discord_channel_messages(channel_id)`);
}

/**
 * 記錄頻道訊息
 */
export function recordChannelMessage(
  channelId: string,
  authorId: string,
  authorName: string,
  content: string,
  isBot: boolean
): void {
  const db = getDb();

  // 插入新訊息
  db.run(
    `INSERT INTO discord_channel_messages (channel_id, author_id, author_name, content, is_bot)
     VALUES (?, ?, ?, ?, ?)`,
    [channelId, authorId, authorName, content, isBot ? 1 : 0]
  );

  // 清理舊訊息，只保留最近 MAX_CONTEXT_MESSAGES * 2 條（給一些餘量）
  db.run(
    `DELETE FROM discord_channel_messages
     WHERE channel_id = ? AND id NOT IN (
       SELECT id FROM discord_channel_messages
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT ?
     )`,
    [channelId, channelId, MAX_CONTEXT_MESSAGES * 2]
  );
}

/**
 * 取得頻道最近訊息作為上下文
 */
export function getChannelContext(channelId: string, limit: number = MAX_CONTEXT_MESSAGES): ChannelMessage[] {
  const db = getDb();
  const messages = db.query<ChannelMessage, [string, number]>(
    `SELECT * FROM discord_channel_messages
     WHERE channel_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(channelId, limit);

  return messages.reverse(); // 返回時間順序（舊到新）
}

/**
 * 格式化頻道上下文為 prompt
 */
export function formatChannelContext(messages: ChannelMessage[]): string {
  if (messages.length === 0) return "";

  const lines = messages.map((m) => {
    const prefix = m.is_bot ? "[Bot]" : `[${m.author_name}]`;
    return `${prefix}: ${m.content}`;
  });

  return `[頻道討論記錄]\n${lines.join("\n")}\n[/頻道討論記錄]`;
}

/**
 * 清除頻道訊息記錄
 */
export function clearChannelMessages(channelId: string): number {
  const db = getDb();
  const result = db.run(
    "DELETE FROM discord_channel_messages WHERE channel_id = ?",
    [channelId]
  );
  return result.changes;
}

/**
 * 取得 session key
 * - 頻道模式（bound/mention）: 用 channelId
 * - DM 模式: 用 numeric hash of discordUserId
 */
export function getSessionKey(channelId: string, isChannelMode: boolean): number {
  if (isChannelMode) {
    // 用 channelId 的 hash 作為 session key
    return hashToNumeric(channelId);
  }
  // DM 模式下，由外部傳入 userId
  return hashToNumeric(channelId);
}

/**
 * 將 Discord snowflake ID 轉換為 numeric
 */
export function hashToNumeric(id: string): number {
  return Number(BigInt(id) % BigInt(Number.MAX_SAFE_INTEGER));
}
