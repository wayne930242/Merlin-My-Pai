/**
 * Intel Feed Types
 */

export type Category = "ai" | "startup" | "productivity" | "trpg";

export interface FeedItem {
  id: string;
  source: "reddit" | "rss";
  sourceName: string; // r/LocalLLaMA or feed title
  category: Category;
  title: string;
  url: string;
  score?: number; // Reddit score
  comments?: number;
  author?: string;
  publishedAt?: Date;
  summary?: string;
}

export interface ScoredItem extends FeedItem {
  relevanceScore: number; // 1-10 from Gemini
}

export interface DigestItem {
  title: string;
  summary: string;
  url: string;
  source: string;
}

export interface CategoryDigest {
  category: Category;
  label: string;
  emoji: string;
  items: DigestItem[];
}
