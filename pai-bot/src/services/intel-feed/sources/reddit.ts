/**
 * Reddit data source using native JSON endpoint (no API key required)
 */

import { REDDIT_LIMIT, SUBREDDITS } from "../config";
import type { Category, FeedItem } from "../types";

const BASE_URL = "https://www.reddit.com";

interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  score: number;
  num_comments: number;
  author: string;
  created_utc: number;
  selftext?: string;
  stickied?: boolean;
}

interface RedditResponse {
  data: {
    children: Array<{ data: RedditPost }>;
  };
}

export async function fetchReddit(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  for (const [category, subs] of Object.entries(SUBREDDITS)) {
    for (const subreddit of subs) {
      try {
        const subItems = await fetchSubreddit(subreddit, category as Category);
        items.push(...subItems);
      } catch (error) {
        console.error(`Error fetching r/${subreddit}:`, error);
      }
    }
  }

  return items;
}

async function fetchSubreddit(subreddit: string, category: Category): Promise<FeedItem[]> {
  const url = `${BASE_URL}/r/${subreddit}/hot.json?limit=${REDDIT_LIMIT}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "pai-bot/1.0 (personal news aggregator)",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = (await response.json()) as RedditResponse;
  const items: FeedItem[] = [];

  for (const child of data.data.children) {
    const post = child.data;

    // Skip stickied posts (mod announcements)
    if (post.stickied) continue;

    items.push({
      id: post.id,
      source: "reddit",
      sourceName: `r/${subreddit}`,
      category,
      title: post.title,
      url: `https://reddit.com${post.permalink}`,
      score: post.score,
      comments: post.num_comments,
      author: post.author,
      publishedAt: new Date(post.created_utc * 1000),
      summary: post.selftext?.slice(0, 300) || undefined,
    });
  }

  return items;
}
