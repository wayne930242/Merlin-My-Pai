/**
 * Voice Slash Commands (join, leave, spotify, say, panel, roll)
 */

import {
  type ChatInputCommandInteraction,
  type Client,
  MessageFlags,
} from "discord.js";
import {
  isInVoiceChannel,
  // isSpotifyConnected,
  joinChannel,
  leaveChannel,
  speakTts,
  // startSpotifyConnect,
  // stopSpotifyConnect,
} from "../../voice";
import {
  buildPanelComponents,
  buildPanelContent,
  // buildVolumeComponents,
  // buildVolumeContent,
  parseAndRoll,
  setDicePanel,
  // setVolumePanel,
} from "../panels";

// Discord client reference (set by index.ts)
let _discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  _discordClient = client;
}

export async function handleJoin(
  interaction: ChatInputCommandInteraction,
  discordUserId: string,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
    return;
  }

  const member = await interaction.guild.members.fetch(discordUserId);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({ content: "請先加入一個語音頻道", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const result = await joinChannel(voiceChannel);

  if (result.ok) {
    await interaction.editReply("✅ 已加入語音頻道");
  } else {
    await interaction.editReply(`無法加入: ${result.error}`);
  }
}

export async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({ content: "Bot 不在語音頻道中", flags: MessageFlags.Ephemeral });
    return;
  }

  leaveChannel(interaction.guildId);
  await interaction.reply("✅ 已離開語音頻道");
}

// export async function handleSpotify(
//   interaction: ChatInputCommandInteraction,
//   discordUserId: string,
// ): Promise<void> {
//   if (!interaction.guildId) {
//     await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
//     return;
//   }
//
//   // Check if already connected
//   if (isSpotifyConnected(interaction.guildId)) {
//     // Stop Spotify Connect
//     stopSpotifyConnect(interaction.guildId);
//     // Clear presence
//     interaction.client.user?.setPresence({ activities: [] });
//     await interaction.reply("🎵 Spotify Connect 已停止");
//     return;
//   }
//
//   // Auto-join if not in voice channel
//   if (!isInVoiceChannel(interaction.guildId)) {
//     const member = await interaction.guild!.members.fetch(discordUserId);
//     const voiceChannel = member.voice.channel;
//
//     if (!voiceChannel) {
//       await interaction.reply({
//         content: "請先加入一個語音頻道，或使用 /join",
//         flags: MessageFlags.Ephemeral,
//       });
//       return;
//     }
//
//     await interaction.deferReply();
//
//     const joinResult = await joinChannel(voiceChannel);
//     if (!joinResult.ok) {
//       await interaction.editReply(`無法加入: ${joinResult.error}`);
//       return;
//     }
//   } else {
//     await interaction.deferReply();
//   }
//
//   const result = await startSpotifyConnect(interaction.guildId);
//
//   if (result.ok) {
//     // Set presence to listening
//     interaction.client.user?.setActivity("Spotify Connect", { type: ActivityType.Listening });
//
//     // Send info message
//     await interaction.editReply(
//       "🎵 **Spotify Connect 已啟動**\n\n" +
//         "在 Spotify app 中選擇 **Merlin DJ** 設備即可播放音樂\n" +
//         "再次使用 `/spotify` 可停止",
//     );
//
//     // Send volume control panel
//     const volumeContent = buildVolumeContent(interaction.guildId);
//     const volumeComponents = buildVolumeComponents(interaction.guildId);
//     const panelMsg = await interaction.followUp({
//       content: volumeContent,
//       components: volumeComponents,
//       fetchReply: true,
//     });
//
//     // Track the volume panel
//     setVolumePanel(interaction.channelId, {
//       messageId: panelMsg.id,
//       channelId: interaction.channelId,
//       guildId: interaction.guildId,
//     });
//   } else {
//     await interaction.editReply(`錯誤: ${result.error}`);
//   }
// }

export async function handleSay(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!isInVoiceChannel(interaction.guildId)) {
    await interaction.reply({
      content: "Bot 不在語音頻道中，請先使用 /join",
      flags: MessageFlags.Ephemeral,
    });
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
  _discordUserId: string,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
    return;
  }

  // Send history message first
  const historyMsg = await interaction.reply({ content: "**擲骰歷史**\n—", fetchReply: true });

  // Send panel message
  const content = buildPanelContent("dice", interaction.guildId);
  const components = buildPanelComponents("dice", interaction.guildId);
  const panelMsg = await interaction.followUp({ content, components, fetchReply: true });

  // Track the dice panel
  setDicePanel(interaction.channelId, {
    historyMessageId: historyMsg.id,
    panelMessageId: panelMsg.id,
    channelId: interaction.channelId,
    gameSystem: "generic",
  });
}

export async function handleRoll(interaction: ChatInputCommandInteraction): Promise<void> {
  const diceExpr = interaction.options.getString("dice", true);
  const result = parseAndRoll(diceExpr);

  if (!result) {
    await interaction.reply({
      content: "無效的骰子表達式。範例: d20, 2d6+3, 3d8-2",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply(result.text);
}
