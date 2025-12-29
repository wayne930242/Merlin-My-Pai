// Configuration management

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .filter(Boolean)
      .map((id) => parseInt(id, 10)),
  },
  claude: {
    /** pai-claude 專案目錄，Claude 會讀取這裡的 CLAUDE.md 和 Skills */
    projectDir: process.env.CLAUDE_PROJECT_DIR || "../pai-claude",
  },
  database: {
    path: process.env.DATABASE_PATH || "./data/pai.db",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  rateLimit: {
    requests: parseInt(process.env.RATE_LIMIT_REQUESTS || "20", 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || "60000", 10),
  },
} as const;

// Validate required config
export function validateConfig(): void {
  if (!config.telegram.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }
  if (config.telegram.allowedUserIds.length === 0) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS is required");
  }
}
