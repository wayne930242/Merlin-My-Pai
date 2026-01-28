/**
 * Discord Slash Commands Registration
 */

import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// Slash commands definition
const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("顯示指令列表"),
  new SlashCommandBuilder().setName("bind").setDescription("綁定此頻道"),
  new SlashCommandBuilder().setName("unbind").setDescription("解綁此頻道"),
  new SlashCommandBuilder().setName("channels").setDescription("查看已綁定頻道"),
  new SlashCommandBuilder().setName("clear").setDescription("清除對話歷史"),
  new SlashCommandBuilder().setName("memory").setDescription("查看長期記憶"),
  new SlashCommandBuilder().setName("forget").setDescription("清除長期記憶"),
  new SlashCommandBuilder().setName("status").setDescription("查看狀態"),
  new SlashCommandBuilder().setName("stop").setDescription("中斷當前任務"),
  new SlashCommandBuilder().setName("hq").setDescription("設定為管理中心"),
  // Voice commands
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("加入語音頻道"),
  new SlashCommandBuilder().setName("leave").setDescription("離開語音頻道"),
  // new SlashCommandBuilder().setName("spotify").setDescription("啟動/停止 Spotify Connect"),
  new SlashCommandBuilder()
    .setName("say")
    .setDescription("讓 Bot 在語音頻道說話（TTS）")
    .addStringOption((option) =>
      option.setName("text").setDescription("要說的文字").setRequired(true),
    ),
  new SlashCommandBuilder().setName("panel").setDescription("顯示擲骰面板"),
  new SlashCommandBuilder()
    .setName("roll")
    .setDescription("擲骰子 (例: d20, 2d6+3)")
    .addStringOption((option) =>
      option.setName("dice").setDescription("骰子表達式 (例: d20, 2d6+3)").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("record")
    .setDescription("開始語音錄音"),
].map((cmd) => cmd.toJSON());

/**
 * Register slash commands with Discord API (global)
 */
export async function registerSlashCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(config.discord.token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    logger.info("Discord slash commands registered");
  } catch (error) {
    logger.error({ error }, "Failed to register slash commands");
  }
}

/**
 * Register slash commands to a specific guild (instant)
 */
export async function registerGuildCommands(clientId: string, guildId: string): Promise<void> {
  const rest = new REST().setToken(config.discord.token);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: slashCommands });
    logger.info({ guildId }, "Discord guild slash commands registered");
  } catch (error) {
    logger.error({ error, guildId }, "Failed to register guild slash commands");
  }
}
