/**
 * Voice Slash Commands (join, leave, play, skip, vstop, queue, np, say)
 */

import type { ChatInputCommandInteraction, Client } from "discord.js";
import {
  joinChannel,
  leaveChannel,
  playMusic,
  skip,
  stop as stopVoice,
  getQueue,
  isInVoiceChannel,
  getNowPlaying,
  setControlPanel,
  getControlPanel,
  clearControlPanel,
  getGuildControlPanels,
  speakTts,
} from "../../voice";
import { buildMusicButtons, buildControlPanelContent } from "../music-panel";

// Discord client reference (set by index.ts)
let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

export async function handleJoin(
  interaction: ChatInputCommandInteraction,
  discordUserId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(discordUserId);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({ content: "請先加入一個語音頻道", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  // Check if user has control panel in another guild
  const existingPanel = getControlPanel(discordUserId);
  if (existingPanel && existingPanel.guildId !== interaction.guildId) {
    leaveChannel(existingPanel.guildId);
    try {
      const oldChannel = await discordClient?.channels.fetch(existingPanel.channelId);
      if (oldChannel?.isTextBased() && "messages" in oldChannel) {
        const oldMessage = await oldChannel.messages.fetch(existingPanel.messageId);
        await oldMessage.delete();
      }
    } catch {
      // Ignore delete errors
    }
    clearControlPanel(discordUserId);
  }

  const result = await joinChannel(voiceChannel);

  if (result.ok) {
    const content = buildControlPanelContent(interaction.guildId!);
    const buttons = buildMusicButtons(interaction.guildId!);
    const reply = await interaction.editReply({
      content,
      components: [buttons],
    });

    setControlPanel(discordUserId, {
      messageId: reply.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId!,
    });
  } else {
    await interaction.editReply(`無法加入: ${result.error}`);
  }
}

export async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({ content: "Bot 不在語音頻道中", ephemeral: true });
    return;
  }

  const panels = getGuildControlPanels(interaction.guildId);
  for (const { userId } of panels) {
    clearControlPanel(userId);
  }

  leaveChannel(interaction.guildId);
  await interaction.reply("👋 已離開語音頻道");
}

export async function handlePlay(
  interaction: ChatInputCommandInteraction,
  discordUserId: string
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const query = interaction.options.getString("query", true);
  let needControlPanel = false;

  // Auto-join if not in voice channel
  if (!isInVoiceChannel(interaction.guildId)) {
    const member = await interaction.guild!.members.fetch(discordUserId);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({ content: "請先加入一個語音頻道，或使用 /join", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const existingPanel = getControlPanel(discordUserId);
    if (existingPanel && existingPanel.guildId !== interaction.guildId) {
      leaveChannel(existingPanel.guildId);
      try {
        const oldChannel = await discordClient?.channels.fetch(existingPanel.channelId);
        if (oldChannel?.isTextBased() && "messages" in oldChannel) {
          const oldMessage = await oldChannel.messages.fetch(existingPanel.messageId);
          await oldMessage.delete();
        }
      } catch {
        // Ignore delete errors
      }
      clearControlPanel(discordUserId);
    }

    const joinResult = await joinChannel(voiceChannel);
    if (!joinResult.ok) {
      await interaction.editReply(`❌ 無法加入語音頻道: ${joinResult.error}`);
      return;
    }
    needControlPanel = true;
  } else {
    await interaction.deferReply();
  }

  const result = await playMusic(interaction.guildId, query);

  if (result.ok) {
    const queue = getQueue(interaction.guildId);
    const queueInfo = queue.length > 0 ? ` (佇列: ${queue.length} 首)` : "";

    if (needControlPanel) {
      const content = buildControlPanelContent(interaction.guildId);
      const buttons = buildMusicButtons(interaction.guildId);
      const reply = await interaction.editReply({
        content,
        components: [buttons],
      });

      setControlPanel(discordUserId, {
        messageId: reply.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.editReply(`Added: **${result.item.title}**${queueInfo}`);
    }
  } else {
    await interaction.editReply(`Error: ${result.error}`);
  }
}

export async function handleSkip(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({ content: "Bot 不在語音頻道中", ephemeral: true });
    return;
  }

  if (skip(interaction.guildId)) {
    await interaction.reply("⏭️ 已跳過");
  } else {
    await interaction.reply({ content: "沒有正在播放的歌曲", ephemeral: true });
  }
}

export async function handleVStop(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({ content: "Bot 不在語音頻道中", ephemeral: true });
    return;
  }

  if (stopVoice(interaction.guildId)) {
    await interaction.reply("⏹️ 已停止播放並清空佇列");
  } else {
    await interaction.reply({ content: "沒有正在播放的歌曲", ephemeral: true });
  }
}

export async function handleQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const queue = getQueue(interaction.guildId);

  if (queue.length === 0) {
    await interaction.reply("📋 播放佇列為空");
    return;
  }

  const lines = queue.slice(0, 10).map((item, i) =>
    `${i + 1}. **${item.title}** [${item.duration}]`
  );

  if (queue.length > 10) {
    lines.push(`\n...還有 ${queue.length - 10} 首`);
  }

  await interaction.reply(`📋 **播放佇列** (${queue.length} 首):\n${lines.join("\n")}`);
}

export async function handleNowPlaying(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const nowPlaying = getNowPlaying(interaction.guildId);
  if (nowPlaying) {
    await interaction.reply(`🎵 正在播放: **${nowPlaying.title}** [${nowPlaying.duration}]`);
  } else {
    await interaction.reply({ content: "目前沒有播放中的歌曲", ephemeral: true });
  }
}

export async function handleSay(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({ content: "Bot 不在語音頻道中，請先使用 /join", ephemeral: true });
    return;
  }

  const text = interaction.options.getString("text", true);
  await interaction.deferReply();

  const result = await speakTts(interaction.guildId, text);

  if (result.ok) {
    await interaction.editReply(`🎙️ 已說出: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);
  } else {
    await interaction.editReply(`❌ TTS 播放失敗: ${result.error}`);
  }
}
