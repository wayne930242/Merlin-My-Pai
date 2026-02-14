#!/usr/bin/env bun

/**
 * PostToolUse Hook - 工具執行完成後通知
 */

import { notify } from "./lib/notify";
import { basename } from "node:path";

interface ToolUseInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    description?: string;
    pattern?: string;
    query?: string;
    url?: string;
    [key: string]: unknown;
  };
}

function getToolDetail(tool: string, input: ToolUseInput["tool_input"]): string {
  switch (tool) {
    case "Edit":
    case "Write":
      return input.file_path ? basename(input.file_path) : "";
    case "Bash":
      return input.description || input.command?.slice(0, 40) || "";
    case "WebFetch":
      return input.url ? new URL(input.url).hostname : "";
    case "WebSearch":
      return input.query?.slice(0, 30) || "";
    case "Task":
      const agentType = (input as Record<string, unknown>).subagent_type || "Agent";
      const desc = input.description || "";
      return desc ? `${agentType}: ${desc}` : String(agentType);
    default:
      return "";
  }
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  try {
    const data: ToolUseInput = JSON.parse(input);
    const tool = data.tool_name;

    // 過濾掉太頻繁的工具
    const quietTools = ["Read", "Glob", "Grep", "TodoWrite"];
    if (quietTools.includes(tool)) return;

    const detail = getToolDetail(tool, data.tool_input);
    const message = detail ? `${tool}: ${detail}` : tool;
    await notify(message, "success");
  } catch {
    // 忽略解析錯誤
  }
}

main();
