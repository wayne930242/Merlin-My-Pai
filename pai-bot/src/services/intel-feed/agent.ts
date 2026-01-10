/**
 * Intel Feed AI Agent
 * Uses Gemini for multi-round analysis
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../../utils/logger";
import { CATEGORY_META, ITEMS_PER_CATEGORY, MIN_RELEVANCE_SCORE } from "./config";
import type { Category, CategoryDigest, DigestItem, FeedItem, ScoredItem } from "./types";

const SCORE_PROMPT = `你是一個內容評分助手。評估以下文章對一個關注 AI/技術、創業、生產力工具和 TRPG 的開發者的相關性。

評分標準（1-10）：
- 1-3: 不相關或低品質（廣告、重複、無實質內容）
- 4-5: 一般內容，沒有特別價值
- 6-7: 有價值的內容，值得了解
- 8-10: 高價值內容，必讀

只回覆一個數字（1-10），不要其他文字。

標題：{title}
來源：{source}
類別：{category}
摘要：{summary}`;

const SUMMARIZE_PROMPT = `你是一個專業的技術內容摘要助手。

請為以下文章生成一個簡潔的一句話摘要（20-30字），重點說明為什麼這篇值得看。

標題：{title}
來源：{source}
原始摘要：{summary}

只回覆摘要，不要其他文字。使用繁體中文。`;

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
   * Round 1: Score items by relevance
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
        .replace("{category}", item.category)
        .replace("{summary}", item.summary || "無");

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { maxOutputTokens: 10 },
      });

      const scoreText = response.text?.trim() || "5";
      const score = Math.min(10, Math.max(1, Number.parseInt(scoreText, 10) || 5));

      return { ...item, relevanceScore: score };
    } catch (error) {
      logger.warn({ error, title: item.title }, "Failed to score item");
      return { ...item, relevanceScore: 5 }; // Default score on error
    }
  }

  /**
   * Round 2: Filter and generate digests by category
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

      // Generate summaries
      const digestItems: DigestItem[] = [];
      for (const item of topItems) {
        const summary = await this.generateSummary(item);
        digestItems.push({
          title: item.title,
          summary,
          url: item.url,
          source: item.sourceName,
        });
      }

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

  private async generateSummary(item: ScoredItem): Promise<string> {
    try {
      const prompt = SUMMARIZE_PROMPT.replace("{title}", item.title)
        .replace("{source}", item.sourceName)
        .replace("{summary}", item.summary || "無");

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { maxOutputTokens: 100 },
      });

      return response.text?.trim() || item.title;
    } catch (error) {
      logger.warn({ error, title: item.title }, "Failed to generate summary");
      return item.title; // Fallback to title
    }
  }

  /**
   * Format digests as notification messages
   */
  formatNotifications(digests: CategoryDigest[]): Map<Category, string> {
    const notifications = new Map<Category, string>();

    for (const digest of digests) {
      const lines: string[] = [
        `${digest.emoji} ${digest.label}（${digest.items.length} 則精選）`,
        "",
      ];

      for (let i = 0; i < digest.items.length; i++) {
        const item = digest.items[i];
        lines.push(`${i + 1}. ${item.title}`);
        lines.push(`   ${item.summary}`);
        lines.push(`   ${item.url}`);
        lines.push("");
      }

      notifications.set(digest.category, lines.join("\n").trim());
    }

    return notifications;
  }
}
