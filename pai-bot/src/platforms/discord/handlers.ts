/**
 * Discord Message Handlers
 */

import {
  type Message,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type TextBasedChannel,
  type Attachment,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { streamClaude } from "../../claude/client";
import { abortUserProcess, hasActiveProcess } from "../../claude/client";
import { queueManager, type QueuedTask } from "../../claude/queue-manager";
import { contextManager } from "../../context/manager";
import { logger } from "../../utils/logger";
import { buildSessionContext } from "../../utils/session";
import { config } from "../../config";
import {
  memoryManager,
  extractAndSaveMemories,
  formatMemoriesForPrompt,
} from "../../memory";
import { bindChannel, unbindChannel, isChannelBound, getBoundChannels } from "./channels";
import { transcribeAudio } from "../../services/transcription";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getChannelContext, formatChannelContext, hashToNumeric } from "./context";
import { sessionService } from "../../storage/sessions";

// Discord client reference
let discordClient: Client | null = null;

// Decision timeout (ms)
const DECISION_TIMEOUT_MS = 10000;

// Pending decisions map
const pendingDecisions = new Map<string, {
  taskId: string;
  messageId: string;
  channelId: string;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

/**
 * Initialize task executor with Discord client
 */
export function initializeTaskExecutor(client: Client): void {
  discordClient = client;
}

/**
 * Convert Discord user ID to numeric ID for storage
 * Discord IDs are snowflakes (strings), we hash them to numbers
 */
function toNumericId(discordId: string): number {
  // Use BigInt to handle large snowflake IDs, then modulo to fit in safe integer
  return Number(BigInt(discordId) % BigInt(Number.MAX_SAFE_INTEGER));
}

/**
 * Check if channel is sendable
 */
function isSendableChannel(channel: TextBasedChannel): channel is Extract<TextBasedChannel, { send: (content: string) => Promise<Message> }> {
  return "send" in channel && typeof (channel as any).send === "function";
}

/**
 * Safe send message to channel
 */
async function safeSend(channel: TextBasedChannel, content: string): Promise<void> {
  if (isSendableChannel(channel)) {
    await channel.send(content);
  }
}

/**
 * Execute Claude task and send response
 */
async function executeClaudeTask(
  task: QueuedTask,
  channel: TextBasedChannel
): Promise<void> {
  if (!isSendableChannel(channel)) return;

  const { userId, prompt, history } = task;

  let currentText = "";

  try {
    // Stream the response
    for await (const event of streamClaude(prompt, {
      conversationHistory: history,
      userId,
    })) {
      if (event.type === "text") {
        currentText = event.content;
      } else if (event.type === "done") {
        currentText = event.content || currentText;
      } else if (event.type === "error") {
        throw new Error(event.content);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await channel.send(`Error: ${errorMessage}`);
    return;
  }

  // Send final response
  const finalContent = currentText.trim();
  if (finalContent) {
    // Discord has 2000 char limit, split if needed
    const chunks = splitMessage(finalContent, 2000);
    for (const chunk of chunks) {
      await channel.send(chunk);
    }

    // Save assistant response
    contextManager.saveMessage(userId, "assistant", finalContent);

    // Extract and save memories asynchronously
    if (config.memory.enabled) {
      extractAndSaveMemories(userId, task.prompt, finalContent).catch((error) => {
        logger.warn({ error, userId }, "Memory extraction failed");
      });
    }
  }
}

/**
 * Split message into chunks
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}

/**
 * Prepare task data
 * @param isChannelMode - If true, use channel-based session key
 */
async function prepareTask(
  discordUserId: string,
  channelId: string,
  text: string,
  prompt: string,
  isChannelMode: boolean = false,
  channel?: TextBasedChannel,
  messageId?: string
): Promise<QueuedTask> {
  // Use channel-based session key for channel mode, user-based for DM
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId); // Keep original userId for memory

  // Save user message with message ID for deduplication
  contextManager.saveMessage(sessionKey, "user", text, messageId);

  // Get conversation context
  const history = contextManager.getConversationContext(sessionKey);

  // Get all message IDs already in conversation history
  const existingMessageIds = contextManager.getMessageIds(sessionKey);

  // Get channel context from Discord API (exclude bot and already-included messages)
  let channelContext = "";
  if (isChannelMode && channel) {
    const channelMessages = await getChannelContext(channel, [], existingMessageIds);
    channelContext = formatChannelContext(channelMessages);
  }

  // Search for relevant memories (use original userId for personal memories)
  let memoryContext = "";
  if (config.memory.enabled) {
    try {
      const memories = await memoryManager.search(userId, text, 5);
      if (memories.length > 0) {
        memoryContext = formatMemoriesForPrompt(memories);
        logger.debug({ userId, memoryCount: memories.length }, "Retrieved memories");
      }
    } catch (error) {
      logger.warn({ error, userId }, "Memory search failed");
    }
  }

  // Build session context for Claude
  const sessionType = isChannelMode ? "channel" : "dm";
  const sessionContext = buildSessionContext(sessionKey, "discord", sessionType);

  // Combine all context: session + memory + conversation history + channel context
  let fullHistory = `${sessionContext}\n${history}`;
  if (channelContext) {
    fullHistory = `${fullHistory}\n\n${channelContext}`;
  }
  if (memoryContext) {
    fullHistory = `${sessionContext}\n${memoryContext}\n\n${history}`;
    if (channelContext) {
      fullHistory = `${fullHistory}\n\n${channelContext}`;
    }
  }

  return {
    id: queueManager.generateTaskId(),
    userId: sessionKey, // Use session key for queue management
    chatId: sessionKey,
    prompt,
    history: fullHistory,
    memoryContext,
    createdAt: new Date(),
  };
}

/**
 * Handle incoming message
 * @param isChannelMode - If true, use channel-based session and force queue
 */
export async function handleMessage(message: Message, isChannelMode: boolean = false): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const guildId = message.guild?.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);

  // 記錄 session 資訊
  sessionService.upsert({
    sessionId: sessionKey,
    platform: "discord",
    platformUserId: isChannelMode ? undefined : discordUserId,
    channelId,
    guildId,
    sessionType: isChannelMode ? "channel" : "dm",
  });

  // Strip bot mention from message content
  let text = message.content;
  if (message.mentions.users.size > 0) {
    // Remove all bot mentions from the text
    text = text.replace(/<@!?\d+>/g, "").trim();
  }

  if (!text) return;

  // Handle commands
  if (text.startsWith("/")) {
    await handleCommand(message, text, isChannelMode);
    return;
  }

  // Prepare task
  const task = await prepareTask(discordUserId, channelId, text, text, isChannelMode, message.channel, message.id);

  // Check if there's an active process
  const isProcessing = queueManager.isProcessing(sessionKey) || hasActiveProcess(sessionKey);

  if (isProcessing) {
    // In channel mode, always auto-queue without interrupt option
    if (isChannelMode) {
      const queueSize = queueManager.getQueueLength(sessionKey);
      await message.reply(`Queued (position: ${queueSize + 1})`);

      queueManager.enqueue(task, async (t) => {
        await executeClaudeTask(t, message.channel);
      }).catch((error) => {
        logger.error({ error, taskId: task.id }, "Queued task failed");
        safeSend(message.channel, `Task failed: ${error.message}`).catch(() => {});
      });
      return;
    }

    // DM mode: show decision buttons
    const queueSize = queueManager.getQueueLength(sessionKey);
    const queueInfo = queueSize > 0 ? ` (queue: ${queueSize})` : "";

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`abort:${task.id}`)
        .setLabel("Interrupt")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`queue:${task.id}`)
        .setLabel("Queue")
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await message.reply({
      content: `Task in progress${queueInfo}. Choose:`,
      components: [row],
    });

    // Store pending task
    queueManager.storePendingTask(task);

    // Set timeout for auto-queue
    const timeoutId = setTimeout(async () => {
      const pending = pendingDecisions.get(discordUserId);
      if (!pending || pending.taskId !== task.id) return;

      pendingDecisions.delete(discordUserId);

      logger.info({ sessionKey, taskId: task.id }, "Auto-queuing due to timeout");

      try {
        await reply.edit({ content: "Auto-queued", components: [] });
      } catch {
        // Ignore edit errors
      }

      queueManager.enqueue(task, async (t) => {
        await executeClaudeTask(t, message.channel);
      }).catch((error) => {
        logger.error({ error, taskId: task.id }, "Queued task failed");
        safeSend(message.channel, `Task failed: ${error.message}`).catch(() => {});
      });
    }, DECISION_TIMEOUT_MS);

    pendingDecisions.set(discordUserId, {
      taskId: task.id,
      messageId: reply.id,
      channelId,
      timeoutId,
    });

    return;
  }

  // No active process, execute immediately
  try {
    await queueManager.executeImmediately(task, async (t) => {
      await executeClaudeTask(t, message.channel);
    });
  } catch (error) {
    logger.error({ error, sessionKey }, "Failed to process message");
    const errorMessage = error instanceof Error ? error.message : String(error);
    await message.reply(`Error: ${errorMessage.slice(0, 100)}`);
  }
}

/**
 * Handle commands
 */
async function handleCommand(message: Message, text: string, isChannelMode: boolean = false): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId); // For memory operations
  const command = text.split(" ")[0].toLowerCase();

  switch (command) {
    case "/start":
    case "/help":
      await message.reply(
        `**Merlin**\n\n` +
        `Commands:\n` +
        `- \`/bind\` - Bind this channel\n` +
        `- \`/unbind\` - Unbind this channel\n` +
        `- \`/channels\` - List bound channels\n` +
        `- \`/clear\` - Clear conversation history\n` +
        `- \`/memory\` - View long-term memories\n` +
        `- \`/forget\` - Clear long-term memories\n` +
        `- \`/status\` - View status\n` +
        `- \`/stop\` - Stop current task`
      );
      break;

    case "/bind": {
      const channelId = message.channel.id;
      const guildId = message.guild?.id || null;

      if (isChannelBound(channelId)) {
        await message.reply("This channel is already bound");
        return;
      }

      if (bindChannel(channelId, guildId, discordUserId)) {
        await message.reply(`Channel bound: <#${channelId}>`);
        logger.info({ channelId, guildId, boundBy: discordUserId }, "Discord channel bound");
      } else {
        await message.reply("Failed to bind channel");
      }
      break;
    }

    case "/unbind": {
      const channelId = message.channel.id;

      if (!isChannelBound(channelId)) {
        await message.reply("This channel is not bound");
        return;
      }

      if (unbindChannel(channelId)) {
        await message.reply("Channel unbound");
        logger.info({ channelId, unboundBy: discordUserId }, "Discord channel unbound");
      } else {
        await message.reply("Failed to unbind channel");
      }
      break;
    }

    case "/channels": {
      const channels = getBoundChannels();
      if (channels.length === 0) {
        await message.reply("No channels bound");
        return;
      }

      const lines = channels.map((c) => `- <#${c.channel_id}>`);
      await message.reply(`**Bound Channels** (${channels.length}):\n${lines.join("\n")}`);
      break;
    }

    case "/clear":
      contextManager.clearHistory(sessionKey);
      await message.reply("Conversation history cleared");
      break;

    case "/status": {
      const messageCount = contextManager.getMessageCount(sessionKey);
      const { queueSize, isProcessing } = queueManager.getStatus(sessionKey);
      const modeInfo = isChannelMode ? `Channel: <#${channelId}>` : `User: \`${discordUserId}\``;
      await message.reply(
        `**Status**\n\n` +
        `- Mode: ${isChannelMode ? "Channel" : "DM"}\n` +
        `- ${modeInfo}\n` +
        `- Messages: ${messageCount}\n` +
        `- Processing: ${isProcessing ? "Yes" : "No"}\n` +
        `- Queued: ${queueSize}`
      );
      break;
    }

    case "/stop": {
      const wasAborted = abortUserProcess(sessionKey);
      const clearedCount = queueManager.clearQueue(sessionKey);

      if (wasAborted || clearedCount > 0) {
        const messages: string[] = [];
        if (wasAborted) messages.push("Task interrupted");
        if (clearedCount > 0) messages.push(`Cleared ${clearedCount} queued tasks`);
        await message.reply(messages.join(", "));
        logger.info({ sessionKey, wasAborted, clearedCount }, "User manually stopped tasks");
      } else {
        await message.reply("No active tasks");
      }
      break;
    }

    case "/memory": {
      if (!config.memory.enabled) {
        await message.reply("Memory feature is disabled");
        return;
      }

      const memories = memoryManager.getRecent(userId, 20);
      const count = memoryManager.count(userId);

      if (memories.length === 0) {
        await message.reply("No long-term memories");
        return;
      }

      const lines = [`**Long-term Memories** (${count} total):\n`];
      for (const m of memories) {
        lines.push(`- [${m.category}] ${m.content}`);
      }

      const content = lines.join("\n");
      const chunks = splitMessage(content, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
      break;
    }

    case "/forget": {
      if (!config.memory.enabled) {
        await message.reply("Memory feature is disabled");
        return;
      }

      const archived = memoryManager.archiveByUser(userId);
      await message.reply(`Archived ${archived} memories (can be recovered via MCP)`);
      break;
    }

    case "/hq": {
      // 確保 session 已記錄
      sessionService.upsert({
        sessionId: sessionKey,
        platform: "discord",
        platformUserId: isChannelMode ? undefined : discordUserId,
        channelId,
        guildId: message.guild?.id,
        sessionType: isChannelMode ? "channel" : "dm",
      });

      // 設定為 HQ
      const success = sessionService.setHQ(sessionKey);
      if (success) {
        await message.reply("✅ 已設定此對話為管理中心（HQ）\n系統通知將發送至此處");
      } else {
        await message.reply("❌ 設定失敗");
      }
      break;
    }

    default:
      // Unknown command, treat as regular message
      await handleMessage({ ...message, content: text.slice(1) } as Message);
  }
}

/**
 * Handle button interactions
 */
export async function handleInteraction(interaction: ButtonInteraction): Promise<void> {
  const data = interaction.customId;
  const discordUserId = interaction.user.id;
  const userId = toNumericId(discordUserId);

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
 * Handle slash commands
 */
export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordUserId = interaction.user.id;
  const channelId = interaction.channelId;
  const isDM = !interaction.guildId;
  const isBound = isChannelBound(channelId);
  const isChannelMode = !isDM && isBound;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId); // For memory operations
  const command = interaction.commandName;

  switch (command) {
    case "help":
      await interaction.reply(
        `**Merlin**\n\n` +
        `Commands:\n` +
        `- \`/bind\` - 綁定此頻道\n` +
        `- \`/unbind\` - 解綁此頻道\n` +
        `- \`/channels\` - 查看已綁定頻道\n` +
        `- \`/clear\` - 清除對話歷史\n` +
        `- \`/memory\` - 查看長期記憶\n` +
        `- \`/forget\` - 清除長期記憶\n` +
        `- \`/status\` - 查看狀態\n` +
        `- \`/stop\` - 中斷當前任務`
      );
      break;

    case "bind": {
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
      break;
    }

    case "unbind": {
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
      break;
    }

    case "channels": {
      const channels = getBoundChannels();
      if (channels.length === 0) {
        await interaction.reply("No channels bound");
        return;
      }

      const lines = channels.map((c) => `- <#${c.channel_id}>`);
      await interaction.reply(`**Bound Channels** (${channels.length}):\n${lines.join("\n")}`);
      break;
    }

    case "clear":
      contextManager.clearHistory(sessionKey);
      await interaction.reply("Conversation history cleared");
      break;

    case "status": {
      const messageCount = contextManager.getMessageCount(sessionKey);
      const { queueSize, isProcessing } = queueManager.getStatus(sessionKey);
      const modeInfo = isChannelMode ? `Channel: <#${channelId}>` : `User: \`${discordUserId}\``;
      await interaction.reply(
        `**Status**\n\n` +
        `- Mode: ${isChannelMode ? "Channel" : "DM"}\n` +
        `- ${modeInfo}\n` +
        `- Messages: ${messageCount}\n` +
        `- Processing: ${isProcessing ? "Yes" : "No"}\n` +
        `- Queued: ${queueSize}`
      );
      break;
    }

    case "stop": {
      const wasAborted = abortUserProcess(sessionKey);
      const clearedCount = queueManager.clearQueue(sessionKey);

      if (wasAborted || clearedCount > 0) {
        const messages: string[] = [];
        if (wasAborted) messages.push("Task interrupted");
        if (clearedCount > 0) messages.push(`Cleared ${clearedCount} queued tasks`);
        await interaction.reply(messages.join(", "));
        logger.info({ sessionKey, wasAborted, clearedCount }, "User manually stopped tasks");
      } else {
        await interaction.reply("No active tasks");
      }
      break;
    }

    case "memory": {
      if (!config.memory.enabled) {
        await interaction.reply("Memory feature is disabled");
        return;
      }

      const memories = memoryManager.getRecent(userId, 20);
      const count = memoryManager.count(userId);

      if (memories.length === 0) {
        await interaction.reply("No long-term memories");
        return;
      }

      const lines = [`**Long-term Memories** (${count} total):\n`];
      for (const m of memories) {
        lines.push(`- [${m.category}] ${m.content}`);
      }

      const content = lines.join("\n");
      const chunks = splitMessage(content, 2000);
      await interaction.reply(chunks[0]);
      // Send remaining chunks as follow-up
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]);
      }
      break;
    }

    case "forget": {
      if (!config.memory.enabled) {
        await interaction.reply("Memory feature is disabled");
        return;
      }

      const archived = memoryManager.archiveByUser(userId);
      await interaction.reply(`Archived ${archived} memories (can be recovered via MCP)`);
      break;
    }

    case "hq": {
      // 確保 session 已記錄
      sessionService.upsert({
        sessionId: sessionKey,
        platform: "discord",
        platformUserId: isChannelMode ? undefined : discordUserId,
        channelId,
        guildId: interaction.guildId || undefined,
        sessionType: isChannelMode ? "channel" : "dm",
      });

      // 設定為 HQ
      const success = sessionService.setHQ(sessionKey);
      if (success) {
        await interaction.reply("✅ 已設定此對話為管理中心（HQ）\n系統通知將發送至此處");
      } else {
        await interaction.reply("❌ 設定失敗");
      }
      break;
    }

    default:
      await interaction.reply("Unknown command");
  }
}

/**
 * Handle attachments (files, images, voice)
 */
export async function handleAttachment(message: Message, isChannelMode: boolean = false): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId); // For logging

  for (const [, attachment] of message.attachments) {
    try {
      const contentType = attachment.contentType || "";
      const isVoice = contentType.startsWith("audio/");
      const isImage = contentType.startsWith("image/");

      // Download the file
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      if (isVoice && config.transcription.enabled) {
        // Handle voice message
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        logger.info({ userId, size: audioBuffer.length, type: contentType }, "Voice downloaded");

        await message.reply("Transcribing...");
        const result = await transcribeAudio(audioBuffer, contentType);

        if (!result.text || result.text === "[無法辨識]") {
          await message.reply("Unable to transcribe voice");
          return;
        }

        // Show transcription
        await message.reply(`🎤 ${result.text}`);

        // Process as message
        const task = await prepareTask(discordUserId, channelId, `[語音訊息] ${result.text}`, result.text, isChannelMode, message.channel, message.id);

        if (!isSendableChannel(message.channel)) return;

        await queueManager.executeImmediately(task, async (t) => {
          await executeClaudeTask(t, message.channel as TextBasedChannel);
        });
      } else {
        // Handle file/image - download and save
        const downloadsDir = resolve(config.workspace.downloadsDir);
        await mkdir(downloadsDir, { recursive: true });

        const fileName = attachment.name || `file_${Date.now()}`;
        const localPath = join(downloadsDir, fileName);

        await Bun.write(localPath, response);
        logger.info({ userId, fileName, localPath }, "File downloaded");

        const typeLabel = isImage ? "圖片" : "檔案";
        const userMessage = `[用戶傳送${typeLabel}: ${fileName}]`;
        const assistantMessage = `已下載至 ${localPath}`;

        contextManager.saveMessage(sessionKey, "user", userMessage);
        contextManager.saveMessage(sessionKey, "assistant", assistantMessage);

        await message.reply(`已下載至 \`${localPath}\``);
      }
    } catch (error) {
      logger.error({ error, sessionKey }, "Failed to process attachment");
      await message.reply("Failed to process attachment");
    }
  }
}
