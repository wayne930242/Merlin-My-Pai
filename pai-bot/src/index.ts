import { config, validateConfig } from "./config";
import { logger } from "./utils/logger";
import { createTelegramBot } from "./platforms/telegram/bot";
import { getDb, closeDb } from "./storage/db";
import { startApiServer, setTelegramBot } from "./api/server";

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
          await bot.api.sendMessage(userId, text, { parse_mode: "Markdown" });
        },
      },
      config.telegram.allowedUserIds
    );

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      await bot.stop();
      apiServer.stop();
      closeDb();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

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
