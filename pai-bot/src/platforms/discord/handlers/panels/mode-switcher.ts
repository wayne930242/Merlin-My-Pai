/**
 * Panel Mode Switcher
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { PanelMode } from "./types";

/**
 * Build mode switcher buttons
 */
export function buildModeSwitcher(
  guildId: string,
  currentMode: PanelMode
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`panel:player:${guildId}`)
      .setLabel("Player")
      .setStyle(currentMode === "player" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`panel:soundboard:${guildId}`)
      .setLabel("Sound")
      .setStyle(currentMode === "soundboard" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`panel:dice:${guildId}`)
      .setLabel("Dice")
      .setStyle(currentMode === "dice" ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}
