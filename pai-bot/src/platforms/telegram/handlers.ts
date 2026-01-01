import { Context } from "grammy";
import {
  streamClaude,
  abortUserProcess,
  hasActiveProcess,
} from "../../claude/client";
import { contextManager } from "../../context/manager";
import { logger } from "../../utils/logger";
import { config } from "../../config";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  memoryManager,
  extractAndSaveMemories,
  formatMemoriesForPrompt,
} from "../../memory";

// Characters that need escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// Convert Claude's markdown to Telegram MarkdownV2
function toMarkdownV2(text: string): string {
  // Use unique placeholders that won't be affected by escaping
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
  // Bold: **text** or __text__ -> *text*
  result = result.replace(/\\\*\\\*(.+?)\\\*\\\*/g, "*$1*");
  result = result.replace(/\\_\\_(.+?)\\_\\_/g, "*$1*");

  // Italic: *text* or _text_ -> _text_
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

// Handle /start command
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.reply(
    `Merlin 已甦醒

可用指令：
• \`/clear\` \\- 清除對話歷史
• \`/memory\` \\- 查看長期記憶
• \`/forget\` \\- 清除長期記憶
• \`/status\` \\- 查看狀態
• \`/stop\` \\- 中斷當前任務
• \`/cc:<command>\` \\- 執行 Claude slash command

發送任何訊息會自動中斷進行中的任務。`,
    { parse_mode: "MarkdownV2" }
  );
}

// Handle /clear command
export async function handleClear(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  contextManager.clearHistory(userId);
  await ctx.reply("對話歷史已清除");
}

// Handle /status command
export async function handleStatus(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const messageCount = contextManager.getMessageCount(userId);
  const isProcessing = hasActiveProcess(userId);

  await ctx.reply(
    `狀態

• User ID: \`${userId}\`
• 對話訊息數: ${messageCount}
• 處理中: ${isProcessing ? "是" : "否"}`,
    { parse_mode: "MarkdownV2" }
  );
}

// Handle /stop command - abort current task
export async function handleStop(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const wasAborted = abortUserProcess(userId);

  if (wasAborted) {
    await ctx.reply("已中斷當前任務");
    logger.info({ userId }, "User manually stopped task");
  } else {
    await ctx.reply("目前沒有進行中的任務");
  }
}

// Handle /memory command - view long-term memories
export async function handleMemory(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!config.memory.enabled) {
    await ctx.reply("長期記憶功能未啟用");
    return;
  }

  const memories = memoryManager.getRecent(userId, 20);
  const count = memoryManager.count(userId);

  if (memories.length === 0) {
    await ctx.reply("目前沒有長期記憶");
    return;
  }

  const lines = [`長期記憶 \\(共 ${count} 條\\)：\n`];
  for (const m of memories) {
    const category = escapeMarkdownV2(m.category);
    const content = escapeMarkdownV2(m.content);
    lines.push(`• \\[${category}\\] ${content}`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "MarkdownV2" });
}

// Handle /forget command - clear long-term memories
export async function handleForget(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!config.memory.enabled) {
    await ctx.reply("長期記憶功能未啟用");
    return;
  }

  const deleted = memoryManager.deleteByUser(userId);
  await ctx.reply(`已清除 ${deleted} 條長期記憶`);
}

// Handle regular messages with streaming
export async function handleMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  const chatId = ctx.chat?.id;

  if (!userId || !text || !chatId) return;

  // Auto-abort any existing task when user sends a new message
  if (hasActiveProcess(userId)) {
    abortUserProcess(userId);
    logger.info({ userId }, "Auto-aborted previous task due to new message");
    await ctx.reply("已自動中斷前一個任務");
  }

  // 處理 /cc: Claude slash command
  let prompt = text;
  if (text.startsWith("/cc:")) {
    const commandPart = text.slice(4);
    prompt = `/${commandPart}`;
  }

  try {
    // Save user message
    contextManager.saveMessage(userId, "user", text);

    // Get conversation context
    const history = contextManager.getConversationContext(userId);

    // Search for relevant memories (if enabled)
    let memoryContext = "";
    if (config.memory.enabled) {
      try {
        const memories = await memoryManager.search(userId, text, 5);
        if (memories.length > 0) {
          memoryContext = formatMemoriesForPrompt(memories);
          logger.debug({ userId, memoryCount: memories.length }, "Retrieved memories");
        }
      } catch (error) {
        // Memory search is optional, don't fail the request
        logger.warn({ error, userId }, "Memory search failed");
      }
    }

    // Combine memory context with conversation history
    const fullHistory = memoryContext
      ? `${memoryContext}\n\n${history}`
      : history;

    // Show typing indicator during processing
    let isProcessing = true;
    const typingInterval = setInterval(async () => {
      if (isProcessing) {
        try {
          await ctx.api.sendChatAction(chatId, "typing");
        } catch {
          // Ignore typing action errors
        }
      }
    }, 4000); // Telegram typing status lasts ~5 seconds

    // Send initial typing
    await ctx.api.sendChatAction(chatId, "typing");

    let currentText = "";

    try {
      // Stream the response (collect without editing)
      for await (const event of streamClaude(prompt, {
        conversationHistory: fullHistory,
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

    // Send final response as new message
    const finalContent = currentText.trim();
    if (finalContent) {
      try {
        await ctx.api.sendMessage(chatId, toMarkdownV2(finalContent), {
          parse_mode: "MarkdownV2",
        });
      } catch {
        // Fallback: send without markdown
        await ctx.api.sendMessage(chatId, finalContent);
      }

      // Save assistant response
      contextManager.saveMessage(userId, "assistant", finalContent);

      // Extract and save memories asynchronously (if enabled, don't block response)
      if (config.memory.enabled) {
        extractAndSaveMemories(userId, text, finalContent).catch((error) => {
          logger.warn({ error, userId }, "Memory extraction failed");
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ error: errorMessage, stack: errorStack, userId }, "Failed to process message");
    await ctx.reply("發生錯誤，請稍後再試");
  }
}

// Handle document/file attachments
export async function handleDocument(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const document = ctx.message?.document;

  if (!userId || !chatId || !document) return;

  try {
    const file = await ctx.getFile();
    const filePath = file.file_path;

    if (!filePath) {
      await ctx.reply("無法取得檔案路徑");
      return;
    }

    // Ensure downloads directory exists
    const downloadsDir = resolve(config.workspace.downloadsDir);
    await mkdir(downloadsDir, { recursive: true });

    // Download file
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    // Save with original filename
    const fileName = document.file_name || `file_${Date.now()}`;
    const localPath = join(downloadsDir, fileName);

    await Bun.write(localPath, response);

    logger.info({ userId, fileName, localPath }, "File downloaded");

    const userMessage = `[用戶傳送檔案: ${fileName}]`;
    const assistantMessage = `已下載至 \`${localPath}\``;

    contextManager.saveMessage(userId, "user", userMessage);
    contextManager.saveMessage(userId, "assistant", assistantMessage);

    await ctx.reply(assistantMessage, { parse_mode: "MarkdownV2" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, userId }, "Failed to download file");
    await ctx.reply("下載檔案失敗，請稍後再試");
  }
}

// Handle photo attachments
export async function handlePhoto(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const photos = ctx.message?.photo;

  if (!userId || !chatId || !photos || photos.length === 0) return;

  try {
    // Get the largest photo (last in array)
    const photo = photos[photos.length - 1];
    const file = await ctx.api.getFile(photo.file_id);
    const filePath = file.file_path;

    if (!filePath) {
      await ctx.reply("無法取得圖片路徑");
      return;
    }

    // Ensure downloads directory exists
    const downloadsDir = resolve(config.workspace.downloadsDir);
    await mkdir(downloadsDir, { recursive: true });

    // Download file
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status}`);
    }

    // Save with timestamp filename
    const ext = filePath.split(".").pop() || "jpg";
    const fileName = `photo_${Date.now()}.${ext}`;
    const localPath = join(downloadsDir, fileName);

    await Bun.write(localPath, response);

    logger.info({ userId, fileName, localPath }, "Photo downloaded");

    const userMessage = `[用戶傳送圖片]`;
    const assistantMessage = `已下載至 \`${localPath}\``;

    contextManager.saveMessage(userId, "user", userMessage);
    contextManager.saveMessage(userId, "assistant", assistantMessage);

    await ctx.reply(assistantMessage, { parse_mode: "MarkdownV2" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, userId }, "Failed to download photo");
    await ctx.reply("下載圖片失敗，請稍後再試");
  }
}
