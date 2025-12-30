---
name: google
description: Google 服務整合。USE WHEN 使用者提到 日曆, calendar, 行程, 會議, 雲端硬碟, drive, 檔案, gmail, 郵件, email, 寄信, 聯絡人, contacts, 通訊錄。
---

# Google Skill

存取 Wei-Hung 的 Google 服務：日曆、雲端硬碟、Gmail、聯絡人。

## 使用方式

透過 MCP（Model Context Protocol）自動呼叫，不需要手動執行指令。

## 可用工具

### 日曆 (Calendar)

| 工具 | 說明 |
|------|------|
| `google_calendar_list` | 列出所有日曆 |
| `google_calendar_events` | 列出行程（可指定時間範圍、搜尋） |
| `google_calendar_create_event` | 建立新行程 |

### 雲端硬碟 (Drive)

| 工具 | 說明 |
|------|------|
| `google_drive_list` | 列出檔案 |
| `google_drive_search` | 搜尋檔案 |
| `google_drive_get_file` | 取得檔案資訊或內容 |

### Gmail

| 工具 | 說明 |
|------|------|
| `google_gmail_list` | 列出郵件 |
| `google_gmail_get` | 讀取郵件內容 |
| `google_gmail_send` | 寄送郵件 |

### 聯絡人 (Contacts)

| 工具 | 說明 |
|------|------|
| `google_contacts_list` | 列出聯絡人 |
| `google_contacts_search` | 搜尋聯絡人 |

## 注意事項

1. 寄送郵件前請確認收件人和內容
2. 時間格式使用 ISO 8601（如 `2024-01-15T10:00:00+08:00`）
3. 搜尋 Gmail 可用 Gmail 搜尋語法（如 `from:someone@example.com`）
