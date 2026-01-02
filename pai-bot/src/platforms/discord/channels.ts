/**
 * Discord Channel Management
 * 動態綁定/解綁頻道
 */

import { getDb } from "../../storage/db";
import { contextManager } from "../../context/manager";
import { hashToNumeric } from "./context";
import { logger } from "../../utils/logger";

export interface BoundChannel {
  id: number;
  channel_id: string;
  guild_id: string | null;
  bound_by: string;
  created_at: string;
}

/**
 * 綁定頻道
 */
export function bindChannel(channelId: string, guildId: string | null, boundBy: string): boolean {
  const db = getDb();
  try {
    db.run(
      "INSERT OR IGNORE INTO discord_channels (channel_id, guild_id, bound_by) VALUES (?, ?, ?)",
      [channelId, guildId, boundBy]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 解綁頻道
 * 同時清除該頻道的 session
 */
export function unbindChannel(channelId: string): boolean {
  const db = getDb();
  const result = db.run("DELETE FROM discord_channels WHERE channel_id = ?", [channelId]);

  if (result.changes > 0) {
    // 清除 channel session
    const sessionKey = hashToNumeric(channelId);
    contextManager.clearHistory(sessionKey);
    logger.info({ channelId, sessionKey }, "Channel session cleared");
  }

  return result.changes > 0;
}

/**
 * 檢查頻道是否已綁定
 */
export function isChannelBound(channelId: string): boolean {
  const db = getDb();
  const row = db.query("SELECT 1 FROM discord_channels WHERE channel_id = ?").get(channelId);
  return !!row;
}

/**
 * 取得所有綁定的頻道
 */
export function getBoundChannels(): BoundChannel[] {
  const db = getDb();
  return db.query("SELECT * FROM discord_channels ORDER BY created_at DESC").all() as BoundChannel[];
}

/**
 * 檢查是否有任何綁定的頻道
 */
export function hasBoundChannels(): boolean {
  const db = getDb();
  const row = db.query("SELECT 1 FROM discord_channels LIMIT 1").get();
  return !!row;
}
