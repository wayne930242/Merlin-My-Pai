/**
 * Voice Slash Commands (join, leave, play, skip, vstop, queue, np, say, panel)
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
  clearControlPanel,
  getGuildControlPanels,
  speakTts,
} from "../../voice";
import { buildPanelContent, buildPanelComponents, type PanelMode } from "../panels";

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

  const result = await joinChannel(voiceChannel);

  if (result.ok) {
    const content = buildPanelContent("player", interaction.guildId!);
    const components = buildPanelComponents("player", interaction.guildId!);
    const reply = await interaction.editReply({
      content,
      components,
    });

    setControlPanel(discordUserId, {
      messageId: reply.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId!,
      mode: "player",
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
  await interaction.reply("Left voice channel");
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

    const joinResult = await joinChannel(voiceChannel);
    if (!joinResult.ok) {
      await interaction.editReply(`Unable to join: ${joinResult.error}`);
      return;
    }
    needControlPanel = true;
  } else {
    await interaction.deferReply();
  }

  const result = await playMusic(interaction.guildId, query);

  if (result.ok) {
    const queue = getQueue(interaction.guildId);
    const queueInfo = queue.length > 0 ? ` (Queue: ${queue.length})` : "";

    if (needControlPanel) {
      const content = buildPanelContent("player", interaction.guildId);
      const components = buildPanelComponents("player", interaction.guildId);
      const reply = await interaction.editReply({
        content,
        components,
      });

      setControlPanel(discordUserId, {
        messageId: reply.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        mode: "player",
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
    await interaction.reply("Skipped");
  } else {
    await interaction.reply({ content: "Nothing playing", ephemeral: true });
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
    await interaction.reply("Stopped and cleared queue");
  } else {
    await interaction.reply({ content: "Nothing playing", ephemeral: true });
  }
}

export async function handleQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const queue = getQueue(interaction.guildId);

  if (queue.length === 0) {
    await interaction.reply("Queue is empty");
    return;
  }

  const lines = queue.slice(0, 10).map((item, i) =>
    `${i + 1}. **${item.title}** [${item.duration}]`
  );

  if (queue.length > 10) {
    lines.push(`\n... +${queue.length - 10} more`);
  }

  await interaction.reply(`**Queue** (${queue.length}):\n${lines.join("\n")}`);
}

export async function handleNowPlaying(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const nowPlaying = getNowPlaying(interaction.guildId);
  if (nowPlaying) {
    await interaction.reply(`Now playing: **${nowPlaying.title}** [${nowPlaying.duration}]`);
  } else {
    await interaction.reply({ content: "Nothing playing", ephemeral: true });
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
    await interaction.editReply(`Said: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`);
  } else {
    await interaction.editReply(`TTS failed: ${result.error}`);
  }
}

export async function handlePanel(
  interaction: ChatInputCommandInteraction,
  discordUserId: string
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", ephemeral: true });
    return;
  }

  const modeInput = interaction.options.getString("mode")?.toLowerCase();
  let mode: PanelMode = "dice";
  if (modeInput === "player" || modeInput === "p") mode = "player";
  else if (modeInput === "sound" || modeInput === "soundboard" || modeInput === "s") mode = "soundboard";
  else if (modeInput === "dice" || modeInput === "d") mode = "dice";

  // Dice mode doesn't require voice channel
  if (mode === "dice") {
    const content = buildPanelContent(mode, interaction.guildId);
    const components = buildPanelComponents(mode, interaction.guildId);
    await interaction.reply({ content, components });

    setControlPanel(discordUserId, {
      messageId: interaction.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      mode,
    });
    return;
  }

  // Player and Soundboard modes require voice channel
  if (!isInVoiceChannel(interaction.guildId)) {
    // Try to auto-join
    const member = await interaction.guild!.members.fetch(discordUserId);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: "請先加入語音頻道，或使用 /join",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const joinResult = await joinChannel(voiceChannel);
    if (!joinResult.ok) {
      await interaction.editReply(`無法加入: ${joinResult.error}`);
      return;
    }

    const content = buildPanelContent(mode, interaction.guildId);
    const components = buildPanelComponents(mode, interaction.guildId);
    const reply = await interaction.editReply({ content, components });

    setControlPanel(discordUserId, {
      messageId: reply.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      mode,
    });
  } else {
    const content = buildPanelContent(mode, interaction.guildId);
    const components = buildPanelComponents(mode, interaction.guildId);
    const reply = await interaction.reply({ content, components, fetchReply: true });

    setControlPanel(discordUserId, {
      messageId: reply.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      mode,
    });
  }
}
