import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "../config";
import { logger } from "../utils/logger";

let db: Database | null = null;

function runMigrations(db: Database): void {
  // Check if column exists helper
  const hasColumn = (table: string, column: string): boolean => {
    const result = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return result.some((col) => col.name === column);
  };

  // Migration: Add message_id to conversations
  if (!hasColumn("conversations", "message_id")) {
    try {
      db.run("ALTER TABLE conversations ADD COLUMN message_id TEXT");
      logger.info("Migration: Added message_id column to conversations");
    } catch (e) {
      // Table might not exist yet, will be created by schema
    }
  }
}

export function getDb(): Database {
  if (!db) {
    db = new Database(config.database.path);
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
