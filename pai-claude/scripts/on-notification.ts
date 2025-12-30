#!/usr/bin/env bun

/**
 * Notification Hook - 轉發 Claude Code 通知
 */

import { notify } from "./lib/notify";

interface NotificationInput {
  type: string;
  message: string;
  [key: string]: unknown;
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  try {
    const data: NotificationInput = JSON.parse(input);
    await notify(`[Claude] ${data.message || data.type}`, "info");
  } catch {
    // 忽略解析錯誤
  }
}

main();
