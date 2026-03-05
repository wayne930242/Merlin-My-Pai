/**
 * Discord Attachment Handler
 */

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Message, TextBasedChannel } from "discord.js";
import { queueManager } from "../../../claude/queue-manager";
import { config } from "../../../config";
import { contextManager } from "../../../context/manager";
import { transcribeAudio } from "../../../services/transcription";
import { logger } from "../../../utils/logger";
import { hashToNumeric } from "../context";
import { executeClaudeTask, prepareTask } from "./message";
import { isSendableChannel, toNumericId } from "./utils";

/**
 * Handle attachments (files, images, voice)
 */
export async function handleAttachment(
  message: Message,
  isChannelMode: boolean = false,
): Promise<void> {
  const discordUserId = message.author.id;
  const channelId = message.channel.id;
  const guildId = message.guild?.id;
  const sessionKey = isChannelMode ? hashToNumeric(channelId) : toNumericId(discordUserId);
  const userId = toNumericId(discordUserId);

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
        const task = await prepareTask(
          discordUserId,
          channelId,
          `[語音訊息] ${result.text}`,
          result.text,
          isChannelMode,
          message.channel,
          message.id,
          guildId,
        );

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

        if (isImage) {
          // Image: trigger Claude processing (Claude can read images via Read tool)
          const caption = message.content?.trim();
          const basePrompt = `[圖片] 用戶傳送了圖片，已下載至 ${localPath}`;
          const prompt = caption ? `${basePrompt}\n用戶附言：${caption}` : basePrompt;

          const task = await prepareTask(
            discordUserId,
            channelId,
            prompt,
            prompt,
            isChannelMode,
            message.channel,
            message.id,
            guildId,
          );

          if (!isSendableChannel(message.channel)) return;

          await queueManager.executeImmediately(task, async (t) => {
            await executeClaudeTask(t, message.channel as TextBasedChannel);
          });
        } else {
          // Non-image file: save path to context only
          const userMessage = `[用戶傳送檔案: ${fileName}]`;
          const assistantMessage = `已下載至 ${localPath}`;

          contextManager.saveMessage(sessionKey, "user", userMessage);
          contextManager.saveMessage(sessionKey, "assistant", assistantMessage);

          await message.reply(`已下載至 \`${localPath}\``);
        }
      }
    } catch (error) {
      logger.error({ error, sessionKey }, "Failed to process attachment");
      await message.reply("Failed to process attachment");
    }
  }
}
