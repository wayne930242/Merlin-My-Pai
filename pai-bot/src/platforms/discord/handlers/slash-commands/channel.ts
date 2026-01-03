/**
 * Channel Slash Commands (bind, unbind, channels)
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { logger } from "../../../../utils/logger";
import { bindChannel, unbindChannel, isChannelBound, getBoundChannels } from "../../channels";

export async function handleBind(
  interaction: ChatInputCommandInteraction,
  discordUserId: string
): Promise<void> {
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;

  if (isChannelBound(channelId)) {
    await interaction.reply("This channel is already bound");
    return;
  }

  if (bindChannel(channelId, guildId, discordUserId)) {
    await interaction.reply(`Channel bound: <#${channelId}>`);
    logger.info({ channelId, guildId, boundBy: discordUserId }, "Discord channel bound");
  } else {
    await interaction.reply("Failed to bind channel");
  }
}

export async function handleUnbind(
  interaction: ChatInputCommandInteraction,
  discordUserId: string
): Promise<void> {
  const channelId = interaction.channelId;

  if (!isChannelBound(channelId)) {
    await interaction.reply("This channel is not bound");
    return;
  }

  if (unbindChannel(channelId)) {
    await interaction.reply("Channel unbound");
    logger.info({ channelId, unboundBy: discordUserId }, "Discord channel unbound");
  } else {
    await interaction.reply("Failed to unbind channel");
  }
}

export async function handleChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  const channels = getBoundChannels();
  if (channels.length === 0) {
    await interaction.reply("No channels bound");
    return;
  }

  const lines = channels.map((c) => `- <#${c.channel_id}>`);
  await interaction.reply(`**Bound Channels** (${channels.length}):\n${lines.join("\n")}`);
}
