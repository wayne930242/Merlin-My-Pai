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
} from "../../recording";
import {
  buildRecordingComponents,
  buildRecordingContent,
  clearRecordingPanel,
} from "../panels/recording";
import { logger } from "../../../../utils/logger";

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
