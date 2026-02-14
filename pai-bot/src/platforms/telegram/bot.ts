import { Bot } from "grammy";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { isAuthorized } from "./auth";
import { handleCallbackQuery } from "./callbacks";
import {
  handleClear,
  handleDocument,
  handleHQ,
  handleMemory,
  handleMessage,
  handleMode,
  handlePhoto,
  handleStart,
  handleStatus,
  handleStop,
  handleVoice,
  handleWorkspace,
} from "./handlers";

export async function setupBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([
    { command: "start", description: "啟動 Merlin" },
    { command: "mode", description: "切換排隊/打斷模式" },
    { command: "status", description: "查看狀態" },
    { command: "stop", description: "中斷當前任務" },
    { command: "clear", description: "清除對話歷史" },
    { command: "memory", description: "查看長期記憶" },
    { command: "workspace", description: "顯示 workspace 樹狀結構" },
    { command: "hq", description: "設定為管理中心" },
  ]);
  logger.info("Bot commands registered");
}

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
      await ctx.reply("你沒有使用此 Bot 的權限");
      return;
    }

    await next();
  });

  // Command handlers (using / prefix)
  bot.command("start", handleStart);
  bot.command("mode", handleMode);
  bot.command("status", handleStatus);
  bot.command("stop", handleStop);
  bot.command("clear", handleClear);
  bot.command("memory", handleMemory);
  bot.command("workspace", handleWorkspace);
  bot.command("hq", handleHQ);

  // Message handler (for non-command messages)
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    // Skip bot commands (but allow /cc: to pass through for Claude slash commands)
    if (text.startsWith("/") && !text.startsWith("/cc:")) {
      return;
    }

    await handleMessage(ctx);
  });

  // Document handler
  bot.on("message:document", handleDocument);

  // Photo handler
  bot.on("message:photo", handlePhoto);

  // Voice handler
  bot.on("message:voice", handleVoice);

  // Callback query handler (inline keyboard)
  bot.on("callback_query:data", handleCallbackQuery);

  // Error handler
  bot.catch((err) => {
    logger.error({ error: err }, "Bot error");
  });

  return bot;
}
