#!/usr/bin/env bun

/**
 * Pre-Tool-Use Security Hook
 *
 * 功能：
 * 1. Prompt Injection 檢測
 * 2. Command Injection 檢測
 * 3. Path Traversal 檢測
 * 4. 可疑內容警告
 *
 * 使用方式：
 * 從 stdin 讀取 JSON，檢查後輸出結果
 *
 * 輸入格式：
 * { "tool": "Bash", "input": { "command": "..." } }
 *
 * 輸出：
 * - 安全：exit 0
 * - 可疑：輸出警告到 stderr，exit 0（允許但警告）
 * - 危險：輸出錯誤到 stderr，exit 1（阻止執行）
 */

// 危險模式檢測
const DANGEROUS_PATTERNS = {
  // Command Injection
  commandInjection: [
    /;\s*(rm|chmod|chown|curl|wget|nc|bash|sh|python|perl|ruby)\s/i,
    /\|\s*(bash|sh|python|perl|ruby)/i,
    /`[^`]*`/,  // backtick execution
    /\$\([^)]+\)/,  // $() execution
  ],

  // Path Traversal
  pathTraversal: [
    /\.\.\//,
    /\.\.\\/,
    /~\/\.ssh/,
    /\/etc\/(passwd|shadow|sudoers)/,
    /\/root\//,
  ],

  // Prompt Injection (在工具輸入中的可疑指令)
  promptInjection: [
    /ignore\s+(previous|above|all)\s+instructions/i,
    /disregard\s+(previous|above|all)/i,
    /new\s+instructions?:/i,
    /system\s*:\s*/i,
    /you\s+are\s+now\s+/i,
    /act\s+as\s+/i,
    /pretend\s+(to\s+be|you('re|are))/i,
  ],

  // 敏感檔案操作
  sensitiveFiles: [
    /\.(env|pem|key|crt|p12|pfx)(\s|$|")/i,
    /(password|secret|token|credential|api.?key)/i,
    /\.git\/config/,
    /\.ssh\/(id_|known_hosts|authorized_keys)/,
  ],
};

// 檢測函式
function detectThreats(input: string): { level: "safe" | "warn" | "danger"; messages: string[] } {
  const messages: string[] = [];
  let level: "safe" | "warn" | "danger" = "safe";

  // 檢測 Command Injection
  for (const pattern of DANGEROUS_PATTERNS.commandInjection) {
    if (pattern.test(input)) {
      messages.push(`[SECURITY] Potential command injection detected: ${pattern}`);
      level = "danger";
    }
  }

  // 檢測 Path Traversal
  for (const pattern of DANGEROUS_PATTERNS.pathTraversal) {
    if (pattern.test(input)) {
      messages.push(`[SECURITY] Potential path traversal detected: ${pattern}`);
      level = level === "danger" ? "danger" : "warn";
    }
  }

  // 檢測 Prompt Injection
  for (const pattern of DANGEROUS_PATTERNS.promptInjection) {
    if (pattern.test(input)) {
      messages.push(`[SECURITY] Potential prompt injection detected: ${pattern}`);
      level = "danger";
    }
  }

  // 檢測敏感檔案操作
  for (const pattern of DANGEROUS_PATTERNS.sensitiveFiles) {
    if (pattern.test(input)) {
      messages.push(`[SECURITY] Sensitive file access detected: ${pattern}`);
      level = level === "danger" ? "danger" : "warn";
    }
  }

  return { level, messages };
}

// 主程式
async function main() {
  // 讀取 stdin
  const input = await Bun.stdin.text();

  if (!input.trim()) {
    // 沒有輸入，通過
    process.exit(0);
  }

  let toolData: { tool?: string; input?: Record<string, unknown> };
  try {
    toolData = JSON.parse(input);
  } catch {
    // 無法解析 JSON，通過但警告
    console.error("[SECURITY] Could not parse tool input as JSON");
    process.exit(0);
  }

  // 將所有輸入轉為字串進行檢測
  const inputStr = JSON.stringify(toolData.input || {});
  const { level, messages } = detectThreats(inputStr);

  // 輸出警告訊息
  for (const msg of messages) {
    console.error(msg);
  }

  // 根據威脅等級決定是否阻止
  if (level === "danger") {
    console.error(`[SECURITY] BLOCKED: Tool "${toolData.tool}" execution blocked due to security concerns`);
    console.error(`[SECURITY] Input: ${inputStr.substring(0, 200)}...`);
    process.exit(1);
  }

  if (level === "warn") {
    console.error(`[SECURITY] WARNING: Tool "${toolData.tool}" may access sensitive resources`);
  }

  // 通過
  process.exit(0);
}

main().catch((err) => {
  console.error("[SECURITY] Hook error:", err);
  process.exit(0); // 錯誤時不阻止執行
});
