#!/usr/bin/env bun

/**
 * SubagentStop Hook - Subagent 完成通知
 */

import { notify } from "./lib/notify";

interface SubagentStopInput {
  subagent_type?: string;
  task_description?: string;
  tool_input?: {
    description?: string;
    prompt?: string;
  };
  [key: string]: unknown;
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  try {
    const data: SubagentStopInput = JSON.parse(input);
    const type = data.subagent_type || "Agent";
    const desc = data.tool_input?.description ||
                 data.task_description ||
                 data.tool_input?.prompt?.slice(0, 60) ||
                 "";
    const message = desc ? `${type}: ${desc}` : `${type} 完成`;
    await notify(`✅ ${message}`, "success");
  } catch {
    // 忽略解析錯誤
  }
}

main();
