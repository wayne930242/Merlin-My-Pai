import { config, validateConfig } from "./config";
import { logger } from "./utils/logger";
import { fmt } from "./utils/telegram";
import { createTelegramBot, setupBotCommands } from "./platforms/telegram/bot";
import { getDb, closeDb } from "./storage/db";
import { startApiServer, setTelegramBot } from "./api/server";
import { startScheduler, stopScheduler, type Schedule, type TaskResult } from "./services/scheduler";
import { callClaude } from "./claude/client";

async function main() {
  try {
    // Validate configuration
    validateConfig();
    logger.info("Configuration validated");

    // Initialize database
    getDb();
    logger.info("Database ready");

    // Create Telegram bot
    const bot = createTelegramBot();

    // Start API server for MCP integration
    const apiPort = parseInt(process.env.API_PORT || "3000", 10);
    const apiServer = startApiServer(apiPort);

    // Inject Telegram bot into API server
    setTelegramBot(
      {
        sendMessage: async (userId: number, text: string) => {
          const formatted = fmt`${text}`;
          await bot.api.sendMessage(userId, formatted.text, {
            parse_mode: "MarkdownV2",
            entities: formatted.entities,
          });
        },
      },
      config.telegram.allowedUserIds
    );

    // Task executor for scheduler
    const executeScheduledTask = async (schedule: Schedule): Promise<TaskResult> => {
      const taskData = schedule.task_data;

      try {
        if (schedule.task_type === "message") {
          // 直接發送訊息
          await bot.api.sendMessage(schedule.user_id, taskData);
          return { success: true, result: "訊息已發送" };
        } else if (schedule.task_type === "prompt") {
          // 執行 Claude prompt 並發送結果
          const result = await callClaude(taskData);
          if (result.response) {
            await bot.api.sendMessage(schedule.user_id, result.response);
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
          await bot.api.sendMessage(
            schedule.user_id,
            `⚠️ 排程任務「${schedule.name}」執行失敗\n錯誤：${errorMessage}`
          );
        } catch {
          // 通知失敗也記錄
          logger.error({ scheduleId: schedule.id }, "Failed to notify user about schedule error");
        }

        return { success: false, error: errorMessage };
      }
    };

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      stopScheduler();
      await bot.stop();
      apiServer.stop();
      closeDb();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Register bot commands
    await setupBotCommands(bot);

    // Start scheduler
    startScheduler(executeScheduledTask);

    // Start bot
    logger.info("Starting Telegram bot...");
    await bot.start({
      onStart: (botInfo) => {
        logger.info(
          { username: botInfo.username },
          "Bot started successfully"
        );
      },
    });
  } catch (error) {
    logger.fatal({ error }, "Failed to start bot");
    process.exit(1);
  }
}

main();
