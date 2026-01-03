/**
 * Discord Voice Module
 * 語音頻道功能：加入、播放音樂、TTS
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  type VoiceConnection,
  type AudioPlayer,
  StreamType,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { logger } from "../../utils/logger";

const COBALT_API = "https://api.cobalt.tools";

interface QueueItem {
  url: string;
  title: string;
  duration: string;
}

interface GuildQueue {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: QueueItem[];
  playing: boolean;
  channelId: string;
}

// Per-guild voice state
const guildQueues = new Map<string, GuildQueue>();

/**
 * 加入語音頻道
 */
export async function joinChannel(
  channel: VoiceBasedChannel
): Promise<{ ok: true; connection: VoiceConnection } | { ok: false; error: string }> {
  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    // Wait for connection to be ready
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const player = createAudioPlayer();

    // Handle player state changes
    player.on(AudioPlayerStatus.Idle, () => {
      const guildQueue = guildQueues.get(channel.guild.id);
      if (guildQueue && guildQueue.queue.length > 0) {
        playNext(channel.guild.id);
      } else if (guildQueue) {
        guildQueue.playing = false;
      }
    });

    player.on("error", (error) => {
      logger.error({ error }, "Audio player error");
      const guildQueue = guildQueues.get(channel.guild.id);
      if (guildQueue && guildQueue.queue.length > 0) {
        playNext(channel.guild.id);
      }
    });

    connection.subscribe(player);

    guildQueues.set(channel.guild.id, {
      connection,
      player,
      queue: [],
      playing: false,
      channelId: channel.id,
    });

    logger.info({ channel: channel.name, guild: channel.guild.name }, "Joined voice channel");

    return { ok: true, connection };
  } catch (error) {
    logger.error({ error }, "Failed to join voice channel");
    return { ok: false, error: String(error) };
  }
}

/**
 * 離開語音頻道
 */
export function leaveChannel(guildId: string): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (guildQueue) {
    guildQueue.player.stop();
    guildQueue.connection.destroy();
    guildQueues.delete(guildId);
    logger.info({ guildId }, "Left voice channel");
    return true;
  }

  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    return true;
  }

  return false;
}

/**
 * 使用 Cobalt API 獲取音訊 URL
 */
async function getCobaltStream(url: string): Promise<{ ok: true; streamUrl: string; title: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(COBALT_API, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        audioFormat: "opus",
        isAudioOnly: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, "Cobalt API error");
      return { ok: false, error: `Cobalt API 錯誤: ${response.status}` };
    }

    const data = await response.json() as { status: string; url?: string; filename?: string; error?: string };

    if (data.status === "error") {
      return { ok: false, error: data.error || "未知錯誤" };
    }

    if (data.status === "redirect" || data.status === "tunnel") {
      const title = data.filename?.replace(/\.[^/.]+$/, "") || "Unknown";
      return { ok: true, streamUrl: data.url!, title };
    }

    return { ok: false, error: "無法獲取音訊串流" };
  } catch (error) {
    logger.error({ error }, "Cobalt fetch failed");
    return { ok: false, error: String(error) };
  }
}

/**
 * 搜尋 YouTube（使用 Piped API）
 */
async function searchYouTube(query: string): Promise<string | null> {
  // 多個 Piped 實例作為備援
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.yt",
    "https://pipedapi.in.projectsegfau.lt",
  ];

  for (const instance of pipedInstances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json() as { items?: Array<{ url?: string }> };
      if (!data.items || data.items.length === 0) continue;

      const firstVideo = data.items[0];
      if (!firstVideo.url) continue;

      // Piped 返回 /watch?v=xxx 格式
      const videoId = firstVideo.url.replace("/watch?v=", "");
      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 播放 YouTube 音樂
 */
export async function playMusic(
  guildId: string,
  query: string
): Promise<{ ok: true; item: QueueItem } | { ok: false; error: string }> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) {
    return { ok: false, error: "Bot 不在語音頻道中，請先使用 /join" };
  }

  try {
    // 判斷是 URL 還是搜尋關鍵字
    let url = query;
    if (!query.startsWith("http")) {
      const searchResult = await searchYouTube(query);
      if (!searchResult) {
        return { ok: false, error: "找不到相關影片，請嘗試提供完整 YouTube 連結" };
      }
      url = searchResult;
    }

    // 使用 Cobalt 獲取串流
    const result = await getCobaltStream(url);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const item: QueueItem = {
      url: result.streamUrl,
      title: result.title,
      duration: "?:??",
    };

    guildQueue.queue.push(item);

    // Start playing if not already
    if (!guildQueue.playing) {
      await playNext(guildId);
    }

    return { ok: true, item };
  } catch (error) {
    logger.error({ error, query }, "Failed to play music");
    return { ok: false, error: `播放失敗: ${String(error)}` };
  }
}

/**
 * 播放下一首
 */
async function playNext(guildId: string): Promise<void> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue || guildQueue.queue.length === 0) {
    return;
  }

  const item = guildQueue.queue.shift()!;

  try {
    // Cobalt 返回的是直接的音訊 URL，用 fetch 獲取串流
    const response = await fetch(item.url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }

    // 將 Web ReadableStream 轉換為 Node.js Readable
    const nodeStream = await import("node:stream");
    const readable = nodeStream.Readable.fromWeb(response.body as any);

    const resource = createAudioResource(readable, {
      inputType: StreamType.Arbitrary,
    });

    guildQueue.player.play(resource);
    guildQueue.playing = true;

    logger.info({ title: item.title }, "Now playing");
  } catch (error) {
    logger.error({ error, item }, "Failed to play next track");
    // Try next song
    if (guildQueue.queue.length > 0) {
      await playNext(guildId);
    } else {
      guildQueue.playing = false;
    }
  }
}

/**
 * 跳過目前歌曲
 */
export function skip(guildId: string): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) {
    return false;
  }

  guildQueue.player.stop();
  return true;
}

/**
 * 停止播放並清空佇列
 */
export function stop(guildId: string): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) {
    return false;
  }

  guildQueue.queue = [];
  guildQueue.player.stop();
  guildQueue.playing = false;
  return true;
}

/**
 * 取得目前佇列
 */
export function getQueue(guildId: string): QueueItem[] {
  const guildQueue = guildQueues.get(guildId);
  return guildQueue?.queue || [];
}

/**
 * 檢查 bot 是否在語音頻道中
 */
export function isInVoiceChannel(guildId: string): boolean {
  return guildQueues.has(guildId) || !!getVoiceConnection(guildId);
}

/**
 * 取得語音頻道資訊
 */
export function getVoiceChannelInfo(guildId: string): { inVoice: boolean; channelId: string | null } {
  const guildQueue = guildQueues.get(guildId);
  if (guildQueue) {
    return { inVoice: true, channelId: guildQueue.channelId };
  }
  return { inVoice: false, channelId: null };
}

/**
 * 取得目前正在播放的項目
 */
export function getNowPlaying(guildId: string): QueueItem | null {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue || !guildQueue.playing) {
    return null;
  }
  // The currently playing item was already shifted from queue
  // We need to track it separately - for now return null
  return null;
}
