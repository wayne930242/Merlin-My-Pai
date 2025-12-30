/**
 * 通知工具 - 發送訊息到 Telegram
 */

const API_URL = process.env.PAI_API_URL || "http://127.0.0.1:3000";

export type NotifyLevel = "info" | "warning" | "error" | "success";

export async function notify(message: string, level: NotifyLevel = "info"): Promise<void> {
  try {
    await fetch(`${API_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, level }),
    });
  } catch {
    // API 不可用時靜默失敗
  }
}

export function formatToolName(tool: string): string {
  const icons: Record<string, string> = {
    Bash: "terminal",
    Read: "file",
    Write: "pencil",
    Edit: "edit",
    Glob: "search",
    Grep: "search",
    Task: "robot",
    WebFetch: "globe",
    WebSearch: "globe",
  };
  return icons[tool] || tool;
}
