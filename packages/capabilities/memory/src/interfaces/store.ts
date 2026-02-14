import type { MemoryEntry, MemoryQuery } from "../domain/types";

export interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  listByTier(tier: MemoryEntry["tier"]): Promise<MemoryEntry[]>;
  search(query: MemoryQuery): Promise<MemoryEntry[]>;
  deleteExpiredWorking(nowIso: string): Promise<number>;
}
