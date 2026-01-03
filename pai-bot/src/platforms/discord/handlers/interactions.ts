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
} from "../voice";
import { toNumericId, isSendableChannel } from "./utils";
import { buildControlPanelContent, buildControlPanelComponents } from "./music-panel";
import { executeClaudeTask, getPendingDecisions } from "./message";

/**
 * Handle button interactions
 */
export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const data = interaction.customId;
  const discordUserId = interaction.user.id;
  const userId = toNumericId(discordUserId);

  // Parse callback data: action:param or music:action:guildId
  const parts = data.split(":");

  // Handle music buttons
  if (parts[0] === "music" && parts.length === 3) {
    await handleMusicButton(interaction, parts[1], parts[2]);
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
 * Handle music button interactions
 */
async function handleMusicButton(
  interaction: ButtonInteraction,
  action: string,
  guildId: string
): Promise<void> {
  switch (action) {
    case "prev": {
      if (previous(guildId)) {
        await interaction.reply({ content: "Replaying current track", ephemeral: true });
        await updateControlPanelMessage(interaction, guildId);
      } else {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
      }
      break;
    }

    case "skip": {
      if (skip(guildId)) {
        await interaction.reply({ content: "Skipped", ephemeral: true });
        await updateControlPanelMessage(interaction, guildId);
      } else {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
      }
      break;
    }

    case "stop": {
      if (stopVoice(guildId)) {
        await interaction.reply({ content: "Stopped and cleared queue", ephemeral: true });
        await updateControlPanelMessage(interaction, guildId);
      } else {
        await interaction.reply({ content: "Nothing playing", ephemeral: true });
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
      break;
    }

    default:
      await interaction.reply({ content: "未知操作", ephemeral: true });
  }
}

/**
 * Handle select menu interactions
 */
export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;
  const parts = customId.split(":");

  // Handle music select: music:select:guildId
  if (parts[0] === "music" && parts[1] === "select" && parts.length === 3) {
    const guildId = parts[2];
    const selectedIndex = parseInt(interaction.values[0], 10);

    if (playAt(guildId, selectedIndex)) {
      await interaction.reply({
        content: `Jumping to track ${selectedIndex + 1}`,
        ephemeral: true,
      });
      await updateControlPanelFromSelect(interaction, guildId);
    } else {
      await interaction.reply({ content: "Failed", ephemeral: true });
    }
  }
}

/**
 * Update control panel message (from button interaction)
 */
async function updateControlPanelMessage(
  interaction: ButtonInteraction,
  guildId: string
): Promise<void> {
  try {
    const content = buildControlPanelContent(guildId);
    const components = buildControlPanelComponents(guildId);
    await interaction.message.edit({ content, components });
  } catch (error) {
    logger.debug({ error, guildId }, "Failed to update control panel message");
  }
}

/**
 * Update control panel message (from select menu interaction)
 */
async function updateControlPanelFromSelect(
  interaction: StringSelectMenuInteraction,
  guildId: string
): Promise<void> {
  try {
    const content = buildControlPanelContent(guildId);
    const components = buildControlPanelComponents(guildId);
    await interaction.message.edit({ content, components });
  } catch (error) {
    logger.debug({ error, guildId }, "Failed to update control panel message");
  }
}
