# Analyze Workflow

分析內容的論點、品質、價值。

## 分析 Patterns

### analyze_claims - 論點分析

分析文章中的論點是否合理、有無邏輯謬誤。

```bash
cat article.md | fabric-ai -p analyze_claims
```

### rate_content - 內容評分

評分內容值不值得花時間看（1-10 分）。

```bash
fabric-ai -y "YouTube URL" -p rate_content
```

### analyze_threat_report - 威脅報告分析

分析安全威脅報告。

```bash
cat threat-report.md | fabric-ai -p analyze_threat_report
```

### analyze_paper - 論文分析

分析學術論文的方法、結論、限制。

```bash
cat paper.pdf | fabric-ai -p analyze_paper
```

## 使用建議

1. 先用 `rate_content` 快速判斷值不值得深入
2. 值得的話用 `extract_wisdom` 提取重點
3. 有爭議性的用 `analyze_claims` 檢驗論點
