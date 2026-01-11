# pai-bot

Personal AI Bot - 整合 Claude Code 的多平台聊天機器人。

## 功能

### 核心

- **Claude Code 整合** - 透過 CLI headless 模式與 Claude 對話
- **多平台支援** - Telegram、Discord 雙平台
- **MCP Server** - 提供工具給 Claude Code 使用

### MCP 工具

| 工具 | 說明 |
|------|------|
| Google | Calendar、Gmail、Tasks、Drive、Contacts |
| Scheduler | 排程任務管理 |
| Memory | 向量記憶儲存與檢索 |
| Notify | 推播通知 |
| Garmin | 健康數據查詢 |
| System | 系統管理 |

### Discord 特色

- 骰子系統（支援 TRPG 規則）
- 語音頻道管理

### 服務

- **Intel Feed** - 自動彙整 Reddit、RSS 情報，AI 篩選後推播

### 其他

- 語音訊息轉文字
- 向量記憶（sqlite-vec）
- 定時任務排程

## 技術棧

- **Runtime**: Bun
- **Telegram**: grammY
- **Discord**: discord.js + @discordjs/voice
- **Database**: SQLite (bun:sqlite) + sqlite-vec
- **MCP**: @modelcontextprotocol/sdk

## 安裝

```bash
cd pai-bot
bun install
```

## 設定

複製 `.env.example` 為 `.env` 並填入：

```bash
# AI API
ANTHROPIC_API_KEY=sk-ant-xxx

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=123456789

# Discord
DISCORD_BOT_TOKEN=
DISCORD_ALLOWED_USER_IDS=1234567890123456789

# Database
DATABASE_PATH=./data/pai.db
```

至少需要設定一個平台（Telegram 或 Discord）。

## 使用

```bash
# 開發模式（hot reload）
bun run dev

# 生產模式
bun run start

# 初始化資料庫
bun run db:init

# 類型檢查
bun run typecheck
```

## 目錄結構

```
pai-bot/
├── src/
│   ├── index.ts           # 入口點
│   ├── config.ts          # 設定管理
│   ├── api/               # HTTP API
│   ├── claude/            # Claude Code 整合
│   ├── context/           # 對話上下文
│   ├── mcp/               # MCP Server & Tools
│   ├── memory/            # 向量記憶系統
│   ├── platforms/
│   │   ├── telegram/      # Telegram Bot
│   │   └── discord/       # Discord Bot
│   ├── services/          # 外部服務整合
│   ├── storage/           # SQLite 資料庫
│   └── utils/             # 工具函式
├── assets/                # 靜態資源
└── scripts/               # 開發腳本
```

## 部署

使用 Ansible 部署到 VPS：

```bash
uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml
```
