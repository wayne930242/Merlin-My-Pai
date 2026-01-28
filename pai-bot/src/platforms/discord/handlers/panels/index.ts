/**
 * Control Panels - Dice, Volume and Recording
 */

import type { ActionRowBuilder, MessageActionRowComponentBuilder } from "discord.js";
import { buildDiceComponents, buildDiceContent } from "./dice";
import { buildRecordingComponents, buildRecordingContent } from "./recording";
import type { PanelMode } from "./types";
import { buildVolumeComponents, buildVolumeContent } from "./volume";

// Re-export dice panel builders
export {
  addDie,
  buildCustomDiceModal,
  buildDiceComponents,
  buildDiceContent,
  clearDicePanel,
  clearDiceState,
  type DicePanel,
  type DiceResult,
  type DiceType,
  formatAccumulatedDice,
  formatResult,
  GAME_SYSTEM_LABELS,
  GAME_SYSTEM_PRESETS,
  type GameSystem,
  getDicePanel,
  getDiceState,
  parseAndRoll,
  roll,
  rollAccumulatedDice,
  setDicePanel,
  setGameSystem,
  undoLastDie,
} from "./dice";
// Re-export types
export type { ControlPanel, PanelMode } from "./types";

// Re-export volume panel builders
export {
  buildVolumeComponents,
  buildVolumeContent,
  clearVolumePanel,
  formatVolumeDisplay,
  getVolumePanel,
  setVolumePanel,
  type VolumePanel,
} from "./volume";

// Re-export recording panel builders
export {
  buildRecordingComponents,
  buildRecordingContent,
  clearRecordingPanel,
  getRecordingPanel,
  type RecordingPanel,
  setRecordingPanel,
} from "./recording";

/**
 * Build panel content based on mode
 */
export function buildPanelContent(mode: PanelMode, guildId: string): string {
  if (mode === "volume") {
    return buildVolumeContent(guildId);
  }
  if (mode === "recording") {
    return buildRecordingContent(guildId);
  }
  return buildDiceContent();
}

/**
 * Build panel components based on mode
 */
export function buildPanelComponents(
  mode: PanelMode,
  guildId: string,
  channelId?: string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (mode === "volume") {
    return buildVolumeComponents(guildId);
  }
  if (mode === "recording") {
    return buildRecordingComponents(guildId);
  }
  return buildDiceComponents(guildId, channelId);
}
