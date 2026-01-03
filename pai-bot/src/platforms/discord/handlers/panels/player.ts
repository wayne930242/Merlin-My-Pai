/**
 * Player Panel (Music Control)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { getQueue, getNowPlaying } from "../../voice";
import { buildModeSwitcher } from "./mode-switcher";

/**
 * Build music control buttons
 */
export function buildPlayerButtons(guildId: string): ActionRowBuilder<ButtonBuilder> {
  const queue = getQueue(guildId);
  const nowPlaying = getNowPlaying(guildId);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:prev:${guildId}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setLabel("Skip")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying && queue.length === 0),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setLabel("Stop")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying && queue.length === 0),
    new ButtonBuilder()
      .setCustomId(`music:leave:${guildId}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Build queue select menu
 */
export function buildQueueSelectMenu(
  guildId: string
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const queue = getQueue(guildId);

  if (queue.length === 0) {
    return null;
  }

  // Discord 限制最多 25 個選項
  const items = queue.slice(0, 25);

  const options = items.map((item, index) => {
    const label = truncateTitle(item.title, 90);
    return {
      label: `${index + 1}. ${label}`,
      description: item.duration,
      value: `${index}`,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`music:select:${guildId}`)
    .setPlaceholder("Select a song...")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
}

/**
 * Build player panel content
 */
export function buildPlayerContent(guildId: string): string {
  const nowPlaying = getNowPlaying(guildId);
  const queue = getQueue(guildId);

  let content = "**[Player]**\n\n";

  if (nowPlaying) {
    content += `Now Playing: **${truncateTitle(nowPlaying.title, 50)}**`;
    if (nowPlaying.duration !== "?:??") {
      content += ` [${nowPlaying.duration}]`;
    }
  } else {
    content += "Not playing";
  }

  if (queue.length > 0) {
    content += `\n\nQueue (${queue.length}):\n`;
    const displayQueue = queue.slice(0, 5);
    content += displayQueue
      .map((item, i) => `${i + 1}. ${truncateTitle(item.title, 40)}`)
      .join("\n");
    if (queue.length > 5) {
      content += `\n... +${queue.length - 5} more`;
    }
  }

  return content;
}

/**
 * Build all components for player panel
 */
export function buildPlayerComponents(
  guildId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  // Mode switcher (top)
  components.push(buildModeSwitcher(guildId, "player") as ActionRowBuilder<MessageActionRowComponentBuilder>);

  // Queue select menu
  const selectMenu = buildQueueSelectMenu(guildId);
  if (selectMenu) {
    components.push(selectMenu as ActionRowBuilder<MessageActionRowComponentBuilder>);
  }

  // Control buttons
  components.push(buildPlayerButtons(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>);

  return components;
}

/**
 * Truncate title to fit Discord limits
 */
function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 3) + "...";
}
