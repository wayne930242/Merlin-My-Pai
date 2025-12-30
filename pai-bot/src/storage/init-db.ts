#!/usr/bin/env bun

import { getDb, closeDb } from "./db";
import { logger } from "../utils/logger";
import { readFileSync } from "fs";
import { join } from "path";

async function initDatabase() {
  try {
    const db = getDb();

    // Read and execute schema
    const schemaPath = join(import.meta.dir, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    db.run(schema);

    logger.info("Database initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize database");
    process.exit(1);
  } finally {
    closeDb();
  }
}

initDatabase();
