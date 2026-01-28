/**
 * Slash Commands Router
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { isChannelBound } from "../../channels";
import { hashToNumeric } from "../../context";
import { toNumericId } from "../utils";
// Channel commands
import { handleBind, handleChannels, handleUnbind } from "./channel";
// General commands
import {
  handleClear,
  handleForget,
  handleHelp,
  handleHQ,
  handleMemory,
  handleStatus,
  handleStop,
} from "./general";

// Voice commands
import {
  handleJoin,
  handleLeave,
  handlePanel,
  handleRecord,
  handleRoll,
  handleSay,
  // handleSpotify,
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

    // case "spotify":
    //   await handleSpotify(interaction, discordUserId);
    //   break;

    case "say":
      await handleSay(interaction);
      break;

    case "panel":
      await handlePanel(interaction, discordUserId);
      break;

    case "roll":
      await handleRoll(interaction);
      break;

    case "record":
      await handleRecord(interaction, discordUserId);
      break;

    default:
      await interaction.reply("Unknown command");
  }
}
