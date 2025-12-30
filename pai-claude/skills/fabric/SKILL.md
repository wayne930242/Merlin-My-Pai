---
name: Fabric
description: Fabric patterns 內容處理工具。
  USE WHEN 使用者提到 summarize, 摘要, extract, 提取,
  analyze, 分析, pattern, fabric, wisdom, 重點。
---

## 首次設定

```bash
fabric-ai -S
```

會要求輸入 API key（用 Anthropic key）。

## Workflow Routing

- 提取重點/智慧 → workflows/extract-wisdom.md
- 摘要內容 → workflows/summarize.md
- 分析論點 → workflows/analyze.md
- 列出所有 patterns → `fabric-ai -l`

## 常用 Patterns

| Pattern | 用途 | 指令 |
|---------|------|------|
| `extract_wisdom` | 從內容提取智慧和重點 | `fabric-ai -p extract_wisdom` |
| `summarize` | 摘要任何內容 | `fabric-ai -p summarize` |
| `analyze_claims` | 分析論點合理性 | `fabric-ai -p analyze_claims` |
| `explain_code` | 解釋程式碼 | `fabric-ai -p explain_code` |
| `improve_writing` | 改善寫作 | `fabric-ai -p improve_writing` |
| `create_keynote` | 生成簡報大綱 | `fabric-ai -p create_keynote` |
| `rate_content` | 評分內容值不值得看 | `fabric-ai -p rate_content` |

## 使用方式

### 從文字輸入
```bash
echo "內容..." | fabric-ai -p extract_wisdom
```

### 從檔案
```bash
cat article.md | fabric-ai -p summarize
```

### 從 YouTube
```bash
fabric-ai -y "https://youtube.com/watch?v=..." -p extract_wisdom
```

### 從剪貼簿
```bash
pbpaste | fabric-ai -p summarize
```

## 輸出選項

- `-o` 輸出到檔案
- `-s` 或 `--stream` 串流輸出
- `-c` 複製到剪貼簿

## 查詢可用 Patterns

```bash
fabric-ai -l
```
