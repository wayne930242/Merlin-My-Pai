/**
 * Intel Feed Service
 * Aggregates news from Reddit and RSS, analyzes with Gemini, sends to Telegram
 */

import { getDb } from "../../storage/db";
import { logger } from "../../utils/logger";
import { IntelFeedAgent } from "./agent";
import { fetchReddit } from "./sources/reddit";
import { fetchRSS } from "./sources/rss";
import type { Category, FeedItem } from "./types";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3000";

/**
 * Check if item has been seen before
 */
function isSeen(source: string, itemId: string): boolean {
  const db = getDb();
  const row = db
    .query("SELECT 1 FROM intel_seen_items WHERE source = ? AND item_id = ?")
    .get(source, itemId);
  return !!row;
}

/**
 * Mark item as seen
 */
function markSeen(item: FeedItem): void {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO intel_seen_items (source, item_id, title, url)
     VALUES (?, ?, ?, ?)`,
    [item.source, item.id, item.title, item.url],
  );
}

/**
 * Record digest execution
 */
function recordDigest(itemCount: number): void {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  db.run(
    `INSERT OR REPLACE INTO intel_digests (digest_date, item_count)
     VALUES (?, ?)`,
    [today, itemCount],
  );
}

/**
 * Send notification via internal API
 */
async function notify(message: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, level: "info" }),
    });
    return response.ok;
  } catch (error) {
    logger.error({ error }, "Failed to send notification");
    return false;
  }
}

/**
 * Cleanup old seen items (older than 7 days)
 */
export function cleanupOldItems(): number {
  const db = getDb();
  const result = db.run("DELETE FROM intel_seen_items WHERE seen_at < datetime('now', '-7 days')");
  return result.changes;
}

/**
 * Main digest generation function
 */
export async function generateDigest(): Promise<{
  ok: boolean;
  itemCount: number;
  categories: Category[];
  error?: string;
}> {
  logger.info("Starting Intel Feed digest generation");

  try {
    // 1. Fetch from all sources
    logger.info("Fetching from Reddit...");
    const redditItems = await fetchReddit();
    logger.info({ count: redditItems.length }, "Reddit items fetched");

    logger.info("Fetching from RSS...");
    const rssItems = await fetchRSS();
    logger.info({ count: rssItems.length }, "RSS items fetched");

    const allItems = [...redditItems, ...rssItems];

    // 2. Filter out seen items
    const newItems = allItems.filter((item) => !isSeen(item.source, item.id));
    logger.info({ total: allItems.length, new: newItems.length }, "Filtered seen items");

    if (newItems.length === 0) {
      logger.info("No new items to process");
      return { ok: true, itemCount: 0, categories: [] };
    }

    // Mark items as seen
    for (const item of newItems) {
      markSeen(item);
    }

    // 3. AI Analysis
    const agent = new IntelFeedAgent();

    // Round 1: Score items
    logger.info("Scoring items with AI...");
    const scoredItems = await agent.scoreItems(newItems);

    // Round 2: Generate digests
    logger.info("Generating category digests...");
    const digests = await agent.generateDigests(scoredItems);

    if (digests.length === 0) {
      logger.info("No items passed the relevance threshold");
      return { ok: true, itemCount: 0, categories: [] };
    }

    // 4. Send notifications (one per category)
    const notifications = agent.formatNotifications(digests);
    const sentCategories: Category[] = [];

    for (const [category, message] of notifications) {
      const sent = await notify(message);
      if (sent) {
        sentCategories.push(category);
        logger.info({ category }, "Notification sent");
      } else {
        logger.warn({ category }, "Failed to send notification");
      }

      // Small delay between notifications
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 5. Record digest
    const totalItems = digests.reduce((sum, d) => sum + d.items.length, 0);
    recordDigest(totalItems);

    // 6. Cleanup old items
    const cleaned = cleanupOldItems();
    if (cleaned > 0) {
      logger.info({ cleaned }, "Cleaned up old seen items");
    }

    logger.info(
      { categories: sentCategories.length, items: totalItems },
      "Digest generation completed",
    );

    return {
      ok: true,
      itemCount: totalItems,
      categories: sentCategories,
    };
  } catch (error) {
    logger.error({ error }, "Digest generation failed");
    return {
      ok: false,
      itemCount: 0,
      categories: [],
      error: String(error),
    };
  }
}

/**
 * Initialize Intel Feed schedule
 * Call this on app startup to ensure the schedule exists
 */
export async function initIntelFeedSchedule(userId: number): Promise<void> {
  const { listSchedules, createSchedule } = await import("../scheduler");

  const existing = listSchedules(userId);
  const hasIntelFeed = existing.some((s) => s.name === "Intel Feed Daily");

  if (!hasIntelFeed) {
    createSchedule({
      name: "Intel Feed Daily",
      cronExpression: "0 8 * * *", // Every day at 08:00
      taskType: "prompt",
      taskData: "/intel-digest",
      userId,
    });
    logger.info("Created Intel Feed daily schedule");
  }
}
