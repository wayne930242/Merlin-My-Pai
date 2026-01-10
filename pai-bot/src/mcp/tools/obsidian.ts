import { homedir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { $ } from "bun";
import { z } from "zod";

const VENV_PYTHON = join(homedir(), ".venv/bin/python");
const BOT_SRC = join(homedir(), "pai-bot/src/rag");
const RAG_SCRIPT = join(BOT_SRC, "obsidian_rag.py");
const AGENTIC_RAG_SCRIPT = join(BOT_SRC, "agentic_rag.py");
const VAULT_PATH = join(homedir(), "obsidian");

export function registerObsidianTools(server: McpServer): void {
  // Agentic RAG - 主要入口
  server.registerTool(
    "obsidian_agent_query",
    {
      title: "查詢我的個人知識庫",
      description:
        "【重要】這是 Wei-Hung 的個人知識庫（Obsidian），包含學習筆記、研究文獻、專案紀錄等。當用戶詢問個人相關問題、學習內容、過去的筆記或研究時，應優先使用此工具搜尋。支援多步推理和智能查詢重寫。",
      inputSchema: {
        question: z.string().describe("要查詢的問題（自然語言）"),
        max_retries: z.number().optional().describe("最大重試次數（預設 2）"),
      },
    },
    async ({ question, max_retries = 2 }) => {
      try {
        const result =
          await $`${VENV_PYTHON} ${AGENTIC_RAG_SCRIPT} query --vault ${VAULT_PATH} -q ${question} -r ${max_retries}`.quiet();
        const output = result.stdout.toString();

        if (!output.trim()) {
          return {
            content: [{ type: "text", text: `Agent 查詢無結果: ${question}` }],
          };
        }

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Agent 查詢失敗: ${errorMsg}` }] };
      }
    },
  );

  // 簡單搜尋 - 快速查詢或 fallback
  server.registerTool(
    "obsidian_search",
    {
      title: "快速搜尋知識庫",
      description:
        "在個人知識庫中進行快速語意搜尋。適合簡單查詢或需要快速取得原始片段時使用。如需更智能的回答，請用 obsidian_agent_query。",
      inputSchema: {
        query: z.string().describe("搜尋查詢（自然語言）"),
        top_k: z.number().optional().describe("返回結果數量（預設 5）"),
      },
    },
    async ({ query, top_k = 5 }) => {
      try {
        const result =
          await $`${VENV_PYTHON} ${RAG_SCRIPT} search --vault ${VAULT_PATH} -q ${query} -k ${top_k}`.quiet();
        const output = result.stdout.toString();

        if (!output.trim()) {
          return { content: [{ type: "text", text: `沒有找到與「${query}」相關的筆記` }] };
        }

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `搜尋失敗: ${errorMsg}` }] };
      }
    },
  );

  server.registerTool(
    "obsidian_stats",
    {
      title: "知識庫統計",
      description: "查看個人知識庫的索引統計（檔案數、chunk 數等）",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await $`${VENV_PYTHON} ${RAG_SCRIPT} stats --vault ${VAULT_PATH}`.quiet();
        return { content: [{ type: "text", text: result.stdout.toString() }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `統計失敗: ${errorMsg}` }] };
      }
    },
  );

  server.registerTool(
    "obsidian_sync",
    {
      title: "同步知識庫索引",
      description: "同步個人知識庫索引（更新有變更的檔案）。通常不需要手動執行，系統會自動同步。",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await $`${VENV_PYTHON} ${RAG_SCRIPT} sync --vault ${VAULT_PATH}`.quiet();
        return { content: [{ type: "text", text: result.stdout.toString() }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `同步失敗: ${errorMsg}` }] };
      }
    },
  );
}
