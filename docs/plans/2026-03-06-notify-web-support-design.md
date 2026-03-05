# Notify Web Support Design

## Goal

讓 notify_image MCP 工具的通知也能在 web UI 的 Notifications tab 顯示，包含圖片和 caption。

## Architecture

notify_image 送完 Telegram/Discord 後，透過 /internal/broadcast 廣播 notify:image 事件（含 base64 圖片資料）到所有 WebSocket 連線。前端收到後在 Notifications tab 渲染圖片。

## Changes

### Backend (pai-bot)

1. **events.ts** - 加上 `notify:image` 事件型別
2. **notify.ts** - notify_image 工具加上 broadcast（類似 notify_user）
3. **websocket.ts** - notificationBuffer 支援 image 型別，notify:init 包含歷史圖片通知

### Frontend (pai-web)

1. **Notification 型別** - 擴展加上 `image?: string`（base64）和 `caption?: string`
2. **App.tsx** - 處理 `notify:image` 事件
3. **logs-view.tsx** - 有 image 的通知渲染 `<img>`，下方顯示 caption
4. **Browser notification** - 圖片通知觸發，body 用 caption 或 "收到圖片"

## Not Changed

- notify_user 既有邏輯
- prompt_user
- API 路由結構
