# Base URL Prefix `/protect` Design

## Goal

將 pai-web 的所有路由（前端頁面、API、WebSocket）統一放在 `/protect` 路徑下，方便透過 zero trust 設定局部防禦。根目錄 `/` 放一個簡單的 index 靜態頁面。

## Changes

### 1. Vite Config (`pai-web/vite.config.ts`)

設定 `base: '/protect/'`，讓所有靜態資源（JS、CSS、圖片）的路徑自動加上 `/protect/` 前綴。

### 2. React Router (`pai-web/src/App.tsx`)

`BrowserRouter` 加上 `basename="/protect"`，讓 SPA 路由在 `/protect` 下運作。例如 `/protect/chat`、`/protect/settings`。

### 3. 環境變數 (`pai-web/.env.local.example` + Ansible template)

- `VITE_API_URL` → 改為相對路徑 `/protect` 或完整 URL 帶 `/protect`
- `VITE_WS_URL` → 改為 `wss://domain/protect/ws`

### 4. API Client (`pai-web/src/lib/api.ts`)

確認 `apiFetch()` 使用的 base URL 能正確對應 `/protect/api/*`。

### 5. Caddy 配置 (`ansible/playbooks/templates/pai-web.Caddyfile.j2`)

```caddy
{{ vault_web_domain }} {
    encode gzip

    # Protected area - all under /protect
    handle_path /protect/api/* {
        reverse_proxy localhost:3000
    }

    handle_path /protect/ws {
        reverse_proxy localhost:3000
    }

    handle /protect/* {
        root * /home/{{ ansible_user }}/pai-web
        try_files {path} /index.html
        file_server
    }

    # Root - simple index page
    handle {
        root * /home/{{ ansible_user }}/pai-web-root
        file_server
    }
}
```

關鍵：使用 `handle_path` 自動 strip `/protect` 前綴再轉發給 pai-bot，所以 pai-bot 程式碼不需要修改。

### 6. 根目錄靜態頁面

建立簡單的 index.html，部署到 `/home/{{ ansible_user }}/pai-web-root/`。

### 7. Ansible Deploy (`ansible/playbooks/deploy-web.yml`)

- 更新環境變數 template
- 新增根目錄靜態頁面的部署步驟

## Not Changed

- **pai-bot** — Caddy 用 `handle_path` strip prefix，bot 收到的請求路徑不變
- **API key 驗證** — 維持不變
- **HTTPS** — Caddy 自動處理，不變
