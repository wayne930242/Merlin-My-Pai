/**
 * Discord Channel Context Management
 * 即時從 Discord API 抓取頻道訊息作為對話背景
 */

import type { Collection, Message, TextBasedChannel } from "discord.js";
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
 * 從 Discord 訊息中提取內容（包含文字、貼圖、附件）
 */
function extractMessageContent(msg: Message): string {
  const parts: string[] = [];

  // 文字內容
  if (msg.content && msg.content.trim().length > 0) {
    const text = msg.content.length > 500 ? `${msg.content.slice(0, 500)}...` : msg.content;
    parts.push(text);
  }

  // 貼圖（Stickers）
  if (msg.stickers.size > 0) {
    for (const [_, sticker] of msg.stickers) {
      const format = sticker.format === 3 ? "動態貼圖" : "貼圖";
      parts.push(`[${format}: ${sticker.name}]`);
    }
  }

  // 附件（Attachments: 圖片、GIF、影片等）
  if (msg.attachments.size > 0) {
    for (const [_, attachment] of msg.attachments) {
      const contentType = attachment.contentType || "unknown";
      if (contentType.startsWith("image/gif")) {
        parts.push(`[GIF: ${attachment.name || "unnamed"}]`);
      } else if (contentType.startsWith("image/")) {
        parts.push(`[圖片: ${attachment.name || "unnamed"}]`);
      } else if (contentType.startsWith("video/")) {
        parts.push(`[影片: ${attachment.name || "unnamed"}]`);
      } else if (contentType.startsWith("audio/")) {
        parts.push(`[音訊: ${attachment.name || "unnamed"}]`);
      } else {
        parts.push(`[檔案: ${attachment.name || "unnamed"}]`);
      }
    }
  }

  return parts.join(" ");
}

/**
 * 從 Discord API 即時抓取頻道最近訊息作為上下文
 * @param channel - Discord 頻道物件
 * @param excludeUserIds - 排除這些用戶的訊息
 * @param excludeMessageIds - 排除這些訊息 ID（已在對話歷史中）
 * @returns 最近的訊息列表（最多 10 則）
 */
export async function getChannelContext(
  channel: TextBasedChannel,
  excludeUserIds: string[] = [],
  excludeMessageIds: Set<string> = new Set(),
): Promise<ChannelMessage[]> {
  try {
    // 從 Discord API 抓取最近 20 則訊息
    const fetchedMessages: Collection<string, Message> = await channel.messages.fetch({
      limit: 20,
    });

    // 過濾並轉換格式
    const messages: ChannelMessage[] = [];

    for (const [_, msg] of fetchedMessages) {
      // 排除 bot 訊息
      if (msg.author.bot) continue;

      // 排除指定用戶
      if (excludeUserIds.includes(msg.author.id)) continue;

      // 排除已在對話歷史中的訊息（避免重複）
      if (excludeMessageIds.has(msg.id)) continue;

      // 提取訊息內容（包含文字、貼圖、附件）
      const content = extractMessageContent(msg);

      // 跳過沒有任何內容的訊息
      if (!content) continue;

      messages.push({
        author_id: msg.author.id,
        author_name: msg.member?.displayName ?? msg.author.username,
        content,
        is_bot: false,
        created_at: msg.createdAt,
      });

      // 達到上限就停止
      if (messages.length >= MAX_CONTEXT_MESSAGES) break;
    }

    // 按時間排序（舊到新）
    messages.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    logger.debug(
      { channelId: channel.id, messageCount: messages.length, excluded: excludeMessageIds.size },
      "Fetched channel context from Discord API",
    );
    return messages;
  } catch (error) {
    logger.error({ error, channelId: channel.id }, "Failed to fetch channel context");
    return [];
  }
}

/**
 * 格式化頻道上下文為 prompt
 * @param messages - 訊息列表
 * @param selfId - 主人的 Discord ID（用於標示「這是主人」）
 */
export function formatChannelContext(messages: ChannelMessage[], selfId?: string): string {
  if (messages.length === 0) return "";

  const lines = messages.map((m) => {
    const isSelf = selfId && m.author_id === selfId;
    const selfMarker = isSelf ? " ★主人" : "";
    const prefix = m.is_bot ? "Bot" : `${m.author_name} (${m.author_id})${selfMarker}`;
    return `<msg from="${prefix}">${m.content}</msg>`;
  });

  return `<channel-context>\n${lines.join("\n")}\n</channel-context>`;
}

/**
 * 將 Discord snowflake ID 轉換為 numeric
 */
export function hashToNumeric(id: string): number {
  return Number(BigInt(id) % BigInt(Number.MAX_SAFE_INTEGER));
}
