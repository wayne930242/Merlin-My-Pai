/**
 * Discord Bot Setup
 */

// 全域 Discord client 參考（用於自動停止錄音等場景）
let discordClient: Client | null = null;

/**
 * 取得 Discord client
 */
export function getDiscordClient(): Client | null {
  return discordClient;
}

import {
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
  type Message,
  MessageFlags,
  Partials,
} from "discord.js";
import { config } from "../../config";
import { migrateDatabase } from "../../storage/migrate";
import { logger } from "../../utils/logger";
import { isAuthorized } from "./auth";
import { isChannelBound } from "./channels";
import { registerSlashCommands } from "./commands";
import {
  handleAttachment,
  handleButtonInteraction,
  handleMessage,
  handleModalSubmit,
  handleSelectMenuInteraction,
  handleSlashCommand,
  initializeTaskExecutor,
} from "./handlers";

/**
 * 檢查訊息是否為 mention 或 reply to bot
 */
function _isBotMentionOrReply(message: Message, botId: string): boolean {
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
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // 儲存全域 client 參考
  discordClient = client;

  // Error handlers
  client.on(Events.Error, (error) => {
    logger.error({ error }, "Discord client error");
  });

  client.on(Events.Warn, (warning) => {
    logger.warn({ warning }, "Discord client warning");
  });

  // Ready event
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ username: readyClient.user.tag }, "Discord bot started");

    // Run database migrations
    migrateDatabase();

    initializeTaskExecutor(client);
    // Register slash commands
    await registerSlashCommands(readyClient.user.id);
  });

  // Message handler
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bot messages
    if (message.author.bot) {
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

    // Check user authorization for responding
    const isUserAuthorized = isAuthorized(message.author.id);

    // If not authorized, don't respond
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
    // Skip auth for dice interactions (TRPG mode - anyone can roll)
    const shouldSkipAuth =
      (interaction.isButton() && interaction.customId.startsWith("dice:")) ||
      (interaction.isModalSubmit() && interaction.customId.startsWith("dice:"));

    // Check authorization
    if (!shouldSkipAuth && !isAuthorized(interaction.user.id)) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: "Unauthorized", flags: MessageFlags.Ephemeral });
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
      await handleButtonInteraction(interaction);
      return;
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }

    // Handle modal submits
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
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
