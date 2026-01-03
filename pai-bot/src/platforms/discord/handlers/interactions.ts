/**
 * Discord Button/Select Interactions Handler
 */

import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { abortUserProcess } from "../../../claude/client";
import { queueManager } from "../../../claude/queue-manager";
import { logger } from "../../../utils/logger";
import {
  skip,
  stop as stopVoice,
  leaveChannel,
  getGuildControlPanels,
  clearControlPanel,
  previous,
  playAt,
  getControlPanel,
  setControlPanel,
} from "../voice";
import { toNumericId, isSendableChannel } from "./utils";
import {
  buildPanelContent,
  buildPanelComponents,
  addDie,
  undoLastDie,
  clearDiceState,
  rollAccumulatedDice,
  formatAccumulatedDice,
  getDicePanel,
  type PanelMode,
  type DiceType,
} from "./panels";
import { executeClaudeTask, getPendingDecisions } from "./message";

/**
 * Handle button interactions
 */
export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const data = interaction.customId;
  const discordUserId = interaction.user.id;
  const userId = toNumericId(discordUserId);

  // Parse callback data
  const parts = data.split(":");

  // Handle panel mode switch: panel:mode:guildId
  if (parts[0] === "panel" && parts.length === 3) {
    await handlePanelSwitch(interaction, discordUserId, parts[1] as PanelMode, parts[2]);
    return;
  }

  // Handle music buttons: music:action:guildId
  if (parts[0] === "music" && parts.length === 3) {
    await handleMusicButton(interaction, discordUserId, parts[1], parts[2]);
    return;
  }

  // Handle dice buttons: dice:action:...:guildId:userId
  if (parts[0] === "dice") {
    await handleDiceButton(interaction, discordUserId, parts);
    return;
  }

  // Parse callback data: action:taskId
  const colonIndex = data.indexOf(":");
  if (colonIndex === -1) return;

  const action = data.slice(0, colonIndex);
  const taskId = data.slice(colonIndex + 1);

  if (action !== "abort" && action !== "queue") return;

  logger.debug({ userId, action, taskId }, "Button interaction received");

  // Check if task already started
  if (queueManager.isTaskStarted(taskId)) {
    await interaction.reply({ content: "Task already started", ephemeral: true });
    return;
  }

  // Cancel timeout
  const pendingDecisions = getPendingDecisions();
  const pending = pendingDecisions.get(discordUserId);
  if (pending && pending.taskId === taskId) {
    clearTimeout(pending.timeoutId);
    pendingDecisions.delete(discordUserId);
  }

  // Get pending task
  const task = queueManager.getPendingTask(taskId);
  if (!task) {
    await interaction.reply({ content: "Task expired", ephemeral: true });
    return;
  }

  // Update original message to remove buttons
  try {
    await interaction.update({ components: [] });
  } catch {
    // Ignore update errors
  }

  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) return;

  if (action === "abort") {
    // Abort current task and clear queue
    abortUserProcess(userId);
    const clearedCount = queueManager.clearQueue(userId);

    logger.info({ userId, taskId, clearedCount }, "Task interrupted, queue cleared");

    await channel.send("Interrupted. Starting new task...");

    // Execute immediately
    queueManager.removePendingTask(taskId);
    await queueManager.executeImmediately(task, async (t) => {
      await executeClaudeTask(t, channel);
    });
  } else if (action === "queue") {
    // Queue the task
    const queueLength = queueManager.getQueueLength(userId) + 1;

    await channel.send(`Queued (position: ${queueLength})`);

    logger.info({ userId, taskId, position: queueLength }, "Task queued");

    queueManager.enqueue(task, async (t) => {
      await executeClaudeTask(t, channel);
    }).catch((error) => {
      logger.error({ error, taskId }, "Queued task failed");
    });
  }
}

/**
 * Handle panel mode switch - delete old message and send new one
 */
async function handlePanelSwitch(
  interaction: ButtonInteraction,
  discordUserId: string,
  mode: PanelMode,
  guildId: string
): Promise<void> {
  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) return;

  // Delete old message
  try {
    await interaction.message.delete();
  } catch {
    // Ignore delete errors
  }

  // Send new message at bottom
  const content = buildPanelContent(mode, guildId);
  const components = buildPanelComponents(mode, guildId);
  const newMessage = await channel.send({ content, components });

  // Update panel record
  setControlPanel(discordUserId, {
    messageId: newMessage.id,
    channelId: interaction.channelId,
    guildId,
    mode,
  });
}

/**
 * Handle music button interactions - move panel down after action
 */
async function handleMusicButton(
  interaction: ButtonInteraction,
  discordUserId: string,
  action: string,
  guildId: string
): Promise<void> {
  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) return;

  switch (action) {
    case "prev": {
      if (!previous(guildId)) {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
        return;
      }
      break;
    }

    case "skip": {
      if (!skip(guildId)) {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
        return;
      }
      break;
    }

    case "stop": {
      if (!stopVoice(guildId)) {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
        return;
      }
      break;
    }

    case "leave": {
      leaveChannel(guildId);
      const panels = getGuildControlPanels(guildId);
      for (const { userId } of panels) {
        clearControlPanel(userId);
      }
      await interaction.reply({ content: "Left voice channel", ephemeral: true });
      try {
        await interaction.message.delete();
      } catch {
        // Ignore delete errors
      }
      return;
    }

    default:
      await interaction.reply({ content: "Unknown action", ephemeral: true });
      return;
  }

  // Delete old and send new panel at bottom
  try {
    await interaction.message.delete();
  } catch {
    // Ignore delete errors
  }

  const content = buildPanelContent("player", guildId);
  const components = buildPanelComponents("player", guildId);
  const newMessage = await channel.send({ content, components });

  setControlPanel(discordUserId, {
    messageId: newMessage.id,
    channelId: interaction.channelId,
    guildId,
    mode: "player",
  });
}

/**
 * Handle dice button interactions
 * Formats:
 * - dice:add:diceType:guildId - add a die
 * - dice:roll:guildId - roll all accumulated dice
 * - dice:clear:guildId - clear accumulated dice
 * - dice:undo:guildId - undo last added die
 */
async function handleDiceButton(
  interaction: ButtonInteraction,
  discordUserId: string,
  parts: string[]
): Promise<void> {
  const action = parts[1];
  const channel = interaction.channel;
  if (!channel || !isSendableChannel(channel)) return;

  // Get user display name for result messages
  const displayName = interaction.member && "displayName" in interaction.member
    ? interaction.member.displayName
    : interaction.user.displayName;

  switch (action) {
    case "add": {
      // dice:add:diceType:guildId
      const diceType = parts[2] as DiceType;
      const guildId = parts[3];
      const state = addDie(discordUserId, diceType, guildId);
      const accumulated = formatAccumulatedDice(state);
      await interaction.reply({ content: `你的累積: ${accumulated}`, ephemeral: true });
      return;
    }

    case "roll": {
      // dice:roll:guildId
      const rollResult = rollAccumulatedDice(discordUserId);
      if (!rollResult) {
        await interaction.reply({ content: "沒有累積的骰子", ephemeral: true });
        return;
      }

      // Try to edit history message
      const dicePanel = getDicePanel(interaction.channelId);
      if (dicePanel && channel && "messages" in channel) {
        try {
          const historyMsg = await channel.messages.fetch(dicePanel.historyMessageId);
          const currentContent = historyMsg.content;
          const newEntry = `<@${discordUserId}> ${rollResult.replace(/\n\n\*\*Total:.*\*\*$/, "").replace(/\n/g, " | ")}`;

          // Check if near Discord's 2000 char limit
          if (currentContent.length + newEntry.length + 2 > 1900) {
            await interaction.reply({
              content: "歷史訊息已滿，請使用 `/panel dice` 重新建立面板",
              ephemeral: true
            });
            return;
          }

          const newContent = currentContent === "**擲骰歷史**\n—"
            ? `**擲骰歷史**\n${newEntry}`
            : `${currentContent}\n${newEntry}`;

          await historyMsg.edit(newContent);
          await interaction.reply({ content: "已擲出！", ephemeral: true });
          return;
        } catch {
          // History message not found, fall back to normal reply
        }
      }

      // Fallback: send as new message
      await interaction.reply(`<@${discordUserId}> 擲骰:\n${rollResult}`);
      return;
    }

    case "clear": {
      // dice:clear:guildId
      clearDiceState(discordUserId);
      await interaction.reply({ content: "已清除累積", ephemeral: true });
      return;
    }

    case "undo": {
      // dice:undo:guildId
      const state = undoLastDie(discordUserId);
      if (!state) {
        await interaction.reply({ content: "沒有可撤銷的骰子", ephemeral: true });
        return;
      }
      const accumulated = formatAccumulatedDice(state);
      await interaction.reply({ content: `你的累積: ${accumulated}`, ephemeral: true });
      return;
    }

    default:
      await interaction.reply({ content: "Unknown action", ephemeral: true });
      return;
  }
}

/**
 * Handle select menu interactions - move panel down after action
 */
export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;
  const parts = customId.split(":");
  const discordUserId = interaction.user.id;

  // Handle music select: music:select:guildId
  if (parts[0] === "music" && parts[1] === "select" && parts.length === 3) {
    const guildId = parts[2];
    const selectedIndex = parseInt(interaction.values[0], 10);

    if (!playAt(guildId, selectedIndex)) {
      await interaction.reply({ content: "Failed", ephemeral: true });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !isSendableChannel(channel)) return;

    // Delete old and send new panel at bottom
    try {
      await interaction.message.delete();
    } catch {
      // Ignore delete errors
    }

    const content = buildPanelContent("player", guildId);
    const components = buildPanelComponents("player", guildId);
    const newMessage = await channel.send({ content, components });

    setControlPanel(discordUserId, {
      messageId: newMessage.id,
      channelId: interaction.channelId,
      guildId,
      mode: "player",
    });
  }
}
