# weihung-pai

Personal AI Infrastructure - Merlin

基於 [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure) 架構設計的個人化 Claude Code 數位助理系統。

## 專案結構

```
weihung-pai/
├── pai-bot/          # Telegram Bot 服務
├── pai-claude/       # Claude Code 配置 (Skills, Hooks, CLAUDE.md)
├── pai-mcp/          # MCP Server (權限請求等)
├── ansible/          # VPS 部署腳本
└── docs/             # 文件
```

## 功能

- **Telegram Bot** - 透過 Telegram 與 Merlin 對話
- **Skills 系統** - 模組化領域知識（Infrastructure, Development, Research, Financial, Philosophy, TRPG）
- **Claude Slash Commands** - 透過 `/cc:` 前綴執行 Claude Code 指令
- **MCP 權限系統** - 危險操作需透過 Telegram 授權

## 快速開始

### 本地開發

```bash
# 安裝 Bot 依賴
cd pai-bot && bun install

# 設定環境變數
cp .env.example .env
# 編輯 .env

# 啟動開發
bun run dev
```

### VPS 部署

```bash
cd ansible

# 設定 inventory
cp inventory/hosts.yml.example inventory/hosts.yml
cp inventory/group_vars/all/vault.yml.example inventory/group_vars/all/vault.yml
# 編輯以上檔案

# 部署
ansible-playbook playbooks/setup-vps.yml
ansible-playbook playbooks/deploy-claude.yml
ansible-playbook playbooks/deploy-bot.yml
```

## Bot 指令

| 指令 | 說明 |
|------|------|
| `/start` | 顯示歡迎訊息 |
| `/clear` | 清除對話歷史 |
| `/status` | 查看狀態 |
| `/cc:<cmd>` | 執行 Claude slash command |

## 技術棧

- **Runtime**: Bun
- **Bot Framework**: grammY
- **AI**: Claude Code CLI (Headless)
- **Database**: SQLite
- **Deployment**: Ansible + PM2

## 參考

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure)
