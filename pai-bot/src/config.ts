// Configuration management

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .filter(Boolean)
      .map((id) => parseInt(id, 10)),
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
    projectDir: process.env.CLAUDE_PROJECT_DIR ||
      (process.env.HOME ? `${process.env.HOME}/merlin/workspace` : "../pai-claude/workspace"),
    /** Claude 執行檔路徑 */
    bin: process.env.CLAUDE_BIN ||
      (process.env.HOME ? `${process.env.HOME}/.local/bin/claude` : "claude"),
  },
  workspace: {
    /** 下載檔案存放目錄 */
    downloadsDir: process.env.WORKSPACE_DOWNLOADS_DIR ||
      (process.env.HOME ? `${process.env.HOME}/merlin/workspace/downloads` : "../pai-claude/workspace/downloads"),
  },
  database: {
    path: process.env.DATABASE_PATH || "./data/pai.db",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
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
