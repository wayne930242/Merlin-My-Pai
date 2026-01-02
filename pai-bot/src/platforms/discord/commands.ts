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
].map(cmd => cmd.toJSON());

/**
 * Register slash commands with Discord API
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
