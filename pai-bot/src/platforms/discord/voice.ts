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

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_COOKIES_PATH = "/home/pai/youtube-cookies.txt";

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
  currentItem: QueueItem | null;
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
        guildQueue.currentItem = null;
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
      currentItem: null,
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
 * 使用 YouTube Data API 搜尋影片
 */
async function searchYouTube(query: string): Promise<{ ok: true; url: string; title: string } | { ok: false; error: string }> {
  if (!YOUTUBE_API_KEY) {
    return { ok: false, error: "YouTube API key 未設定" };
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "1",
      key: YOUTUBE_API_KEY,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, "YouTube API error");
      return { ok: false, error: `YouTube API 錯誤: ${response.status}` };
    }

    const data = await response.json();
    const items = data.items;

    if (!items || items.length === 0) {
      return { ok: false, error: `找不到「${query}」` };
    }

    const video = items[0];
    return {
      ok: true,
      url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      title: video.snippet.title,
    };
  } catch (error) {
    logger.error({ error }, "YouTube search error");
    return { ok: false, error: String(error) };
  }
}

/**
 * 取得影片資訊（YouTube API 搜尋 + 直接 URL）
 * 不再使用 yt-dlp 取得 metadata（會被 YouTube 封鎖）
 */
async function getVideoInfo(query: string): Promise<{ ok: true; url: string; title: string; duration: string } | { ok: false; error: string }> {
  try {
    // 如果是 URL 直接使用
    if (query.startsWith("http")) {
      // 從 URL 中提取 video ID 作為標題（簡化處理）
      const videoId = query.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1] || "Video";
      return {
        ok: true,
        url: query,
        title: `YouTube Video (${videoId})`,
        duration: "?:??",
      };
    }

    // 使用 YouTube API 搜尋
    const searchResult = await searchYouTube(query);
    if (!searchResult.ok) {
      return searchResult;
    }

    return {
      ok: true,
      url: searchResult.url,
      title: searchResult.title,
      duration: "?:??", // YouTube API search doesn't return duration
    };
  } catch (error) {
    logger.error({ error }, "getVideoInfo error");
    return { ok: false, error: String(error) };
  }
}

/**
 * 使用 yt-dlp 獲取音訊串流
 */
function createYtdlpStream(url: string): ReturnType<typeof Bun.spawn> {
  return Bun.spawn([
    "yt-dlp",
    "--cookies", YOUTUBE_COOKIES_PATH,
    "--remote-components", "ejs:github",
    "-f", "bestaudio",
    "-o", "-",
    "--quiet",
    url,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });
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
    // 使用 yt-dlp 獲取影片資訊（支援搜尋和 URL）
    const result = await getVideoInfo(query);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const item: QueueItem = {
      url: result.url,
      title: result.title,
      duration: result.duration,
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
  guildQueue.currentItem = item;

  try {
    // 使用 yt-dlp 串流音訊
    const proc = createYtdlpStream(item.url);

    // 將 Bun 的 ReadableStream 轉換為 Node.js Readable
    const nodeStream = await import("node:stream");
    const readable = nodeStream.Readable.fromWeb(proc.stdout as any);

    const resource = createAudioResource(readable, {
      inputType: StreamType.Arbitrary,
    });

    guildQueue.player.play(resource);
    guildQueue.playing = true;

    logger.info({ title: item.title }, "Now playing");

    // 監聯 yt-dlp 錯誤
    proc.exited.then(async (code) => {
      if (code !== 0 && proc.stderr) {
        const stderr = await new Response(proc.stderr as ReadableStream).text();
        logger.error({ stderr, code, url: item.url }, "yt-dlp stream error");
      }
    });
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
  guildQueue.currentItem = null;
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
  return guildQueue.currentItem;
}
