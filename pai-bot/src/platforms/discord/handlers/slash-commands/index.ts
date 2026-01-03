/**
 * Slash Commands Router
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { isChannelBound } from "../../channels";
import { hashToNumeric } from "../../context";
import { toNumericId } from "../utils";

// General commands
import {
  handleHelp,
  handleClear,
  handleStatus,
  handleStop,
  handleMemory,
  handleForget,
  handleHQ,
} from "./general";

// Channel commands
import { handleBind, handleUnbind, handleChannels } from "./channel";

// Voice commands
import {
  handleJoin,
  handleLeave,
  handlePlay,
  handleSkip,
  handleVStop,
  handleQueue,
  handleNowPlaying,
  handleSay,
} from "./voice";

/**
 * Handle slash commands
 */
export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordUserId = interaction.user.id;
  const channelId = interaction.channelId;
  const isDM = !interaction.guildId;
  const isBound = isChannelBound(channelId);
  const isChannelMode = !isDM && isBound;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId);
  const command = interaction.commandName;

  switch (command) {
    // General commands
    case "help":
      await handleHelp(interaction);
      break;

    case "clear":
      await handleClear(interaction, sessionKey);
      break;

    case "status":
      await handleStatus(interaction, sessionKey, isChannelMode, channelId, discordUserId);
      break;

    case "stop":
      await handleStop(interaction, sessionKey);
      break;

    case "memory":
      await handleMemory(interaction, userId);
      break;

    case "forget":
      await handleForget(interaction, userId);
      break;

    case "hq":
      await handleHQ(interaction, sessionKey, isChannelMode, discordUserId, channelId);
      break;

    // Channel commands
    case "bind":
      await handleBind(interaction, discordUserId);
      break;

    case "unbind":
      await handleUnbind(interaction, discordUserId);
      break;

    case "channels":
      await handleChannels(interaction);
      break;

    // Voice commands
    case "join":
      await handleJoin(interaction, discordUserId);
      break;

    case "leave":
      await handleLeave(interaction);
      break;

    case "play":
      await handlePlay(interaction, discordUserId);
      break;

    case "skip":
      await handleSkip(interaction);
      break;

    case "vstop":
      await handleVStop(interaction);
      break;

    case "queue":
      await handleQueue(interaction);
      break;

    case "np":
      await handleNowPlaying(interaction);
      break;

    case "say":
      await handleSay(interaction);
      break;

    default:
      await interaction.reply("Unknown command");
  }
}
