#!/usr/bin/env bun

/**
 * Session Stop Hook
 *
 * 功能：
 * 1. 記錄 Session 結束時間
 * 2. 提示保存 Session（手動觸發）
 *
 * 注意：自動 Session 記錄需要更複雜的實作（讀取對話內容）
 * 目前採用手動方式：在對話結束前請 AI 生成摘要並保存
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { notify } from "./lib/notify";

const PAI_ROOT = join(import.meta.dir, "..");

async function main() {
  const now = new Date();
  const timestamp = now.toISOString();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "");

  console.log(`[PAI] Session ended: ${timestamp}`);
  await notify(`Session 結束`, "info");

  // 確保 sessions 目錄存在
  const sessionsDir = join(PAI_ROOT, "history", "sessions");
  try {
    await mkdir(sessionsDir, { recursive: true });
  } catch {
    // 目錄已存在
  }

  // 生成 Session 模板檔名
  const sessionFile = `${dateStr}-${timeStr}-session.md`;
  console.log(`[PAI] To save this session, create: history/sessions/${sessionFile}`);

  // 輸出 Session 模板提示
  console.log(`[PAI] Session template:`);
  console.log(`---`);
  console.log(`# Session: [topic]`);
  console.log(`Date: ${dateStr}`);
  console.log(`Duration: [minutes]`);
  console.log(``);
  console.log(`## Summary`);
  console.log(`[1-3 sentence summary]`);
  console.log(``);
  console.log(`## Key Actions`);
  console.log(`- [action 1]`);
  console.log(``);
  console.log(`## Learnings`);
  console.log(`- [learning 1]`);
  console.log(``);
  console.log(`## Follow-ups`);
  console.log(`- [ ] [todo 1]`);
  console.log(`---`);
}

main().catch(console.error);
