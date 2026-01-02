/**
 * Database Migration Script
 * Adds message_id column to conversations table
 */

import { getDb } from "./db";
import { logger } from "../utils/logger";

export function migrateDatabase() {
  const db = getDb();

  try {
    // Check if message_id column exists
    const tableInfo = db.query("PRAGMA table_info(conversations)").all() as any[];
    const hasMessageId = tableInfo.some((col: any) => col.name === "message_id");

    if (!hasMessageId) {
      logger.info("Adding message_id column to conversations table");

      // Add message_id column
      db.run("ALTER TABLE conversations ADD COLUMN message_id TEXT");

      // Create index
      db.run("CREATE INDEX IF NOT EXISTS idx_conv_message_id ON conversations(message_id)");

      logger.info("Migration completed successfully");
    } else {
      logger.debug("message_id column already exists, skipping migration");
    }
  } catch (error) {
    logger.error({ error }, "Migration failed");
    throw error;
  }
}
