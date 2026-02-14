/**
 * Discord Text Commands Handler
 */

import type { Message } from "discord.js";
import { abortUserProcess } from "../../../claude/client";
import { queueManager } from "../../../claude/queue-manager";
import { config } from "../../../config";
import { contextManager } from "../../../context/manager";
import { memoryManager } from "../../../memory";
import { renderWorkspaceSnapshot } from "../../../services/workspace-tree";
import { sessionService } from "../../../storage/sessions";
import { logger } from "../../../utils/logger";
import { bindChannel, getBoundChannels, isChannelBound, unbindChannel } from "../channels";
import { hashToNumeric } from "../context";
import { splitMessage, toNumericId } from "./utils";

/**
 * Handle text commands (starting with /)
 */
export async function handleCommand(
  message: Message,
  text: string,
  isChannelMode: boolean = false,
): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId);
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
          `- \`/workspace\` - Show workspace tree\n` +
          `- \`/forget\` - Clear long-term memories\n` +
          `- \`/status\` - View status\n` +
          `- \`/stop\` - Stop current task`,
      );
      break;

    case "/bind": {
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
          `- Queued: ${queueSize}`,
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

    case "/workspace": {
      const output = await renderWorkspaceSnapshot(config.claude.projectDir, {
        maxDepth: 3,
        maxEntries: 120,
      });
      const chunks = splitMessage(output, 1800);
      for (const chunk of chunks) {
        await message.reply(`\`\`\`\n${chunk}\n\`\`\``);
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
      sessionService.upsert({
        sessionId: sessionKey,
        platform: "discord",
        platformUserId: isChannelMode ? undefined : discordUserId,
        channelId,
        guildId: message.guild?.id,
        sessionType: isChannelMode ? "channel" : "dm",
      });

      const success = sessionService.setHQ(sessionKey);
      if (success) {
        await message.reply("✅ 已設定此對話為管理中心（HQ）\n系統通知將發送至此處");
      } else {
        await message.reply("❌ 設定失敗");
      }
      break;
    }

    default: {
      // Unknown command, treat as regular message
      // Import dynamically to avoid circular dependency
      const { handleMessage } = await import("./message");
      await handleMessage({ ...message, content: text.slice(1) } as Message, isChannelMode);
    }
  }
}
