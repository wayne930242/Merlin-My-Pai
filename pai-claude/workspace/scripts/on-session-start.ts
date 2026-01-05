#!/usr/bin/env bun

/**
 * Session Start Hook
 *
 * 功能：
 * 1. 載入長期記憶（從 pai-bot SQLite）
 * 2. 檢查最近 sessions 和未完成 follow-ups
 * 3. 顯示可用 Skills
 * 4. 輸出 Context 供 Claude 參考
 *
 * 參考：PAI (Personal AI Infrastructure) 的 SessionStart 設計
 * - 在對話開始時主動蒐集脈絡
 * - 整合 Memory + History 雙層記憶架構
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";
import {
  getRecentMemories,
  getMemoryStats,
  formatMemoriesForContext,
} from "./lib/memory";

const PAI_ROOT = join(import.meta.dir, "..");

interface FollowUp {
  file: string;
  items: string[];
}

/**
 * 從 history/sessions 讀取未完成的 follow-ups
 */
async function getPendingFollowUps(): Promise<FollowUp[]> {
  const sessionsDir = join(PAI_ROOT, "history", "sessions");
  const followUps: FollowUp[] = [];

  try {
    const files = await readdir(sessionsDir);
    const recentFiles = files
      .filter((f) => f.endsWith(".md"))
      .sort()
      .slice(-5);

    for (const file of recentFiles) {
      const content = await readFile(join(sessionsDir, file), "utf-8");
      const unchecked = content
        .split("\n")
        .filter((line) => line.match(/^- \[ \]/))
        .map((line) => line.replace(/^- \[ \] /, "").trim());

      if (unchecked.length > 0) {
        followUps.push({ file, items: unchecked });
      }
    }
  } catch {
    // history/sessions 不存在
  }

  return followUps;
}

/**
 * 取得可用 Skills
 */
async function getAvailableSkills(): Promise<string[]> {
  try {
    const skillsDir = join(PAI_ROOT, ".claude", "skills");
    const skills = await readdir(skillsDir);
    return skills.filter((s) => !s.startsWith("."));
  } catch {
    return [];
  }
}

async function main() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekday = now.toLocaleDateString("zh-TW", { weekday: "long" });
  const time = now.toLocaleTimeString("zh-TW", { hour12: false });

  console.log(`[Session] ${today} ${weekday} ${time}`);

  // 1. 載入長期記憶（如果啟用）
  if (isMemoryEnabled()) {
    const memories = getRecentMemories(10);
    const stats = getMemoryStats();

    if (memories.length > 0) {
      console.log(`\n${formatMemoriesForContext(memories)}`);
      console.log(`\n[Memory Stats] Total: ${stats.total}`);
    }
  }

  // 2. 檢查未完成 follow-ups
  const followUps = await getPendingFollowUps();
  if (followUps.length > 0) {
    console.log("\n[Pending Follow-ups]");
    for (const fu of followUps) {
      console.log(`\nFrom ${fu.file}:`);
      for (const item of fu.items.slice(0, 3)) {
        console.log(`- [ ] ${item}`);
      }
      if (fu.items.length > 3) {
        console.log(`  ... and ${fu.items.length - 3} more`);
      }
    }
  }

  // 3. 顯示可用 Skills
  const skills = await getAvailableSkills();
  if (skills.length > 0) {
    console.log(`\n[Available Skills] ${skills.join(", ")}`);
  }
}

main().catch(console.error);
