/**
 * Control Panels
 */

import type { ActionRowBuilder, MessageActionRowComponentBuilder } from "discord.js";
import type { PanelMode, ControlPanel } from "./types";
import { buildPlayerContent, buildPlayerComponents } from "./player";
import { buildDiceContent, buildDiceComponents } from "./dice";

// Re-export types
export type { PanelMode, ControlPanel } from "./types";

// Re-export panel builders
export { buildPlayerContent, buildPlayerComponents } from "./player";
export {
  buildDiceContent,
  buildDiceComponents,
  roll,
  formatResult,
  parseAndRoll,
  addDie,
  undoLastDie,
  clearDiceState,
  rollAccumulatedDice,
  formatAccumulatedDice,
  getDiceState,
  setDicePanel,
  getDicePanel,
  clearDicePanel,
  type DiceResult,
  type DiceType,
  type DicePanel,
} from "./dice";

/**
 * Build panel content based on mode
 */
export function buildPanelContent(mode: PanelMode, guildId: string): string {
  switch (mode) {
    case "player":
      return buildPlayerContent(guildId);
    case "dice":
      return buildDiceContent();
  }
}

/**
 * Build panel components based on mode
 */
export function buildPanelComponents(
  mode: PanelMode,
  guildId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  switch (mode) {
    case "player":
      return buildPlayerComponents(guildId);
    case "dice":
      return buildDiceComponents(guildId);
  }
}
