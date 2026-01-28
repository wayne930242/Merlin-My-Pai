/**
 * Recording Panel - Voice recording control panel
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { getRecordingSession } from "../../recording";

export interface RecordingPanel {
  messageId: string;
  channelId: string;
  guildId: string;
}

const recordingPanels = new Map<string, RecordingPanel>(); // guildId -> RecordingPanel

export function setRecordingPanel(guildId: string, panel: RecordingPanel): void {
  recordingPanels.set(guildId, panel);
}

export function getRecordingPanel(guildId: string): RecordingPanel | undefined {
  return recordingPanels.get(guildId);
}

export function clearRecordingPanel(guildId: string): void {
  recordingPanels.delete(guildId);
}

/**
 * Format recording duration
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Build recording panel content
 */
export function buildRecordingContent(guildId: string): string {
  const session = getRecordingSession(guildId);
  if (!session) {
    return "**錄音已結束**";
  }

  return session.isPaused ? "⏸️ **已暫停**" : "🔴 **錄音中**";
}

/**
 * Build recording panel buttons
 */
export function buildRecordingComponents(
  guildId: string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const session = getRecordingSession(guildId);
  const isPaused = session?.isPaused ?? false;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`recording:${isPaused ? "resume" : "pause"}:${guildId}`)
      .setLabel(isPaused ? "繼續" : "暫停")
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`recording:stop:${guildId}`)
      .setLabel("停止並上傳")
      .setStyle(ButtonStyle.Danger),
  );

  return [row as ActionRowBuilder<MessageActionRowComponentBuilder>];
}
