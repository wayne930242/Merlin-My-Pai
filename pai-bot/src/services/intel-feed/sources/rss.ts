/**
 * RSS/Atom feed source
 */

import { RSS_FEEDS } from "../config";
import type { FeedItem } from "../types";

// Only include items published within this many hours
const MAX_AGE_HOURS = 24;

// Simple XML parsing for RSS feeds
interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

export async function fetchRSS(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feedItems = await fetchFeed(feedUrl);
      items.push(...feedItems);
    } catch (error) {
      console.error(`Error fetching RSS ${feedUrl}:`, error);
    }
  }

  return items;
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "pai-bot/1.0 (personal news aggregator)",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch error: ${response.status}`);
  }

  const xml = await response.text();
  const feedTitle = extractFeedTitle(xml);
  const rssItems = parseRSSItems(xml);

  const now = Date.now();
  const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

  return rssItems
    .slice(0, 20)
    .map((item) => ({
      id: hashString(item.guid || item.link),
      source: "rss" as const,
      sourceName: feedTitle,
      category: categorizeRSSFeed(url),
      title: item.title,
      url: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      summary: item.description?.slice(0, 300) || undefined,
    }))
    .filter((item) => {
      if (!item.publishedAt) return false;
      return now - item.publishedAt.getTime() <= maxAgeMs;
    });
}

function extractFeedTitle(xml: string): string {
  // Try RSS format
  const rssMatch = xml.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/);
  if (rssMatch) return decodeEntities(rssMatch[1]);

  // Try Atom format
  const atomMatch = xml.match(/<feed[\s\S]*?<title>([^<]+)<\/title>/);
  if (atomMatch) return decodeEntities(atomMatch[1]);

  return "Unknown Feed";
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Try RSS format (item tags)
  const rssItemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, "title"),
      link: extractTag(itemXml, "link"),
      description: extractTag(itemXml, "description"),
      pubDate: extractTag(itemXml, "pubDate"),
      guid: extractTag(itemXml, "guid"),
    });
  }

  // Try Atom format (entry tags)
  if (items.length === 0) {
    const atomEntryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
    while ((match = atomEntryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
      items.push({
        title: extractTag(entryXml, "title"),
        link: linkMatch?.[1] || "",
        description: extractTag(entryXml, "summary") || extractTag(entryXml, "content"),
        pubDate: extractTag(entryXml, "published") || extractTag(entryXml, "updated"),
        guid: extractTag(entryXml, "id"),
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Regular tag
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? decodeEntities(match[1].trim()) : "";
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function categorizeRSSFeed(_url: string): "ai" | "startup" | "productivity" | "trpg" {
  // All current RSS feeds are tech-related
  return "ai";
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}
