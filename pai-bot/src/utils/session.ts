/**
 * Session context utilities
 */

/**
 * 產生 session context 字串，包含時間資訊（台北時區）
 */
export function buildSessionContext(
  sessionId: string | number,
  platform: "telegram" | "discord",
  type: "dm" | "channel"
): string {
  const now = new Date();
  const taipeiTime = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `[Session]
session_id: ${sessionId}
platform: ${platform}
type: ${type}
time: ${taipeiTime}
`;
}
