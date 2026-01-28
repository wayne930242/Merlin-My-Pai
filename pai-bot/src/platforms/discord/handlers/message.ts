/**
 * Discord Message Handling
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type TextBasedChannel,
} from "discord.js";
import { hasActiveProcess, streamClaude } from "../../../claude/client";
import { type QueuedTask, queueManager } from "../../../claude/queue-manager";
import { config } from "../../../config";
import { contextManager } from "../../../context/manager";
import { extractAndSaveMemories, formatMemoriesForPrompt, memoryManager } from "../../../memory";
import { sessionService } from "../../../storage/sessions";
import { logger } from "../../../utils/logger";
import { buildSessionContext } from "../../../utils/session";
import { formatChannelContext, getChannelContext, hashToNumeric } from "../context";
import { getVoiceChannelInfo } from "../voice";
import { handleCommand } from "./commands";
import { isSendableChannel, safeSend, splitMessage, toNumericId } from "./utils";

// Global memory user ID (shared across all platforms)
const MEMORY_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0] || "0", 10);

// Decision timeout (ms)
const DECISION_TIMEOUT_MS = 10000;

// Pending decisions map
const pendingDecisions = new Map<
  string,
  {
    taskId: string;
    messageId: string;
    channelId: string;
    timeoutId: ReturnType<typeof setTimeout>;
  }
>();

/**
 * Execute Claude task and send response
 */
export async function executeClaudeTask(
  task: QueuedTask,
  channel: TextBasedChannel,
): Promise<void> {
  if (!isSendableChannel(channel)) return;

  const { userId, prompt, history } = task;
  let currentText = "";

  try {
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

  const finalContent = currentText.trim();
  if (finalContent) {
    const chunks = splitMessage(finalContent, 2000);
    for (const chunk of chunks) {
      await channel.send(chunk);
    }

    contextManager.saveMessage(userId, "assistant", finalContent);

    if (config.memory.enabled) {
      // Use global memory user ID for cross-platform memory sharing
      extractAndSaveMemories(MEMORY_USER_ID, task.prompt, finalContent).catch((error) => {
        logger.warn({ error, userId: MEMORY_USER_ID }, "Memory extraction failed");
      });
    }
  }
}

/**
 * Prepare task data
 */
export async function prepareTask(
  discordUserId: string,
  channelId: string,
  text: string,
  prompt: string,
  isChannelMode: boolean = false,
  channel?: TextBasedChannel,
  messageId?: string,
  guildId?: string,
): Promise<QueuedTask> {
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId);

  contextManager.saveMessage(sessionKey, "user", text, messageId);
  const history = contextManager.getConversationContext(sessionKey);
  const existingMessageIds = contextManager.getMessageIds(sessionKey);

  let channelContext = "";
  if (isChannelMode && channel) {
    const channelMessages = await getChannelContext(channel, [], existingMessageIds);
    // 傳入主人的 Discord ID，用於在上下文中標示
    const selfId = config.discord.allowedUserIds[0];
    channelContext = formatChannelContext(channelMessages, selfId);
  }

  let memoryContext = "";
  if (config.memory.enabled) {
    try {
      // Use global memory user ID for cross-platform memory sharing
      const memories = await memoryManager.search(MEMORY_USER_ID, text, 5);
      if (memories.length > 0) {
        memoryContext = formatMemoriesForPrompt(memories);
        logger.debug({ memoryUserId: MEMORY_USER_ID, memoryCount: memories.length }, "Retrieved memories");
      }
    } catch (error) {
      logger.warn({ error, memoryUserId: MEMORY_USER_ID }, "Memory search failed");
    }
  }

  const sessionType = isChannelMode ? "channel" : "dm";
  const voiceContext = guildId ? getVoiceChannelInfo(guildId) : undefined;
  const sessionContext = buildSessionContext(sessionKey, "discord", sessionType, {
    voice: voiceContext,
  });

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
    userId: sessionKey,
    chatId: sessionKey,
    prompt,
    history: fullHistory,
    memoryContext,
    createdAt: new Date(),
  };
}

/**
 * Handle incoming message
 */
export async function handleMessage(
  message: Message,
  isChannelMode: boolean = false,
): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const guildId = message.guild?.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);

  sessionService.upsert({
    sessionId: sessionKey,
    platform: "discord",
    platformUserId: isChannelMode ? undefined : discordUserId,
    channelId,
    guildId,
    sessionType: isChannelMode ? "channel" : "dm",
  });

  let text = message.content;
  if (message.mentions.users.size > 0) {
    text = text.replace(/<@!?\d+>/g, "").trim();
  }

  if (!text) return;

  if (text.startsWith("/")) {
    await handleCommand(message, text, isChannelMode);
    return;
  }

  const task = await prepareTask(
    discordUserId,
    channelId,
    text,
    text,
    isChannelMode,
    message.channel,
    message.id,
    guildId,
  );
  const isProcessing = queueManager.isProcessing(sessionKey) || hasActiveProcess(sessionKey);

  if (isProcessing) {
    if (isChannelMode) {
      const queueSize = queueManager.getQueueLength(sessionKey);
      await message.reply(`Queued (position: ${queueSize + 1})`);

      queueManager
        .enqueue(task, async (t) => {
          await executeClaudeTask(t, message.channel);
        })
        .catch((error) => {
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
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await message.reply({
      content: `Task in progress${queueInfo}. Choose:`,
      components: [row],
    });

    queueManager.storePendingTask(task);

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

      queueManager
        .enqueue(task, async (t) => {
          await executeClaudeTask(t, message.channel);
        })
        .catch((error) => {
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
 * Get pending decisions map (for interaction handler)
 */
export function getPendingDecisions(): typeof pendingDecisions {
  return pendingDecisions;
}
