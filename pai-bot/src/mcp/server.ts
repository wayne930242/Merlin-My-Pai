#!/usr/bin/env bun
/**
 * Google Services MCP Server
 * 提供 Google Calendar, Drive, Gmail, Contacts 服務給 Claude Code
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as google from "../services/google";
import * as scheduler from "../services/scheduler";

// Simple stderr logger for MCP (stdout is reserved for protocol)
const log = {
  info: (msg: string, data?: object) =>
    console.error(`[MCP INFO] ${msg}`, data ? JSON.stringify(data) : ""),
  error: (msg: string, data?: object) =>
    console.error(`[MCP ERROR] ${msg}`, data ? JSON.stringify(data) : ""),
};

// Wrapper for tool handlers with error logging
function withErrorHandling<T>(
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Tool ${toolName} failed`, { error: errorMessage });
    throw error;
  });
}

log.info("Starting Google Services MCP Server");

const server = new McpServer({
  name: "google-services",
  version: "1.0.0",
});

// === Calendar Tools ===

server.registerTool(
  "google_calendar_list",
  {
    title: "List Calendars",
    description: "列出所有 Google 日曆",
    inputSchema: {},
  },
  async () => {
    return withErrorHandling("google_calendar_list", async () => {
      const calendars = await google.calendar.listCalendars();
      return {
        content: [{ type: "text", text: JSON.stringify(calendars, null, 2) }],
      };
    });
  }
);

server.registerTool(
  "google_calendar_events",
  {
    title: "List Calendar Events",
    description: "列出日曆行程",
    inputSchema: {
      calendarId: z.string().optional().describe("日曆 ID，預設 primary"),
      timeMin: z.string().optional().describe("開始時間 (ISO 8601)"),
      timeMax: z.string().optional().describe("結束時間 (ISO 8601)"),
      maxResults: z.number().optional().describe("最多回傳幾筆，預設 10"),
      q: z.string().optional().describe("搜尋關鍵字"),
    },
  },
  async ({ calendarId, timeMin, timeMax, maxResults, q }) => {
    const events = await google.calendar.listEvents(calendarId || "primary", {
      timeMin,
      timeMax,
      maxResults,
      q,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
    };
  }
);

server.registerTool(
  "google_calendar_create_event",
  {
    title: "Create Calendar Event",
    description: "建立日曆行程",
    inputSchema: {
      summary: z.string().describe("行程標題"),
      description: z.string().optional().describe("行程描述"),
      startDateTime: z
        .string()
        .describe("開始時間 (ISO 8601，如 2024-01-15T10:00:00+08:00)"),
      endDateTime: z.string().describe("結束時間 (ISO 8601)"),
      location: z.string().optional().describe("地點"),
      calendarId: z.string().optional().describe("日曆 ID，預設 primary"),
    },
  },
  async ({
    summary,
    description,
    startDateTime,
    endDateTime,
    location,
    calendarId,
  }) => {
    const event = await google.calendar.createEvent(
      {
        summary,
        description,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
        location,
      },
      calendarId || "primary"
    );
    return {
      content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
    };
  }
);

// === Drive Tools ===

server.registerTool(
  "google_drive_list",
  {
    title: "List Drive Files",
    description: "列出雲端硬碟檔案",
    inputSchema: {
      folderId: z.string().optional().describe("資料夾 ID"),
      pageSize: z.number().optional().describe("最多回傳幾筆，預設 20"),
    },
  },
  async ({ folderId, pageSize }) => {
    const files = await google.drive.listFiles({ folderId, pageSize });
    return {
      content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
    };
  }
);

server.registerTool(
  "google_drive_search",
  {
    title: "Search Drive Files",
    description: "搜尋雲端硬碟檔案",
    inputSchema: {
      query: z.string().describe("搜尋關鍵字"),
    },
  },
  async ({ query }) => {
    const files = await google.drive.searchFiles(query);
    return {
      content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
    };
  }
);

server.registerTool(
  "google_drive_get_file",
  {
    title: "Get Drive File",
    description: "取得檔案資訊或內容",
    inputSchema: {
      fileId: z.string().describe("檔案 ID"),
      getContent: z
        .boolean()
        .optional()
        .describe("是否取得檔案內容（僅純文字檔案）"),
    },
  },
  async ({ fileId, getContent }) => {
    if (getContent) {
      const content = await google.drive.getFileContent(fileId);
      return { content: [{ type: "text", text: content }] };
    } else {
      const file = await google.drive.getFile(fileId);
      return {
        content: [{ type: "text", text: JSON.stringify(file, null, 2) }],
      };
    }
  }
);

// === Gmail Tools ===

server.registerTool(
  "google_gmail_list",
  {
    title: "List Gmail Messages",
    description: "列出 Gmail 郵件",
    inputSchema: {
      q: z
        .string()
        .optional()
        .describe("搜尋條件（如 from:someone@example.com）"),
      maxResults: z.number().optional().describe("最多回傳幾筆，預設 10"),
    },
  },
  async ({ q, maxResults }) => {
    const messages = await google.gmail.listMessages({ q, maxResults });
    return {
      content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
    };
  }
);

server.registerTool(
  "google_gmail_get",
  {
    title: "Get Gmail Message",
    description: "讀取郵件內容",
    inputSchema: {
      messageId: z.string().describe("郵件 ID"),
    },
  },
  async ({ messageId }) => {
    const message = await google.gmail.getMessageContent(messageId);
    return {
      content: [{ type: "text", text: JSON.stringify(message, null, 2) }],
    };
  }
);

server.registerTool(
  "google_gmail_send",
  {
    title: "Send Gmail",
    description: "寄送郵件",
    inputSchema: {
      to: z.string().describe("收件人 email"),
      subject: z.string().describe("郵件主旨"),
      body: z.string().describe("郵件內容"),
      cc: z.string().optional().describe("副本"),
      bcc: z.string().optional().describe("密件副本"),
    },
  },
  async ({ to, subject, body, cc, bcc }) => {
    const result = await google.gmail.sendMessage(to, subject, body, {
      cc,
      bcc,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// === Contacts Tools ===

server.registerTool(
  "google_contacts_list",
  {
    title: "List Contacts",
    description: "列出聯絡人",
    inputSchema: {
      pageSize: z.number().optional().describe("最多回傳幾筆，預設 100"),
    },
  },
  async ({ pageSize }) => {
    const result = await google.contacts.listContacts({ pageSize });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "google_contacts_search",
  {
    title: "Search Contacts",
    description: "搜尋聯絡人",
    inputSchema: {
      query: z.string().describe("搜尋關鍵字（姓名、email、電話）"),
    },
  },
  async ({ query }) => {
    const contacts = await google.contacts.searchContacts(query);
    return {
      content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
    };
  }
);

// === Scheduler Tools ===

// 從環境變數取得預設 user_id（Telegram bot 主人）
const DEFAULT_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

server.registerTool(
  "schedule_create",
  {
    title: "Create Schedule",
    description: "創建排程任務。支援 cron 表達式（重複）或指定時間（一次性）。時區為 Asia/Taipei。",
    inputSchema: {
      name: z.string().describe("任務名稱"),
      cronExpression: z
        .string()
        .optional()
        .describe("Cron 表達式，如 '0 9 * * *' (每天早上9點)，'0 9 * * 1' (每週一早上9點)"),
      runAt: z
        .string()
        .optional()
        .describe("一次性執行時間 (ISO 8601)，如 '2024-01-15T09:00:00+08:00'"),
      taskType: z
        .enum(["message", "prompt"])
        .describe("任務類型：message (發送訊息) 或 prompt (執行 Claude prompt)"),
      taskData: z.string().describe("任務資料：message 類型為訊息內容，prompt 類型為要執行的指令"),
    },
  },
  async ({ name, cronExpression, runAt, taskType, taskData }) => {
    if (!cronExpression && !runAt) {
      return {
        content: [{ type: "text", text: "錯誤：必須提供 cronExpression 或 runAt" }],
      };
    }

    const result = scheduler.createSchedule({
      name,
      cronExpression,
      runAt,
      taskType,
      taskData,
      userId: DEFAULT_USER_ID,
    });

    if (!result) {
      return {
        content: [{ type: "text", text: "錯誤：創建排程失敗，請檢查 cron 表達式是否正確" }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "schedule_list",
  {
    title: "List Schedules",
    description: "列出所有排程任務",
    inputSchema: {},
  },
  async () => {
    const schedules = scheduler.listSchedules(DEFAULT_USER_ID);
    return {
      content: [{ type: "text", text: JSON.stringify(schedules, null, 2) }],
    };
  }
);

server.registerTool(
  "schedule_delete",
  {
    title: "Delete Schedule",
    description: "刪除排程任務",
    inputSchema: {
      id: z.number().describe("排程 ID"),
    },
  },
  async ({ id }) => {
    const success = scheduler.deleteSchedule(id);
    return {
      content: [{ type: "text", text: success ? "排程已刪除" : "找不到該排程" }],
    };
  }
);

server.registerTool(
  "schedule_toggle",
  {
    title: "Toggle Schedule",
    description: "啟用或停用排程任務",
    inputSchema: {
      id: z.number().describe("排程 ID"),
      enabled: z.boolean().describe("是否啟用"),
    },
  },
  async ({ id, enabled }) => {
    const success = scheduler.setScheduleEnabled(id, enabled);
    return {
      content: [{ type: "text", text: success ? `排程已${enabled ? "啟用" : "停用"}` : "找不到該排程" }],
    };
  }
);

// === System Tools ===

server.registerTool(
  "system_reload_caddy",
  {
    title: "Reload Caddy",
    description: "重載 Caddy 網頁伺服器配置（自動修復 site 目錄權限）",
    inputSchema: {},
  },
  async () => {
    return withErrorHandling("system_reload_caddy", async () => {
      const siteDir = "/home/pai/merlin/workspace/site";

      // 修復檔案權限 (644)
      const fixFiles = Bun.spawn(
        ["find", siteDir, "-type", "f", "-exec", "chmod", "644", "{}", ";"],
        { stdout: "pipe", stderr: "pipe" }
      );
      await fixFiles.exited;

      // 修復目錄權限 (755)
      const fixDirs = Bun.spawn(
        ["find", siteDir, "-type", "d", "-exec", "chmod", "755", "{}", ";"],
        { stdout: "pipe", stderr: "pipe" }
      );
      await fixDirs.exited;

      // 重載 Caddy
      const proc = Bun.spawn(["sudo", "systemctl", "reload", "caddy"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      if (exitCode !== 0) {
        return {
          content: [{ type: "text", text: `重載失敗: ${stderr}` }],
        };
      }
      return {
        content: [{ type: "text", text: "Caddy 已重載（權限已修復）" }],
      };
    });
  }
);

server.registerTool(
  "system_service_status",
  {
    title: "Service Status",
    description: "查看系統服務狀態",
    inputSchema: {
      service: z.enum(["caddy", "pai-bot"]).describe("服務名稱"),
    },
  },
  async ({ service }) => {
    return withErrorHandling("system_service_status", async () => {
      const proc = Bun.spawn(["systemctl", "status", service, "--no-pager"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      return {
        content: [{ type: "text", text: stdout }],
      };
    });
  }
);

server.registerTool(
  "system_restart_service",
  {
    title: "Restart Service",
    description: "重啟系統服務（僅限 pai-bot）",
    inputSchema: {
      service: z.enum(["pai-bot"]).describe("服務名稱"),
    },
  },
  async ({ service }) => {
    return withErrorHandling("system_restart_service", async () => {
      const proc = Bun.spawn(["sudo", "systemctl", "restart", service], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      if (exitCode !== 0) {
        return {
          content: [{ type: "text", text: `重啟失敗: ${stderr}` }],
        };
      }
      return {
        content: [{ type: "text", text: `${service} 已重啟` }],
      };
    });
  }
);

// Start server
log.info("Connecting to transport...");
const transport = new StdioServerTransport();
await server.connect(transport);
log.info("MCP Server connected and ready");
