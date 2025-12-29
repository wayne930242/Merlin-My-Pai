import { Bot } from "grammy";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { isAuthorized } from "./auth";
import {
  handleStart,
  handleClear,
  handleStatus,
  handleMessage,
} from "./handlers";

export function createTelegramBot(): Bot {
  const bot = new Bot(config.telegram.token);

  // Auth middleware - check if user is allowed
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId) {
      logger.warn("Message without user ID");
      return;
    }

    if (!isAuthorized(userId)) {
      await ctx.reply("⛔ 你沒有使用此 Bot 的權限");
      return;
    }

    await next();
  });

  // Command handlers (using / prefix)
  bot.command("start", handleStart);
  bot.command("clear", handleClear);
  bot.command("status", handleStatus);

  // Message handler (for non-command messages)
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    // Skip bot commands (but allow /cc: to pass through for Claude slash commands)
    if (text.startsWith("/") && !text.startsWith("/cc:")) {
      return;
    }

    await handleMessage(ctx);
  });

  // Error handler
  bot.catch((err) => {
    logger.error({ error: err }, "Bot error");
  });

  return bot;
}
