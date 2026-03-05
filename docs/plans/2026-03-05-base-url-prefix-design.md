# Base URL Prefix `/protect` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將 pai-web 的所有路由（前端、API、WebSocket）統一放在 `/protect` 路徑下，根目錄放簡單 index 頁面。

**Architecture:** Vite `base` 設定處理靜態資源前綴，React Router `basename` 處理 SPA 路由，Caddy `handle_path` strip prefix 再轉發給 pai-bot（bot 程式碼不改）。根目錄另外放一個簡單靜態頁面。

**Tech Stack:** Vite 7, React Router 7, Caddy, Ansible

---

## Tasks

### Task 1: Vite base path

**Files:**
- Modify: `pai-web/vite.config.ts`

**Step 1: Add base option**

```typescript
export default defineConfig({
  base: '/protect/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 2: Verify build output**

Run: `cd pai-web && bun run build`
Expected: `dist/index.html` 中的 script/css 路徑以 `/protect/` 開頭

**Step 3: Commit**

```bash
git add pai-web/vite.config.ts
git commit -m "feat: set vite base to /protect/"
```

---

### Task 2: React Router basename

**Files:**
- Modify: `pai-web/src/main.tsx`

**Step 1: Add basename to BrowserRouter**

```tsx
<BrowserRouter basename="/protect">
```

**Step 2: Commit**

```bash
git add pai-web/src/main.tsx
git commit -m "feat: add /protect basename to BrowserRouter"
```

---

### Task 3: Environment variables

**Files:**
- Modify: `pai-web/.env.local.example`
- Modify: `ansible/playbooks/templates/pai-web.env.j2`

**Step 1: Update .env.local.example**

```env
# PAI Web 開發環境範例
# 複製此檔案為 .env.local 並填入你的值

# API 端點（指向 pai-bot 服務，經過 /protect 前綴）
VITE_API_URL=http://YOUR_SERVER_IP:3000
VITE_WS_URL=ws://YOUR_SERVER_IP:3000/ws

# API 認證金鑰（需與 pai-bot 的 PAI_API_KEY 一致）
VITE_API_KEY=YOUR_API_KEY
```

Note: 開發環境直連 pai-bot，不經過 Caddy，所以不需要 `/protect` 前綴。

**Step 2: Update Ansible template**

```env
# PAI Web Production Environment
VITE_API_URL=https://{{ vault_web_domain }}/protect
VITE_WS_URL=wss://{{ vault_web_domain }}/protect/ws
VITE_API_KEY={{ vault_pai_api_key }}
```

**Step 3: Commit**

```bash
git add pai-web/.env.local.example ansible/playbooks/templates/pai-web.env.j2
git commit -m "feat: update env templates for /protect prefix"
```

---

### Task 4: Fix API client and App.tsx URL construction

**Files:**
- Modify: `pai-web/src/lib/api.ts`
- Modify: `pai-web/src/App.tsx`

**Step 1: Update api.ts**

`apiFetch` 使用 `new URL(endpoint, API_BASE_URL)` 構建 URL。生產環境 `API_BASE_URL` 是 `https://domain/protect`，endpoint 是 `/api/memory/list`。

`new URL('/api/memory/list', 'https://domain/protect')` 會產生 `https://domain/api/memory/list`（絕對路徑會覆蓋 base 的 path）。

修正：endpoint 改用相對路徑，或改用字串拼接。

```typescript
export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...init } = options

  const url = new URL(`${API_BASE_URL}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  // ... rest unchanged
```

**Step 2: Update App.tsx chat history URL**

App.tsx line 91 也直接用 `new URL('/api/chat/history', API_BASE_URL)` 構建，需要同樣修正：

```typescript
const url = new URL(`${API_BASE_URL}/api/chat/history`)
```

**Step 3: Update App.tsx favicon reference**

Line 52 `icon: '/favicon.ico'` 改為使用 `import.meta.env.BASE_URL`：

```typescript
icon: `${import.meta.env.BASE_URL}favicon.ico`,
```

**Step 4: Verify build**

Run: `cd pai-web && bun run build`
Expected: 無 TypeScript 錯誤

**Step 5: Commit**

```bash
git add pai-web/src/lib/api.ts pai-web/src/App.tsx
git commit -m "feat: fix URL construction for /protect base path"
```

---

### Task 5: Caddy configuration

**Files:**
- Modify: `ansible/playbooks/templates/pai-web.Caddyfile.j2`

**Step 1: Update Caddyfile template**

```caddy
{{ vault_web_domain }} {
    encode gzip

    # API proxy - strip /protect prefix before forwarding to bot
    handle_path /protect/api/* {
        reverse_proxy localhost:3000
    }

    # WebSocket proxy - strip /protect prefix
    handle_path /protect/ws {
        reverse_proxy localhost:3000
    }

    # SPA static files under /protect
    handle_path /protect/* {
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

Key: 全部使用 `handle_path` — API/WS strip prefix 後轉給 bot，SPA 也 strip prefix 後在 dist 目錄找檔案。

**Step 2: Commit**

```bash
git add ansible/playbooks/templates/pai-web.Caddyfile.j2
git commit -m "feat: update Caddyfile for /protect base path"
```

---

### Task 6: Root index page

**Files:**
- Create: `pai-web/public-root/index.html`

**Step 1: Create simple index page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>wayneh.tw</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #0a0a0a;
            color: #fafafa;
        }
        .container { text-align: center; }
        h1 { font-size: 2rem; font-weight: 300; }
    </style>
</head>
<body>
    <div class="container">
        <h1>wayneh.tw</h1>
    </div>
</body>
</html>
```

**Step 2: Commit**

```bash
git add pai-web/public-root/index.html
git commit -m "feat: add root index page"
```

---

### Task 7: Update Ansible deploy playbook

**Files:**
- Modify: `ansible/playbooks/deploy-web.yml`

**Step 1: Add root page deployment**

在 `vars` 區塊加上 `root_dir`：

```yaml
vars:
    web_dir: "/home/{{ ansible_user }}/pai-web"
    root_dir: "/home/{{ ansible_user }}/pai-web-root"
    caddy_conf: "/etc/caddy/conf.d/pai-web.caddy"
```

在 "Sync built files to server" 之後加入：

```yaml
    - name: Ensure root directory exists
      ansible.builtin.file:
        path: "{{ root_dir }}"
        state: directory
        owner: "{{ ansible_user }}"
        group: "{{ ansible_user }}"
        mode: "0755"

    - name: Sync root index page to server
      ansible.posix.synchronize:
        src: "{{ playbook_dir }}/../../pai-web/public-root/"
        dest: "{{ root_dir }}/"
        delete: true

    - name: Fix ownership of root files
      ansible.builtin.file:
        path: "{{ root_dir }}"
        owner: "{{ ansible_user }}"
        group: "{{ ansible_user }}"
        recurse: true
```

**Step 2: Commit**

```bash
git add ansible/playbooks/deploy-web.yml
git commit -m "feat: add root index page deployment"
```

---

### Task 8: Final verification

**Step 1: Full build test**

Run: `cd pai-web && bun run build`
Expected: Build succeeds, `dist/index.html` references `/protect/assets/*`

**Step 2: Check all files modified**

Run: `git log --oneline -7`
Expected: 7 commits for tasks 1-7

**Step 3: Squash into single commit (optional)**

If preferred, squash all commits into one feature commit.

---

## Not Changed

- **pai-bot** — Caddy `handle_path` strips `/protect` prefix, bot receives original paths
- **API key auth** — unchanged
- **HTTPS** — Caddy auto-handles
