---
name: coding
description: 程式碼撰寫與自動化。USE WHEN 使用者提到 寫程式, code, 腳本, script, 工具, tool, 自動化, automate, 存檔, save, 批次, batch, 爬蟲, crawler, API, 資料處理, data。
---

# Coding Skill

撰寫程式碼解決問題，建立自動化腳本。

## 核心原則

**任何重複性或可自動化的工作，都值得寫成腳本。**

## Workspace 結構

所有程式碼保存在 `~/merlin-workspace/`：

```
~/merlin-workspace/
├── scripts/        # 一次性或簡單腳本
├── tools/          # 可重用的工具程式
├── automations/    # 自動化流程
├── crawlers/       # 資料爬取
├── data/           # 資料檔案
├── learning/       # 學習相關筆記和程式
└── daily/          # 日常事務相關
```

## 適用場景

### 日常自動化
- 批次重新命名檔案
- 整理下載資料夾
- 定時備份
- 監控網站變動

### 資料處理
- CSV/JSON 轉換
- 資料清理和格式化
- 報表生成
- 批次 API 請求

### 學習輔助
- 抓取課程資料
- 整理筆記格式
- 生成記憶卡片
- 追蹤學習進度

### 資訊收集
- 網頁爬蟲
- RSS 聚合
- 價格追蹤
- 新聞摘要

## 技術選擇

| 場景 | 建議 |
|------|------|
| 一般腳本 | TypeScript + Bun |
| 資料處理 | TypeScript 或 Python |
| 網頁爬取 | Playwright / Cheerio |
| API 整合 | TypeScript + fetch |
| CLI 工具 | TypeScript + Commander |

## 工作流程

### 1. 評估需求
- 這個任務會重複嗎？
- 手動做要多久？
- 值得自動化嗎？

### 2. 設計方案
- 輸入是什麼？
- 輸出是什麼？
- 有什麼邊界情況？

### 3. 實作
```bash
# 建立腳本
cd ~/merlin-workspace
mkdir -p scripts
cat > scripts/my-script.ts << 'EOF'
#!/usr/bin/env bun
// 腳本內容
EOF
chmod +x scripts/my-script.ts
```

### 4. 測試
```bash
bun run scripts/my-script.ts
```

### 5. 保存到 GitHub
```bash
cd ~/merlin-workspace
git add .
git commit -m "add: description"
git push origin main
```

## Repo 資訊

- **本地路徑**: `~/merlin-workspace/`
- **查看 remote**: `cd ~/merlin-workspace && git remote -v`
- **查看所有 repo**: `gh repo list`

> Repo 已在 VPS 初始化時建立，直接使用即可。

## 程式碼風格

- **簡潔**：能用 10 行就不寫 100 行
- **可讀**：清晰的變數名，必要的註解
- **可靠**：處理錯誤情況
- **可重用**：考慮未來擴展

## 常用模板

### 簡單腳本
```typescript
#!/usr/bin/env bun

const main = async () => {
  // 主邏輯
}

main().catch(console.error)
```

### CLI 工具
```typescript
#!/usr/bin/env bun
import { parseArgs } from "util"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    input: { type: "string", short: "i" },
    output: { type: "string", short: "o" },
  },
})

// 處理邏輯
```

### 爬蟲模板
```typescript
#!/usr/bin/env bun
import * as cheerio from "cheerio"

const url = "https://example.com"
const html = await fetch(url).then(r => r.text())
const $ = cheerio.load(html)

// 解析邏輯
```
