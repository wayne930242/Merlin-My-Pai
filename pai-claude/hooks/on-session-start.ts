#!/usr/bin/env bun

/**
 * Session Start Hook
 *
 * 功能：
 * 1. 顯示 Session 時間
 * 2. 顯示記憶統計（中短期 via API，長期 via CLI）
 * 3. 檢查未完成 follow-ups
 * 4. 顯示可用 Skills
 *
 * 注意：具體記憶內容由 UserPromptSubmit Hook 注入
 */

import { spawn } from "bun";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";
import { getWorkspaceRoot } from "./lib/paths";

const WORKSPACE_ROOT = getWorkspaceRoot();
const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const SCRIPTS_DIR = import.meta.dir;
const SHORT_TERM_LIMIT = 100;

interface FollowUp {
  file: string;
  items: string[];
}

/**
 * 取得中短期記憶統計（via API）
 */
async function getShortTermStats(): Promise<{ total: number }> {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/stats`);
    if (!response.ok) return { total: 0 };
    return await response.json();
  } catch {
    return { total: 0 };
  }
}

/**
 * 取得長期記憶數量（via CLI）
 */
async function getLongTermCount(): Promise<number> {
  try {
    const proc = spawn({
      cmd: ["bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), "list"],
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return 0;

    const data = JSON.parse(output);
    return data.ok ? data.data.count : 0;
  } catch {
    return 0;
  }
}

/**
 * 從 history/sessions 讀取未完成的 follow-ups
 */
async function getPendingFollowUps(): Promise<FollowUp[]> {
  const sessionsDir = join(WORKSPACE_ROOT, "history", "sessions");
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
    const skillsDir = join(WORKSPACE_ROOT, ".claude", "skills");
    const skills = await readdir(skillsDir);
    return skills.filter((s) => !s.startsWith("."));
  } catch {
    return [];
  }
}

async function main() {
  // 顯示 session 資訊
  const now = new Date();
  const timeStr = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  console.log(`[Session] ${timeStr}`);

  // 記憶統計（具體記憶由 UserPromptSubmit 注入）
  if (isMemoryEnabled()) {
    const [shortTermStats, longTermCount] = await Promise.all([
      getShortTermStats(),
      getLongTermCount(),
    ]);

    console.log(
      `[Memory] Short-term: ${shortTermStats.total}/${SHORT_TERM_LIMIT} | Long-term: ${longTermCount} files`
    );
  }

  // 檢查未完成 follow-ups
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

  // 顯示可用 Skills
  const skills = await getAvailableSkills();
  if (skills.length > 0) {
    console.log(`\n[Available Skills] ${skills.join(", ")}`);
  }
}

main().catch(console.error);
