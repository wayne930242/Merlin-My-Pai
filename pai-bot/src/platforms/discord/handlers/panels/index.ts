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
  buildCustomDiceModal,
  buildDiceComponents,
  buildDiceContent,
  clearDicePanel,
  clearCustomExpressions,
  type DicePanel,
  type DiceResult,
  type DiceType,
  formatResult,
  GAME_SYSTEM_LABELS,
  GAME_SYSTEM_PRESETS,
  type GameSystem,
  getDicePanel,
  parseCustomExpressionsInput,
  parseAndRoll,
  roll,
  saveCustomExpression,
  setDicePanel,
  setGameSystem,
} from "./dice";
// Re-export recording panel builders
export {
  buildRecordingComponents,
  buildRecordingContent,
  clearRecordingPanel,
  getRecordingPanel,
  type RecordingPanel,
  setRecordingPanel,
} from "./recording";
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
