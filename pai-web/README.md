# pai-web

Merlin Web Console（React + Vite）。

English version: [README.en.md](README.en.md)

## 功能

- Chat：即時對話與串流回覆
- Memory：查詢短期記憶（對齊 `pai-bot /api/memory/*`）
- History：瀏覽 sessions / learnings / decisions
- Workspace：讀取 workspace 檔案與目錄
- RAG：查詢與同步知識庫
- Logs：即時觀察 log / notify 事件
- Settings：主題與行為設定

## 設定

建立 `.env`（或使用 Vite 環境變數）：

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
VITE_API_KEY=
```

## 開發

```bash
cd pai-web
bun install
bun run dev
```

## 檢查

```bash
bunx tsc --noEmit
bun run lint
```
