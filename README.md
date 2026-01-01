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
│       ├── mcp/      # MCP Server (Google + System tools)
│       ├── platforms/# Telegram handlers
│       └── storage/  # SQLite 儲存
├── pai-claude/       # Merlin VPS 運行配置 (↔ ~/merlin/)
│   ├── context/      # 身份與原則
│   ├── scripts/      # Hooks
│   └── workspace/    # 工作區
│       ├── .claude/  # Agent System 配置
│       │   ├── agents/   # Subagents
│       │   ├── skills/   # 技能模組
│       │   ├── commands/ # Slash commands
│       │   └── rules/    # 規範
│       ├── site/     # 網站檔案（Caddy serve）
│       ├── downloads/# 下載檔案
│       ├── projects/ # 專案
│       └── data/     # 資料檔案
├── ansible/          # VPS 部署
│   ├── playbooks/    # 部署劇本
│   ├── inventory/    # 主機清單與 vault
│   └── scripts/      # ansible-wrapper.sh, setup-ssh-config.sh
└── mutagen.yml       # 雙向同步配置
```

## 功能

- **Telegram Bot** - 透過 Telegram 與 Merlin 對話
- **Skills 系統** - 模組化技能：學習輔助、日常事務、研究調查、內容處理、程式碼撰寫
- **Google 整合** - 透過 MCP 存取 Google Calendar、Drive、Gmail、Contacts
- **System MCP** - 系統管理工具（重載 Caddy、服務狀態）
- **雙向同步** - 本地 ↔ VPS 透過 Mutagen 即時同步
- **Workspace** - Merlin 可直接編輯網站、建立腳本
- **Fabric AI** - 透過 Fabric patterns 處理內容（摘要、分析）
- **靜態網站** - Caddy 託管（自動 HTTPS，Merlin 可直接編輯）

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
| `vultr_api_key` | Vultr API Key（僅使用 Vultr 自動建立時需要）|
| `vault_anthropic_api_key` | Anthropic API Key（用於 Fabric AI）|
| `vault_google_client_id` | Google OAuth2 Client ID |
| `vault_google_client_secret` | Google OAuth2 Client Secret |
| `vault_google_refresh_token` | Google OAuth2 Refresh Token |

### 2. 設定 Google OAuth2（可選）

讓 Merlin 存取你的 Google 日曆、雲端硬碟、Gmail、聯絡人：

```bash
cd ansible

# 1. 建立 OAuth2 憑證
#    前往 https://console.cloud.google.com/
#    建立專案 → 啟用 API（Calendar, Drive, Gmail, People）
#    建立 OAuth 2.0 憑證（桌面應用程式）
#    OAuth consent screen → 加入測試用戶（你的 email）

# 2. 存入 Client ID/Secret（只需首次）
export GOOGLE_CLIENT_ID='your-client-id'
export GOOGLE_CLIENT_SECRET='your-client-secret'
./scripts/ansible-wrapper.sh ansible-playbook playbooks/config/google-oauth.yml

# 3. 授權（會開瀏覽器，自動存入 refresh token）
./scripts/google-auth.sh
```

### 3. 設定 Inventory

```bash
cd ansible/inventory
cp hosts.yml.example hosts.yml
# 編輯 hosts.yml，設定 VPS IP 和用戶
```

### 3. 設定 SSH 和 Mutagen 同步

```bash
cd ansible

# 從 vault 提取 SSH 設定（自動設定 ~/.ssh/config）
./scripts/setup-ssh-config.sh

# 安裝 Mutagen
brew install mutagen-io/mutagen/mutagen

# 啟動雙向同步（pai-claude/ ↔ VPS ~/merlin/）
cd ..
./sync start
```

### 4. 本地開發

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

### 5. VPS 部署

**VPS 廠商不限** - 專案不綁定 Vultr，可使用任何 VPS（Linode、DigitalOcean、Hetzner 等），只要是 Ubuntu Linux 即可。

所有 ansible 命令透過 wrapper 執行（自動從 vault 解密 SSH key）：

```bash
cd ansible

# === 初始化（僅首次）===

# 1. 建立 VPS（二擇一）
#    方法 A：使用 Vultr 自動建立
./scripts/ansible-wrapper.sh ansible-playbook -i inventory playbooks/init/provision-vultr.yml
#    方法 B：手動建立任意 VPS，然後更新 vault.yml 中的 vault_server_ip

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
| `deploy-claude.yml` | 部署 Claude Code 配置（備用，正常使用 Mutagen 同步）|
| `deploy-fabric.yml` | 部署 Fabric AI |

### 維護

| Playbook | 說明 |
|----------|------|
| `clean-logs.yml` | 清理 VPS 上的 log 檔案 |

### 初始化 (init/)

| Playbook | 說明 |
|----------|------|
| `provision-vultr.yml` | （可選）透過 Vultr API 自動建立 VPS，使用其他廠商請手動建立 |
| `init-user.yml` | 初始化部署用戶 |
| `setup-vps.yml` | VPS 環境設定（Bun, Claude, gh cli, workspace, 防火牆）|
| `setup-caddy.yml` | 設定 Caddy 靜態網站（自動 HTTPS）|

### Scripts

| Script | 說明 |
|--------|------|
| `ansible-wrapper.sh` | Ansible 執行包裝器（自動從 vault 取得 SSH key）|
| `setup-ssh-config.sh` | 設定 SSH config 和 Mutagen（從 vault 提取）|
| `ssh-to-vps.sh` | SSH 快捷連線（用於 Claude 認證等互動操作）|
| `google-auth.sh` | Google OAuth2 授權（取得 refresh token）|

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

## GitHub Actions 自動部署

推送到 `main` 分支時會自動部署（需先設定 GitHub Secrets）。

### 設定 GitHub Secrets

到 repo Settings → Secrets and variables → Actions，新增：

| Secret | 說明 |
|--------|------|
| `ANSIBLE_VAULT_PASSWORD` | 你的 ansible-vault 密碼 |

Workflow 會自動從 vault 解密 SSH key 並執行部署。

### 手動觸發

也可以在 Actions 頁面手動觸發 `Deploy to VPS` workflow。

## 參考

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure)
