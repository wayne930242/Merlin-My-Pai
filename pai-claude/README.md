# pai-claude

Merlin 的 VPS 運行配置，同步至 VPS 的 `~/merlin/` 目錄。

## 概述

此目錄包含 Claude Code CLI 在 VPS 上運行所需的所有配置：

- **CLAUDE.md** - Merlin 的身份與行為準則
- **MCP 設定** - 連接 pai-bot 提供的工具
- **Skills** - 各種專業技能定義
- **Hooks** - 事件觸發腳本

## 目錄結構

```
pai-claude/
├── hooks/                    # Claude hooks 腳本（不放 workspace）
│   ├── lib/                  # Hook 共用函式
│   └── *.ts                  # Hook entrypoints
├── workspace/
│   ├── CLAUDE.md              # Merlin 身份定義
│   ├── .claude/
│   │   ├── settings.json      # Claude Code 設定
│   │   ├── rules/             # 程式碼規範
│   │   ├── commands/          # Slash commands
│   │   └── skills/            # 技能定義
│   │       ├── coding/        # 程式開發
│   │       ├── daily/         # 每日任務
│   │       ├── fabric/        # Fabric 整合
│   │       ├── google/        # Google 服務
│   │       ├── learning/      # 學習筆記
│   │       ├── memory/        # 記憶管理
│   │       ├── notify/        # 通知系統
│   │       ├── proactive/     # 主動行動
│   │       ├── reflection/    # 反思總結
│   │       ├── research/      # 深度研究
│   │       ├── scheduling/    # 排程管理
│   │       └── web-deploy/    # 網站部署
│   ├── memory/                # 執行期記憶資料
│   ├── history/               # 執行期歷史資料
│   └── site/                  # 靜態網站
├── .mcp.json                  # MCP Server 配置
└── package.json
```

## 同步

使用 Mutagen 進行雙向同步：

```bash
# 在專案根目錄
./sync.py start   # 啟動同步
./sync.py stop    # 停止同步
./sync.py status  # 查看狀態
```

## Memory Hook 整合

- Hook 入口在 `pai-claude/hooks/`
- `hooks/memory-cli.ts` 使用 `hooks/lib/memory-capability.ts` 作為能力層 façade
- `workspace/` 僅保留執行期資料（memory/history/site），不再放 hook 腳本

## 部署

```bash
uv run pai ansible ansible-playbook ansible/playbooks/deploy-claude.yml
```
