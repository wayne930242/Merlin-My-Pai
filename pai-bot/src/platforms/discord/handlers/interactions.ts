/**
 * Discord Button Interactions Handler
 */

import type { ButtonInteraction } from "discord.js";
import { abortUserProcess } from "../../../claude/client";
import { queueManager } from "../../../claude/queue-manager";
import { logger } from "../../../utils/logger";
import {
  skip,
  stop as stopVoice,
  getQueue,
  getNowPlaying,
  leaveChannel,
  getGuildControlPanels,
  clearControlPanel,
} from "../voice";
import { toNumericId, isSendableChannel } from "./utils";
import { buildMusicButtons, buildControlPanelContent } from "./music-panel";
import { executeClaudeTask, getPendingDecisions } from "./message";

/**
 * Handle button interactions
 */
export async function handleInteraction(interaction: ButtonInteraction): Promise<void> {
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
    case "skip": {
      if (skip(guildId)) {
        await interaction.reply({ content: "⏭️ 已跳過", ephemeral: true });
      } else {
        await interaction.reply({ content: "沒有正在播放的歌曲", ephemeral: true });
      }
      break;
    }

    case "stop": {
      if (stopVoice(guildId)) {
        await interaction.reply({ content: "⏹️ 已停止播放並清空佇列", ephemeral: true });
        await updateControlPanelMessage(interaction, guildId);
      } else {
        await interaction.reply({ content: "沒有正在播放的歌曲", ephemeral: true });
      }
      break;
    }

    case "queue": {
      const queue = getQueue(guildId);
      const nowPlaying = getNowPlaying(guildId);

      let content = "";
      if (nowPlaying) {
        content += `🎵 正在播放: **${nowPlaying.title}** [${nowPlaying.duration}]\n\n`;
      }

      if (queue.length === 0) {
        content += "📋 播放佇列為空";
      } else {
        const lines = queue.slice(0, 10).map((item, i) =>
          `${i + 1}. **${item.title}** [${item.duration}]`
        );
        if (queue.length > 10) {
          lines.push(`\n...還有 ${queue.length - 10} 首`);
        }
        content += `📋 **播放佇列** (${queue.length} 首):\n${lines.join("\n")}`;
      }

      await interaction.reply({ content, ephemeral: true });
      break;
    }

    case "leave": {
      leaveChannel(guildId);
      const panels = getGuildControlPanels(guildId);
      for (const { userId } of panels) {
        clearControlPanel(userId);
      }
      await interaction.reply({ content: "👋 已離開語音頻道", ephemeral: true });
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
 * Update control panel message
 */
async function updateControlPanelMessage(
  interaction: ButtonInteraction,
  guildId: string
): Promise<void> {
  try {
    const content = buildControlPanelContent(guildId);
    const buttons = buildMusicButtons(guildId);
    await interaction.message.edit({ content, components: [buttons] });
  } catch (error) {
    logger.debug({ error, guildId }, "Failed to update control panel message");
  }
}
