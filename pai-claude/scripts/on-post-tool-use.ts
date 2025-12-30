#!/usr/bin/env bun

/**
 * PostToolUse Hook - 工具執行完成後通知
 */

import { notify, formatToolName } from "./lib/notify";

interface ToolUseInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  try {
    const data: ToolUseInput = JSON.parse(input);
    const tool = data.tool_name;

    // 過濾掉太頻繁的工具
    const quietTools = ["Read", "Glob", "Grep"];
    if (quietTools.includes(tool)) return;

    const icon = formatToolName(tool);
    await notify(`[${icon}] ${tool} completed`, "info");
  } catch {
    // 忽略解析錯誤
  }
}

main();
