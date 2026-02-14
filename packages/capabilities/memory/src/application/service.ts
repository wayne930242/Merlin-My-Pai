import type {
  EpisodicMemoryEntry,
  MemoryEntry,
  MemoryQuery,
  ProceduralMemoryEntry,
  SemanticMemoryEntry,
  WorkingMemoryEntry,
} from "../domain/types";
import type { MemoryStore } from "../interfaces/store";

export class MemoryService {
  constructor(private readonly store: MemoryStore) {}

  async rememberWorking(entry: WorkingMemoryEntry): Promise<void> {
    await this.store.save(entry);
  }

  async appendEpisode(entry: EpisodicMemoryEntry): Promise<void> {
    await this.store.save(entry);
  }

  async upsertSemantic(entry: SemanticMemoryEntry): Promise<void> {
    // Keep semantic memory deterministic by key/category to prevent duplicates.
    await this.store.save({
      ...entry,
      id: `semantic:${entry.category}:${entry.key}`,
    });
  }

  async addProcedure(entry: ProceduralMemoryEntry): Promise<void> {
    await this.store.save({
      ...entry,
      id: `procedural:${entry.name}:${entry.trigger}`,
    });
  }

  async retrieveContext(query: MemoryQuery): Promise<MemoryEntry[]> {
    return this.store.search(query);
  }

  async cleanupWorking(nowIso: string): Promise<number> {
    return this.store.deleteExpiredWorking(nowIso);
  }
}
