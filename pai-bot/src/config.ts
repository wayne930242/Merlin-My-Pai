// Configuration management

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .filter(Boolean)
      .map((id) => parseInt(id, 10)),
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN || "",
    allowedUserIds: (process.env.DISCORD_ALLOWED_USER_IDS || "").split(",").filter(Boolean),
  },
  memory: {
    enabled: process.env.ENABLE_MEMORY === "true",
    provider: (process.env.MEMORY_PROVIDER || "gemini") as "gemini" | "haiku",
  },
  transcription: {
    enabled: process.env.ENABLE_TRANSCRIPTION === "true",
  },
  claude: {
    /** Claude 專案目錄（VPS 上是 ~/merlin/workspace，本地開發用 ../pai-claude/workspace） */
    projectDir:
      process.env.CLAUDE_PROJECT_DIR ||
      (process.env.HOME ? `${process.env.HOME}/merlin/workspace` : "../pai-claude/workspace"),
    /** Claude 執行檔路徑 */
    bin:
      process.env.CLAUDE_BIN ||
      (process.env.HOME ? `${process.env.HOME}/.local/bin/claude` : "claude"),
  },
  workspace: {
    /** 下載檔案存放目錄 */
    downloadsDir:
      process.env.WORKSPACE_DOWNLOADS_DIR ||
      (process.env.HOME
        ? `${process.env.HOME}/merlin/workspace/downloads`
        : "../pai-claude/workspace/downloads"),
  },
  database: {
    path: process.env.DATABASE_PATH || "./data/pai.db",
  },
  spotify: {
    username: process.env.SPOTIFY_USERNAME || "",
    password: process.env.SPOTIFY_PASSWORD || "",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  api: {
    /** Web API Key（用於保護 WebSocket 和 API 端點） */
    key: process.env.PAI_API_KEY || "",
  },
  rateLimit: {
    requests: parseInt(process.env.RATE_LIMIT_REQUESTS || "20", 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || "60000", 10),
  },
} as const;

// Validate required config
export function validateConfig(): void {
  const hasTelegram = config.telegram.token && config.telegram.allowedUserIds.length > 0;
  const hasDiscord = config.discord.token && config.discord.allowedUserIds.length > 0;

  if (!hasTelegram && !hasDiscord) {
    throw new Error("At least one platform (Telegram or Discord) must be configured");
  }
}

export function isTelegramEnabled(): boolean {
  return !!(config.telegram.token && config.telegram.allowedUserIds.length > 0);
}

export function isDiscordEnabled(): boolean {
  return !!(config.discord.token && config.discord.allowedUserIds.length > 0);
}
