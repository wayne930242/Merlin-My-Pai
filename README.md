# weihung-pai

Personal AI Infrastructure - Merlin

基於 [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure) 架構設計的個人化 Claude Code 數位助理系統。

## 專案結構

```
weihung-pai/
├── .claude/          # 開發環境 Claude Code 配置
│   ├── commands/     # Slash commands
│   └── rules/        # 開發規範 (bun, commit, typescript)
├── pai-bot/          # Telegram Bot 服務 (Bun + grammY)
│   └── src/
│       ├── api/      # HTTP API server
│       ├── claude/   # Claude Code client
│       ├── platforms/# Telegram handlers
│       └── storage/  # SQLite 儲存
├── pai-claude/       # Merlin VPS 運行配置
│   ├── agents/       # Subagents (Engineer, Architect, etc.)
│   ├── skills/       # 技能模組 (learning, daily, research, fabric, coding)
│   ├── context/      # 身份與原則
│   └── scripts/      # Hooks
├── ansible/          # VPS 部署
│   ├── playbooks/    # 部署劇本
│   │   ├── init/     # 初始化 (provision, setup)
│   │   ├── deploy-bot.yml
│   │   └── deploy-claude.yml
│   ├── inventory/    # 主機清單與 vault
│   └── scripts/      # ansible-wrapper.sh, ssh-to-vps.sh
└── docs/             # 文件
```

## 功能

- **Telegram Bot** - 透過 Telegram 與 Merlin 對話
- **Skills 系統** - 模組化技能：學習輔助、日常事務、研究調查、內容處理、程式碼撰寫
- **Workspace** - Merlin 可自動建立腳本並保存到 GitHub private repo

## 快速開始

### 1. 設定 Vault

所有敏感資料都存放在 Ansible Vault 中：

```bash
cd ansible/inventory/group_vars/all

# 複製範例並編輯
cp vault.yml.example vault.yml
# 編輯 vault.yml，填入你的值

# 加密
ansible-vault encrypt vault.yml
```

**Vault 包含的變數**：
| 變數 | 說明 |
|------|------|
| `telegram_bot_token` | Telegram Bot Token |
| `telegram_allowed_user_ids` | 允許使用的 Telegram User ID |
| `vault_server_ip` | VPS IP |
| `pai_agent_user` | VPS 用戶名（預設 pai）|
| `pai_agent_ssh_private_key` | SSH 私鑰 |
| `pai_agent_ssh_public_key` | SSH 公鑰 |
| `github_token` | GitHub PAT (scopes: repo, read:org, gist) |
| `github_username` | GitHub 用戶名 |
| `vultr_api_key` | Vultr API Key（可選）|

### 2. 設定 Inventory

```bash
cd ansible/inventory
cp hosts.yml.example hosts.yml
# 編輯 hosts.yml，設定 VPS IP 和用戶
```

### 3. 本地開發

```bash
# 安裝依賴
cd pai-bot && bun install

# 設定環境變數
cp .env.example .env
# 編輯 .env

# 初始化資料庫
bun run db:init

# 啟動開發
bun run dev
```

### 4. VPS 部署

所有 ansible 命令透過 wrapper 執行（自動從 vault 解密 SSH key）：

```bash
cd ansible

# === 初始化（僅首次）===

# 1. 建立 VPS（可選，若已有 VPS 則跳過）
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/init/provision-vultr.yml

# 2. 初始化部署用戶
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/init/init-user.yml

# 3. VPS 基礎設定（安裝 Bun, Claude, gh cli, 建立 workspace）
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/init/setup-vps.yml

# 4. Claude Code 認證
./scripts/ssh-to-vps.sh
# 進入後執行: ~/.local/bin/claude setup-token

# === 日常部署 ===

# 部署 Claude Code 配置
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/deploy-claude.yml

# 部署 Bot
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/deploy-bot.yml
```

## Ansible Playbooks

### 日常部署

| Playbook | 說明 |
|----------|------|
| `deploy-bot.yml` | 部署 Telegram Bot |
| `deploy-claude.yml` | 部署 Claude Code 配置 |

### 初始化 (init/)

| Playbook | 說明 |
|----------|------|
| `provision-vultr.yml` | 透過 Vultr API 建立 VPS |
| `init-user.yml` | 初始化部署用戶 |
| `setup-vps.yml` | VPS 環境設定（Bun, Claude, gh cli, workspace）|

### Scripts

| Script | 說明 |
|--------|------|
| `ansible-wrapper.sh` | Ansible 執行包裝器（自動從 vault 取得 SSH key）|
| `ssh-to-vps.sh` | SSH 快捷連線（用於 Claude 認證等互動操作）|

## Bot 指令

| 指令 | 說明 |
|------|------|
| `/start` | 顯示歡迎訊息 |
| `/clear` | 清除對話歷史 |
| `/status` | 查看狀態 |
| `/cc:<cmd>` | 執行 Claude slash command |

## 技術棧

| 類別 | 技術 |
|------|------|
| Runtime | Bun |
| Bot | grammY |
| AI | Claude Code CLI (Headless) |
| Database | SQLite (bun:sqlite) |
| Deploy | Ansible + systemd |

## 參考

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure)
