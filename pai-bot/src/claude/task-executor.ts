/**
 * Claude Task Executor
 * 核心任務執行邏輯，與平台無關
 */

import { config } from "../config";
import { contextManager } from "../context/manager";
import { extractAndSaveMemories, formatMemoriesForPrompt, memoryManager } from "../memory";
import { logger } from "../utils/logger";
import { buildSessionContext } from "../utils/session";
import { escapeMarkdownV2 } from "../utils/telegram";
import { streamClaude } from "./client";
import { type QueuedTask, queueManager } from "./queue-manager";

// Global memory user ID (shared across all platforms)
const MEMORY_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

/**
 * 將 Claude 的 Markdown 轉換為 Telegram MarkdownV2
 */
export function toMarkdownV2(text: string): string {
  const CODE_BLOCK_PREFIX = "\u0000CB";
  const INLINE_CODE_PREFIX = "\u0000IC";
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract and protect code blocks
  let result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`\`\`\`${lang}\n${code}\`\`\``);
    return `${CODE_BLOCK_PREFIX}${idx}\u0000`;
  });

  // Extract and protect inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`\`${code}\``);
    return `${INLINE_CODE_PREFIX}${idx}\u0000`;
  });

  // Escape special characters in regular text
  result = escapeMarkdownV2(result);

  // Convert markdown syntax to MarkdownV2
  result = result.replace(/\\\*\\\*(.+?)\\\*\\\*/g, "*$1*");
  result = result.replace(/\\_\\_(.+?)\\_\\_/g, "*$1*");
  result = result.replace(/(?<!\\\*)\\\*([^*]+)\\\*(?!\\\*)/g, "_$1_");

  // Restore code blocks and inline code
  codeBlocks.forEach((code, idx) => {
    result = result.replace(`${CODE_BLOCK_PREFIX}${idx}\u0000`, code);
  });
  inlineCodes.forEach((code, idx) => {
    result = result.replace(`${INLINE_CODE_PREFIX}${idx}\u0000`, code);
  });

  return result;
}

/**
 * 訊息發送器介面
 */
export interface MessageSender {
  sendChatAction(chatId: number, action: string): Promise<void>;
  sendMessage(chatId: number, text: string, options?: { parse_mode?: string }): Promise<void>;
}

// Telegram 單則訊息上限
const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * 切斷訊息（避免超過平台限制）
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 尋找適合的切斷點
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}

/**
 * 執行 Claude 任務
 */
export async function executeClaudeTask(
  task: QueuedTask,
  chatId: number,
  sender: MessageSender,
): Promise<void> {
  const { userId, prompt, history } = task;

  // Show typing indicator during processing
  let isProcessing = true;
  const typingInterval = setInterval(async () => {
    if (isProcessing) {
      try {
        await sender.sendChatAction(chatId, "typing");
      } catch {
        // Ignore typing action errors
      }
    }
  }, 4000);

  // Send initial typing
  await sender.sendChatAction(chatId, "typing");

  let currentText = "";

  try {
    // Stream the response
    for await (const event of streamClaude(prompt, {
      conversationHistory: history,
      userId,
    })) {
      if (event.type === "text") {
        currentText = event.content;
      } else if (event.type === "done") {
        currentText = event.content || currentText;
      } else if (event.type === "error") {
        throw new Error(event.content);
      }
    }
  } finally {
    isProcessing = false;
    clearInterval(typingInterval);
  }

  // Send final response
  const finalContent = currentText.trim();
  if (finalContent) {
    const chunks = splitMessage(finalContent, TELEGRAM_MESSAGE_LIMIT);
    for (const chunk of chunks) {
      try {
        await sender.sendMessage(chatId, toMarkdownV2(chunk), {
          parse_mode: "MarkdownV2",
        });
      } catch (error) {
        logger.debug({ error }, "MarkdownV2 parsing failed, fallback to plain text");
        await sender.sendMessage(chatId, chunk);
      }
    }

    // Save assistant response
    contextManager.saveMessage(userId, "assistant", finalContent);

    // Extract and save memories asynchronously (use global memory user ID)
    if (config.memory.enabled) {
      extractAndSaveMemories(MEMORY_USER_ID, task.prompt, finalContent).catch((error) => {
        logger.warn({ error, memoryUserId: MEMORY_USER_ID }, "Memory extraction failed");
      });
    }
  }
}

/**
 * Session 資訊
 */
export interface SessionInfo {
  sessionId: number;
  platform: "telegram" | "discord";
  sessionType: "dm" | "channel";
}

/**
 * 準備任務資料（收集 context 和 memory）
 */
export async function prepareTask(
  userId: number,
  chatId: number,
  text: string,
  prompt: string,
  session: SessionInfo,
): Promise<QueuedTask> {
  // Save user message
  contextManager.saveMessage(userId, "user", text);

  // Get conversation context
  const history = contextManager.getConversationContext(userId);

  // Search for relevant memories (use global memory user ID)
  let memoryContext = "";
  if (config.memory.enabled) {
    try {
      const memories = await memoryManager.search(MEMORY_USER_ID, text, 5);
      if (memories.length > 0) {
        memoryContext = formatMemoriesForPrompt(memories);
        logger.debug(
          { memoryUserId: MEMORY_USER_ID, memoryCount: memories.length },
          "Retrieved memories",
        );
      }
    } catch (error) {
      logger.warn({ error, memoryUserId: MEMORY_USER_ID }, "Memory search failed");
    }
  }

  // Build session context for Claude
  const sessionContext = buildSessionContext(
    session.sessionId,
    session.platform as "telegram" | "discord",
    session.sessionType as "dm" | "channel",
  );

  // Combine memory context with history
  const fullHistory = memoryContext
    ? `${sessionContext}\n${memoryContext}\n\n${history}`
    : `${sessionContext}\n${history}`;

  return {
    id: queueManager.generateTaskId(),
    userId,
    chatId,
    prompt,
    history: fullHistory,
    memoryContext,
    createdAt: new Date(),
  };
}
