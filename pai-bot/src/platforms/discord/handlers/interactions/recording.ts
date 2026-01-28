/**
 * Recording Interaction Handler
 */

import type { ButtonInteraction } from "discord.js";
import {
  getRecordingSession,
  pauseRecording,
  resumeRecording,
  stopRecording,
  uploadRecording,
  setAutoStopCallback,
} from "../../recording";
import {
  buildRecordingComponents,
  buildRecordingContent,
  clearRecordingPanel,
  getRecordingPanel,
} from "../panels/recording";
import { logger } from "../../../../utils/logger";
import { getDiscordClient } from "../../bot";

// 設定自動停止 callback
setAutoStopCallback(async (guildId: string, reason: string) => {
  const session = getRecordingSession(guildId);
  if (!session) return;

  const panel = getRecordingPanel(guildId);

  const stopResult = await stopRecording(guildId);

  if (stopResult.ok) {
    // 嘗試取得頻道名稱
    const client = getDiscordClient();
    const guild = client?.guilds.cache.get(guildId);
    const voiceChannel = guild?.channels.cache.get(session.channelId);
    const channelName = voiceChannel?.name ?? "auto-stopped";

    const uploadResult = await uploadRecording(stopResult.mp3Path, channelName);

    // 如果有 panel，嘗試更新訊息
    if (panel && client) {
      try {
        const channel = client.channels.cache.get(panel.channelId);
        if (channel?.isTextBased() && "messages" in channel) {
          const message = await channel.messages.fetch(panel.messageId);
          const duration = formatDuration(stopResult.duration);
          if (uploadResult.ok) {
            await message.edit({
              content: `⏹️ **Recording auto-stopped** (${reason})\nDuration: ${duration}\nLink: ${uploadResult.webViewLink}`,
              components: [],
            });
          } else {
            await message.edit({
              content: `⏹️ **Recording auto-stopped** (${reason})\nDuration: ${duration}\n❌ Upload failed: ${uploadResult.error}`,
              components: [],
            });
          }
        }
      } catch (error) {
        logger.warn({ error, guildId }, "Failed to update panel after auto-stop");
      }
    }

    logger.info(
      { guildId, reason, uploaded: uploadResult.ok },
      "Recording auto-stopped"
    );
  }

  clearRecordingPanel(guildId);
});

export async function handleRecordingInteraction(
  interaction: ButtonInteraction,
  action: string,
  guildId: string,
): Promise<void> {
  // Validate guildId matches
  if (interaction.guildId !== guildId) {
    await interaction.reply({ content: "Invalid operation", ephemeral: true });
    return;
  }

  const session = getRecordingSession(guildId);

  if (action === "pause") {
    if (!session) {
      await interaction.reply({ content: "No active recording", ephemeral: true });
      return;
    }

    pauseRecording(guildId);

    // Update panel
    await interaction.update({
      content: buildRecordingContent(guildId),
      components: buildRecordingComponents(guildId),
    });
  } else if (action === "resume") {
    if (!session) {
      await interaction.reply({ content: "No active recording", ephemeral: true });
      return;
    }

    resumeRecording(guildId);

    // Update panel
    await interaction.update({
      content: buildRecordingContent(guildId),
      components: buildRecordingComponents(guildId),
    });
  } else if (action === "stop") {
    if (!session) {
      await interaction.reply({ content: "No active recording", ephemeral: true });
      return;
    }

    await interaction.update({
      content: "⏳ Processing recording and uploading to Google Drive...",
      components: [],
    });

    const stopResult = await stopRecording(guildId);

    if (!stopResult.ok) {
      await interaction.editReply({
        content: `❌ Failed to stop recording: ${stopResult.error}`,
      });
      clearRecordingPanel(guildId);
      return;
    }

    // Get channel name
    const voiceChannel = interaction.guild?.channels.cache.get(session.channelId);
    const channelName = voiceChannel?.name ?? "unknown";

    const uploadResult = await uploadRecording(stopResult.mp3Path, channelName);

    if (uploadResult.ok) {
      const duration = formatDuration(stopResult.duration);
      await interaction.editReply({
        content: `✅ **Recording uploaded**\nDuration: ${duration}\nLink: ${uploadResult.webViewLink}`,
      });
      logger.info(
        { guildId, duration: stopResult.duration, link: uploadResult.webViewLink },
        "Recording uploaded successfully",
      );
    } else {
      await interaction.editReply({
        content: `❌ Upload failed: ${uploadResult.error}`,
      });
    }

    clearRecordingPanel(guildId);
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
