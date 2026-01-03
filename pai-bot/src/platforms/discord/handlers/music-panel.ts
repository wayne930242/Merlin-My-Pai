/**
 * Music Control Panel UI
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { getQueue, getNowPlaying, type QueueItem } from "../voice";

/**
 * Build music control buttons
 */
export function buildMusicButtons(guildId: string): ActionRowBuilder<ButtonBuilder> {
  const queue = getQueue(guildId);
  const nowPlaying = getNowPlaying(guildId);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:prev:${guildId}`)
      .setLabel("⏮")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setLabel("⏭")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying && queue.length === 0),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setLabel("⏹")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!nowPlaying && queue.length === 0),
    new ButtonBuilder()
      .setCustomId(`music:leave:${guildId}`)
      .setLabel("👋")
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
    .setPlaceholder("選擇要播放的歌曲...")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
}

/**
 * Build control panel content (message text)
 */
export function buildControlPanelContent(guildId: string): string {
  const nowPlaying = getNowPlaying(guildId);
  const queue = getQueue(guildId);

  let content = "";

  if (nowPlaying) {
    content += `🎵 **${truncateTitle(nowPlaying.title, 60)}**`;
    if (nowPlaying.duration !== "?:??") {
      content += ` [${nowPlaying.duration}]`;
    }
  } else {
    content += "⏸️ 未播放";
  }

  if (queue.length > 0) {
    content += `\n\n📋 **播放佇列** (${queue.length} 首):\n`;
    const displayQueue = queue.slice(0, 5);
    content += displayQueue
      .map((item, i) => `${i + 1}. ${truncateTitle(item.title, 50)}`)
      .join("\n");
    if (queue.length > 5) {
      content += `\n... 還有 ${queue.length - 5} 首`;
    }
  }

  return content;
}

/**
 * Build all components for control panel
 */
export function buildControlPanelComponents(
  guildId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  // Add select menu if queue has items
  const selectMenu = buildQueueSelectMenu(guildId);
  if (selectMenu) {
    components.push(selectMenu as ActionRowBuilder<MessageActionRowComponentBuilder>);
  }

  // Add control buttons
  components.push(buildMusicButtons(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>);

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
