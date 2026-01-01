import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as google from "../../services/google";

export function registerGoogleTools(server: McpServer): void {
  // === Calendar Tools ===

  server.registerTool(
    "google_calendar_list",
    {
      title: "List Calendars",
      description: "列出所有 Google 日曆",
      inputSchema: {},
    },
    async () => {
      const calendars = await google.calendar.listCalendars();
      return {
        content: [{ type: "text", text: JSON.stringify(calendars, null, 2) }],
      };
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

  // === Tasks Tools ===

  server.registerTool(
    "google_tasks_list_tasklists",
    {
      title: "List Task Lists",
      description: "列出所有工作清單",
      inputSchema: {},
    },
    async () => {
      const taskLists = await google.tasks.listTaskLists();
      return {
        content: [{ type: "text", text: JSON.stringify(taskLists, null, 2) }],
      };
    }
  );

  server.registerTool(
    "google_tasks_list",
    {
      title: "List Tasks",
      description: "列出工作清單中的工作",
      inputSchema: {
        taskListId: z.string().optional().describe("工作清單 ID，預設 @default"),
        showCompleted: z.boolean().optional().describe("是否顯示已完成的工作"),
        maxResults: z.number().optional().describe("最多回傳幾筆，預設 100"),
      },
    },
    async ({ taskListId, showCompleted, maxResults }) => {
      const tasks = await google.tasks.listTasks(taskListId || "@default", {
        showCompleted,
        maxResults,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
      };
    }
  );

  server.registerTool(
    "google_tasks_create",
    {
      title: "Create Task",
      description: "建立新工作",
      inputSchema: {
        title: z.string().describe("工作標題"),
        notes: z.string().optional().describe("工作備註"),
        due: z.string().optional().describe("到期日 (RFC 3339，如 2024-01-15T00:00:00Z)"),
        taskListId: z.string().optional().describe("工作清單 ID，預設 @default"),
      },
    },
    async ({ title, notes, due, taskListId }) => {
      const task = await google.tasks.createTask(
        { title, notes, due },
        taskListId || "@default"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.registerTool(
    "google_tasks_complete",
    {
      title: "Complete Task",
      description: "將工作標記為完成",
      inputSchema: {
        taskId: z.string().describe("工作 ID"),
        taskListId: z.string().optional().describe("工作清單 ID，預設 @default"),
      },
    },
    async ({ taskId, taskListId }) => {
      const task = await google.tasks.completeTask(taskId, taskListId || "@default");
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.registerTool(
    "google_tasks_delete",
    {
      title: "Delete Task",
      description: "刪除工作",
      inputSchema: {
        taskId: z.string().describe("工作 ID"),
        taskListId: z.string().optional().describe("工作清單 ID，預設 @default"),
      },
    },
    async ({ taskId, taskListId }) => {
      await google.tasks.deleteTask(taskId, taskListId || "@default");
      return {
        content: [{ type: "text", text: "工作已刪除" }],
      };
    }
  );
}
