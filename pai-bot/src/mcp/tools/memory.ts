import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { memoryManager } from "../../memory";

// 從環境變數取得預設 user_id（Telegram bot 主人）
const DEFAULT_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

export function registerMemoryTools(server: McpServer): void {
  server.registerTool(
    "memory_list",
    {
      title: "List Memories",
      description: "列出最近的長期記憶",
      inputSchema: {
        limit: z.number().optional().describe("最多顯示幾條（預設 20）"),
      },
    },
    async ({ limit = 20 }) => {
      try {
        const memories = memoryManager.getRecent(DEFAULT_USER_ID, limit);
        const count = memoryManager.count(DEFAULT_USER_ID);

        if (memories.length === 0) {
          return { content: [{ type: "text", text: "目前沒有長期記憶" }] };
        }

        const lines = [`長期記憶（共 ${count} 條，顯示 ${memories.length} 條）：\n`];
        for (const m of memories) {
          lines.push(`- [ID:${m.id}] [${m.category}] ${m.content} (重要性: ${m.importance})`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "memory_search",
    {
      title: "Search Memories",
      description: "搜尋相關的長期記憶",
      inputSchema: {
        query: z.string().describe("搜尋關鍵字或描述"),
        limit: z.number().optional().describe("最多顯示幾條（預設 5）"),
      },
    },
    async ({ query, limit = 5 }) => {
      try {
        const memories = await memoryManager.search(DEFAULT_USER_ID, query, limit);

        if (memories.length === 0) {
          return { content: [{ type: "text", text: `沒有找到與「${query}」相關的記憶` }] };
        }

        const lines = [`與「${query}」相關的記憶：\n`];
        for (const m of memories) {
          lines.push(`- [ID:${m.id}] [${m.category}] ${m.content}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "memory_save",
    {
      title: "Save Memory",
      description: "手動儲存一條長期記憶",
      inputSchema: {
        content: z.string().describe("記憶內容（關於用戶的事實）"),
        category: z
          .enum([
            "preference",
            "personal",
            "event",
            "work",
            "health",
            "investment",
            "watchlist",
            "general",
          ])
          .optional()
          .describe("分類（預設 general）"),
        importance: z.number().min(1).max(5).optional().describe("重要性 1-5（預設 3）"),
      },
    },
    async ({ content, category = "general", importance = 3 }) => {
      try {
        const result = await memoryManager.save({
          userId: DEFAULT_USER_ID,
          content,
          category,
          importance,
        });

        if (result === null) {
          return { content: [{ type: "text", text: "已有相似記憶，跳過儲存" }] };
        }

        return { content: [{ type: "text", text: `記憶已儲存 (ID: ${result})` }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "memory_delete",
    {
      title: "Delete Memory",
      description: "刪除單則記憶（需要先用 memory_list 或 memory_search 取得 ID）",
      inputSchema: {
        id: z.number().describe("記憶 ID"),
      },
    },
    async ({ id }) => {
      try {
        const memory = memoryManager.getById(id);
        if (!memory) {
          return {
            content: [{ type: "text", text: `找不到 ID 為 ${id} 的記憶` }],
            isError: true,
          };
        }

        const deleted = memoryManager.delete(id);
        if (deleted) {
          return {
            content: [{ type: "text", text: `已刪除記憶 (ID: ${id}): ${memory.content}` }],
          };
        }
        return {
          content: [{ type: "text", text: `刪除失敗` }],
          isError: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "memory_update",
    {
      title: "Update Memory",
      description: "更新單則記憶的內容、分類或重要性",
      inputSchema: {
        id: z.number().describe("記憶 ID"),
        content: z.string().optional().describe("新內容"),
        category: z
          .enum([
            "preference",
            "personal",
            "event",
            "work",
            "health",
            "investment",
            "watchlist",
            "general",
          ])
          .optional()
          .describe("新分類"),
        importance: z.number().min(1).max(5).optional().describe("新重要性 1-5"),
      },
    },
    async ({ id, content, category, importance }) => {
      try {
        const memory = memoryManager.getById(id);
        if (!memory) {
          return {
            content: [{ type: "text", text: `找不到 ID 為 ${id} 的記憶` }],
            isError: true,
          };
        }

        const updated = await memoryManager.update(id, { content, category, importance });
        if (updated) {
          const newMemory = memoryManager.getById(id);
          return {
            content: [
              {
                type: "text",
                text: `已更新記憶 (ID: ${id}):\n舊: ${memory.content}\n新: ${newMemory?.content}`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: `更新失敗` }],
          isError: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "memory_stats",
    {
      title: "Memory Statistics",
      description: "查看記憶系統統計資訊",
      inputSchema: {},
    },
    async () => {
      try {
        const userCount = memoryManager.count(DEFAULT_USER_ID);
        const archived = memoryManager.countArchived(DEFAULT_USER_ID);
        const recentMemories = memoryManager.getRecent(DEFAULT_USER_ID, 1);
        const oldest = recentMemories.length > 0 ? recentMemories[0].createdAt : null;

        // Get category breakdown from recent memories
        const allMemories = memoryManager.getRecent(DEFAULT_USER_ID, 1000);
        const byCategory: Record<string, number> = {};
        for (const m of allMemories) {
          byCategory[m.category] = (byCategory[m.category] || 0) + 1;
        }

        const info = [
          `記憶統計：`,
          `- 總數：${userCount}`,
          `- 已封存：${archived}`,
          `- 最新：${oldest || "無"}`,
          ``,
          `分類統計：`,
          ...Object.entries(byCategory).map(([cat, count]) => `- ${cat}: ${count}`),
        ];

        return { content: [{ type: "text", text: info.join("\n") }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Memory 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
