#!/usr/bin/env bun

/**
 * SubagentStop Hook - Subagent 完成通知
 */

import { notify } from "./lib/notify";

interface SubagentStopInput {
  agent_name?: string;
  task_description?: string;
  [key: string]: unknown;
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  try {
    const data: SubagentStopInput = JSON.parse(input);
    const name = data.agent_name || "Subagent";
    const task = data.task_description ? `: ${data.task_description.slice(0, 50)}` : "";
    await notify(`[Agent] ${name} 完成${task}`, "success");
  } catch {
    // 忽略解析錯誤
  }
}

main();
