export type MemoryTier = "working" | "episodic" | "semantic" | "procedural";

export interface MemoryBase {
  id: string;
  tier: MemoryTier;
  createdAt: string;
  updatedAt: string;
  source: string;
  confidence: number;
  tags: string[];
}

export interface WorkingMemoryEntry extends MemoryBase {
  tier: "working";
  content: string;
  ttlSeconds: number;
}

export interface EpisodicMemoryEntry extends MemoryBase {
  tier: "episodic";
  sessionId: string;
  eventType: "user_intent" | "tool_result" | "decision" | "follow_up";
  summary: string;
}

export interface SemanticMemoryEntry extends MemoryBase {
  tier: "semantic";
  key: string;
  value: string;
  category: "preference" | "fact" | "profile" | "knowledge";
}

export interface ProceduralMemoryEntry extends MemoryBase {
  tier: "procedural";
  name: string;
  instruction: string;
  trigger: string;
}

export type MemoryEntry =
  | WorkingMemoryEntry
  | EpisodicMemoryEntry
  | SemanticMemoryEntry
  | ProceduralMemoryEntry;

export interface MemoryQuery {
  text: string;
  tiers?: MemoryTier[];
  tags?: string[];
  limit?: number;
}
