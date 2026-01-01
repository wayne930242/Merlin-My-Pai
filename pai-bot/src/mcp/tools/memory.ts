import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { memoryManager } from "../../memory";

// 從環境變數取得預設 user_id（Telegram bot 主人）
const DEFAULT_USER_ID = parseInt(
  process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0",
  10
);

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
      const memories = memoryManager.getRecent(DEFAULT_USER_ID, limit);
      const count = memoryManager.count(DEFAULT_USER_ID);

      if (memories.length === 0) {
        return { content: [{ type: "text", text: "目前沒有長期記憶" }] };
      }

      const lines = [`長期記憶（共 ${count} 條，顯示 ${memories.length} 條）：\n`];
      for (const m of memories) {
        lines.push(`- [${m.category}] ${m.content} (重要性: ${m.importance})`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
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
      const memories = await memoryManager.search(DEFAULT_USER_ID, query, limit);

      if (memories.length === 0) {
        return { content: [{ type: "text", text: `沒有找到與「${query}」相關的記憶` }] };
      }

      const lines = [`與「${query}」相關的記憶：\n`];
      for (const m of memories) {
        const distance = m.distance?.toFixed(2) || "?";
        lines.push(`- [${m.category}] ${m.content} (距離: ${distance})`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "memory_save",
    {
      title: "Save Memory",
      description: "手動儲存一條長期記憶",
      inputSchema: {
        content: z.string().describe("記憶內容（關於用戶的事實）"),
        category: z
          .enum(["preference", "personal", "event", "work", "general"])
          .optional()
          .describe("分類（預設 general）"),
        importance: z.number().min(1).max(5).optional().describe("重要性 1-5（預設 3）"),
      },
    },
    async ({ content, category = "general", importance = 3 }) => {
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
    }
  );

  server.registerTool(
    "memory_archive",
    {
      title: "Archive All Memories",
      description: "封存所有長期記憶（軟刪除，可恢復）",
      inputSchema: {},
    },
    async () => {
      const archived = memoryManager.archiveByUser(DEFAULT_USER_ID);
      return {
        content: [{ type: "text", text: `已封存 ${archived} 條記憶` }],
      };
    }
  );

  server.registerTool(
    "memory_restore",
    {
      title: "Restore Archived Memories",
      description: "恢復所有已封存的記憶",
      inputSchema: {},
    },
    async () => {
      const restored = memoryManager.restoreByUser(DEFAULT_USER_ID);
      return {
        content: [{ type: "text", text: `已恢復 ${restored} 條記憶` }],
      };
    }
  );

  server.registerTool(
    "memory_stats",
    {
      title: "Memory Statistics",
      description: "查看記憶系統統計資訊",
      inputSchema: {},
    },
    async () => {
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
    }
  );
}
