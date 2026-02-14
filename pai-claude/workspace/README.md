# Merlin Workspace

此目錄為 Merlin 的工作區，透過 Mutagen 與本地 `pai-claude/workspace/` 雙向同步。

## 目錄結構

```
workspace/
├── .claude/            # Claude Code 配置
│   ├── agents/         # Subagents (4)
│   ├── skills/         # 技能模組 (6)
│   ├── commands/       # Slash commands (4)
│   └── rules/          # 開發規範 (3)
├── memory/             # 長期記憶資料
├── history/            # 對話歷史與決策紀錄
├── downloads/          # 上傳與附件下載暫存
└── site/               # 靜態網站內容
```

> Hook 腳本已移至 `pai-claude/hooks/`，`workspace/` 只保留執行期資料。

## .claude 結構

### Agents

| Agent | 專長 |
|-------|------|
| Architect | 系統設計、架構規劃 |
| Engineer | 技術實作、TDD |
| Researcher | 調查研究、資料收集 |
| QATester | 測試、品質保證 |

### Skills

| Skill | 用途 |
|-------|------|
| coding | 程式碼撰寫、自動化腳本 |
| daily | 日常事務、待辦管理 |
| research | 調查研究、深度分析 |
| fabric | 內容處理（摘要、提取重點） |
| learning | 學習輔助、筆記整理 |
| google | Google 服務整合 |

### Commands

| Command | 說明 |
|---------|------|
| `/daily` | 執行每日規劃 |
| `/weekly` | 執行週回顧 |
| `/research <topic>` | 深度研究 |
| `/summarize <content>` | 摘要內容 |

### Rules

| Rule | 說明 |
|------|------|
| bun.md | Bun 優先原則 |
| code-style.md | 程式碼風格 |
| workspace.md | 目錄結構規範 |

## 同步機制

- **工具**: Mutagen
- **模式**: two-way-resolved（雙向同步，衝突時以 alpha 為準）
- **本地路徑**: `./pai-claude/workspace/`
- **VPS 路徑**: `~/merlin/workspace/`

### 排除同步的檔案

- `*.db` - 資料庫檔案（VPS 產生，不覆蓋）
- `node_modules/` - 依賴套件

## 常用指令

```bash
# 啟動同步
./sync start

# 停止同步
./sync stop

# 查看狀態
./sync status
```

## 注意事項

- 此目錄的變更會自動同步到 VPS
- VPS 上的變更也會同步回本地
- 資料庫檔案 (`*.db`) 不會被覆蓋，避免資料遺失
