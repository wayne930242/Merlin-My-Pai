# Summarize Workflow

摘要任何內容。

## 步驟

### 1. 輸入來源

```bash
# 從檔案
cat article.md | fabric-ai -p summarize

# 從剪貼簿
pbpaste | fabric-ai -p summarize

# 從 URL（需要先抓取）
curl -s "URL" | fabric-ai -p summarize
```

### 2. 輸出選項

```bash
# 串流輸出（即時顯示）
cat article.md | fabric-ai -p summarize -s

# 保存到檔案
cat article.md | fabric-ai -p summarize -o summary.md

# 複製到剪貼簿
cat article.md | fabric-ai -p summarize -c
```

## 相關 Patterns

| Pattern | 用途 |
|---------|------|
| `summarize` | 一般摘要 |
| `summarize_paper` | 學術論文摘要 |
| `summarize_meeting` | 會議紀錄摘要 |
| `summarize_debate` | 辯論摘要 |
