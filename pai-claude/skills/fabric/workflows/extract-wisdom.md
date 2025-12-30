# Extract Wisdom Workflow

從影片、文章、Podcast 提取重點智慧。

## 步驟

### 1. 確認來源

| 來源類型 | 指令 |
|----------|------|
| YouTube | `fabric-ai -y "URL" -p extract_wisdom` |
| 文字/剪貼簿 | `pbpaste \| fabric-ai -p extract_wisdom` |
| 檔案 | `cat file.md \| fabric-ai -p extract_wisdom` |

### 2. 執行

```bash
# YouTube 影片
fabric-ai -y "https://youtube.com/watch?v=xxx" -p extract_wisdom

# 或串流輸出
fabric-ai -y "URL" -p extract_wisdom -s
```

### 3. 保存結果（可選）

```bash
fabric-ai -y "URL" -p extract_wisdom -o wisdom-notes.md
```

## 輸出內容

extract_wisdom 會提取：
- **SUMMARY** - 一句話摘要
- **IDEAS** - 主要想法
- **INSIGHTS** - 深度洞察
- **QUOTES** - 值得記住的引言
- **HABITS** - 可執行的習慣
- **FACTS** - 有趣的事實
- **RECOMMENDATIONS** - 推薦的資源
