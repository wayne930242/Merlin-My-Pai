/**
 * Session context utilities
 */

export interface VoiceContext {
  inVoice: boolean;
  channelId: string | null;
}

export interface SessionContextOptions {
  sessionId: string | number;
  platform: "telegram" | "discord";
  type: "dm" | "channel";
  voice?: VoiceContext;
}

/**
 * 產生 session context 字串，包含時間資訊（台北時區）
 */
export function buildSessionContext(
  sessionId: string | number,
  platform: "telegram" | "discord",
  type: "dm" | "channel",
  options?: { voice?: VoiceContext }
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

  let context = `[Session]
session_id: ${sessionId}
platform: ${platform}
type: ${type}
time: ${taipeiTime}`;

  // Add Discord voice context if available
  if (platform === "discord" && options?.voice) {
    const { inVoice, channelId } = options.voice;
    context += `\nvoice_connected: ${inVoice}`;
    if (inVoice && channelId) {
      context += `\nvoice_channel_id: ${channelId}`;
    }
  }

  return context + "\n";
}
