import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSystemTools(server: McpServer): void {
  server.registerTool(
    "system_reload_caddy",
    {
      title: "Reload Caddy",
      description: "重載 Caddy 網頁伺服器配置（自動修復 site 目錄權限）",
      inputSchema: {},
    },
    async () => {
      try {
        const siteDir = "/home/pai/merlin/workspace/site";

        // 修復檔案權限 (644)
        const fixFiles = Bun.spawn(
          ["find", siteDir, "-type", "f", "-exec", "chmod", "644", "{}", ";"],
          { stdout: "pipe", stderr: "pipe" },
        );
        await fixFiles.exited;

        // 修復目錄權限 (755)
        const fixDirs = Bun.spawn(
          ["find", siteDir, "-type", "d", "-exec", "chmod", "755", "{}", ";"],
          { stdout: "pipe", stderr: "pipe" },
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
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: "Caddy 已重載（權限已修復）" }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `System 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
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
      try {
        const proc = Bun.spawn(["systemctl", "status", service, "--no-pager"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await proc.exited;
        const stdout = await new Response(proc.stdout).text();
        return {
          content: [{ type: "text", text: stdout }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `System 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
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
      try {
        const proc = Bun.spawn(["sudo", "systemctl", "restart", service], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const exitCode = await proc.exited;
        const stderr = await new Response(proc.stderr).text();

        if (exitCode !== 0) {
          return {
            content: [{ type: "text", text: `重啟失敗: ${stderr}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `${service} 已重啟` }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `System 錯誤: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
