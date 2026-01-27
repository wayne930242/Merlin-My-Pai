// Memory system configuration

/** Maximum memories per user (short-term memory limit for dual-layer system) */
export const MAX_MEMORIES_PER_USER = 100;

/** Trigger consolidation when memories exceed this count */
export const CONSOLIDATION_THRESHOLD = 30;

/** Days until memory expires if not accessed (0 = never expire) */
export const EXPIRY_DAYS = 0;

/** Minimum memories to keep even if expired */
export const MIN_MEMORIES_TO_KEEP = 10;

/** Memory categories for dual-layer system */
export const MEMORY_CATEGORIES = {
  shortTerm: ["context", "temp", "recent"],
  longTerm: ["preference", "personal", "knowledge", "event"],
} as const;
