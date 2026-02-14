# weihung-pai

Personal AI Infrastructure - Merlin

基於 [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure) 架構設計的個人化 Claude Code 數位助理系統。

## 專案結構

```
weihung-pai/
├── pai-bot/          # 多平台 Bot 服務
├── pai-claude/       # Merlin VPS 運行配置
├── scripts/          # CLI 工具集
├── setup/            # 設定精靈
├── ansible/          # VPS 部署
└── .claude/          # 開發環境配置
```

| 模組 | 說明 |
|------|------|
| [pai-bot](pai-bot/README.md) | Telegram/Discord Bot（Bun + grammY + discord.js） |
| [pai-claude](pai-claude/README.md) | Merlin 身份、Skills、Hooks（同步至 VPS ~/merlin/） |
| [scripts](scripts/README.md) | CLI 工具（ansible, ssh, bot, google） |
| [setup](setup/README.md) | 互動式設定精靈 |

## 架構重點（2026-02）

- `packages/capabilities/memory`：記憶能力單一契約（working / episodic / semantic / procedural）
- `pai-bot`：`/api/memory/*` 透過 capability adapter 提供統一路由行為
- `pai-claude/hooks`：memory CLI 透過 capability façade，不直接放在 workspace
- `pai-web`：memory API client 對齊 capability-backed payload（`POST /api/memory/search`, `POST /api/memory/save`）

## 功能

- **多平台 Bot** - Telegram / Discord 與 Merlin 對話
- **Skills 系統** - 模組化技能：學習、日常、研究、程式碼
- **Intel Feed** - 自動彙整 Reddit、RSS 情報摘要
- **Obsidian LiveSync** - CouchDB 筆記同步
- **Google 整合** - Calendar、Drive、Gmail、Contacts
- **雙向同步** - 本地 ↔ VPS 透過 Mutagen 即時同步
- **Fabric AI** - 透過 Fabric patterns 處理內容

## 環境需求

- [uv](https://docs.astral.sh/uv/) - Python 套件管理
- [Bun](https://bun.sh/) - JavaScript runtime
- [Mutagen](https://mutagen.io/) - 檔案同步

```bash
# macOS
brew install uv oven-sh/bun/bun mutagen-io/mutagen/mutagen
```

## 快速開始

### 1. 設定精靈

```bash
uv sync
uv run pai-setup
```

設定精靈會引導完成 Vault 密碼、變數設定、SSH Key 產生、初始化部署。

### 2. 本地開發

```bash
cd pai-bot && bun install
cp .env.example .env  # 編輯 .env
bun run db:init
bun run dev
```

### 3. VPS 部署

```bash
# 初始化（僅首次）
uv run pai ansible ansible-playbook ansible/playbooks/init/init-user.yml
uv run pai ansible ansible-playbook ansible/playbooks/init/setup-vps.yml
uv run pai ansible ansible-playbook ansible/playbooks/init/setup-caddy.yml
# 日常部署
uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml
uv run pai ansible ansible-playbook ansible/playbooks/deploy-claude.yml
```

### 4. 同步

```bash
./sync.py start   # 啟動 pai-claude ↔ VPS 同步
./sync.py status
```

## 常用指令

```bash
uv run pai-setup                    # 設定精靈
uv run pai ssh connect              # SSH 連線
uv run pai bot status               # Bot 狀態
uv run pai bot logs -f              # 追蹤日誌
uv run pai google auth              # Google OAuth
```

詳見 [scripts/README.md](scripts/README.md)。

## Ansible Playbooks

| Playbook | 說明 |
|----------|------|
| `deploy-bot.yml` | 部署 Bot |
| `deploy-claude.yml` | 部署 Claude 配置 |
| `init/init-user.yml` | 初始化部署用戶 |
| `init/setup-vps.yml` | VPS 環境設定 |
| `init/setup-caddy.yml` | Caddy 靜態網站 |

## 技術棧

| 類別 | 技術 |
|------|------|
| Runtime | Bun |
| Bot | grammY, discord.js |
| AI | Claude Code CLI (Headless) |
| Database | SQLite + sqlite-vec |
| Deploy | Ansible + systemd |

## GitHub Actions

推送到 `main` 分支時自動部署。需設定 Secret：`ANSIBLE_VAULT_PASSWORD`

## 參考

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure)
