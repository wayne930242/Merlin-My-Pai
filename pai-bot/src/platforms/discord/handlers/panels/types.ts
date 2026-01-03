/**
 * Panel Types
 */

export type PanelMode = "player" | "soundboard" | "dice";
export type SoundCategory = "dnd" | "coc";

export interface ControlPanel {
  messageId: string;
  channelId: string;
  guildId: string;
  mode: PanelMode;
  soundCategory?: SoundCategory;
}
