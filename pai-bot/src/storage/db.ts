import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config";
import { logger } from "../utils/logger";

let db: Database | null = null;

function runMigrations(db: Database): void {
  // Check if column exists helper
  const hasColumn = (table: string, column: string): boolean => {
    const result = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return result.some((col) => col.name === column);
  };

  // Check if table exists helper
  const hasTable = (table: string): boolean => {
    const result = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    return !!result;
  };

  // Migration: Add message_id to conversations
  if (!hasColumn("conversations", "message_id")) {
    try {
      db.run("ALTER TABLE conversations ADD COLUMN message_id TEXT");
      logger.info("Migration: Added message_id column to conversations");
    } catch (_e) {
      // Table might not exist yet, will be created by schema
    }
  }

  // Migration: Add is_hq to sessions
  if (hasTable("sessions") && !hasColumn("sessions", "is_hq")) {
    try {
      db.run("ALTER TABLE sessions ADD COLUMN is_hq INTEGER DEFAULT 0");
      logger.info("Migration: Added is_hq column to sessions");
    } catch (_e) {
      // Ignore if table doesn't exist yet
    }
  }
}

export function getDb(): Database {
  if (!db) {
    const dbPath = config.database.path;
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(dbPath);
    db.run("PRAGMA journal_mode = WAL");
    logger.info({ path: config.database.path }, "Database connected");

    // Run migrations first (for existing tables)
    runMigrations(db);

    // Then apply schema (creates new tables, indices)
    const schemaPath = join(import.meta.dir, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    db.run(schema);
    logger.info("Database migration completed");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("Database closed");
  }
}
