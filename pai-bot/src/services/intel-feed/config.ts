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
  // General Tech
  "https://hnrss.org/frontpage?points=100", // Hacker News (100+ points)
  "https://simonwillison.net/atom/everything/", // Simon Willison - AI/Python

  // AI/Tech
  "https://openai.com/blog/rss.xml", // OpenAI Blog
  "https://blog.google/technology/ai/rss/", // Google AI Blog
  "https://huyenchip.com/feed.xml", // Chip Huyen - MLOps
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_the_batch.xml", // DeepLearning.AI
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_cursor.xml", // Cursor Blog

  // Anthropic/Claude
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml", // Anthropic News
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_changelog_claude_code.xml", // Claude Code Changelog

  // Startup
  "https://steveblank.com/feed/", // Steve Blank - Lean Startup
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_paulgraham.xml", // Paul Graham Essays
  "https://www.ycombinator.com/blog/feed/", // YC Blog
  "https://www.lennysnewsletter.com/feed", // Lenny's Newsletter - Product
  "https://lethain.com/feeds/", // Will Larson - Engineering Leadership
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_chanderramesh.xml", // Chander Ramesh - Startup Philosophy

  // AI Engineering
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_hamel.xml", // Hamel Husain - LLM Evals
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_blogsurgeai.xml", // Surge AI - Data Quality
  "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_xainews.xml", // xAI News

  // 中文 Tech
  "http://feeds.feedburner.com/ihower", // ihower - AI Engineer 電子報
  "https://blog.huli.tw/atom-ch.xml", // Huli - JS/Security

  // TRPG
  "https://slyflourish.com/index.xml", // Sly Flourish - DM Tips
  "https://gnomestew.com/feed/", // Gnome Stew - GM Tips
  "https://thealexandrian.net/feed", // The Alexandrian - Game Design
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
