#!/usr/bin/env bun

/**
 * SubagentStop Hook
 *
 * 注意：此 hook 的輸入資料有限（只有 session_id、transcript_path 等）
 * 不包含 subagent 的描述或類型，因此不發送通知
 * Task 完成通知由 PostToolUse hook 處理
 */

async function main() {
  // SubagentStop 輸入資料有限，不發送通知
  // 如需處理，可讀取 transcript_path 獲取詳細資訊
}

main();
