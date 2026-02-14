/**
 * General Slash Commands (help, clear, status, stop, memory, forget, hq)
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { abortUserProcess } from "../../../../claude/client";
import { queueManager } from "../../../../claude/queue-manager";
import { config } from "../../../../config";
import { contextManager } from "../../../../context/manager";
import { memoryManager } from "../../../../memory";
import { renderWorkspaceSnapshot } from "../../../../services/workspace-tree";
import { sessionService } from "../../../../storage/sessions";
import { logger } from "../../../../utils/logger";
import { splitMessage } from "../utils";

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply(
    `**Merlin**\n\n` +
      `Commands:\n` +
      `- \`/bind\` - 綁定此頻道\n` +
      `- \`/unbind\` - 解綁此頻道\n` +
      `- \`/channels\` - 查看已綁定頻道\n` +
      `- \`/clear\` - 清除對話歷史\n` +
      `- \`/memory\` - 查看長期記憶\n` +
      `- \`/workspace\` - 顯示 workspace 樹狀結構\n` +
      `- \`/forget\` - 清除長期記憶\n` +
      `- \`/status\` - 查看狀態\n` +
      `- \`/stop\` - 中斷當前任務`,
  );
}

export async function handleClear(
  interaction: ChatInputCommandInteraction,
  sessionKey: number,
): Promise<void> {
  contextManager.clearHistory(sessionKey);
  await interaction.reply("Conversation history cleared");
}

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  sessionKey: number,
  isChannelMode: boolean,
  channelId: string,
  discordUserId: string,
): Promise<void> {
  const messageCount = contextManager.getMessageCount(sessionKey);
  const { queueSize, isProcessing } = queueManager.getStatus(sessionKey);
  const modeInfo = isChannelMode ? `Channel: <#${channelId}>` : `User: \`${discordUserId}\``;
  await interaction.reply(
    `**Status**\n\n` +
      `- Mode: ${isChannelMode ? "Channel" : "DM"}\n` +
      `- ${modeInfo}\n` +
      `- Messages: ${messageCount}\n` +
      `- Processing: ${isProcessing ? "Yes" : "No"}\n` +
      `- Queued: ${queueSize}`,
  );
}

export async function handleStop(
  interaction: ChatInputCommandInteraction,
  sessionKey: number,
): Promise<void> {
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
}

export async function handleMemory(
  interaction: ChatInputCommandInteraction,
  userId: number,
): Promise<void> {
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

  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp(chunks[i]);
  }
}

export async function handleWorkspace(interaction: ChatInputCommandInteraction): Promise<void> {
  const output = await renderWorkspaceSnapshot(config.claude.projectDir, {
    maxDepth: 3,
    maxEntries: 120,
  });

  const chunks = splitMessage(output, 1800);
  await interaction.reply(`\`\`\`\n${chunks[0]}\n\`\`\``);

  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp(`\`\`\`\n${chunks[i]}\n\`\`\``);
  }
}

export async function handleForget(
  interaction: ChatInputCommandInteraction,
  userId: number,
): Promise<void> {
  if (!config.memory.enabled) {
    await interaction.reply("Memory feature is disabled");
    return;
  }

  const archived = memoryManager.archiveByUser(userId);
  await interaction.reply(`Archived ${archived} memories (can be recovered via MCP)`);
}

export async function handleHQ(
  interaction: ChatInputCommandInteraction,
  sessionKey: number,
  isChannelMode: boolean,
  discordUserId: string,
  channelId: string,
): Promise<void> {
  sessionService.upsert({
    sessionId: sessionKey,
    platform: "discord",
    platformUserId: isChannelMode ? undefined : discordUserId,
    channelId,
    guildId: interaction.guildId || undefined,
    sessionType: isChannelMode ? "channel" : "dm",
  });

  const success = sessionService.setHQ(sessionKey);
  if (success) {
    await interaction.reply("✅ 已設定此對話為管理中心（HQ）\n系統通知將發送至此處");
  } else {
    await interaction.reply("❌ 設定失敗");
  }
}
