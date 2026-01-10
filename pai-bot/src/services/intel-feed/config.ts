/**
 * Intel Feed Configuration
 */

import type { Category } from "./types";

export const SUBREDDITS: Record<Category, string[]> = {
  ai: ["programming", "LocalLLaMA", "MachineLearning", "ClaudeAI", "SideProject"],
  startup: ["startups", "Entrepreneur", "SaaS", "indiehackers"],
  productivity: ["productivity", "selfhosted", "ObsidianMD"],
  trpg: ["rpg", "DMAcademy", "Solo_Roleplaying", "RPGdesign", "osr"],
};

export const RSS_FEEDS = [
  "https://hnrss.org/frontpage?points=100",
  "https://www.theverge.com/rss/index.xml",
  "https://simonwillison.net/atom/everything/",
];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  ai: { label: "AI/技術", emoji: "🤖" },
  startup: { label: "創業/產品", emoji: "💼" },
  productivity: { label: "生產力", emoji: "🎯" },
  trpg: { label: "TRPG", emoji: "🎲" },
};

// Items per subreddit
export const REDDIT_LIMIT = 10;

// Items to keep per category after filtering
export const ITEMS_PER_CATEGORY = 3;

// Minimum relevance score to keep (1-10)
export const MIN_RELEVANCE_SCORE = 6;
