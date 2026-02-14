import { MemoryService } from "../../../packages/capabilities/memory/src/application/service";
import type {
  MemoryEntry,
  MemoryQuery,
  WorkingMemoryEntry,
} from "../../../packages/capabilities/memory/src/domain/types";
import type { MemoryStore } from "../../../packages/capabilities/memory/src/interfaces/store";
import { type Memory, memoryManager } from "./manager";

export interface MemoryManagerLike {
  save(input: {
    userId: number;
    content: string;
    category?: string;
    importance?: number;
  }): Promise<number | null>;
  searchByKeywords(userId: number, keywords: string[], limit?: number): Memory[];
  count(userId: number): number;
  enforceLimit(userId: number): number;
  getAll(userId: number): Memory[];
}

class BotMemoryStore implements MemoryStore {
  constructor(
    private readonly userId: number,
    private readonly manager: MemoryManagerLike,
  ) {}

  async save(entry: MemoryEntry): Promise<void> {
    if (entry.tier === "working") {
      await this.manager.save({
        userId: this.userId,
        content: entry.content,
        category: entry.tags[0] || "context",
        importance: 1,
      });
      return;
    }

    if (entry.tier === "episodic") {
      await this.manager.save({
        userId: this.userId,
        content: entry.summary,
        category: entry.eventType,
        importance: 2,
      });
      return;
    }

    if (entry.tier === "semantic") {
      await this.manager.save({
        userId: this.userId,
        content: entry.value,
        category: entry.category,
        importance: 3,
      });
      return;
    }

    await this.manager.save({
      userId: this.userId,
      content: `${entry.name}: ${entry.instruction}`,
      category: "procedure",
      importance: 2,
    });
  }

  async listByTier(tier: MemoryEntry["tier"]): Promise<MemoryEntry[]> {
    const rows = this.manager.getAll(this.userId);
    const mapped = rows.map((row) => this.toWorkingEntry(row));
    return tier === "working" ? mapped : [];
  }

  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    const keywords = query.text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

    const rows = this.manager.searchByKeywords(this.userId, keywords, query.limit ?? 10);
    return rows.map((row) => this.toWorkingEntry(row));
  }

  async deleteExpiredWorking(): Promise<number> {
    return this.manager.enforceLimit(this.userId);
  }

  private toWorkingEntry(row: Memory): WorkingMemoryEntry {
    const now = new Date().toISOString();
    return {
      id: `working:${row.id}`,
      tier: "working",
      content: row.content,
      ttlSeconds: 7 * 24 * 60 * 60,
      source: "pai-bot-memory",
      confidence: 0.8,
      tags: [row.category],
      createdAt: row.createdAt || now,
      updatedAt: row.lastAccessed || now,
    };
  }
}

export interface SaveShortTermInput {
  content: string;
  category?: string;
  importance?: number;
}

export function createMemoryCapabilityForUser(
  userId: number,
  manager: MemoryManagerLike = memoryManager,
) {
  const service = new MemoryService(new BotMemoryStore(userId, manager));

  return {
    async saveShortTerm(input: SaveShortTermInput): Promise<number | null> {
      const before = manager.count(userId);

      await service.rememberWorking({
        id: `working:${userId}:${Date.now()}`,
        tier: "working",
        content: input.content,
        ttlSeconds: 7 * 24 * 60 * 60,
        source: "api",
        confidence: Math.min(Math.max((input.importance || 1) / 5, 0.1), 1),
        tags: [input.category || "context"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return manager.count(userId) > before ? manager.count(userId) : null;
    },

    async search(keywords: string[], limit = 10) {
      const entries = await service.retrieveContext({
        text: keywords.join(" "),
        tiers: ["working"],
        limit,
      });

      return entries.map((entry) => {
        const working = entry as WorkingMemoryEntry;
        return {
          id: Number(working.id.replace("working:", "")) || 0,
          content: working.content,
          category: working.tags[0] || "context",
          importance: 1,
        };
      });
    },

    count(): number {
      return manager.count(userId);
    },

    cleanup(): number {
      return manager.enforceLimit(userId);
    },
  };
}
