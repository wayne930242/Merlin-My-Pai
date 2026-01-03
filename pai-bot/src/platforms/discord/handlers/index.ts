/**
 * Discord Message Handlers
 *
 * Re-exports all handler functions from submodules.
 */

import type { Client } from "discord.js";
import { logger } from "../../../utils/logger";
import {
  setOnTrackChange,
  getGuildControlPanels,
  setControlPanel,
} from "../voice";
import { buildMusicButtons, buildControlPanelContent } from "./music-panel";
import { setDiscordClient } from "./slash-commands/voice";

// Discord client reference
let discordClient: Client | null = null;

/**
 * Initialize task executor with Discord client
 */
export function initializeTaskExecutor(client: Client): void {
  discordClient = client;
  setDiscordClient(client);

  // Set track change callback to update control panels
  setOnTrackChange(async (guildId, item) => {
    const panels = getGuildControlPanels(guildId);
    for (const { userId, panel } of panels) {
      try {
        const channel = await client.channels.fetch(panel.channelId);
        if (channel?.isTextBased() && "messages" in channel && "send" in channel) {
          // Delete old message
          try {
            const oldMessage = await channel.messages.fetch(panel.messageId);
            await oldMessage.delete();
          } catch {
            // Ignore delete errors
          }

          // Send new message
          const content = buildControlPanelContent(guildId);
          const buttons = buildMusicButtons(guildId);
          const newMessage = await channel.send({ content, components: [buttons] });

          // Update record
          setControlPanel(userId, {
            messageId: newMessage.id,
            channelId: panel.channelId,
            guildId,
          });
        }
      } catch (error) {
        logger.debug({ error, panel }, "Failed to update control panel");
      }
    }
  });
}

// Re-export handlers
export { handleMessage } from "./message";
export { handleInteraction } from "./interactions";
export { handleSlashCommand } from "./slash-commands";
export { handleAttachment } from "./attachments";
