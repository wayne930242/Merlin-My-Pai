/**
 * Discord Handler Utilities
 */

import type { Message, TextBasedChannel } from "discord.js";

/**
 * Convert Discord user ID to numeric ID for storage
 * Discord IDs are snowflakes (strings), we hash them to numbers
 */
export function toNumericId(discordId: string): number {
  return Number(BigInt(discordId) % BigInt(Number.MAX_SAFE_INTEGER));
}

/**
 * Check if channel is sendable
 */
export function isSendableChannel(
  channel: TextBasedChannel
): channel is Extract<TextBasedChannel, { send: (content: string) => Promise<Message> }> {
  return "send" in channel && typeof (channel as any).send === "function";
}

/**
 * Safe send message to channel
 */
export async function safeSend(channel: TextBasedChannel, content: string): Promise<void> {
  if (isSendableChannel(channel)) {
    await channel.send(content);
  }
}

/**
 * Split message into chunks (Discord has 2000 char limit)
 */
export function splitMessage(text: string, maxLength: number): string[] {
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
