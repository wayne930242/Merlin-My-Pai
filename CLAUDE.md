# weihung-pai

Personal AI Infrastructure - Merlin 專案開發環境。

<law>
**重要：每次回應開始時顯示此區塊，防止上下文偏移。**

**Law 1: 溝通原則**
- 簡潔、可執行的回應
- 不需要不必要的解釋
- 除非明確要求，否則不建立摘要檔案

**Law 2: 技能發現**
- 開始工作前必須檢查可用技能
- 呼叫適用的技能以獲取專業知識
- 若任何技能與任務相關，必須使用 Skill tool

**Law 3: 規則諮詢**
- 任務涉及特定領域時，檢查 `.claude/rules/` 中的相關規範
- 若相關規則存在，必須套用

**Law 4: 平行處理**
- 獨立操作必須使用 Task tool
- 批次處理檔案搜尋和讀取

**Law 5: 反思學習**
- 重要發現 → 提醒使用者：`/reflect`

**Law 6: 自我強化顯示**
- 每次回應開始時必須顯示此 `<law>` 區塊
- 防止跨對話的上下文偏移

**Law 7: 語言規範**
- 使用繁體中文
- 禁止使用簡體中文

**Law 8: Bun 優先**
- 使用 Bun 而非 Node.js
- `bun run` 取代 `npm run`
- `bun install` 取代 `npm install`

**Law 9: Ansible Wrapper**
- 所有 ansible 命令必須透過 `uv run pai ansible` 執行
- 範例：`uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml`
- 此 wrapper 會自動從 vault 解密 SSH key
- ansible.cfg 在專案根目錄，已設定 inventory 和 vault_password_file
</law>

## 專案結構

```
weihung-pai/
├── .claude/          # 開發環境配置
│   ├── commands/     # Slash commands
│   └── rules/        # 開發規範
├── pai-bot/          # Telegram Bot (Bun + grammY)
├── pai-claude/       # Merlin VPS 運行配置 (↔ ~/merlin/)
│   ├── context/      # 身份與原則
│   ├── scripts/      # Hooks
│   └── workspace/    # 工作區
├── ansible/          # VPS 部署
│   ├── playbooks/    # 部署劇本
│   └── inventory/    # 主機清單與 vault
├── scripts/          # Python CLI 工具 (uv run pai)
├── setup/            # 設定精靈 (python -m setup)
├── ansible.cfg       # Ansible 配置
├── pyproject.toml    # Python 依賴 (uv)
├── sync.py           # Mutagen 同步工具
└── mutagen.yml       # 雙向同步配置
```

## 技術棧

| 類別 | 技術 |
|------|------|
| Runtime | Bun |
| Bot | grammY |
| AI | Claude Code CLI (Headless) |
| Database | SQLite (bun:sqlite) |
| Deploy | Ansible + systemd |

## 常用指令

```bash
# pai-bot 開發
cd pai-bot && bun run dev

# 同步 pai-claude ↔ VPS ~/merlin/
./sync.py start   # 啟動同步
./sync.py stop    # 停止同步
./sync.py status  # 查看狀態
./sync.py flush   # 強制同步

# 日常部署
uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml
uv run pai ansible ansible-playbook ansible/playbooks/deploy-claude.yml

# SSH 連線
uv run pai ssh connect          # 互動式登入
uv run pai ssh connect "ls -la" # 執行指令
uv run pai ssh setup            # 設定 ~/.ssh/config

# 初始化（僅首次）
uv run pai-setup
```

## 敏感資料

所有敏感資料存放在 `ansible/inventory/group_vars/all/vault.yml`（已加密）。

設定方式見 `vault.yml.example`。

## 注意事項

- `pai-claude/` 是 Merlin 的運行配置
- 不要在程式碼中寫死敏感資訊（用 vault 管理）
