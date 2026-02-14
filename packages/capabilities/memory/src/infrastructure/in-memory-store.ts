import type { MemoryEntry, MemoryQuery } from "../domain/types";
import type { MemoryStore } from "../interfaces/store";

export class InMemoryStore implements MemoryStore {
  private entries: MemoryEntry[] = [];

  async save(entry: MemoryEntry): Promise<void> {
    const index = this.entries.findIndex((e) => e.id === entry.id);
    if (index >= 0) {
      this.entries[index] = entry;
      return;
    }
    this.entries.push(entry);
  }

  async listByTier(tier: MemoryEntry["tier"]): Promise<MemoryEntry[]> {
    return this.entries.filter((entry) => entry.tier === tier);
  }

  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    const text = query.text.toLowerCase();
    const limit = query.limit ?? 10;

    return this.entries
      .filter((entry) => {
        if (query.tiers && !query.tiers.includes(entry.tier)) return false;
        if (query.tags && !query.tags.every((tag) => entry.tags.includes(tag))) return false;

        return JSON.stringify(entry).toLowerCase().includes(text);
      })
      .slice(0, limit);
  }

  async deleteExpiredWorking(nowIso: string): Promise<number> {
    const nowMs = Date.parse(nowIso);
    const before = this.entries.length;

    this.entries = this.entries.filter((entry) => {
      if (entry.tier !== "working") return true;

      const createdMs = Date.parse(entry.createdAt);
      return createdMs + entry.ttlSeconds * 1000 > nowMs;
    });

    return before - this.entries.length;
  }
}
