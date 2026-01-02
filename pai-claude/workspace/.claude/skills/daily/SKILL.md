---
name: daily
description: 每日任務管理。觸發：todo, remind, schedule, plan, task, track, 待辦, 任務, 規劃
---

# Daily Skill

每日任務管理與規劃。

## Workflow Routing

- Daily planning → [workflows/daily-plan.md](workflows/daily-plan.md)
- Weekly review → [workflows/weekly-review.md](workflows/weekly-review.md)

## Task Priority

- **P0**: 必須今天完成
- **P1**: 本週完成
- **P2**: 有空再做
- **P3**: 想法/靈感（可能不做）

## Task Categories

- 🔴 Work（工作）
- 🟢 Personal（個人）
- 🔵 Learning（學習）
- 🟡 Health（健康）
- ⚪ Other（其他）

## Daily Flow

### Morning
1. 回顧今日任務
2. 確認優先級
3. 預估時間

### Evening
1. 檢視完成度
2. 調整未完成項
3. 記錄堵塞點和心得

## 與 Memory 整合

### 開始規劃時
```
→ memory_search: "task pattern preference"
→ 找到用戶的任務偏好和模式
→ 套用到今日規劃
```

### 完成任務後
```
→ 任務完成情況
→ 如果有特別的 pattern（如：總是拖延某類任務）
→ memory_save: 保存觀察
```

## 與 Proactive 整合

### 主動提醒
- P0 任務到了預估時間還沒完成 → 提醒
- 有連續幾天沒完成的任務 → 建議重新評估
- 發現任務模式 → 建議自動化

### 主動建議
- 任務完成後 → 建議下一個優先任務
- 早上規劃時 → 根據過去模式建議時間分配

## 與 Scheduling 整合

- 有明確時間的任務 → 建議用 `schedule_create` 設提醒
- 重複性任務 → 建議設定週期排程

## Todo Format

```markdown
## [Date]

### P0 - Must Do Today
- [ ] Task 1 (est. 30min)
- [ ] Task 2 (est. 1h)

### P1 - This Week
- [ ] Task 3

### Completed
- [x] Finished task
```

## Data Storage

所有每日記錄存在 `data/daily/`。
