# MCP Tools Result Pattern Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 ts-results 的 Result pattern 重構 services 和 MCP tools 層的錯誤處理。

**Architecture:**
- Services 層：函數回傳 `Result<T, Error>` 而非 throw
- MCP tools 層：檢查 `result.ok`，轉換成 MCP 標準格式

**Tech Stack:** TypeScript, ts-results, @modelcontextprotocol/sdk

---

## ts-results 使用方式

```typescript
import { Result, Ok, Err } from "ts-results";

// Services 層
async function listCalendars(): Promise<Result<Calendar[], Error>> {
  try {
    const res = await calendar.calendarList.list();
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

// MCP tools 層
async () => {
  const result = await google.calendar.listCalendars();
  if (result.err) {
    return {
      content: [{ type: "text", text: `錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result.val, null, 2) }],
  };
}
```

---

### Task 1: Google Calendar Service

**Files:**
- Modify: `pai-bot/src/services/google/calendar.ts`

**Step 1: 加入 Result import 並修改所有函數**

```typescript
import { type calendar_v3, google } from "googleapis";
import { Result, Ok, Err } from "ts-results";
import { getAuthClient } from "./auth";

function getCalendar() {
  return google.calendar({ version: "v3", auth: getAuthClient() });
}

export async function listCalendars(): Promise<Result<calendar_v3.Schema$CalendarListEntry[], Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.calendarList.list();
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function listEvents(
  calendarId = "primary",
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    q?: string;
  } = {},
): Promise<Result<calendar_v3.Schema$Event[], Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.list({
      calendarId,
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax,
      maxResults: options.maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
      q: options.q,
    });
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getEvent(
  eventId: string,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.get({ calendarId, eventId });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function createEvent(
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function updateEvent(
  eventId: string,
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function deleteEvent(
  eventId: string,
  calendarId = "primary",
): Promise<Result<void, Error>> {
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId, eventId });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export type { calendar_v3 };
```

**Step 2: 驗證編譯**

Run: `cd pai-bot && bun run build`
Expected: 可能有 type error（MCP tools 還沒改）

**Step 3: Commit**

```bash
git add pai-bot/src/services/google/calendar.ts
git commit -m "refactor(google): use Result pattern in calendar service"
```

---

### Task 2: Google Calendar MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/google.ts` (calendar 相關部分)

**Step 1: 修改 calendar tools 處理 Result**

```typescript
// google_calendar_list
async () => {
  const result = await google.calendar.listCalendars();
  if (result.err) {
    return {
      content: [{ type: "text", text: `Google Calendar 錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result.val, null, 2) }],
  };
},

// google_calendar_events
async ({ calendarId, timeMin, timeMax, maxResults, q }) => {
  const result = await google.calendar.listEvents(calendarId || "primary", {
    timeMin,
    timeMax,
    maxResults,
    q,
  });
  if (result.err) {
    return {
      content: [{ type: "text", text: `Google Calendar 錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result.val, null, 2) }],
  };
},

// google_calendar_create_event
async ({ summary, description, startDateTime, endDateTime, location, calendarId }) => {
  const result = await google.calendar.createEvent(
    {
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      location,
    },
    calendarId || "primary",
  );
  if (result.err) {
    return {
      content: [{ type: "text", text: `Google Calendar 錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result.val, null, 2) }],
  };
},

// google_calendar_update_event
async ({ eventId, summary, description, startDateTime, endDateTime, location, calendarId }) => {
  const updateData: any = {};
  if (summary) updateData.summary = summary;
  if (description) updateData.description = description;
  if (startDateTime) updateData.start = { dateTime: startDateTime };
  if (endDateTime) updateData.end = { dateTime: endDateTime };
  if (location) updateData.location = location;

  const result = await google.calendar.updateEvent(eventId, updateData, calendarId || "primary");
  if (result.err) {
    return {
      content: [{ type: "text", text: `Google Calendar 錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result.val, null, 2) }],
  };
},

// google_calendar_delete_event
async ({ eventId, calendarId }) => {
  const result = await google.calendar.deleteEvent(eventId, calendarId || "primary");
  if (result.err) {
    return {
      content: [{ type: "text", text: `Google Calendar 錯誤: ${result.val.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: "行程已刪除" }],
  };
},
```

**Step 2: 驗證編譯**

Run: `cd pai-bot && bun run build`
Expected: 編譯成功

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/google.ts
git commit -m "refactor(mcp): handle Result in calendar tools"
```

---

### Task 3: Google Drive Service

**Files:**
- Modify: `pai-bot/src/services/google/drive.ts`

**Step 1: 先讀取現有檔案了解結構**

**Step 2: 加入 Result pattern**

所有函數改為回傳 `Result<T, Error>`

**Step 3: 驗證編譯**

Run: `cd pai-bot && bun run build`

**Step 4: Commit**

```bash
git add pai-bot/src/services/google/drive.ts
git commit -m "refactor(google): use Result pattern in drive service"
```

---

### Task 4: Google Drive MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/google.ts` (drive 相關部分)

**Step 1: 修改 drive tools 處理 Result**

**Step 2: 驗證編譯**

Run: `cd pai-bot && bun run build`

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/google.ts
git commit -m "refactor(mcp): handle Result in drive tools"
```

---

### Task 5: Google Gmail Service

**Files:**
- Modify: `pai-bot/src/services/google/gmail.ts`

**Step 1: 加入 Result pattern**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/services/google/gmail.ts
git commit -m "refactor(google): use Result pattern in gmail service"
```

---

### Task 6: Google Gmail MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/google.ts` (gmail 相關部分)

**Step 1: 修改 gmail tools 處理 Result**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/google.ts
git commit -m "refactor(mcp): handle Result in gmail tools"
```

---

### Task 7: Google Contacts Service

**Files:**
- Modify: `pai-bot/src/services/google/contacts.ts`

**Step 1: 加入 Result pattern**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/services/google/contacts.ts
git commit -m "refactor(google): use Result pattern in contacts service"
```

---

### Task 8: Google Contacts MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/google.ts` (contacts 相關部分)

**Step 1: 修改 contacts tools 處理 Result**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/google.ts
git commit -m "refactor(mcp): handle Result in contacts tools"
```

---

### Task 9: Google Tasks Service

**Files:**
- Modify: `pai-bot/src/services/google/tasks.ts`

**Step 1: 加入 Result pattern**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/services/google/tasks.ts
git commit -m "refactor(google): use Result pattern in tasks service"
```

---

### Task 10: Google Tasks MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/google.ts` (tasks 相關部分)

**Step 1: 修改 tasks tools 處理 Result**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/google.ts
git commit -m "refactor(mcp): handle Result in tasks tools"
```

---

### Task 11: Garmin Service

**Files:**
- Modify: `pai-bot/src/services/garmin/index.ts`

**Step 1: 修改 runSync 和所有公開函數使用 Result**

```typescript
import { Result, Ok, Err } from "ts-results";

async function runSync<T>(command: string, args: string[] = []): Promise<Result<T, Error>> {
  if (!isGarminConfigured()) {
    return Err(new Error("Garmin credentials not configured"));
  }

  const allArgs = [GARMIN_EMAIL!, GARMIN_PASSWORD!, command, ...args];

  try {
    const result = await $`uv run --with garminconnect python3 ${SYNC_SCRIPT} ${allArgs}`.text();
    const parsed = JSON.parse(result.trim());

    if (parsed.error) {
      return Err(new Error(parsed.error));
    }

    return Ok(parsed as T);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getStats(startDate?: string, endDate?: string): Promise<Result<GarminStats[], Error>> {
  const start = startDate || getToday();
  const end = endDate || start;
  return runSync<GarminStats[]>("stats", [start, end]);
}

// ... 其他函數同理
```

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/services/garmin/index.ts
git commit -m "refactor(garmin): use Result pattern in garmin service"
```

---

### Task 12: Garmin MCP Tools

**Files:**
- Modify: `pai-bot/src/mcp/tools/garmin.ts`

**Step 1: 修改所有 tools 處理 Result**

**Step 2: 驗證編譯**

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/garmin.ts
git commit -m "refactor(mcp): handle Result in garmin tools"
```

---

### Task 13: 其他 MCP Tools 加入 try-catch

以下檔案 services 層較複雜或是本地操作，直接在 MCP 層加 try-catch + isError：

**Files:**
- Modify: `pai-bot/src/mcp/tools/memory.ts`
- Modify: `pai-bot/src/mcp/tools/scheduler.ts`
- Modify: `pai-bot/src/mcp/tools/history.ts`
- Modify: `pai-bot/src/mcp/tools/obsidian.ts`
- Modify: `pai-bot/src/mcp/tools/system.ts`

**Step 1: 每個檔案加入 try-catch 和 isError**

參考 notify.ts 的模式。

**Step 2: 驗證編譯**

Run: `cd pai-bot && bun run build`

**Step 3: Commit**

```bash
git add pai-bot/src/mcp/tools/memory.ts pai-bot/src/mcp/tools/scheduler.ts pai-bot/src/mcp/tools/history.ts pai-bot/src/mcp/tools/obsidian.ts pai-bot/src/mcp/tools/system.ts
git commit -m "feat(mcp): add error handling to remaining tools"
```

---

### Task 14: 最終驗證

**Step 1: 完整編譯**

Run: `cd pai-bot && bun run build`
Expected: 編譯成功

**Step 2: Lint（如果有）**

Run: `cd pai-bot && bun run lint`

**Step 3: 最終檢查**

確認所有 MCP tools 都有錯誤處理。
