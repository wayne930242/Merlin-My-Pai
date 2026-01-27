/**
 * Long-term Memory Core Library
 *
 * Manages memory files with YAML frontmatter format.
 * Memory structure:
 * ---
 * title: string
 * path: string
 * summary: string
 * updated: YYYY-MM-DD
 * tags: string[]
 * ---
 * # Content
 */

import { join } from "path";

// Memory root directory
const MEMORY_ROOT = join(import.meta.dir, "..", "..", "memory");

export function getMemoryRoot(): string {
  return MEMORY_ROOT;
}

export interface MemoryMeta {
  title: string;
  path: string;
  summary: string;
  updated: string;
  tags: string[];
}

export interface MemoryData extends MemoryMeta {
  content: string;
}

export interface IndexEntry {
  path: string;
  summary: string;
  updated: string;
}

/**
 * Parse YAML frontmatter from content
 */
export function parseFrontmatter(content: string): {
  meta: Partial<MemoryMeta>;
  content: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { meta: {}, content: content.trim() };
  }

  const yamlContent = frontmatterMatch[1];
  const bodyContent = frontmatterMatch[2].trim();

  const meta: Partial<MemoryMeta> = {};

  // Parse YAML manually (simple key: value format)
  for (const line of yamlContent.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value: string | string[] = rawValue.trim();

    // Handle array format: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else {
      // Remove quotes if present
      value = value.replace(/^['"]|['"]$/g, "");
    }

    (meta as Record<string, unknown>)[key] = value;
  }

  return { meta, content: bodyContent };
}

/**
 * Generate YAML frontmatter from metadata
 */
export function generateFrontmatter(meta: MemoryMeta): string {
  const lines = ["---"];
  lines.push(`title: ${meta.title}`);
  lines.push(`path: ${meta.path}`);
  lines.push(`summary: ${meta.summary}`);
  lines.push(`updated: ${meta.updated}`);
  lines.push(`tags: [${meta.tags.join(", ")}]`);
  lines.push("---");
  return lines.join("\n");
}

/**
 * Read the memory index file
 */
export async function readIndex(): Promise<Map<string, IndexEntry>> {
  const indexPath = join(MEMORY_ROOT, "index.md");
  const entries = new Map<string, IndexEntry>();

  try {
    const content = await Bun.file(indexPath).text();
    const lines = content.split("\n");

    for (const line of lines) {
      // Parse table row: | path | summary | date |
      const match = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/);
      if (!match) continue;

      const [, pathCell, summaryCell, dateCell] = match;
      const path = pathCell.trim();
      const summary = summaryCell.trim();
      const updated = dateCell.trim();

      // Skip header rows
      if (path === "檔案" || path.startsWith("-")) continue;
      if (!path || !path.endsWith(".md")) continue;

      entries.set(path, { path, summary, updated });
    }
  } catch {
    // Index doesn't exist yet
  }

  return entries;
}

/**
 * Update the memory index
 */
export async function updateIndex(
  memoryPath: string,
  summary: string,
  updated?: string
): Promise<void> {
  const indexPath = join(MEMORY_ROOT, "index.md");
  const entries = await readIndex();

  // Update or add entry
  entries.set(memoryPath, {
    path: memoryPath,
    summary,
    updated: updated || new Date().toISOString().split("T")[0],
  });

  // Organize entries by category
  const categories: Record<string, IndexEntry[]> = {
    preferences: [],
    knowledge: [],
    events: [],
  };

  for (const entry of entries.values()) {
    const category = entry.path.split("/")[0];
    if (category in categories) {
      categories[category].push(entry);
    }
  }

  // Generate index content
  const lines = [
    "---",
    "title: Memory Index",
    `updated: ${new Date().toISOString().split("T")[0]}`,
    "---",
    "",
    "# 長期記憶索引",
    "",
    "此文件由系統自動維護。",
    "",
  ];

  for (const [category, categoryEntries] of Object.entries(categories)) {
    lines.push(`## ${category}/`);
    lines.push("| 檔案 | 摘要 | 更新日期 |");
    lines.push("|------|------|----------|");

    for (const entry of categoryEntries.sort((a, b) => a.path.localeCompare(b.path))) {
      lines.push(`| ${entry.path} | ${entry.summary} | ${entry.updated} |`);
    }

    lines.push("");
  }

  await Bun.write(indexPath, lines.join("\n"));
}

/**
 * Get a memory file by path
 */
export async function getMemory(memoryPath: string): Promise<MemoryData | null> {
  const fullPath = join(MEMORY_ROOT, memoryPath);

  try {
    const content = await Bun.file(fullPath).text();
    const { meta, content: bodyContent } = parseFrontmatter(content);

    return {
      title: (meta.title as string) || "",
      path: (meta.path as string) || memoryPath,
      summary: (meta.summary as string) || "",
      updated: (meta.updated as string) || "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      content: bodyContent,
    };
  } catch {
    return null;
  }
}

/**
 * Save a memory file
 */
export async function saveMemory(
  memoryPath: string,
  data: {
    title: string;
    summary: string;
    content: string;
    tags?: string[];
  }
): Promise<void> {
  const fullPath = join(MEMORY_ROOT, memoryPath);
  const updated = new Date().toISOString().split("T")[0];

  const meta: MemoryMeta = {
    title: data.title,
    path: memoryPath,
    summary: data.summary,
    updated,
    tags: data.tags || [],
  };

  const frontmatter = generateFrontmatter(meta);
  const fileContent = `${frontmatter}\n\n${data.content}\n`;

  // Ensure directory exists
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  await Bun.write(join(dir, ".gitkeep"), ""); // Ensure dir exists
  await Bun.write(fullPath, fileContent);

  // Update index
  await updateIndex(memoryPath, data.summary, updated);
}

/**
 * Search memories by keywords
 */
export async function searchMemory(
  keywords: string[],
  limit = 10
): Promise<MemoryData[]> {
  const results: MemoryData[] = [];
  const entries = await readIndex();

  // Search in all memory files
  for (const entry of entries.values()) {
    const memory = await getMemory(entry.path);
    if (!memory) continue;

    // Check if any keyword matches
    const searchText = `${memory.title} ${memory.summary} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
    const matches = keywords.some((kw) => searchText.includes(kw.toLowerCase()));

    if (matches) {
      results.push(memory);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Find similar memories by keywords and optional category
 * Returns memories with relevance score
 */
export async function findSimilarMemory(
  keywords: string[],
  category?: string,
  limit = 5
): Promise<Array<{ memory: MemoryData; score: number }>> {
  const entries = await readIndex();
  const scored: Array<{ memory: MemoryData; score: number }> = [];

  for (const entry of entries.values()) {
    // Filter by category if specified
    if (category && !entry.path.startsWith(`${category}/`)) continue;

    const memory = await getMemory(entry.path);
    if (!memory) continue;

    // Calculate relevance score
    const searchText = `${memory.title} ${memory.summary} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) {
        score++;
        // Bonus for title/summary match
        if (memory.title.toLowerCase().includes(kw.toLowerCase())) score++;
        if (memory.summary.toLowerCase().includes(kw.toLowerCase())) score++;
      }
    }

    if (score > 0) {
      scored.push({ memory, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Update an existing memory file (merge content)
 */
export async function updateMemory(
  memoryPath: string,
  data: {
    summary?: string;
    content?: string;
    tags?: string[];
    appendContent?: boolean; // If true, append content instead of replace
  }
): Promise<boolean> {
  const existing = await getMemory(memoryPath);
  if (!existing) return false;

  const fullPath = join(MEMORY_ROOT, memoryPath);
  const updated = new Date().toISOString().split("T")[0];

  // Merge data
  const newContent = data.appendContent && data.content
    ? `${existing.content}\n\n${data.content}`
    : data.content || existing.content;

  const newTags = data.tags
    ? [...new Set([...existing.tags, ...data.tags])]
    : existing.tags;

  const meta: MemoryMeta = {
    title: existing.title,
    path: memoryPath,
    summary: data.summary || existing.summary,
    updated,
    tags: newTags,
  };

  const frontmatter = generateFrontmatter(meta);
  const fileContent = `${frontmatter}\n\n${newContent}\n`;

  await Bun.write(fullPath, fileContent);

  // Update index
  await updateIndex(memoryPath, meta.summary, updated);

  return true;
}

/**
 * List all memories
 */
export async function listMemory(): Promise<IndexEntry[]> {
  const entries = await readIndex();
  return Array.from(entries.values()).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Initialize memory directory structure
 */
export async function initMemory(): Promise<void> {
  const dirs = ["preferences", "knowledge", "events"];

  for (const dir of dirs) {
    const dirPath = join(MEMORY_ROOT, dir);
    await Bun.write(join(dirPath, ".gitkeep"), "");
  }

  // Create index if not exists
  const indexPath = join(MEMORY_ROOT, "index.md");
  const indexExists = await Bun.file(indexPath).exists();

  if (!indexExists) {
    const indexContent = [
      "---",
      "title: Memory Index",
      `updated: ${new Date().toISOString().split("T")[0]}`,
      "---",
      "",
      "# 長期記憶索引",
      "",
      "此文件由系統自動維護。",
      "",
      "## preferences/",
      "| 檔案 | 摘要 | 更新日期 |",
      "|------|------|----------|",
      "",
      "## knowledge/",
      "| 檔案 | 摘要 | 更新日期 |",
      "|------|------|----------|",
      "",
      "## events/",
      "| 檔案 | 摘要 | 更新日期 |",
      "|------|------|----------|",
      "",
    ].join("\n");

    await Bun.write(indexPath, indexContent);
  }

  // Create user-profile if not exists
  const profilePath = join(MEMORY_ROOT, "user-profile.md");
  const profileExists = await Bun.file(profilePath).exists();

  if (!profileExists) {
    const profileContent = [
      "---",
      "title: 用戶資料",
      "path: user-profile.md",
      "summary: 基本資訊、身份、角色",
      `updated: ${new Date().toISOString().split("T")[0]}`,
      "tags: [profile, identity]",
      "---",
      "",
      "# 用戶資料",
      "",
      "（由系統自動填充）",
      "",
    ].join("\n");

    await Bun.write(profilePath, profileContent);
  }
}
