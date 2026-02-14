import type { Client } from "discord.js";
import { setDiscordClient, setTelegramBot, startApiServer } from "./api/server";
import { callClaude } from "./claude/client";
import { config, isDiscordEnabled, isTelegramEnabled, validateConfig } from "./config";
import { createDiscordBot, startDiscordBot, stopDiscordBot } from "./platforms/discord";
import { createTelegramBot, setupBotCommands } from "./platforms/telegram/bot";
import { initWebPlatform } from "./platforms/web";
import { generateDigest, pauseIntelFeedSchedules } from "./services/intel-feed";
import {
  type Schedule,
  startScheduler,
  stopScheduler,
  type TaskResult,
} from "./services/scheduler";
import { closeDb, getDb } from "./storage/db";
import { logger } from "./utils/logger";

// 全局錯誤處理 - 確保所有錯誤都記錄到 error log
process.on("uncaughtException", (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  const error = reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason;
  logger.error({ error, promise: String(promise) }, "Unhandled promise rejection");
});

async function main() {
  try {
    // Validate configuration
    validateConfig();
    logger.info("Configuration validated");

    // Initialize database
    getDb();
    logger.info("Database ready");

    // Platform instances
    let telegramBot: ReturnType<typeof createTelegramBot> | null = null;
    let discordClient: Client | null = null;

    // Start API server for MCP integration
    const apiPort = parseInt(process.env.API_PORT || "3000", 10);
    const apiServer = startApiServer(apiPort);

    // Initialize Web platform (handles WebSocket chat)
    initWebPlatform();

    // Initialize Telegram if configured
    if (isTelegramEnabled()) {
      telegramBot = createTelegramBot();

      // Inject Telegram bot into API server
      setTelegramBot(
        {
          sendMessage: async (userId: number, text: string) => {
            await telegramBot!.api.sendMessage(userId, text);
          },
        },
        config.telegram.allowedUserIds,
      );

      logger.info("Telegram bot configured");
    }

    // Initialize Discord if configured
    if (isDiscordEnabled()) {
      discordClient = createDiscordBot();

      // Inject Discord client into API server
      setDiscordClient(discordClient);

      logger.info("Discord bot configured");
    }

    // Task executor for scheduler (uses Telegram if available)
    const executeScheduledTask = async (schedule: Schedule): Promise<TaskResult> => {
      const taskData = schedule.task_data;

      // Try to find the right platform to send the message
      const sendMessage = async (userId: number, text: string) => {
        if (telegramBot && config.telegram.allowedUserIds.includes(userId)) {
          await telegramBot.api.sendMessage(userId, text);
          return true;
        }
        // Discord scheduled messages not yet supported
        return false;
      };

      try {
        if (schedule.task_type === "message") {
          const sent = await sendMessage(schedule.user_id, taskData);
          if (!sent) return { success: false, error: "No platform available" };
          return { success: true, result: "訊息已發送" };
        } else if (schedule.task_type === "prompt") {
          // Special handling for /intel-digest
          if (taskData === "/intel-digest") {
            logger.info("Executing Intel Feed digest...");
            const digestResult = await generateDigest();
            if (digestResult.ok) {
              return {
                success: true,
                result: `已推送 ${digestResult.categories.length} 個分類，共 ${digestResult.itemCount} 則`,
              };
            }
            return { success: false, error: digestResult.error || "Digest generation failed" };
          }

          const result = await callClaude(taskData);
          if (result.response) {
            const sent = await sendMessage(schedule.user_id, result.response);
            if (!sent) return { success: false, error: "No platform available" };
            return { success: true, result: result.response.slice(0, 500) };
          }
          return { success: true, result: "無回應內容" };
        }
        return { success: false, error: "未知的任務類型" };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error, scheduleId: schedule.id }, "Failed to execute scheduled task");

        // 通知用戶執行失敗
        try {
          await sendMessage(
            schedule.user_id,
            `排程任務「${schedule.name}」執行失敗\n錯誤：${errorMessage}`,
          );
        } catch {
          logger.error({ scheduleId: schedule.id }, "Failed to notify user about schedule error");
        }

        return { success: false, error: errorMessage };
      }
    };

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      stopScheduler();
      if (telegramBot) await telegramBot.stop();
      if (discordClient) stopDiscordBot(discordClient);
      apiServer.stop();
      closeDb();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Pause deprecated Intel Feed schedules before scheduler starts
    if (config.telegram.allowedUserIds.length > 0) {
      await pauseIntelFeedSchedules(config.telegram.allowedUserIds[0]);
    }

    // Start scheduler
    startScheduler(executeScheduledTask);

    // Start platforms
    // Discord first (non-blocking), then Telegram (blocking long-poll)
    if (discordClient) {
      logger.info("Starting Discord bot...");
      await startDiscordBot(discordClient);
    }

    if (telegramBot) {
      await setupBotCommands(telegramBot);
      logger.info("Starting Telegram bot...");
      // This blocks forever (long polling)
      await telegramBot.start({
        onStart: (botInfo) => {
          logger.info({ username: botInfo.username }, "Telegram bot started");
        },
      });
    }

    // Keep process running if only Discord (no Telegram blocking)
    if (!telegramBot && discordClient) {
      logger.info("Running in Discord-only mode");
    }
  } catch (error) {
    const err = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    logger.fatal({ error: err }, "Failed to start bot");
    process.exit(1);
  }
}

main();
