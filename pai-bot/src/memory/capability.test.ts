import { describe, expect, test } from "bun:test";

import { createMemoryCapabilityForUser, type MemoryManagerLike } from "./capability";

class FakeMemoryManager implements MemoryManagerLike {
  public rows: Array<{ id: number; content: string; category: string; importance: number }> = [];
  private id = 0;

  async save(input: {
    userId: number;
    content: string;
    category?: string;
    importance?: number;
  }): Promise<number | null> {
    if (this.rows.some((r) => r.content === input.content)) {
      return null;
    }

    this.id += 1;
    this.rows.push({
      id: this.id,
      content: input.content,
      category: input.category || "general",
      importance: input.importance || 0,
    });
    return this.id;
  }

  searchByKeywords(_userId: number, keywords: string[], limit = 10) {
    return this.rows
      .filter((row) => keywords.some((k) => row.content.includes(k)))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        userId: 1,
        content: row.content,
        category: row.category,
        importance: row.importance,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      }));
  }

  count(): number {
    return this.rows.length;
  }

  enforceLimit(): number {
    return 0;
  }

  getAll(_userId: number) {
    return this.rows.map((row) => ({
      id: row.id,
      userId: 1,
      content: row.content,
      category: row.category,
      importance: row.importance,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    }));
  }
}

describe("bot memory capability adapter", () => {
  test("saveShortTerm + search keeps backward-compatible content", async () => {
    const manager = new FakeMemoryManager();
    const memory = createMemoryCapabilityForUser(1, manager);

    await memory.saveShortTerm({
      content: "Use Bun runtime",
      category: "preference",
      importance: 4,
    });

    const results = await memory.search(["Bun"], 5);
    expect(results.length).toBe(1);
    expect(results[0]?.content).toBe("Use Bun runtime");
    expect(results[0]?.category).toBe("preference");
  });
});
