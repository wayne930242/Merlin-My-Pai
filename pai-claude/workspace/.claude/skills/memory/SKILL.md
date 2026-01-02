---
name: memory
description: 長期記憶管理。主動保存重要資訊、搜尋相關記憶、整理記憶。觸發：remember, 記住, 記憶, memory, 之前說過, 上次, 忘記
---

# Memory Skill

主動管理長期記憶，讓對話具有連續性。

## 核心原則

**主動，不被動** - 不等用戶要求，主動保存和搜尋相關記憶。

## 何時主動保存

- 用戶提到偏好、習慣、喜好
- 重要決定或里程碑
- 反覆出現的話題或需求
- 用戶明確要求記住的事
- 學到關於用戶的新事實

## 何時主動搜尋

- 新對話開始時，搜尋相關上下文
- 討論曾經談過的話題
- 做決定時，參考過去的偏好
- 用戶問「之前」「上次」相關問題

## MCP Tools

| 工具 | 用途 |
|------|------|
| `memory_save` | 保存新記憶 |
| `memory_search` | 搜尋相關記憶 |
| `memory_list` | 列出最近記憶 |
| `memory_stats` | 查看統計 |
| `memory_archive` | 封存記憶 |
| `memory_restore` | 恢復記憶 |

## 記憶分類

| 分類 | 說明 | 範例 |
|------|------|------|
| `preference` | 偏好設定 | 喜歡簡潔回答、偏好 TypeScript |
| `personal` | 個人資訊 | 名字、生日、家人 |
| `event` | 重要事件 | 開始新專案、完成里程碑 |
| `work` | 工作相關 | 專案狀態、工作流程 |
| `general` | 一般事實 | 其他值得記住的事 |

## 重要性評分 (1-5)

- **5**: 核心偏好、重要個人資訊
- **4**: 經常需要參考的事
- **3**: 一般有用的資訊（預設）
- **2**: 可能有用但不確定
- **1**: 僅供參考

## 使用範例

### 保存記憶
```
用戶：我比較喜歡用 Bun 而不是 Node

→ memory_save:
  content: "偏好使用 Bun 而非 Node.js"
  category: "preference"
  importance: 4
```

### 搜尋記憶
```
用戶：幫我寫個腳本

→ memory_search:
  query: "coding preference style"

→ 找到：偏好 Bun、TypeScript、簡潔風格
→ 套用這些偏好來寫腳本
```

## 記憶維護

- 定期用 `memory_stats` 檢查記憶狀態
- 過時的記憶可用 `memory_archive` 封存
- 不要保存重複或太瑣碎的資訊
