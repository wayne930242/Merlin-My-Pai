import { getDb } from "../storage/db";
import { logger } from "../utils/logger";
import { consolidateMemories } from "./consolidation";
import { CONSOLIDATION_THRESHOLD, MAX_MEMORIES_PER_USER } from "./constants";

export interface Memory {
  id: number;
  userId: number;
  content: string;
  category: string;
  importance: number;
  createdAt: string;
  lastAccessed?: string;
}

export interface MemoryInput {
  userId: number;
  content: string;
  category?: string;
  importance?: number;
}

let initialized = false;

function initDb(): void {
  if (initialized) return;

  const db = getDb();

  // Simple memory table (no vector embedding)
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_accessed TEXT NOT NULL
    )
  `);

  // Ensure category column exists (for existing tables created before this schema)
  ensureCategoryColumn(db);

  db.run(`CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(user_id, category)`);

  // Soft delete archive table
  db.run(`
    CREATE TABLE IF NOT EXISTS deleted_memories (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      importance INTEGER,
      created_at TEXT,
      deleted_at TEXT NOT NULL
    )
  `);

  // Migrate from vec_memories if exists
  migrateFromVecMemories(db);

  initialized = true;
  logger.info("Memory table initialized");
}

function ensureCategoryColumn(db: ReturnType<typeof getDb>): void {
  // Check if category column exists
  const columns = db.query<{ name: string }, []>("PRAGMA table_info(memories)").all();

  const hasCategory = columns.some((col) => col.name === "category");
  if (hasCategory) return;

  // Add category column
  db.run("ALTER TABLE memories ADD COLUMN category TEXT DEFAULT 'general'");
  logger.info("Added category column to memories table");
}

function migrateFromVecMemories(db: ReturnType<typeof getDb>): void {
  // Check if vec_memories exists
  const tableExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vec_memories'",
    )
    .get();

  if (!tableExists) return;

  // Check if already migrated (memories table has data)
  const hasData = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM memories").get();

  if (hasData && hasData.count > 0) {
    logger.info("Migration already done, skipping");
    return;
  }

  // Migrate data from vec_memories
  try {
    const oldMemories = db
      .query<
        {
          userId: number;
          content: string;
          category: string;
          importance: number;
          createdAt: string;
          lastAccessed: string;
        },
        []
      >(
        `SELECT user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM vec_memories`,
      )
      .all();

    if (oldMemories.length === 0) {
      logger.info("No memories to migrate from vec_memories, dropping table");
      db.run("DROP TABLE vec_memories");
      return;
    }

    for (const m of oldMemories) {
      db.run(
        `INSERT INTO memories(user_id, content, category, importance, created_at, last_accessed)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [m.userId, m.content, m.category, m.importance, m.createdAt, m.lastAccessed],
      );
    }

    logger.info({ migrated: oldMemories.length }, "Migrated memories from vec_memories");
    db.run("DROP TABLE vec_memories");
    logger.info("Dropped old vec_memories table");
  } catch (_error) {
    // Schema mismatch or virtual table without extension - try to drop
    try {
      db.run("DROP TABLE IF EXISTS vec_memories");
      logger.info("Dropped incompatible vec_memories table");
    } catch {
      // Virtual table without vec0 module - can't drop, just ignore
      // The table is unusable anyway without sqlite-vec
      logger.debug("Could not drop vec_memories (virtual table without extension)");
    }
  }
}

export class MemoryManager {
  constructor() {
    initDb();
  }

  /**
   * Save a memory with simple text deduplication
   * Returns null if identical memory exists, new id otherwise
   */
  async save(input: MemoryInput): Promise<number | null> {
    const db = getDb();
    const { userId, content, category = "general", importance = 0 } = input;

    // Simple text deduplication (exact match)
    const existing = db
      .query<{ id: number }, [number, string]>(
        "SELECT id FROM memories WHERE user_id = ? AND content = ?",
      )
      .get(userId, content);

    if (existing) {
      logger.debug({ userId, existingId: existing.id }, "Duplicate memory exists, skipping");
      return null;
    }

    const now = new Date().toISOString();
    const result = db.run(
      `INSERT INTO memories(user_id, content, category, importance, created_at, last_accessed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, content, category, importance, now, now],
    );

    const newId = Number(result.lastInsertRowid);
    logger.info({ userId, category, importance, id: newId }, "Memory saved");

    // Trigger consolidation if threshold exceeded (async, don't block)
    const count = this.count(userId);
    if (count > CONSOLIDATION_THRESHOLD) {
      consolidateMemories(userId).catch((error) => {
        logger.warn({ error, userId }, "Background consolidation failed");
      });
    }

    // Enforce capacity limit
    this.enforceLimit(userId);

    return newId;
  }

  /**
   * Get all memories for a user (no search, just retrieve all)
   */
  getAll(userId: number): Memory[] {
    const db = getDb();
    const now = new Date().toISOString();

    const results = db
      .query<Memory, [number]>(
        `SELECT id, user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM memories WHERE user_id = ?
         ORDER BY importance DESC, created_at DESC`,
      )
      .all(userId);

    // Update last_accessed for all retrieved memories
    if (results.length > 0) {
      db.run(`UPDATE memories SET last_accessed = ? WHERE user_id = ?`, [now, userId]);
    }

    return results;
  }

  /**
   * Search memories by keyword (simple text search)
   */
  search(userId: number, query: string, limit: number = 5): Memory[] {
    const db = getDb();
    const pattern = `%${query}%`;

    return db
      .query<Memory, [number, string, number]>(
        `SELECT id, user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM memories WHERE user_id = ? AND content LIKE ?
         ORDER BY importance DESC, created_at DESC LIMIT ?`,
      )
      .all(userId, pattern, limit);
  }

  /**
   * Enforce per-user memory limit by removing lowest priority memories
   * Returns the number of memories removed
   */
  enforceLimit(userId: number): number {
    const count = this.count(userId);
    if (count <= MAX_MEMORIES_PER_USER) return 0;

    const db = getDb();
    const toRemove = count - MAX_MEMORIES_PER_USER;

    // Delete lowest importance, then oldest last_accessed
    const result = db.run(
      `DELETE FROM memories WHERE id IN (
        SELECT id FROM memories
        WHERE user_id = ?
        ORDER BY importance ASC, last_accessed ASC
        LIMIT ?
      )`,
      [userId, toRemove],
    );

    logger.info({ userId, removed: result.changes }, "Enforced memory limit");
    return result.changes;
  }

  /**
   * Get recent memories
   */
  getRecent(userId: number, limit: number = 10): Memory[] {
    const db = getDb();
    return db
      .query<Memory, [number, number]>(
        `SELECT id, user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM memories WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(userId, limit);
  }

  /**
   * Count memories for a user
   */
  count(userId: number): number {
    const db = getDb();
    const result = db
      .query<{ count: number }, [number]>(
        "SELECT COUNT(*) as count FROM memories WHERE user_id = ?",
      )
      .get(userId);
    return result?.count ?? 0;
  }

  /**
   * Search memories by multiple keywords (OR logic)
   */
  searchByKeywords(userId: number, keywords: string[], limit: number = 10): Memory[] {
    const db = getDb();

    if (keywords.length === 0) {
      return this.getRecent(userId, limit);
    }

    const conditions = keywords.map(() => "content LIKE ?").join(" OR ");
    const params = keywords.map((k) => `%${k}%`);

    return db
      .query<Memory, (number | string)[]>(
        `SELECT id, user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM memories
         WHERE user_id = ? AND (${conditions})
         ORDER BY importance DESC, created_at DESC
         LIMIT ?`,
      )
      .all(userId, ...params, limit);
  }

  /**
   * Delete a single memory
   */
  delete(id: number): boolean {
    const db = getDb();
    const result = db.run("DELETE FROM memories WHERE id = ?", [id]);
    return result.changes > 0;
  }

  /**
   * Get a single memory by ID
   */
  getById(id: number): Memory | null {
    const db = getDb();
    return (
      db
        .query<Memory, [number]>(
          `SELECT id, user_id as userId, content, category, importance,
                created_at as createdAt, last_accessed as lastAccessed
         FROM memories WHERE id = ?`,
        )
        .get(id) ?? null
    );
  }

  /**
   * Update a single memory's content
   */
  update(
    id: number,
    updates: { content?: string; category?: string; importance?: number },
  ): boolean {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return false;

    const content = updates.content ?? existing.content;
    const category = updates.category ?? existing.category;
    const importance = updates.importance ?? existing.importance;

    db.run(`UPDATE memories SET content = ?, category = ?, importance = ? WHERE id = ?`, [
      content,
      category,
      importance,
      id,
    ]);

    logger.info({ id, updates }, "Memory updated");
    return true;
  }

  /**
   * Soft delete all memories for a user (archive them)
   */
  archiveByUser(userId: number): number {
    const db = getDb();
    const now = new Date().toISOString();

    // Get memories to archive
    const memories = db
      .query<Memory, [number]>(
        `SELECT id, content, category, importance, created_at as createdAt
         FROM memories WHERE user_id = ?`,
      )
      .all(userId);

    if (memories.length === 0) return 0;

    // Insert into archive
    for (const m of memories) {
      db.run(
        `INSERT INTO deleted_memories (user_id, content, category, importance, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, m.content, m.category, m.importance, m.createdAt, now],
      );
    }

    // Delete from memories
    db.run("DELETE FROM memories WHERE user_id = ?", [userId]);

    logger.info({ userId, archived: memories.length }, "User memories archived");
    return memories.length;
  }

  /**
   * Hard delete all memories for a user (permanent)
   */
  deleteByUser(userId: number): number {
    const db = getDb();
    const result = db.run("DELETE FROM memories WHERE user_id = ?", [userId]);
    logger.info({ userId, deleted: result.changes }, "User memories deleted");
    return result.changes;
  }

  /**
   * Restore archived memories for a user
   */
  async restoreByUser(userId: number): Promise<number> {
    const db = getDb();

    const archived = db
      .query<{ content: string; category: string; importance: number }, [number]>(
        "SELECT content, category, importance FROM deleted_memories WHERE user_id = ?",
      )
      .all(userId);

    if (archived.length === 0) return 0;

    // Re-save each memory
    let restored = 0;
    for (const m of archived) {
      const id = await this.save({
        userId,
        content: m.content,
        category: m.category,
        importance: m.importance,
      });
      if (id) restored++;
    }

    // Clear archive
    db.run("DELETE FROM deleted_memories WHERE user_id = ?", [userId]);

    logger.info({ userId, restored }, "User memories restored");
    return restored;
  }

  /**
   * Get archived memories count
   */
  countArchived(userId: number): number {
    const db = getDb();
    const result = db
      .query<{ count: number }, [number]>(
        "SELECT COUNT(*) as count FROM deleted_memories WHERE user_id = ?",
      )
      .get(userId);
    return result?.count ?? 0;
  }
}

export const memoryManager = new MemoryManager();
