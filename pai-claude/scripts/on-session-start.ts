#!/usr/bin/env bun

/**
 * Session Start Hook
 *
 * 功能：
 * 1. 顯示時間和可用 Skills
 * 2. 檢查未完成任務
 * 3. 載入 Context 提示
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const PAI_ROOT = join(import.meta.dir, "..");

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString("zh-TW", { hour12: false });

  console.log(`[PAI] Session started: ${today} ${time}`);

  // 列出可用 Skills
  try {
    const skillsDir = join(PAI_ROOT, "skills");
    const skills = await readdir(skillsDir);
    const validSkills = skills.filter(s => !s.startsWith("."));
    console.log(`[PAI] Available skills: ${validSkills.join(", ")}`);
  } catch {
    console.log(`[PAI] Skills directory not found`);
  }

  // 檢查 history/sessions 中是否有未完成的 follow-ups
  try {
    const sessionsDir = join(PAI_ROOT, "history", "sessions");
    const sessions = await readdir(sessionsDir);
    const recentSessions = sessions
      .filter(s => s.endsWith(".md"))
      .sort()
      .slice(-3);

    if (recentSessions.length > 0) {
      console.log(`[PAI] Recent sessions: ${recentSessions.length}`);
    }
  } catch {
    // history/sessions 尚未有內容，忽略
  }

  // 提醒載入 Context
  console.log(`[PAI] Context: context/Identity.md, context/Principles.md`);
}

main().catch(console.error);
