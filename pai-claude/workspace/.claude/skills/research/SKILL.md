---
name: research
description: 研究與資訊蒐集。觸發：research, investigate, compare, evaluate, analyze, explore, 研究, 比較, 分析, 調查
---

# Research Skill

研究與資訊蒐集。

## Workflow Routing

- Deep research → [workflows/deep-research.md](workflows/deep-research.md)

## 與 Memory 整合

### 開始研究前
```
→ memory_search: "[研究主題]"
→ 找到之前相關的研究、偏好、決定
→ 避免重複研究，建立在已有知識上
```

### 研究完成後
```
→ 重要發現
→ memory_save:
    content: "[關鍵發現]"
    category: "general" 或 "work"
    importance: 4
```

## Research Method

### 1. Define Problem
- 釐清研究目標
- 確定評估標準
- 設定時間範圍
- **查詢 memory 中的相關資訊**

### 2. Gather Data
- 官方文檔
- GitHub 專案
- 技術部落格
- 論文 / 報告

### 3. Analyze & Compare
- 建立比較矩陣
- 分析優缺點
- 考慮長期維護
- **對照過去的偏好和決定**

### 4. Conclusions
- 提供明確建議
- 說明理由
- 列出風險
- **保存重要發現到 memory**

## 與 Reflection 整合

研究完成後反思：
- 研究方法有效嗎？
- 有沒有遺漏的角度？
- 下次可以怎麼改進？

## 與 Proactive 整合

- 發現與過去研究相關 → 主動提供連結
- 研究結論影響其他決定 → 主動提醒
- 發現需要後續行動 → 主動建議

## Output Format

```markdown
## Research Topic: [Topic]

### Background
[Why research this problem]
[Related past research from memory]

### Option Analysis
| Option | Pros | Cons | Use Case |
|--------|------|------|----------|
| A      | ...  | ...  | ...      |
| B      | ...  | ...  | ...      |

### Recommendation
[Final recommendation and reasoning]

### Key Findings (saved to memory)
- [Finding 1]
- [Finding 2]

### References
- [Link 1]
- [Link 2]
```

## Data Storage

研究報告存在 `data/research/`。
