/**
 * Intel Feed AI Agent
 * Uses Gemini with two-stage processing (lite → flash)
 * Inspired by agentic_rag.py pattern
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../../utils/logger";
import { CATEGORY_META, ITEMS_PER_CATEGORY, MIN_RELEVANCE_SCORE } from "./config";
import type { Category, CategoryDigest, DigestItem, FeedItem, ScoredItem } from "./types";

// Models
const LITE_MODEL = "gemini-2.5-flash-lite"; // Simple tasks: scoring, outline
const MAIN_MODEL = "gemini-2.5-flash"; // Complex tasks: final formatting

// Prompts
const SCORE_PROMPT = `You are a content scoring assistant. Rate the relevance of this article for a developer interested in AI/tech, startups, productivity tools, and TRPG.

Scoring criteria (1-10):
- 1-3: Irrelevant or low quality (ads, duplicates, no substance)
- 4-5: Generic content, no special value
- 6-7: Interesting, original, or valuable content worth knowing
- 8-10: High value content, must read

Reply with only a number (1-10), nothing else.

Title: {title}
Source: {source}
Category: {category}`;

const OUTLINE_PROMPT = `You are a senior tech editor. Create a detailed outline for the following articles to help readers quickly understand today's highlights.

Requirements:
1. Write 2-3 sentences per article explaining the core idea and why it matters
2. Point out connections between articles if any
3. Use English
4. Total length: 800-1000 words

Articles:
{articles}

Output the outline directly, no prefix.`;

const FORMAT_PROMPT = `你是一位 Telegram 推送編輯。請將以下綱要整理成適合 Telegram 推送的格式。

要求：
1. 每篇文章寫 150-250 字的摘要
2. 包含：核心觀點、關鍵發現、為什麼值得關注
3. 可用 • 條列重點
4. 語氣專業但易讀
5. **必須使用繁體中文**（不可使用簡體中文或英文，所有內容都要翻譯成繁體中文）

原始綱要：
{outline}

文章資訊（用於格式化）：
{articles}

輸出格式（每篇文章）：
標題
摘要內容（150-250字）
---

請直接輸出，不要額外說明。`;

export class IntelFeedAgent {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Round 1: Score items by relevance (uses lite model)
   */
  async scoreItems(items: FeedItem[]): Promise<ScoredItem[]> {
    const scored: ScoredItem[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((item) => this.scoreItem(item)));
      scored.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return scored;
  }

  private async scoreItem(item: FeedItem): Promise<ScoredItem> {
    try {
      const prompt = SCORE_PROMPT.replace("{title}", item.title)
        .replace("{source}", item.sourceName)
        .replace("{category}", item.category);

      const response = await this.ai.models.generateContent({
        model: LITE_MODEL,
        contents: prompt,
        config: { maxOutputTokens: 10 },
      });

      const scoreText = response.text?.trim() || "5";
      const score = Math.min(10, Math.max(1, Number.parseInt(scoreText, 10) || 5));

      return { ...item, relevanceScore: score };
    } catch (error) {
      logger.warn({ error, title: item.title }, "Failed to score item");
      return { ...item, relevanceScore: 5 };
    }
  }

  /**
   * Round 2: Generate digests with two-stage processing
   * Stage 1 (lite): Create detailed outline (~1000 chars)
   * Stage 2 (flash): Refine into notification format
   */
  async generateDigests(items: ScoredItem[]): Promise<CategoryDigest[]> {
    // Filter by minimum score
    const filtered = items.filter((item) => item.relevanceScore >= MIN_RELEVANCE_SCORE);

    // Group by category
    const byCategory = new Map<Category, ScoredItem[]>();
    for (const item of filtered) {
      const existing = byCategory.get(item.category) || [];
      existing.push(item);
      byCategory.set(item.category, existing);
    }

    const digests: CategoryDigest[] = [];

    for (const [category, categoryItems] of byCategory) {
      // Sort by score, take top N
      const topItems = categoryItems
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, ITEMS_PER_CATEGORY);

      if (topItems.length === 0) continue;

      logger.info({ category, count: topItems.length }, "Processing category");

      // Stage 1: Generate outline with lite model
      const outline = await this.generateOutline(topItems);

      // Stage 2: Format with main model
      const digestItems = await this.formatDigest(topItems, outline);

      const meta = CATEGORY_META[category];
      digests.push({
        category,
        label: meta.label,
        emoji: meta.emoji,
        items: digestItems,
      });
    }

    return digests;
  }

  /**
   * Stage 1: Generate detailed outline (lite model)
   */
  private async generateOutline(items: ScoredItem[]): Promise<string> {
    try {
      const articlesText = items
        .map(
          (item, i) =>
            `${i + 1}. 【${item.sourceName}】${item.title}\n   ${item.summary || "無摘要"}\n   連結：${item.url}`,
        )
        .join("\n\n");

      const prompt = OUTLINE_PROMPT.replace("{articles}", articlesText);

      const response = await this.ai.models.generateContent({
        model: MAIN_MODEL,
        contents: prompt,
        config: { maxOutputTokens: 2000 },
      });

      const outline = response.text?.trim() || "";
      logger.info({ length: outline.length }, "Generated outline with flash");
      return outline;
    } catch (error) {
      logger.error({ error }, "Failed to generate outline");
      // Fallback: return basic info
      return items.map((item) => `${item.title}: ${item.summary || "無摘要"}`).join("\n");
    }
  }

  /**
   * Stage 2: Format into notification (main model)
   */
  private async formatDigest(items: ScoredItem[], outline: string): Promise<DigestItem[]> {
    try {
      const articlesText = items
        .map(
          (item, i) => `${i + 1}. ${item.title}\n   來源：${item.sourceName}\n   連結：${item.url}`,
        )
        .join("\n\n");

      const prompt = FORMAT_PROMPT.replace("{outline}", outline).replace(
        "{articles}",
        articlesText,
      );

      const response = await this.ai.models.generateContent({
        model: MAIN_MODEL,
        contents: prompt,
        config: { maxOutputTokens: 4000 },
      });

      const formatted = response.text?.trim() || "";

      // Parse response into DigestItems
      return this.parseFormattedResponse(formatted, items);
    } catch (error) {
      logger.error({ error }, "Failed to format digest");
      // Fallback: use outline directly
      return items.map((item) => ({
        title: item.title,
        summary: item.summary || "無摘要",
        url: item.url,
        source: item.sourceName,
      }));
    }
  }

  /**
   * Parse formatted response into DigestItems
   */
  private parseFormattedResponse(response: string, items: ScoredItem[]): DigestItem[] {
    const blocks = response.split("---").filter((b) => b.trim());
    const digestItems: DigestItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const block = blocks[i]?.trim();

      if (block) {
        // Extract summary from block (skip first line which is title)
        const lines = block.split("\n").filter((l) => l.trim());
        const summary = lines.slice(1).join("\n").trim() || item.summary || "無摘要";

        digestItems.push({
          title: item.title,
          summary,
          url: item.url,
          source: item.sourceName,
        });
      } else {
        // Fallback if parsing fails
        digestItems.push({
          title: item.title,
          summary: item.summary || "無摘要",
          url: item.url,
          source: item.sourceName,
        });
      }
    }

    return digestItems;
  }

  /**
   * Format digests as notification messages
   * Returns: category overview + individual article notifications
   */
  formatNotifications(digests: CategoryDigest[]): Map<Category, string[]> {
    const notifications = new Map<Category, string[]>();

    for (const digest of digests) {
      const messages: string[] = [];

      // 1. Category overview (titles + links)
      const overviewLines: string[] = [
        `${digest.emoji} ${digest.label}（${digest.items.length} 則精選）`,
        "",
      ];
      for (let i = 0; i < digest.items.length; i++) {
        const item = digest.items[i];
        overviewLines.push(`${i + 1}. ${item.title}`);
        overviewLines.push(`   ${item.url}`);
      }
      messages.push(overviewLines.join("\n"));

      // 2. Individual article notifications
      for (let i = 0; i < digest.items.length; i++) {
        const item = digest.items[i];
        const articleLines: string[] = [`📰 ${item.title}`, "", item.summary, "", `🔗 ${item.url}`];
        messages.push(articleLines.join("\n"));
      }

      notifications.set(digest.category, messages);
    }

    return notifications;
  }
}
