/**
 * Telegram Callback Query Handlers
 * 處理 Inline Keyboard 的回調
 */

import type { Context } from "grammy";
import { abortUserProcess } from "../../claude/client";
import { type QueuedTask, queueManager } from "../../claude/queue-manager";
import { getPrompt, resolvePrompt } from "../../services/prompt-store";
import { logger } from "../../utils/logger";

// 任務執行器（由 handlers.ts 設定）
let taskExecutor: ((task: QueuedTask, chatId: number) => Promise<void>) | null = null;

/**
 * 設定任務執行器
 */
export function setTaskExecutor(
  executor: (task: QueuedTask, chatId: number) => Promise<void>,
): void {
  taskExecutor = executor;
}

/**
 * 處理 callback query
 */
export async function handleCallbackQuery(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!data || !userId || !chatId) return;

  // 解析 callback data: action:taskId
  const colonIndex = data.indexOf(":");
  if (colonIndex === -1) return;

  const action = data.slice(0, colonIndex);
  const taskId = data.slice(colonIndex + 1);

  // Handle prompt callbacks: prompt:promptId:optionIndex
  if (action === "prompt") {
    const parts = data.split(":");
    const promptId = parts[1];
    const optionIndex = parseInt(parts[2], 10);

    const prompt = getPrompt(promptId);
    if (!prompt) {
      await ctx.answerCallbackQuery({ text: "此提示已過期" });
      return;
    }

    if (prompt.result !== null) {
      await ctx.answerCallbackQuery({ text: `已選擇：${prompt.options[prompt.result]}` });
      return;
    }

    const resolved = resolvePrompt(promptId, optionIndex);
    if (resolved) {
      await ctx.answerCallbackQuery({ text: `已選擇：${prompt.options[optionIndex]}` });
      // Update message to show selection
      try {
        await ctx.editMessageText(
          `${prompt.question}\n\n✅ 已選擇：${prompt.options[optionIndex]}`,
          {
            reply_markup: undefined,
          },
        );
      } catch {
        // Ignore edit failures
      }
    } else {
      await ctx.answerCallbackQuery({ text: "操作失敗" });
    }
    return;
  }

  // 只處理 queue 相關的 callback
  if (action !== "abort" && action !== "queue") return;

  logger.debug({ userId, action, taskId }, "Callback query received");

  // 檢查任務是否已開始（過時請求）
  if (queueManager.isTaskStarted(taskId)) {
    await ctx.answerCallbackQuery({ text: "此選項已過時，任務已開始執行" });
    try {
      await ctx.deleteMessage();
    } catch {
      // 忽略刪除失敗
    }
    return;
  }

  // 取消超時計時器
  const pending = queueManager.cancelPendingDecision(userId);
  if (pending) {
    try {
      await ctx.api.deleteMessage(chatId, pending.messageId);
    } catch {
      // 忽略刪除失敗
    }
  }

  // 取得暫存的任務
  const task = queueManager.getPendingTask(taskId);
  if (!task) {
    await ctx.answerCallbackQuery({ text: "任務已過期" });
    return;
  }

  if (action === "abort") {
    // 打斷：中止當前任務 + 清空佇列 + 立即執行
    abortUserProcess(userId);
    const clearedCount = queueManager.clearQueue(userId);

    logger.info({ userId, taskId, clearedCount }, "Task interrupted, queue cleared");

    await ctx.answerCallbackQuery({ text: "已打斷，開始新任務" });

    // 立即執行新任務
    if (taskExecutor) {
      queueManager.removePendingTask(taskId);
      await queueManager.executeImmediately(task, async (t) => {
        await taskExecutor!(t, chatId);
      });
    }
  } else if (action === "queue") {
    // 排隊：加入佇列
    const queueLength = queueManager.getQueueLength(userId) + 1;

    await ctx.answerCallbackQuery({ text: `已排入佇列 (第 ${queueLength} 位)` });

    logger.info({ userId, taskId, position: queueLength }, "Task queued");

    // 加入佇列
    if (taskExecutor) {
      queueManager
        .enqueue(task, async (t) => {
          await taskExecutor!(t, chatId);
        })
        .catch((error) => {
          logger.error({ error, taskId }, "Queued task failed");
        });
    }
  }
}
