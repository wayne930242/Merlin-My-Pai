import { MemoryService } from "../../../packages/capabilities/memory/src/application/service";
import type {
  MemoryEntry,
  MemoryQuery,
  SemanticMemoryEntry,
} from "../../../packages/capabilities/memory/src/domain/types";
import type { MemoryStore } from "../../../packages/capabilities/memory/src/interfaces/store";
import {
  findSimilarMemory,
  getMemory,
  listMemory,
  saveMemory,
  searchMemory,
  updateMemory,
} from "./long-term-memory";

function nowIso(): string {
  return new Date().toISOString();
}

function inferCategory(path: string): SemanticMemoryEntry["category"] {
  if (path.startsWith("preferences/")) return "preference";
  if (path.startsWith("knowledge/")) return "knowledge";
  return "fact";
}

function entryFromMemory(path: string, summary: string): SemanticMemoryEntry {
  return {
    id: `semantic:${path}`,
    tier: "semantic",
    key: path,
    value: summary,
    category: inferCategory(path),
    source: "workspace-memory-index",
    confidence: 0.8,
    tags: ["long-term"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

class WorkspaceLongTermStore implements MemoryStore {
  async save(entry: MemoryEntry): Promise<void> {
    if (entry.tier !== "semantic") return;

    const existing = await getMemory(entry.key);
    if (!existing) {
      await saveMemory(entry.key, {
        title: entry.key.replace(/\.md$/, "").split("/").pop() || entry.key,
        summary: entry.value,
        content: entry.value,
        tags: entry.tags,
      });
      return;
    }

    await updateMemory(entry.key, {
      summary: entry.value,
      tags: entry.tags,
    });
  }

  async listByTier(tier: MemoryEntry["tier"]): Promise<MemoryEntry[]> {
    if (tier !== "semantic") return [];
    const entries = await listMemory();
    return entries.map((entry) => entryFromMemory(entry.path, entry.summary));
  }

  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (query.tiers && !query.tiers.includes("semantic")) {
      return [];
    }

    const keywords = query.text
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (keywords.length === 0) return [];

    const results = await searchMemory(keywords, query.limit ?? 10);
    return results.map((result) => ({
      id: `semantic:${result.path}`,
      tier: "semantic" as const,
      key: result.path,
      value: result.summary || result.content,
      category: inferCategory(result.path),
      source: "workspace-memory-file",
      confidence: 0.8,
      tags: result.tags,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));
  }

  async deleteExpiredWorking(): Promise<number> {
    return 0;
  }
}

const service = new MemoryService(new WorkspaceLongTermStore());

export async function semanticSearch(keywords: string[], limit = 10): Promise<Array<{
  path: string;
  summary: string;
  score: number;
}>> {
  const entries = await service.retrieveContext({
    text: keywords.join(" "),
    tiers: ["semantic"],
    limit,
  });

  return entries
    .map((entry) => ({
      path: (entry as SemanticMemoryEntry).key,
      summary: (entry as SemanticMemoryEntry).value,
      score: 1,
    }))
    .slice(0, limit);
}

export async function semanticFindSimilar(
  keywords: string[],
  category?: string,
  limit = 5
): Promise<Array<{ path: string; title: string; summary: string; score: number }>> {
  const results = await findSimilarMemory(keywords, category, limit);
  return results.map((result) => ({
    path: result.memory.path,
    title: result.memory.title,
    summary: result.memory.summary,
    score: result.score,
  }));
}

export async function semanticUpsert(args: {
  path: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
}): Promise<void> {
  await service.upsertSemantic({
    id: `semantic:${args.path}`,
    tier: "semantic",
    key: args.path,
    value: args.summary,
    category: inferCategory(args.path),
    source: "memory-cli",
    confidence: 0.95,
    tags: args.tags,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const existing = await getMemory(args.path);
  if (!existing) {
    await saveMemory(args.path, {
      title: args.title,
      summary: args.summary,
      content: args.content,
      tags: args.tags,
    });
    return;
  }

  await updateMemory(args.path, {
    summary: args.summary,
    content: args.content,
    tags: args.tags,
  });
}
