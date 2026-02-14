/**
 * Intel Feed Service
 * Aggregates news from Reddit and RSS, analyzes with LangGraph agent, sends to Telegram
 */

import { join } from "node:path";
import { $ } from "bun";
import { config } from "../../config";
import { contextManager } from "../../context/manager";
import { getDb } from "../../storage/db";
import { logger } from "../../utils/logger";
import { IntelFeedAgent } from "./agent";
import { fetchReddit } from "./sources/reddit";
import { fetchRSS } from "./sources/rss";
import type { Category, CategoryDigest, FeedItem } from "./types";

const AGENT_SCRIPT = join(import.meta.dir, "agent.py");

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3000";

/**
 * Run Python LangGraph agent to analyze items
 * Returns digests or null if failed
 */
async function runPythonAgent(items: FeedItem[]): Promise<CategoryDigest[] | null> {
  try {
    const itemsJson = JSON.stringify(items);
    logger.info({ itemCount: items.length }, "Running Python LangGraph agent...");

    const result =
      await $`uv run --with langgraph --with langchain-google-genai --with pydantic python3 ${AGENT_SCRIPT} ${itemsJson}`.text();

    const parsed = JSON.parse(result.trim());

    if (parsed.error) {
      logger.error({ error: parsed.error }, "Python agent returned error");
      return null;
    }

    logger.info({ digestCount: parsed.digests?.length ?? 0 }, "Python agent completed");
    return parsed.digests as CategoryDigest[];
  } catch (error) {
    logger.error({ error }, "Python agent failed, falling back to TypeScript");
    return null;
  }
}

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

    // 3. AI Analysis (Python LangGraph agent with TypeScript fallback)
    let digests: CategoryDigest[];

    // Try Python LangGraph agent first
    const pythonDigests = await runPythonAgent(newItems);

    if (pythonDigests !== null) {
      digests = pythonDigests;
    } else {
      // Fallback to TypeScript agent
      logger.info("Using TypeScript agent fallback...");
      const tsAgent = new IntelFeedAgent();

      logger.info("Scoring items with AI...");
      const scoredItems = await tsAgent.scoreItems(newItems);

      logger.info("Generating category digests...");
      digests = await tsAgent.generateDigests(scoredItems);
    }

    if (digests.length === 0) {
      logger.info("No items passed the relevance threshold");
      return { ok: true, itemCount: 0, categories: [] };
    }

    // 4. Send notifications (overview + individual articles per category)
    const notificationFormatter = new IntelFeedAgent();
    const notifications = notificationFormatter.formatNotifications(digests);
    const sentCategories: Category[] = [];
    const userId = config.telegram.allowedUserIds[0]; // Primary user for memory

    for (const [category, messages] of notifications) {
      let categorySuccess = true;

      for (let i = 0; i < messages.length; i++) {
        const sent = await notify(messages[i]);
        if (!sent) {
          logger.warn({ category, messageIndex: i }, "Failed to send notification");
          categorySuccess = false;
        }

        // Save overview (first message) to conversation memory
        if (i === 0 && sent) {
          contextManager.saveMessage(userId, "assistant", `[Intel Feed 每日推送]\n${messages[i]}`);
          logger.info({ category }, "Overview saved to memory");
        }

        // Small delay between notifications (avoid rate limiting)
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (categorySuccess) {
        sentCategories.push(category);
        logger.info({ category, messageCount: messages.length }, "Category notifications sent");
      }
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
 * Pause existing Intel Feed schedules.
 * News digest scheduling is deprecated and should remain disabled.
 */
export async function pauseIntelFeedSchedules(userId: number): Promise<number> {
  const { listSchedules, setScheduleEnabled } = await import("../scheduler");
  const existing = listSchedules(userId);

  const intelSchedules = existing.filter(
    (s) => s.enabled === 1 && s.task_type === "prompt" && s.task_data === "/intel-digest",
  );

  let pausedCount = 0;
  for (const schedule of intelSchedules) {
    if (setScheduleEnabled(schedule.id, false)) {
      pausedCount += 1;
    }
  }

  if (pausedCount > 0) {
    logger.info({ pausedCount }, "Paused Intel Feed schedules");
  }

  return pausedCount;
}
