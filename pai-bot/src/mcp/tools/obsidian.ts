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
      title: "Query Obsidian with AI Agent",
      description:
        "使用 AI Agent 智能查詢 Obsidian 知識庫，支援多步推理、查詢重寫、相關性評估",
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
      title: "Search Obsidian Notes (Simple)",
      description: "在 Obsidian 知識庫中進行簡單語意搜尋（不經過 Agent）",
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
      title: "Obsidian Stats",
      description: "查看 Obsidian RAG 索引統計",
      inputSchema: {},
    },
    async () => {
      try {
        const result =
          await $`${VENV_PYTHON} ${RAG_SCRIPT} stats --vault ${VAULT_PATH}`.quiet();
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
      title: "Sync Obsidian Index",
      description: "同步 Obsidian RAG 索引（更新有變更的檔案）",
      inputSchema: {},
    },
    async () => {
      try {
        const result =
          await $`${VENV_PYTHON} ${RAG_SCRIPT} sync --vault ${VAULT_PATH}`.quiet();
        return { content: [{ type: "text", text: result.stdout.toString() }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `同步失敗: ${errorMsg}` }] };
      }
    },
  );
}
