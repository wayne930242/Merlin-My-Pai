/**
 * Discord Bot Setup
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Message,
  type Interaction,
} from "discord.js";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { isAuthorized } from "./auth";
import { handleMessage, handleInteraction, handleSlashCommand, handleAttachment, initializeTaskExecutor } from "./handlers";
import { isChannelBound } from "./channels";
import { registerSlashCommands } from "./commands";
import { initChannelContextTable, recordChannelMessage } from "./context";

/**
 * 檢查訊息是否為 mention 或 reply to bot
 */
function isBotMentionOrReply(message: Message, botId: string): boolean {
  // Check if message mentions the bot
  if (message.mentions.users.has(botId)) {
    return true;
  }

  // Check if message is a reply to bot's message
  if (message.reference?.messageId) {
    // We'll check the referenced message's author in the handler
    return true;
  }

  return false;
}

export function createDiscordBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // Ready event
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ username: readyClient.user.tag }, "Discord bot started");
    initializeTaskExecutor(client);
    // Initialize channel context table
    initChannelContextTable();
    // Register slash commands
    await registerSlashCommands(readyClient.user.id);
  });

  // Message handler
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bot messages (but record them for context)
    if (message.author.bot) {
      // Record bot's own messages in bound channels for context
      if (message.author.id === client.user?.id && isChannelBound(message.channel.id)) {
        recordChannelMessage(
          message.channel.id,
          message.author.id,
          message.author.username,
          message.content.slice(0, 500), // Limit content length
          true
        );
      }
      return;
    }

    const isDM = !message.guild;
    const channelId = message.channel.id;
    const isBound = isChannelBound(channelId);
    const botId = client.user?.id || "";

    // Check if this is a mention or reply to bot (for unbound channels)
    let isMentionOrReply = false;
    if (!isDM && !isBound && botId) {
      // Check direct mention
      if (message.mentions.users.has(botId)) {
        isMentionOrReply = true;
      }
      // Check reply to bot
      if (message.reference?.messageId) {
        try {
          const refMessage = await message.fetchReference();
          if (refMessage.author.id === botId) {
            isMentionOrReply = true;
          }
        } catch {
          // Ignore fetch errors
        }
      }
    }

    // Record messages in bound channels (from any user)
    if (isBound) {
      recordChannelMessage(
        channelId,
        message.author.id,
        message.author.username,
        message.content.slice(0, 500),
        false
      );
    }

    // Check user authorization for responding
    const isUserAuthorized = isAuthorized(message.author.id);

    // If not authorized, don't respond (but message is already recorded above)
    if (!isUserAuthorized) {
      return;
    }

    // Determine if we should respond:
    // 1. DM - always respond
    // 2. Bound channel - always respond
    // 3. Mention/reply in unbound channel - respond
    // 4. /bind command - allow in any channel
    const isBindCommand = message.content.trim().toLowerCase().startsWith("/bind");
    const shouldRespond = isDM || isBound || isMentionOrReply || isBindCommand;

    if (!shouldRespond) {
      return;
    }

    // Determine context mode
    // Channel mode: bound channel or mention/reply
    // User mode: DM
    const isChannelMode = !isDM && (isBound || isMentionOrReply);

    // Handle attachments (files, images, voice)
    if (message.attachments.size > 0) {
      await handleAttachment(message, isChannelMode);
      return;
    }

    await handleMessage(message, isChannelMode);
  });

  // Interaction handler (for buttons and slash commands)
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Check authorization
    if (!isAuthorized(interaction.user.id)) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: "Unauthorized", ephemeral: true });
      }
      return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    // Handle buttons
    if (interaction.isButton()) {
      await handleInteraction(interaction);
    }
  });

  return client;
}

export async function startDiscordBot(client: Client): Promise<void> {
  await client.login(config.discord.token);
}

export function stopDiscordBot(client: Client): void {
  client.destroy();
  logger.info("Discord bot stopped");
}
