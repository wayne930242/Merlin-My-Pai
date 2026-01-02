/**
 * Discord Channel Context Management
 * 即時從 Discord API 抓取頻道訊息作為對話背景
 */

import type { TextBasedChannel, Collection, Message } from "discord.js";
import { logger } from "../../utils/logger";

export interface ChannelMessage {
  author_id: string;
  author_name: string;
  content: string;
  is_bot: boolean;
  created_at: Date;
}

const MAX_CONTEXT_MESSAGES = 10;

/**
 * 從 Discord API 即時抓取頻道最近訊息作為上下文
 * @param channel - Discord 頻道物件
 * @param excludeUserIds - 排除這些用戶的訊息
 * @returns 最近的訊息列表（最多 10 則）
 */
export async function getChannelContext(
  channel: TextBasedChannel,
  excludeUserIds: string[] = []
): Promise<ChannelMessage[]> {
  try {
    // 從 Discord API 抓取最近 20 則訊息
    const fetchedMessages: Collection<string, Message> = await channel.messages.fetch({
      limit: 20
    });

    // 過濾並轉換格式
    const messages: ChannelMessage[] = [];

    for (const [_, msg] of fetchedMessages) {
      // 排除 bot 訊息
      if (msg.author.bot) continue;

      // 排除指定用戶
      if (excludeUserIds.includes(msg.author.id)) continue;

      // 只保留有文字內容的訊息
      if (!msg.content || msg.content.trim().length === 0) continue;

      // 限制訊息長度避免 context 過長
      const content = msg.content.length > 500
        ? msg.content.slice(0, 500) + "..."
        : msg.content;

      messages.push({
        author_id: msg.author.id,
        author_name: msg.author.username,
        content,
        is_bot: false,
        created_at: msg.createdAt,
      });

      // 達到上限就停止
      if (messages.length >= MAX_CONTEXT_MESSAGES) break;
    }

    // 按時間排序（舊到新）
    messages.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    logger.debug({ channelId: channel.id, messageCount: messages.length }, "Fetched channel context from Discord API");
    return messages;
  } catch (error) {
    logger.error({ error, channelId: channel.id }, "Failed to fetch channel context");
    return [];
  }
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
 * 將 Discord snowflake ID 轉換為 numeric
 */
export function hashToNumeric(id: string): number {
  return Number(BigInt(id) % BigInt(Number.MAX_SAFE_INTEGER));
}
