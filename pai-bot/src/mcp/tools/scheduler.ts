import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as scheduler from "../../services/scheduler";

// 從環境變數取得預設 user_id（Telegram bot 主人）
const DEFAULT_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

export function registerSchedulerTools(server: McpServer): void {
  server.registerTool(
    "schedule_create",
    {
      title: "Create Schedule",
      description:
        "創建排程任務。支援 cron 表達式（重複）或指定時間（一次性）。時區為 Asia/Taipei。",
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
        taskData: z
          .string()
          .describe("任務資料：message 類型為訊息內容，prompt 類型為要執行的指令"),
      },
    },
    async ({ name, cronExpression, runAt, taskType, taskData }) => {
      try {
        if (!cronExpression && !runAt) {
          return {
            content: [{ type: "text", text: "錯誤：必須提供 cronExpression 或 runAt" }],
            isError: true,
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
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "schedule_list",
    {
      title: "List Schedules",
      description: "列出所有排程任務",
      inputSchema: {},
    },
    async () => {
      try {
        const schedules = scheduler.listSchedules(DEFAULT_USER_ID);
        return {
          content: [{ type: "text", text: JSON.stringify(schedules, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
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
      try {
        const success = scheduler.deleteSchedule(id);
        if (!success) {
          return {
            content: [{ type: "text", text: "找不到該排程" }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: "排程已刪除" }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
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
      try {
        const success = scheduler.setScheduleEnabled(id, enabled);
        if (!success) {
          return {
            content: [{ type: "text", text: "找不到該排程" }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `排程已${enabled ? "啟用" : "停用"}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "schedule_update",
    {
      title: "Update Schedule",
      description: "更新排程任務。可更新名稱、時間、任務類型、任務資料等。",
      inputSchema: {
        id: z.number().describe("排程 ID"),
        name: z.string().optional().describe("新的任務名稱"),
        cronExpression: z
          .string()
          .nullable()
          .optional()
          .describe("新的 Cron 表達式，設為 null 可清除"),
        runAt: z
          .string()
          .nullable()
          .optional()
          .describe("新的一次性執行時間 (ISO 8601)，設為 null 可清除"),
        taskType: z.enum(["message", "prompt"]).optional().describe("新的任務類型"),
        taskData: z.string().optional().describe("新的任務資料"),
        enabled: z.boolean().optional().describe("是否啟用"),
      },
    },
    async ({ id, name, cronExpression, runAt, taskType, taskData, enabled }) => {
      try {
        const result = scheduler.updateSchedule({
          id,
          name,
          cronExpression,
          runAt,
          taskType,
          taskData,
          enabled,
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "錯誤：找不到該排程或 cron 表達式無效" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "schedule_logs",
    {
      title: "Get Schedule Logs",
      description: "取得排程的執行記錄",
      inputSchema: {
        id: z.number().describe("排程 ID"),
        limit: z.number().optional().describe("最多回傳幾筆，預設 10"),
      },
    },
    async ({ id, limit }) => {
      try {
        const logs = scheduler.getScheduleLogs(id, limit || 10);
        return {
          content: [{ type: "text", text: JSON.stringify(logs, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Scheduler 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
