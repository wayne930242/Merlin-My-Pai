/**
 * Panel Types
 */

export type PanelMode = "dice" | "volume" | "recording";

export interface ControlPanel {
  messageId: string;
  channelId: string;
  guildId: string;
  mode: PanelMode;
}
