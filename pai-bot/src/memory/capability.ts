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

export interface SaveShortTermInput {
  content: string;
  category?: string;
  importance?: number;
}

export function createMemoryCapabilityForUser(
  userId: number,
  manager: MemoryManagerLike = memoryManager,
) {
  return {
    async saveShortTerm(input: SaveShortTermInput): Promise<number | null> {
      return manager.save({
        userId,
        content: input.content,
        category: input.category || "context",
        importance: input.importance || 1,
      });
    },

    async search(keywords: string[], limit = 10) {
      const memories = manager.searchByKeywords(userId, keywords, limit);
      return memories.map((memory: Memory) => {
        return {
          id: memory.id,
          content: memory.content,
          category: memory.category,
          importance: memory.importance,
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
