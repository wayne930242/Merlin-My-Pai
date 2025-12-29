# Personal AI Infrastructure (PAI) Blueprint

## 概述

基於 Daniel Miessler PAI v2 架構設計，為 WayDoSoft 全端工程環境建立個人化 Claude Code 數位助理系統。

**存取介面**：
- CLI（本地終端）
- Telegram Bot
- Discord Bot（僅限 DM，僅限本人使用）

**部署目標**：獨立 VPS（Ansible 自動化部署）

---

## Stack

| 項目 | 選擇 | 版本 |
|------|------|------|
| Language | TypeScript | 5.x |
| Runtime | Bun | 1.1+ |
| Package Manager | bun | (內建) |
| AI Platform | Claude Code CLI (Headless) | latest |
| Version Control | Git | 2.40+ |
| Protocol | MCP (Model Context Protocol) | latest |
| Bot Framework | grammY (Telegram) + discord.js | latest |
| Deployment | Ansible + pm2 | - |
| Database | SQLite (本地) | - |

---

## 目錄結構

### 整體專案結構

```
weihung-pai/                    # 專案根目錄（本地開發 + Git 版控）
├── docs/
│   └── blueprint.md            # 本文件
├── pai.md                      # PAI 規格書
│
├── pai-bot/                    # Bot 服務原始碼
│   ├── src/
│   ├── package.json
│   └── ...
│
├── pai-claude/                 # Claude Code 配置（部署到 ~/.claude/）
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── skills/
│   └── ...
│
└── ansible/                    # Ansible 部署腳本
    ├── inventory/
    │   └── hosts.yml
    ├── playbooks/
    │   ├── setup-vps.yml       # VPS 初始化
    │   ├── deploy-claude.yml   # 部署 Claude 配置
    │   └── deploy-bot.yml      # 部署 Bot 服務
    ├── roles/
    │   ├── common/
    │   ├── bun/
    │   ├── claude-code/
    │   └── pai-bot/
    └── ansible.cfg
```

### PAI 核心目錄（~/.claude/）

```
~/.claude/
├── CLAUDE.md                 # 全局身份定義與核心原則
├── settings.json             # Claude Code 設定（含 Hooks 配置）
│
├── skills/                   # Skills 系統（核心）
│   ├── infrastructure/
│   │   ├── SKILL.md
│   │   └── workflows/
│   │       ├── nomad-deploy.md
│   │       ├── consul-service.md
│   │       └── caddy-proxy.md
│   │
│   ├── development/
│   │   ├── SKILL.md
│   │   └── workflows/
│   │       ├── tdd.md
│   │       └── code-review.md
│   │
│   ├── research/
│   │   ├── SKILL.md
│   │   └── workflows/
│   │       └── deep-research.md
│   │
│   ├── financial/
│   │   ├── SKILL.md
│   │   └── workflows/
│   │       ├── stock-analysis.md
│   │       └── portfolio-review.md
│   │
│   ├── philosophy/
│   │   ├── SKILL.md
│   │   └── workflows/
│   │       └── socratic-dialogue.md
│   │
│   └── trpg/
│       ├── SKILL.md
│       └── workflows/
│           ├── character-creation.md
│           ├── story-generation.md
│           └── dm-assistant.md
│
├── agents/                   # Subagent 定義
│   ├── engineer.md
│   ├── architect.md
│   ├── researcher.md
│   └── qa-tester.md
│
├── scripts/                  # Hook 腳本（由 settings.json 引用）
│   ├── on-session-start.ts
│   ├── on-stop.ts
│   └── record-history.ts
│
└── data/                     # 運行時資料
    ├── history/              # 歷史紀錄
    │   ├── sessions/
    │   └── learnings/
    └── memory.db             # SQLite 記憶資料庫
```

**注意**：
- Hooks 在 `settings.json` 中配置，腳本放在 `scripts/` 目錄
- `context/` 目錄已移除，改為在 CLAUDE.md 中直接定義身份和原則
- `.mcp.json` 已整合到 `settings.json`

---

## 本地開發初始化

```bash
# 1. Clone 專案
git clone <your-repo> weihung-pai
cd weihung-pai

# 2. 初始化 Bot 服務
cd pai-bot && bun install

# 3. 本地測試（需要先設定環境變數）
cp .env.example .env
# 編輯 .env 填入 tokens
bun run dev
```

## VPS 部署（使用 Ansible）

```bash
# 1. 設定 inventory
cd ansible
cp inventory/hosts.yml.example inventory/hosts.yml
# 編輯 hosts.yml 填入 VPS 資訊

# 2. 初始化 VPS（安裝 Bun, Claude Code, pm2）
ansible-playbook playbooks/setup-vps.yml

# 3. SSH 到 VPS 完成 Claude 登入（一次性）
ssh user@your-vps
claude login
# 完成 OAuth 認證

# 4. 部署 PAI 系統
ansible-playbook playbooks/deploy-claude.yml
ansible-playbook playbooks/deploy-bot.yml
```

---

## 核心 Skills

### 1. Infrastructure Skill

**觸發詞**: deploy, nomad, consul, caddy, 部署, 服務, 基礎設施

**功能**:
- Nomad Job 部署與管理
- Consul 服務註冊與發現
- Caddy 反向代理設定
- 服務健康檢查

### 2. Development Skill

**觸發詞**: code, develop, 開發, 程式, component, test, 測試

**功能**:
- TDD 工作流程
- Code Review 協助
- TypeScript/Vue/React 最佳實踐
- 元件開發指南

### 3. Research Skill

**觸發詞**: research, 調查, 研究, 比較, 評估

**功能**:
- 技術調研流程
- 資料收集與整理
- 比較分析框架
- 證據導向決策

### 4. Financial Skill

**觸發詞**: stock, 股票, investment, 投資, portfolio, 財務

**功能**:
- 股票分析框架
- 投資組合檢視
- 財務報表解讀
- 風險評估

### 5. Philosophy Skill

**觸發詞**: 哲學, philosophy, 思考, 辯論, ethics, 倫理

**功能**:
- 蘇格拉底式對話
- 邏輯論證分析
- 倫理問題探討
- 深度思考引導

### 6. TRPG Skill

**觸發詞**: trpg, dnd, 角色, character, dm, 遊戲, story

**功能**:
- 角色創建輔助
- 故事生成引擎
- DM 助手工具
- 骰子與規則查詢

---

## Hooks 系統

Hooks 在 `settings.json` 中配置，腳本放在 `~/.claude/scripts/` 目錄。

參考：[Claude Code Hooks 官方文檔](https://claude.com/blog/how-to-configure-hooks)

### settings.json 配置範例

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bun run ~/.claude/scripts/on-session-start.ts"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bun run ~/.claude/scripts/on-stop.ts"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ~/.claude/scripts/record-history.ts"
          }
        ]
      }
    ]
  }
}
```

### Hook 腳本範例

```typescript
// ~/.claude/scripts/on-session-start.ts
// 輸出會被加入到 Claude 的上下文中
const today = new Date().toISOString().split('T')[0];
console.log(`[PAI] Session started: ${today}`);
console.log(`[PAI] Active skills: infrastructure, development, research, financial, philosophy, trpg`);
```

```typescript
// ~/.claude/scripts/on-stop.ts
// 會話結束時記錄摘要
import { Database } from "bun:sqlite";

const db = new Database(process.env.HOME + "/.claude/data/memory.db");
// 記錄會話摘要邏輯...
```

### Hook 事件類型

| 事件 | 觸發時機 | 用途 |
|------|----------|------|
| `SessionStart` | 會話開始 | 載入上下文、顯示提醒 |
| `Stop` | 會話結束 | 記錄摘要、保存學習 |
| `PreToolUse` | 工具執行前 | 安全驗證（exit code 2 可阻止） |
| `PostToolUse` | 工具執行後 | 記錄操作、觸發格式化 |
| `Notification` | 通知發送時 | 自訂通知處理 |

---

## Agent 定義

| Agent | 專長 | Skills |
|-------|------|--------|
| Engineer | TDD、功能實作、TypeScript | Development |
| Architect | 系統設計、策略規劃 | Infrastructure, Research |
| Researcher | 調查研究、證據收集 | Research |
| QATester | 品質驗證、自動化測試 | Development, Research |

---

## MCP 配置

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/.claude"]
    }
  }
}
```

---

## 安全機制

採用四層縱深防禦：

1. **設定強化**: MCP Server 白名單、敏感檔案存取控制
2. **憲法防禦**: 核心原則定義於 CLAUDE.md，STOP → REPORT → LOG 協議
3. **執行前驗證**: PreToolUse Hook 進行安全檢測
4. **安全 API**: 輸入/輸出驗證

---

## 版本控制策略

- `~/.claude/` 作為獨立 Git 倉庫
- 敏感資料透過 `.gitignore` 排除
- 定期推送到私有遠端倉庫備份
- 使用語義化版本標籤管理重大更新

---

## Bot 服務架構

### 系統架構圖

```
┌─────────────────┐     ┌─────────────────┐
│   Telegram      │     │    Discord      │
│   (grammY)      │     │  (discord.js)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │ Bot Service │  ← pm2 管理
              │   (Bun)     │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │ Memory  │ │ Context │ │ Claude  │
    │(SQLite) │ │ Manager │ │ Code    │
    └─────────┘ └─────────┘ └────┬────┘
                                 │
                          ┌──────▼──────┐
                          │ ~/.claude/  │
                          │ Skills      │
                          └─────────────┘
```

### Bot Service 專案結構

```
pai-bot/
├── src/
│   ├── index.ts              # 入口點
│   ├── config.ts             # 配置管理
│   │
│   ├── platforms/
│   │   ├── telegram/
│   │   │   ├── bot.ts
│   │   │   ├── handlers.ts
│   │   │   └── auth.ts       # user_id 白名單驗證
│   │   └── discord/
│   │       ├── bot.ts
│   │       ├── handlers.ts
│   │       └── auth.ts       # DM only + user_id 驗證
│   │
│   ├── claude/
│   │   ├── client.ts         # Claude Code Headless 封裝
│   │   └── prompt-builder.ts # Prompt 組合（含上下文）
│   │
│   ├── context/
│   │   ├── manager.ts        # 上下文管理器
│   │   ├── conversation.ts   # 對話歷史（滑動視窗）
│   │   └── memory.ts         # 長期記憶摘要
│   │
│   ├── storage/
│   │   ├── db.ts             # SQLite 連接
│   │   └── schema.sql        # 資料表定義
│   │
│   └── utils/
│       ├── logger.ts         # 日誌
│       ├── files.ts          # 檔案處理
│       └── rate-limit.ts     # 速率限制
│
├── ecosystem.config.js       # pm2 配置
├── package.json
├── tsconfig.json
└── .env.example
```

### Claude Code Headless 整合

```typescript
// src/claude/client.ts
import { $ } from "bun";

interface ClaudeOptions {
  conversationHistory?: string;  // 先前對話摘要
  systemContext?: string;        // 系統上下文
}

export async function callClaude(
  prompt: string,
  options?: ClaudeOptions
): Promise<string> {
  // 組合完整 prompt（含上下文）
  let fullPrompt = prompt;

  if (options?.conversationHistory) {
    fullPrompt = `[Previous conversation summary]\n${options.conversationHistory}\n\n[Current request]\n${prompt}`;
  }

  // Claude Code headless 呼叫
  // Skills 會根據 prompt 內容自動觸發（透過 SKILL.md 的 description）
  const result = await $`claude -p ${fullPrompt} --output-format text`.text();

  return result;
}
```

### 上下文管理

```typescript
// src/context/manager.ts
import { Database } from "bun:sqlite";

export class ContextManager {
  private db: Database;
  private maxHistoryTokens = 2000;  // 避免超出 context window

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  // 取得對話上下文（滑動視窗）
  async getConversationContext(
    platform: "telegram" | "discord",
    userId: string
  ): Promise<string> {
    const messages = this.db
      .query(`
        SELECT role, content, created_at
        FROM conversations
        WHERE platform = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `)
      .all(platform, userId);

    // 組合成摘要，控制 token 數量
    return this.summarizeIfNeeded(messages.reverse());
  }

  // 儲存訊息
  async saveMessage(
    platform: "telegram" | "discord",
    userId: string,
    role: "user" | "assistant",
    content: string
  ): void {
    this.db.run(`
      INSERT INTO conversations (platform, user_id, role, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [platform, userId, role, content]);
  }

  // 清除對話歷史
  async clearHistory(platform: string, userId: string): void {
    this.db.run(`
      DELETE FROM conversations
      WHERE platform = ? AND user_id = ?
    `, [platform, userId]);
  }
}
```

### 資料庫 Schema

```sql
-- storage/schema.sql

-- 對話歷史
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,           -- 'telegram' | 'discord'
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conv_user ON conversations(platform, user_id, created_at);

-- 長期記憶
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,                -- 記憶標籤
  content TEXT NOT NULL,            -- 記憶內容
  importance INTEGER DEFAULT 0,     -- 重要程度
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME
);

-- 檔案記錄
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,            -- 平台的 file_id
  file_type TEXT,                   -- image, document, etc.
  local_path TEXT,                  -- 本地儲存路徑
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 安全機制

```typescript
// src/platforms/telegram/auth.ts
const ALLOWED_USER_IDS = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",") || [];

export function isAuthorized(userId: number): boolean {
  return ALLOWED_USER_IDS.includes(String(userId));
}

// src/platforms/discord/auth.ts
const ALLOWED_USER_IDS = process.env.DISCORD_ALLOWED_USER_IDS?.split(",") || [];

export function isAuthorized(userId: string, isDM: boolean): boolean {
  // Discord: 必須是 DM 且在白名單中
  return isDM && ALLOWED_USER_IDS.includes(userId);
}
```

### 錯誤處理與日誌

```typescript
// src/utils/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true }
  }
});

// src/claude/client.ts 中的錯誤處理
export async function callClaude(prompt: string, options?: ClaudeOptions): Promise<string> {
  try {
    const result = await $`claude -p ${fullPrompt} --output-format text`.text();
    return result;
  } catch (error) {
    logger.error({ error, prompt: prompt.slice(0, 100) }, "Claude call failed");

    // 重試邏輯
    if (retryCount < 3) {
      await Bun.sleep(1000 * retryCount);
      return callClaude(prompt, options, retryCount + 1);
    }

    throw new Error("Claude 暫時無法回應，請稍後再試");
  }
}
```

### pm2 配置

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "pai-bot",
    script: "src/index.ts",
    interpreter: "bun",
    env: {
      NODE_ENV: "production"
    },
    // 自動重啟
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // 日誌
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    // 監控
    max_memory_restart: "500M"
  }]
};
```

### 環境變數

```bash
# .env.example

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=           # 逗號分隔，如: 123456789,987654321

# Discord
DISCORD_BOT_TOKEN=
DISCORD_ALLOWED_USER_IDS=            # 逗號分隔，如: 1234567890123456789

# Database
DATABASE_PATH=./data/pai.db

# Logging
LOG_LEVEL=info                       # debug, info, warn, error

# Rate Limiting
RATE_LIMIT_REQUESTS=20               # 每分鐘最大請求數
RATE_LIMIT_WINDOW=60000              # 時間窗口（毫秒）
```

### 指令系統設計

**指令前綴區分**：

| 類型 | 前綴 | 處理層 | 範例 |
|------|------|--------|------|
| Bot Commands | `!` | Bot Service | `!research`, `!clear` |
| Claude Slash Commands | `/` | Claude Code | `/help`, `/init` |
| Claude Skills | 自然語言 | Claude Code | 「幫我研究...」 |

**Bot 指令列表**（使用 `!` 前綴）：

| 指令 | 說明 | 行為 |
|------|------|------|
| `!start` | 開始對話 | 顯示歡迎訊息和使用說明 |
| `!research <topic>` | 深度研究 | 組合 prompt，提示使用 Research Skill |
| `!trpg` | 進入 TRPG 模式 | 切換上下文，啟用 TRPG Skill |
| `!think <question>` | 哲學思考 | 組合 prompt，提示使用 Philosophy Skill |
| `!invest <symbol>` | 投資分析 | 組合 prompt，提示使用 Financial Skill |
| `!deploy` | 部署輔助 | 組合 prompt，提示使用 Infrastructure Skill |
| `!clear` | 清除對話歷史 | 清空當前會話記憶 |
| `!memory` | 查看長期記憶 | 顯示儲存的重要記憶 |
| `!mode <name>` | 切換模式 | 切換持久化的對話模式 |

**一般訊息**：
- 不帶 `!` 前綴的訊息直接傳給 Claude Code
- Claude Code Skills 會根據訊息內容自動觸發

---

## Ansible 部署

### Inventory 配置

```yaml
# ansible/inventory/hosts.yml
all:
  hosts:
    pai-server:
      ansible_host: your-vps-ip
      ansible_user: your-user
      ansible_ssh_private_key_file: ~/.ssh/id_rsa
```

### VPS 初始化 Playbook

```yaml
# ansible/playbooks/setup-vps.yml
---
- name: Setup PAI VPS
  hosts: pai-server
  become: yes

  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes

    - name: Install dependencies
      apt:
        name:
          - curl
          - unzip
          - git
        state: present

    - name: Install Bun
      shell: curl -fsSL https://bun.sh/install | bash
      args:
        creates: ~/.bun/bin/bun
      become_user: "{{ ansible_user }}"

    - name: Add Bun to PATH
      lineinfile:
        path: ~/.bashrc
        line: 'export PATH="$HOME/.bun/bin:$PATH"'
      become_user: "{{ ansible_user }}"

    - name: Install Claude Code CLI
      shell: |
        curl -fsSL https://claude.ai/install.sh | sh
      args:
        creates: ~/.claude/bin/claude
      become_user: "{{ ansible_user }}"

    - name: Install pm2
      shell: ~/.bun/bin/bun install -g pm2
      become_user: "{{ ansible_user }}"

    - name: Create app directories
      file:
        path: "{{ item }}"
        state: directory
        owner: "{{ ansible_user }}"
      loop:
        - ~/pai-bot
        - ~/pai-bot/data
        - ~/pai-bot/logs
```

### Claude 配置部署 Playbook

```yaml
# ansible/playbooks/deploy-claude.yml
---
- name: Deploy Claude Configuration
  hosts: pai-server

  tasks:
    - name: Sync Claude configuration
      synchronize:
        src: ../../pai-claude/
        dest: ~/.claude/
        delete: yes
        rsync_opts:
          - "--exclude=data/"
          - "--exclude=*.db"

    - name: Ensure data directories exist
      file:
        path: "{{ item }}"
        state: directory
      loop:
        - ~/.claude/data
        - ~/.claude/data/history
        - ~/.claude/data/history/sessions
        - ~/.claude/data/history/learnings
```

### Bot 服務部署 Playbook

```yaml
# ansible/playbooks/deploy-bot.yml
---
- name: Deploy PAI Bot Service
  hosts: pai-server

  tasks:
    - name: Sync bot source code
      synchronize:
        src: ../../pai-bot/
        dest: ~/pai-bot/
        delete: yes
        rsync_opts:
          - "--exclude=node_modules/"
          - "--exclude=.env"
          - "--exclude=data/"
          - "--exclude=logs/"

    - name: Copy environment file
      template:
        src: templates/bot.env.j2
        dest: ~/pai-bot/.env
        mode: '0600'

    - name: Install dependencies
      shell: cd ~/pai-bot && ~/.bun/bin/bun install
      args:
        chdir: ~/pai-bot

    - name: Initialize database
      shell: |
        cd ~/pai-bot
        ~/.bun/bin/bun run src/storage/init-db.ts
      args:
        creates: ~/pai-bot/data/pai.db

    - name: Start/Restart bot with pm2
      shell: |
        cd ~/pai-bot
        ~/.bun/bin/pm2 delete pai-bot 2>/dev/null || true
        ~/.bun/bin/pm2 start ecosystem.config.js
        ~/.bun/bin/pm2 save

    - name: Setup pm2 startup
      shell: ~/.bun/bin/pm2 startup | tail -1 | bash
      become: yes
```

### 環境變數模板

```jinja2
{# ansible/playbooks/templates/bot.env.j2 #}
# Telegram
TELEGRAM_BOT_TOKEN={{ telegram_bot_token }}
TELEGRAM_ALLOWED_USER_IDS={{ telegram_allowed_user_ids }}

# Discord
DISCORD_BOT_TOKEN={{ discord_bot_token }}
DISCORD_ALLOWED_USER_IDS={{ discord_allowed_user_ids }}

# Database
DATABASE_PATH=./data/pai.db

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_REQUESTS=20
RATE_LIMIT_WINDOW=60000
```

### Ansible Vault（儲存敏感資訊）

```bash
# 建立加密的變數檔案
ansible-vault create ansible/inventory/group_vars/all/vault.yml

# vault.yml 內容
telegram_bot_token: "your-token"
telegram_allowed_user_ids: "123456789"
discord_bot_token: "your-token"
discord_allowed_user_ids: "1234567890123456789"
```

### 常用部署命令

```bash
# 首次設定 VPS
ansible-playbook playbooks/setup-vps.yml

# 部署 Claude 配置
ansible-playbook playbooks/deploy-claude.yml

# 部署 Bot 服務
ansible-playbook playbooks/deploy-bot.yml --ask-vault-pass

# 完整部署（所有步驟）
ansible-playbook playbooks/setup-vps.yml playbooks/deploy-claude.yml playbooks/deploy-bot.yml --ask-vault-pass

# 查看 Bot 狀態
ssh pai-server "~/.bun/bin/pm2 status"

# 查看 Bot 日誌
ssh pai-server "~/.bun/bin/pm2 logs pai-bot"
```

---

## 後續擴展

- [ ] 整合 ERP-Domain Skill（ERP/MES/APS 領域知識）
- [ ] 整合 Documentation Skill（文件撰寫）
- [ ] 整合 Database Skill（資料庫設計與查詢）
- [ ] 建立 MCP Server（Cloudflare Workers）
- [ ] 整合 ElevenLabs TTS 語音輸出
- [ ] 建立可觀測性 Dashboard
- [ ] 語音訊息支援（Whisper API）
- [ ] Web UI Dashboard

---

## 參考資源

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Agent Skills Documentation](https://code.claude.com/docs/en/skills)
- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure)
- [Model Context Protocol](https://modelcontextprotocol.io)
