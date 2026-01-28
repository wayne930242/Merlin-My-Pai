/**
 * Discord Button/Select/Modal Interactions Handler
 */

import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { handleDiceButton, handleDiceModalSubmit, handleDiceSelectMenu } from "./dice";
import { handleQueueButton } from "./queue";
import { handleRecordingInteraction } from "./recording";
import { handleVolumeButton } from "./volume";

/**
 * Handle button interactions
 */
export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const data = interaction.customId;
  const discordUserId = interaction.user.id;

  // Parse callback data
  const parts = data.split(":");

  // Handle dice buttons: dice:action:...:guildId
  if (parts[0] === "dice") {
    await handleDiceButton(interaction, discordUserId, parts);
    return;
  }

  // Handle volume buttons: vol:action:guildId
  if (parts[0] === "vol") {
    await handleVolumeButton(interaction, parts);
    return;
  }

  // Handle recording buttons: recording:action:guildId
  if (parts[0] === "recording") {
    const [, action, guildId] = parts;
    await handleRecordingInteraction(interaction, action, guildId);
    return;
  }

  // Parse callback data: action:taskId
  const colonIndex = data.indexOf(":");
  if (colonIndex === -1) return;

  const action = data.slice(0, colonIndex);
  const taskId = data.slice(colonIndex + 1);

  if (action === "abort" || action === "queue") {
    await handleQueueButton(interaction, discordUserId, action, taskId);
  }
}

/**
 * Handle modal submit interactions
 */
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  const parts = customId.split(":");
  const discordUserId = interaction.user.id;

  // Handle dice modal: dice:modal:guildId
  if (parts[0] === "dice" && parts[1] === "modal") {
    await handleDiceModalSubmit(interaction, discordUserId);
  }
}

/**
 * Handle select menu interactions
 */
export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const customId = interaction.customId;
  const parts = customId.split(":");
  const discordUserId = interaction.user.id;

  // Handle dice select menu: dice:system:channelId
  if (parts[0] === "dice" && parts[1] === "system") {
    await handleDiceSelectMenu(interaction, discordUserId, parts);
  }
}
