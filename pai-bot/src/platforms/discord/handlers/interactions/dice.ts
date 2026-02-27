/**
 * Dice Panel Interactions
 */

import {
  type ButtonInteraction,
  MessageFlags,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
} from "discord.js";
import { logger } from "../../../../utils/logger";
import {
  buildCustomDiceModal,
  buildDiceComponents,
  clearCustomExpressions,
  type GameSystem,
  getDicePanel,
  parseAndRoll,
  saveCustomExpression,
  setGameSystem,
} from "../panels";
import { isSendableChannel } from "../utils";

/**
 * Append roll result to history message
 */
async function appendToHistory(
  channel: TextBasedChannel,
  channelId: string,
  discordUserId: string,
  resultText: string,
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  const dicePanel = getDicePanel(channelId);
  if (!dicePanel || !isSendableChannel(channel)) return false;

  try {
    const historyMsg = await channel.messages.fetch(dicePanel.historyMessageId);
    const currentContent = historyMsg.content;
    const newEntry = `<@${discordUserId}> ${resultText}`;

    if (currentContent.length + newEntry.length + 2 > 1900) {
      // Auto-rotate history message when content reaches Discord limit.
      const rotatedHistory = await channel.send(`**擲骰歷史**\n${newEntry}`);
      dicePanel.historyMessageId = rotatedHistory.id;
      return true;
    }

    const newContent =
      currentContent === "**擲骰歷史**\n—"
        ? `**擲骰歷史**\n${newEntry}`
        : `${currentContent}\n${newEntry}`;

    await historyMsg.edit(newContent);
    return true;
  } catch (error) {
    logger.error(
      { error, channelId, historyMessageId: dicePanel.historyMessageId },
      "Failed to update dice history",
    );
    return false;
  }
}

async function refreshPanelComponents(
  channel: TextBasedChannel,
  channelId: string,
  guildId: string,
): Promise<void> {
  const dicePanel = getDicePanel(channelId);
  if (!dicePanel || !isSendableChannel(channel)) return;

  try {
    const panelMsg = await channel.messages.fetch(dicePanel.panelMessageId);
    const components = buildDiceComponents(guildId, channelId);
    await panelMsg.edit({ components });
  } catch (error) {
    logger.error(
      { error, channelId, panelMessageId: dicePanel.panelMessageId },
      "Failed to refresh dice panel components",
    );
  }
}

/**
 * Handle dice button interactions
 */
export async function handleDiceButton(
  interaction: ButtonInteraction,
  discordUserId: string,
  parts: string[],
): Promise<void> {
  const action = parts[1];
  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) return;

  switch (action) {
    case "quick": {
      // dice:quick:expression:guildId
      const expression = parts[2];
      const result = parseAndRoll(expression);
      if (!result) {
        await interaction.reply({ content: "無效的骰子表達式", flags: MessageFlags.Ephemeral });
        return;
      }

      const handled = await appendToHistory(
        channel,
        interaction.channelId,
        discordUserId,
        result.text,
        interaction,
      );
      if (handled) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `你的結果: ${result.text}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }
      await interaction.reply(`<@${discordUserId}> ${result.text}`);
      return;
    }

    case "saved": {
      // dice:saved:index:guildId
      const savedIndex = parseInt(parts[2], 10);
      const panel = getDicePanel(interaction.channelId);
      const expression = panel?.savedCustomExpressions?.[savedIndex];
      if (!expression) {
        await interaction.reply({ content: "找不到這組 custom 骰子", flags: MessageFlags.Ephemeral });
        return;
      }

      const result = parseAndRoll(expression);
      if (!result) {
        await interaction.reply({
          content: "這組 custom 骰子已失效，請重建",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const handled = await appendToHistory(
        channel,
        interaction.channelId,
        discordUserId,
        result.text,
        interaction,
      );
      if (handled) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `你的結果: ${result.text}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }
      await interaction.reply(`<@${discordUserId}> ${result.text}`);
      return;
    }

    case "custom": {
      // dice:custom:guildId
      const guildId = parts[2];
      const modal = buildCustomDiceModal(guildId);
      await interaction.showModal(modal);
      return;
    }

    case "customreset": {
      // dice:customreset:guildId
      const guildId = parts[2];
      clearCustomExpressions(interaction.channelId);
      await refreshPanelComponents(channel, interaction.channelId, guildId);
      await interaction.reply({
        content: "已移除本頻道所有 custom 骰子",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    case "add":
    case "roll":
    case "clear":
    case "undo": {
      await interaction.reply({
        content: "此按鈕已停用，請使用新版骰盤（立即擲骰）",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    default:
      await interaction.reply({ content: "Unknown action", flags: MessageFlags.Ephemeral });
      return;
  }
}

/**
 * Handle dice modal submit
 */
export async function handleDiceModalSubmit(
  interaction: ModalSubmitInteraction,
  discordUserId: string,
): Promise<void> {
  const expression = interaction.fields.getTextInputValue("dice_expression");
  const result = parseAndRoll(expression);

  if (!result) {
    await interaction.reply({ content: "無效的骰子表達式", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) {
    await interaction.reply({ content: result.text, flags: MessageFlags.Ephemeral });
    return;
  }

  const channelId = interaction.channelId ?? channel.id;
  const guildId = interaction.guildId;

  saveCustomExpression(channelId, expression);
  if (guildId) {
    await refreshPanelComponents(channel, channelId, guildId);
  }

  const handled = await appendToHistory(
    channel,
    channelId,
    discordUserId,
    result.text,
    interaction,
  );
  if (handled) {
    if (!interaction.replied) {
      await interaction.reply({
        content: `你的結果: ${result.text}\n複製: \`${expression}\``,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  await interaction.reply(`<@${discordUserId}> ${result.text}`);
}

/**
 * Handle dice select menu (game system selection)
 */
export async function handleDiceSelectMenu(
  interaction: StringSelectMenuInteraction,
  _discordUserId: string,
  parts: string[],
): Promise<void> {
  const guildId = parts[2];
  const selectedSystem = interaction.values[0] as GameSystem;
  const channelId = interaction.channelId;

  // Update the game system
  setGameSystem(channelId, selectedSystem);

  // Update the panel with new components
  const components = buildDiceComponents(guildId, channelId);
  await interaction.update({ components });
}
