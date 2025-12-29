import { $ } from "bun";
import { resolve } from "path";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface ClaudeResult {
  response: string;
}

interface ClaudeOptions {
  conversationHistory?: string;
}

export async function callClaude(
  prompt: string,
  options?: ClaudeOptions,
  retryCount = 0
): Promise<ClaudeResult> {
  // Build full prompt with context
  let fullPrompt = prompt;

  if (options?.conversationHistory) {
    fullPrompt = `[Previous conversation]\n${options.conversationHistory}\n\n[Current message]\n${prompt}`;
  }

  // 解析專案目錄的絕對路徑
  const projectDir = resolve(process.cwd(), config.claude.projectDir);

  try {
    logger.debug(
      { promptLength: fullPrompt.length, cwd: projectDir },
      "Calling Claude"
    );

    // Call Claude Code in headless mode
    // cwd 設為 pai-claude 目錄，讓 Claude 讀取專案級的 CLAUDE.md 和 Skills
    // 使用 MCP server 處理權限請求，所以不限制 tools
    const result =
      await $`claude -p ${fullPrompt} --output-format text`
        .cwd(projectDir)
        .text();

    logger.debug({ responseLength: result.length }, "Claude response received");

    return { response: result.trim() };
  } catch (error) {
    logger.error({ error, attempt: retryCount + 1 }, "Claude call failed");

    // Retry logic
    if (retryCount < 3) {
      const delay = 1000 * (retryCount + 1);
      logger.info({ delay }, "Retrying...");
      await Bun.sleep(delay);
      return callClaude(prompt, options, retryCount + 1);
    }

    throw new Error("魔法暫時失效了，請稍後再試");
  }
}
