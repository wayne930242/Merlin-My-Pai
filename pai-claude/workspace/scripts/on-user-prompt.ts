#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook
 * 搜尋雙層記憶，注入相關脈絡
 */

import { spawn } from "bun";
import { join } from "node:path";
import { isMemoryEnabled } from "./lib/config";

const PAI_API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";
const SCRIPTS_DIR = import.meta.dir;

interface UserPromptEvent {
  prompt: string;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的", "是", "在", "了", "和", "與", "有", "我", "你",
    "這", "那", "什麼", "怎麼", "可以", "需要", "想要", "請",
    "幫", "看", "一下", "問題",
  ]);

  return text
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w))
    .slice(0, 8);
}

async function searchLongTerm(keywords: string[]) {
  const proc = spawn({
    cmd: ["bun", "run", join(SCRIPTS_DIR, "memory-cli.ts"), "search", ...keywords, "--limit", "3"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return [];
  try {
    const data = JSON.parse(output);
    return data.ok ? data.data.results : [];
  } catch {
    return [];
  }
}

async function searchShortTerm(keywords: string[]) {
  try {
    const response = await fetch(`${PAI_API_URL}/api/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, limit: 5 }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.memories || [];
  } catch {
    return [];
  }
}

async function main() {
  if (!isMemoryEnabled()) return;

  const input = await Bun.stdin.text();
  if (!input.trim()) return;

  let data: UserPromptEvent;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const prompt = data.prompt;
  if (!prompt || prompt.length < 5) return;

  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return;

  const output: string[] = [];

  // 1. 搜尋長期記憶
  const longTermResults = await searchLongTerm(keywords);
  if (longTermResults.length > 0) {
    output.push("[Long-term Memory]");
    for (const r of longTermResults) {
      output.push(`- ${r.path}: ${r.summary || r.title}`);
    }
    output.push("");
  }

  // 2. 搜尋中短期記憶
  const shortTermResults = await searchShortTerm(keywords);
  if (shortTermResults.length > 0) {
    output.push("[Recent Context]");
    for (const m of shortTermResults) {
      output.push(`- ${m.content}`);
    }
  }

  if (output.length > 0) {
    console.log(output.join("\n"));
  }
}

main().catch(console.error);
