/**
 * Telegram Message Handlers
 * 處理 Telegram 平台的訊息和指令
 */

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Context } from "grammy";
import { abortUserProcess, hasActiveProcess } from "../../claude/client";
import { queueManager } from "../../claude/queue-manager";
import {
  executeClaudeTask,
  type MessageSender,
  prepareTask,
  type SessionInfo,
} from "../../claude/task-executor";
import { config } from "../../config";
import { contextManager } from "../../context/manager";
import { memoryManager } from "../../memory";
import { transcribeAudio } from "../../services/transcription";
import { sessionService } from "../../storage/sessions";
import { logger } from "../../utils/logger";
import { escapeMarkdownV2, fmt } from "../../utils/telegram";
import { setTaskExecutor } from "./callbacks";

// Global memory user ID (shared across all platforms)
const MEMORY_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

// Bot API 參考
let botApi: Context["api"] | null = null;

/**
 * 建立 Telegram 訊息發送器
 */
function createTelegramSender(api: Context["api"]): MessageSender {
  return {
    sendChatAction: (chatId, action) => api.sendChatAction(chatId, action as any).then(() => {}),
    sendMessage: (chatId, text, options) =>
      api.sendMessage(chatId, text, options as any).then(() => {}),
  };
}

/**
 * 初始化任務執行器（供 callbacks.ts 使用）
 */
export function initializeTaskExecutor(api: Context["api"]): void {
  botApi = api;
  const sender = createTelegramSender(api);
  setTaskExecutor(async (task, chatId) => {
    await executeClaudeTask(task, chatId, sender);
  });
}

// ============================================================
// Command Handlers
// ============================================================

export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const mode = queueManager.getMode(userId);
  const modeText = mode === "queue" ? "📋 排隊" : "🛑 打斷";

  await ctx.reply(
    `Merlin 已甦醒

可用指令：
• \`/mode\` \\- 切換排隊/打斷模式
• \`/status\` \\- 查看狀態
• \`/stop\` \\- 中斷當前任務
• \`/clear\` \\- 清除對話歷史
• \`/memory\` \\- 查看長期記憶
• \`/hq\` \\- 設定管理中心
• \`/cc:<cmd>\` \\- 執行 Claude 指令

當前模式：${modeText}`,
    { parse_mode: "MarkdownV2" },
  );
}

export async function handleClear(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  contextManager.clearHistory(userId);
  await ctx.reply("對話歷史已清除");
}

export async function handleStatus(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const messageCount = contextManager.getMessageCount(userId);
  const { queueSize, isProcessing } = queueManager.getStatus(userId);
  const mode = queueManager.getMode(userId);
  const modeText = mode === "queue" ? "📋 排隊" : "🛑 打斷";

  await ctx.reply(
    `狀態

• User ID: \`${userId}\`
• 模式: ${modeText}
• 對話訊息數: ${messageCount}
• 處理中: ${isProcessing ? "是" : "否"}
• 佇列中: ${queueSize} 個任務`,
    { parse_mode: "MarkdownV2" },
  );
}

export async function handleStop(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const wasAborted = abortUserProcess(userId);
  const clearedCount = queueManager.clearQueue(userId);

  if (wasAborted || clearedCount > 0) {
    const messages: string[] = [];
    if (wasAborted) messages.push("已中斷當前任務");
    if (clearedCount > 0) messages.push(`已清空 ${clearedCount} 個佇列任務`);
    await ctx.reply(messages.join("，"));
    logger.info({ userId, wasAborted, clearedCount }, "User manually stopped tasks");
  } else {
    await ctx.reply("目前沒有進行中的任務");
  }
}

export async function handleMemory(ctx: Context): Promise<void> {
  if (!ctx.from?.id) return;

  if (!config.memory.enabled) {
    await ctx.reply("長期記憶功能未啟用");
    return;
  }

  // Use global memory user ID for cross-platform sharing
  const memories = memoryManager.getRecent(MEMORY_USER_ID, 20);
  const count = memoryManager.count(MEMORY_USER_ID);

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

export async function handleForget(ctx: Context): Promise<void> {
  if (!ctx.from?.id) return;

  if (!config.memory.enabled) {
    await ctx.reply("長期記憶功能未啟用");
    return;
  }

  // Use global memory user ID for cross-platform sharing
  const archived = memoryManager.archiveByUser(MEMORY_USER_ID);
  await ctx.reply(`已封存 ${archived} 條長期記憶（可透過 MCP 工具恢復）`);
}

export async function handleMode(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const newMode = queueManager.toggleMode(userId);
  const modeText = newMode === "queue" ? "📋 排隊模式" : "🛑 打斷模式";
  const description =
    newMode === "queue" ? "新訊息會自動排入佇列等待執行" : "新訊息會打斷當前任務並立即執行";

  await ctx.reply(`已切換至 ${modeText}\n${description}`);
}

export async function handleHQ(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  // 確保 session 已記錄
  sessionService.upsert({
    sessionId: userId,
    platform: "telegram",
    platformUserId: userId.toString(),
    chatId: chatId.toString(),
    sessionType: "dm",
  });

  // 設定為 HQ
  const success = sessionService.setHQ(userId);
  if (success) {
    await ctx.reply("✅ 已設定此對話為管理中心（HQ）\n系統通知將發送至此處");
  } else {
    await ctx.reply("❌ 設定失敗，請先發送任意訊息建立 session");
  }
}

// ============================================================
// Message Handler
// ============================================================

export async function handleMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  const chatId = ctx.chat?.id;

  if (!userId || !text || !chatId) return;

  // 初始化 bot API（首次調用時）
  if (!botApi) {
    initializeTaskExecutor(ctx.api);
  }

  // 記錄 session 資訊
  sessionService.upsert({
    sessionId: userId,
    platform: "telegram",
    platformUserId: userId.toString(),
    chatId: chatId.toString(),
    sessionType: "dm",
  });

  // 處理 /cc: Claude slash command
  let prompt = text;
  if (text.startsWith("/cc:")) {
    prompt = `/${text.slice(4)}`;
  }

  // 準備 session 資訊
  const session: SessionInfo = {
    sessionId: userId,
    platform: "telegram",
    sessionType: "dm",
  };

  // 準備任務
  const task = await prepareTask(userId, chatId, text, prompt, session);
  const sender = createTelegramSender(ctx.api);

  // 檢查是否有進行中的任務
  const isProcessing = queueManager.isProcessing(userId) || hasActiveProcess(userId);

  if (isProcessing) {
    const mode = queueManager.getMode(userId);

    if (mode === "interrupt") {
      // 打斷模式：中止當前任務並立即執行
      abortUserProcess(userId);
      const clearedCount = queueManager.clearQueue(userId);

      if (clearedCount > 0) {
        logger.info({ userId, clearedCount }, "Queue cleared for interrupt mode");
      }

      try {
        await queueManager.executeImmediately(task, async (t) => {
          await executeClaudeTask(t, chatId, sender);
        });
      } catch (error) {
        logger.error({ error, userId }, "Failed to process message");
        const errorMessage = error instanceof Error ? error.message : String(error);
        const shortError =
          errorMessage.length > 100 ? `${errorMessage.substring(0, 100)}...` : errorMessage;
        await ctx.reply(`❌ 發生錯誤：${shortError}`);
      }
    } else {
      // 排隊模式：加入佇列
      const queueSize = queueManager.getQueueLength(userId) + 1;
      await ctx.reply(`📋 已排入佇列（第 ${queueSize} 位）`);

      queueManager
        .enqueue(task, async (t) => {
          await executeClaudeTask(t, chatId, sender);
        })
        .catch((error) => {
          logger.error({ error, taskId: task.id }, "Queued task failed");
          ctx.api.sendMessage(chatId, `❌ 任務執行失敗：${error.message}`).catch(() => {});
        });
    }

    return;
  }

  // 沒有進行中的任務，直接執行
  try {
    await queueManager.executeImmediately(task, async (t) => {
      await executeClaudeTask(t, chatId, sender);
    });
  } catch (error) {
    logger.error({ error, userId }, "Failed to process message");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const shortError =
      errorMessage.length > 100 ? `${errorMessage.substring(0, 100)}...` : errorMessage;
    await ctx.reply(`❌ 發生錯誤：${shortError}`);
  }
}

// ============================================================
// Attachment Handlers
// ============================================================

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

    const downloadsDir = resolve(config.workspace.downloadsDir);
    await mkdir(downloadsDir, { recursive: true });

    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const fileName = document.file_name || `file_${Date.now()}`;
    const localPath = join(downloadsDir, fileName);

    await Bun.write(localPath, response);
    logger.info({ userId, fileName, localPath }, "File downloaded");

    const userMessage = `[用戶傳送檔案: ${fileName}]`;
    const assistantMessage = `已下載至 ${localPath}`;

    contextManager.saveMessage(userId, "user", userMessage);
    contextManager.saveMessage(userId, "assistant", assistantMessage);

    const formatted = fmt`已下載至 \`${localPath}\``;
    await ctx.reply(formatted.text, { parse_mode: "MarkdownV2", entities: formatted.entities });
  } catch (error) {
    logger.error({ error, userId }, "Failed to download file");
    await ctx.reply("下載檔案失敗，請稍後再試");
  }
}

export async function handlePhoto(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const photos = ctx.message?.photo;

  if (!userId || !chatId || !photos || photos.length === 0) return;

  try {
    const photo = photos[photos.length - 1];
    const file = await ctx.api.getFile(photo.file_id);
    const filePath = file.file_path;

    if (!filePath) {
      await ctx.reply("無法取得圖片路徑");
      return;
    }

    const downloadsDir = resolve(config.workspace.downloadsDir);
    await mkdir(downloadsDir, { recursive: true });

    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status}`);
    }

    const ext = filePath.split(".").pop() || "jpg";
    const fileName = `photo_${Date.now()}.${ext}`;
    const localPath = join(downloadsDir, fileName);

    await Bun.write(localPath, response);
    logger.info({ userId, fileName, localPath }, "Photo downloaded");

    const userMessage = `[用戶傳送圖片]`;
    const assistantMessage = `已下載至 ${localPath}`;

    contextManager.saveMessage(userId, "user", userMessage);
    contextManager.saveMessage(userId, "assistant", assistantMessage);

    const formatted = fmt`已下載至 \`${localPath}\``;
    await ctx.reply(formatted.text, { parse_mode: "MarkdownV2", entities: formatted.entities });
  } catch (error) {
    logger.error({ error, userId }, "Failed to download photo");
    await ctx.reply("下載圖片失敗，請稍後再試");
  }
}

export async function handleVoice(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const voice = ctx.message?.voice;

  if (!userId || !chatId || !voice) return;

  // 檢查是否啟用轉錄功能
  if (!config.transcription.enabled) {
    await ctx.reply("語音轉錄功能未啟用");
    return;
  }

  try {
    // 初始化 bot API（首次調用時）
    if (!botApi) {
      initializeTaskExecutor(ctx.api);
    }

    // 下載語音文件
    const file = await ctx.getFile();
    const filePath = file.file_path;

    if (!filePath) {
      await ctx.reply("無法取得語音檔案路徑");
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download voice: ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    logger.info({ userId, duration: voice.duration, size: audioBuffer.length }, "Voice downloaded");

    // 轉錄語音
    await ctx.api.sendChatAction(chatId, "typing");
    const result = await transcribeAudio(audioBuffer, "audio/ogg");

    if (!result.text || result.text === "[無法辨識]") {
      await ctx.reply("無法辨識語音內容，請重試");
      return;
    }

    // 顯示轉錄結果
    const formatted = fmt`🎤 ${result.text}`;
    await ctx.reply(formatted.text, { parse_mode: "MarkdownV2", entities: formatted.entities });

    // 將轉錄文字作為用戶訊息處理
    const prompt = result.text;
    const session: SessionInfo = {
      sessionId: userId,
      platform: "telegram",
      sessionType: "dm",
    };
    const task = await prepareTask(userId, chatId, `[語音訊息] ${prompt}`, prompt, session);
    const sender = createTelegramSender(ctx.api);

    // 檢查是否有進行中的任務
    const isProcessing = queueManager.isProcessing(userId) || hasActiveProcess(userId);

    if (isProcessing) {
      const mode = queueManager.getMode(userId);

      if (mode === "interrupt") {
        // 打斷模式：中止當前任務並立即執行
        abortUserProcess(userId);
        queueManager.clearQueue(userId);

        await queueManager.executeImmediately(task, async (t) => {
          await executeClaudeTask(t, chatId, sender);
        });
      } else {
        // 排隊模式：加入佇列
        const queueSize = queueManager.getQueueLength(userId) + 1;
        await ctx.reply(`📋 已排入佇列（第 ${queueSize} 位）`);

        queueManager
          .enqueue(task, async (t) => {
            await executeClaudeTask(t, chatId, sender);
          })
          .catch((error) => {
            logger.error({ error, taskId: task.id }, "Queued task failed");
            ctx.api.sendMessage(chatId, `❌ 任務執行失敗：${error.message}`).catch(() => {});
          });
      }

      return;
    }

    // 沒有進行中的任務，直接執行
    await queueManager.executeImmediately(task, async (t) => {
      await executeClaudeTask(t, chatId, sender);
    });
  } catch (error) {
    logger.error({ error, userId }, "Failed to process voice");
    await ctx.reply("處理語音訊息失敗，請稍後再試");
  }
}
