#!/usr/bin/env bun
/**
 * PAI MCP Server
 * 提供 Google Services、排程器、系統管理工具給 Claude Code
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarminTools } from "./tools/garmin";
import { registerGoogleTools } from "./tools/google";
import { registerHistoryTools } from "./tools/history";
import { registerMemoryTools } from "./tools/memory";
import { registerNotifyTools } from "./tools/notify";
import { registerObsidianTools } from "./tools/obsidian";
import { registerSchedulerTools } from "./tools/scheduler";
import { registerSystemTools } from "./tools/system";

// Simple stderr logger for MCP (stdout is reserved for protocol)
const log = {
  info: (msg: string, data?: object) =>
    console.error(`[MCP INFO] ${msg}`, data ? JSON.stringify(data) : ""),
  error: (msg: string, data?: object) =>
    console.error(`[MCP ERROR] ${msg}`, data ? JSON.stringify(data) : ""),
};

log.info("Starting PAI MCP Server");

const server = new McpServer({
  name: "pai-services",
  version: "1.0.0",
});

// Register all tools
registerGoogleTools(server);
registerSchedulerTools(server);
registerSystemTools(server);
registerMemoryTools(server);
registerHistoryTools(server);
registerNotifyTools(server);
registerGarminTools(server);
registerObsidianTools(server);

// Start server
log.info("Connecting to transport...");
const transport = new StdioServerTransport();
await server.connect(transport);
log.info("MCP Server connected and ready");
