/**
 * Discord Voice Module
 * 語音頻道功能：加入、播放音樂、TTS
 */

import {
  type AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  type VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { logger } from "../../utils/logger";

// Spotify Connect 設定 (disabled)
// const LIBRESPOT_PATH = "/home/pai/.cargo/bin/librespot";
// const LIBRESPOT_CACHE = "/home/pai/.cache/librespot";
// const SPOTIFY_DEVICE_NAME = "Merlin DJ";

// TTS 設定
const TTS_VOICE = "zh-TW-YunJheNeural"; // 台灣男聲（雲哲）
const TTS_TEMP_DIR = "/tmp/pai-tts";

interface GuildQueue {
  connection: VoiceConnection;
  player: AudioPlayer;
  playing: boolean;
  channelId: string;
  // librespotProc: ReturnType<typeof Bun.spawn> | null;
  // spotifyConnected: boolean;
  volume: number; // 0-100
  muted: boolean;
  volumeResource: { setVolume: (v: number) => void } | null;
}

// Default volume
const DEFAULT_VOLUME = 100;

// Per-guild voice state
const guildQueues = new Map<string, GuildQueue>();

// Track reconnect sessions to cancel stale reconnects
const reconnectSessions = new Map<string, number>();

/**
 * 加入語音頻道
 */
export async function joinChannel(
  channel: VoiceBasedChannel,
): Promise<{ ok: true; connection: VoiceConnection } | { ok: false; error: string }> {
  try {
    const guildId = channel.guild.id;

    // Cancel any ongoing reconnect attempts
    const sessionId = Date.now();
    reconnectSessions.set(guildId, sessionId);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false, // 需要接收音訊（錄音功能）
    });

    // Wait for connection to be ready
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const player = createAudioPlayer();

    // Handle player state changes
    player.on(AudioPlayerStatus.Idle, () => {
      const guildQueue = guildQueues.get(channel.guild.id);
      if (guildQueue) {
        guildQueue.playing = false;
      }
    });

    player.on("error", (error) => {
      logger.error({ error }, "Audio player error");
    });

    // 監聽連接狀態變化，自動重連（最多 3 次）
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      const guildId = channel.guild.id;
      // const guildQueue = guildQueues.get(guildId);
      // const wasSpotifyConnected = guildQueue?.spotifyConnected ?? false;

      // Record current session to detect if a new join happens during reconnect
      const mySession = reconnectSessions.get(guildId) ?? 0;

      logger.warn({ guildId }, "Voice connection disconnected");

      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Check if a new connection was established (user manually rejoined)
        if (reconnectSessions.get(guildId) !== mySession) {
          logger.info({ guildId }, "New connection detected, cancelling reconnect");
          return;
        }

        try {
          logger.info({ guildId, attempt, maxRetries: MAX_RETRIES }, "Attempting to reconnect");

          // 嘗試等待重新連接（5 秒）
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);

          // 等待連接完全就緒
          await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
          logger.info({ guildId, attempt }, "Voice connection ready after reconnect");

          // Spotify Connect auto-restart disabled
          // if (wasSpotifyConnected) {
          //   logger.info({ guildId }, "Auto-restarting Spotify Connect after reconnect");
          //   const result = await startSpotifyConnect(guildId);
          //   if (!result.ok) {
          //     logger.error(
          //       { guildId, error: result.error },
          //       "Failed to auto-restart Spotify Connect",
          //     );
          //   }
          // }
          return; // 成功，退出
        } catch {
          logger.warn({ guildId, attempt, maxRetries: MAX_RETRIES }, "Reconnect attempt failed");
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 2000)); // 等 2 秒再試
          }
        }
      }

      // Check again before cleanup
      if (reconnectSessions.get(guildId) !== mySession) {
        logger.info({ guildId }, "New connection detected, skipping cleanup");
        return;
      }

      // 3 次都失敗，清理資源
      logger.info({ guildId }, "All reconnect attempts failed, cleaning up");
      connection.destroy();
      guildQueues.delete(guildId);
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info({ guildId: channel.guild.id }, "Voice connection destroyed");
      guildQueues.delete(channel.guild.id);
    });

    connection.subscribe(player);

    guildQueues.set(channel.guild.id, {
      connection,
      player,
      playing: false,
      channelId: channel.id,
      // librespotProc: null,
      // spotifyConnected: false,
      volume: DEFAULT_VOLUME,
      muted: false,
      volumeResource: null,
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
    // Stop Spotify Connect if running (disabled)
    // if (guildQueue.librespotProc) {
    //   guildQueue.librespotProc.kill();
    //   guildQueue.librespotProc = null;
    //   guildQueue.spotifyConnected = false;
    // }
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

// /**
//  * 啟動 Spotify Connect (librespot) - DISABLED
//  */
// export async function startSpotifyConnect(
//   guildId: string,
// ): Promise<{ ok: true } | { ok: false; error: string }> {
//   const guildQueue = guildQueues.get(guildId);
//   if (!guildQueue) {
//     return { ok: false, error: "Bot 不在語音頻道中，請先使用 /join" };
//   }
//
//   // 如果已經在運行，先停止
//   if (guildQueue.librespotProc) {
//     guildQueue.librespotProc.kill();
//     guildQueue.librespotProc = null;
//   }
//
//   try {
//     // 先殺掉所有舊的 librespot 進程，避免累積
//     try {
//       Bun.spawnSync(["pkill", "-9", "librespot"]);
//     } catch {
//       // ignore
//     }
//
//     // 啟動 librespot，使用 cached credentials
//     const proc = Bun.spawn(
//       [
//         LIBRESPOT_PATH,
//         "--name",
//         SPOTIFY_DEVICE_NAME,
//         "--cache",
//         LIBRESPOT_CACHE,
//         "--backend",
//         "pipe",
//         "--initial-volume",
//         "100",
//         "--enable-volume-normalisation",
//         "--normalisation-pregain",
//         "1",
//         "--format",
//         "S16",
//         "--bitrate",
//         "160",
//       ],
//       {
//         stdout: "pipe",
//         stderr: "pipe",
//       },
//     );
//
//     guildQueue.librespotProc = proc;
//     guildQueue.spotifyConnected = true;
//
//     // 將 librespot 輸出串流到 Discord
//     const nodeStream = await import("node:stream");
//     const readable = nodeStream.Readable.fromWeb(proc.stdout as any);
//
//     const resource = createAudioResource(readable, {
//       inputType: StreamType.Raw,
//       inlineVolume: true,
//     });
//
//     // 保存音量控制引用
//     if (resource.volume) {
//       guildQueue.volumeResource = resource.volume;
//       const vol = guildQueue.muted ? 0 : guildQueue.volume / 100;
//       resource.volume.setVolume(vol);
//       logger.info({ volume: guildQueue.volume, actualVolume: vol }, "Volume resource initialized");
//     } else {
//       logger.warn("Volume resource not available - inlineVolume may not be working");
//     }
//
//     guildQueue.player.play(resource);
//     guildQueue.playing = true;
//
//     logger.info({ deviceName: SPOTIFY_DEVICE_NAME }, "Spotify Connect started");
//
//     // 監聽 librespot stderr（狀態訊息）
//     (async () => {
//       if (!proc.stderr) return;
//       const reader = proc.stderr.getReader();
//       const decoder = new TextDecoder();
//       let errorCount = 0;
//
//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//
//         const line = decoder.decode(value);
//         // 解析 librespot 日誌
//         if (line.includes("now playing")) {
//           logger.info({ line: line.trim() }, "Spotify now playing");
//           errorCount = 0; // Reset on successful playback
//         } else if (line.includes("audio key error") || line.includes("Service unavailable")) {
//           errorCount++;
//           logger.warn({ line: line.trim(), errorCount }, "Librespot auth error");
//
//           // Auto-recover: clear audio cache (not credentials) and restart after 3 consecutive errors
//           if (errorCount >= 3) {
//             logger.info({ guildId }, "Too many auth errors, clearing audio cache and restarting");
//             proc.kill();
//
//             // Clear only audio cache (files/), keep credentials.json
//             const fs = await import("node:fs/promises");
//             try {
//               await fs.rm(`${LIBRESPOT_CACHE}/files`, { recursive: true, force: true });
//             } catch {
//               // ignore
//             }
//
//             // Restart after a short delay
//             setTimeout(() => {
//               if (guildQueues.has(guildId)) {
//                 startSpotifyConnect(guildId);
//               }
//             }, 2000);
//             return;
//           }
//         } else if (line.includes("ERROR") || line.includes("error")) {
//           logger.warn({ line: line.trim() }, "Librespot warning");
//         }
//       }
//     })();
//
//     // 監聽進程結束
//     proc.exited.then((code) => {
//       logger.info({ code }, "Librespot process ended");
//       if (guildQueue.librespotProc === proc) {
//         guildQueue.librespotProc = null;
//         guildQueue.spotifyConnected = false;
//         guildQueue.playing = false;
//       }
//     });
//
//     return { ok: true };
//   } catch (error) {
//     logger.error({ error }, "Failed to start Spotify Connect");
//     return { ok: false, error: String(error) };
//   }
// }
//
// /**
//  * 停止 Spotify Connect
//  */
// export function stopSpotifyConnect(guildId: string): boolean {
//   const guildQueue = guildQueues.get(guildId);
//   if (!guildQueue || !guildQueue.librespotProc) {
//     return false;
//   }
//
//   guildQueue.librespotProc.kill();
//   guildQueue.librespotProc = null;
//   guildQueue.spotifyConnected = false;
//   guildQueue.player.stop();
//   guildQueue.playing = false;
//
//   logger.info({ guildId }, "Spotify Connect stopped");
//   return true;
// }
//
// /**
//  * 檢查 Spotify Connect 狀態
//  */
// export function isSpotifyConnected(guildId: string): boolean {
//   const guildQueue = guildQueues.get(guildId);
//   return guildQueue?.spotifyConnected ?? false;
// }

/**
 * 檢查 bot 是否在語音頻道中（驗證連接狀態）
 */
export function isInVoiceChannel(guildId: string): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (guildQueue) {
    // 驗證連接狀態是否有效
    const status = guildQueue.connection.state.status;
    if (status === VoiceConnectionStatus.Ready || status === VoiceConnectionStatus.Signalling) {
      return true;
    }
    // 連接無效，清理
    logger.warn({ guildId, status }, "Invalid voice connection state, cleaning up");
    guildQueues.delete(guildId);
  }

  // 檢查是否有獨立的連接（不在 guildQueues 中）
  const connection = getVoiceConnection(guildId);
  if (connection) {
    const status = connection.state.status;
    return status === VoiceConnectionStatus.Ready || status === VoiceConnectionStatus.Signalling;
  }

  return false;
}

/**
 * 取得語音頻道資訊
 */
export function getVoiceChannelInfo(guildId: string): {
  inVoice: boolean;
  channelId: string | null;
} {
  const guildQueue = guildQueues.get(guildId);
  if (guildQueue) {
    return { inVoice: true, channelId: guildQueue.channelId };
  }
  return { inVoice: false, channelId: null };
}

/**
 * 確保 TTS 暫存目錄存在
 */
async function ensureTtsTempDir(): Promise<void> {
  const fs = await import("node:fs/promises");
  try {
    await fs.mkdir(TTS_TEMP_DIR, { recursive: true });
  } catch {
    // ignore if exists
  }
}

/**
 * 使用 edge-tts 生成語音並播放
 */
export async function speakTts(
  guildId: string,
  text: string,
  options?: { voice?: string; interrupt?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) {
    return { ok: false, error: "Bot 不在語音頻道中" };
  }

  const voice = options?.voice || TTS_VOICE;
  const interrupt = options?.interrupt ?? true;

  try {
    await ensureTtsTempDir();

    // 生成唯一檔名
    const filename = `${TTS_TEMP_DIR}/tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;

    // 使用 edge-tts 生成音頻
    const proc = Bun.spawn(
      ["edge-tts", "--voice", voice, "--text", text, "--write-media", filename],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr as ReadableStream).text();
      logger.error({ stderr, exitCode }, "edge-tts failed");
      return { ok: false, error: `TTS 生成失敗: ${stderr}` };
    }

    // 如果設定中斷，先暫停目前播放
    if (interrupt && guildQueue.playing) {
      guildQueue.player.stop();
      guildQueue.playing = false;
    }

    // 播放 TTS 音頻
    const fs = await import("node:fs");
    const readable = fs.createReadStream(filename);

    const resource = createAudioResource(readable, {
      inputType: StreamType.Arbitrary,
    });

    // 等待 TTS 播放完成
    await new Promise<void>((resolve, reject) => {
      const onIdle = () => {
        guildQueue.player.off(AudioPlayerStatus.Idle, onIdle);
        guildQueue.player.off("error", onError);
        resolve();
      };

      const onError = (error: Error) => {
        guildQueue.player.off(AudioPlayerStatus.Idle, onIdle);
        guildQueue.player.off("error", onError);
        reject(error);
      };

      guildQueue.player.on(AudioPlayerStatus.Idle, onIdle);
      guildQueue.player.on("error", onError);
      guildQueue.player.play(resource);
    });

    // 清理暫存檔
    const fsPromises = await import("node:fs/promises");
    await fsPromises.unlink(filename).catch(() => {});

    logger.info({ text: text.slice(0, 50), voice }, "TTS played");
    return { ok: true };
  } catch (error) {
    logger.error({ error, text }, "TTS playback failed");
    return { ok: false, error: String(error) };
  }
}

/**
 * 播放本地音效檔案
 */
export async function playSoundEffect(
  guildId: string,
  filePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) {
    return { ok: false, error: "Bot 不在語音頻道中" };
  }

  try {
    const fs = await import("node:fs");
    const fsPromises = await import("node:fs/promises");

    // Check if file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return { ok: false, error: `音效檔案不存在: ${filePath}` };
    }

    const readable = fs.createReadStream(filePath);
    const resource = createAudioResource(readable, {
      inputType: StreamType.Arbitrary,
    });

    guildQueue.player.play(resource);
    logger.info({ filePath }, "Sound effect played");
    return { ok: true };
  } catch (error) {
    logger.error({ error, filePath }, "Sound effect playback failed");
    return { ok: false, error: String(error) };
  }
}

// ============================================================================
// Volume Control
// ============================================================================

export interface VolumeState {
  volume: number;
  muted: boolean;
}

/**
 * 取得音量狀態
 */
export function getVolumeState(guildId: string): VolumeState | null {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) return null;
  return { volume: guildQueue.volume, muted: guildQueue.muted };
}

/**
 * 設定音量 (0-100)
 */
export function setVolume(guildId: string, volume: number): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) return false;

  guildQueue.volume = Math.max(0, Math.min(100, volume));
  if (!guildQueue.muted && guildQueue.volumeResource) {
    const actualVol = guildQueue.volume / 100;
    guildQueue.volumeResource.setVolume(actualVol);
    logger.info({ guildId, volume: guildQueue.volume, actualVol }, "Volume set");
  } else {
    logger.warn(
      {
        guildId,
        volume: guildQueue.volume,
        muted: guildQueue.muted,
        hasResource: !!guildQueue.volumeResource,
      },
      "Volume set but not applied",
    );
  }
  return true;
}

/**
 * 調整音量 (+/- delta)
 */
export function adjustVolume(guildId: string, delta: number): number | null {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) return null;

  const newVolume = Math.max(0, Math.min(100, guildQueue.volume + delta));
  setVolume(guildId, newVolume);
  return newVolume;
}

/**
 * 靜音/取消靜音
 */
export function toggleMute(guildId: string): boolean | null {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) return null;

  guildQueue.muted = !guildQueue.muted;
  if (guildQueue.volumeResource) {
    guildQueue.volumeResource.setVolume(guildQueue.muted ? 0 : guildQueue.volume / 100);
  }
  logger.info({ guildId, muted: guildQueue.muted }, "Mute toggled");
  return guildQueue.muted;
}

/**
 * 淡出 (fade out)
 */
export async function fadeOut(guildId: string, durationMs: number = 2000): Promise<boolean> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue || !guildQueue.volumeResource) return false;

  const startVolume = guildQueue.muted ? 0 : guildQueue.volume;
  const steps = 20;
  const stepDuration = durationMs / steps;
  const volumeStep = startVolume / steps;

  for (let i = steps; i >= 0; i--) {
    const currentVolume = (i * volumeStep) / 100;
    guildQueue.volumeResource.setVolume(currentVolume);
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
  }

  guildQueue.muted = true;
  logger.info({ guildId, durationMs }, "Fade out complete");
  return true;
}

/**
 * 淡入 (fade in)
 */
export async function fadeIn(guildId: string, durationMs: number = 2000): Promise<boolean> {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue || !guildQueue.volumeResource) return false;

  const targetVolume = guildQueue.volume;
  const steps = 20;
  const stepDuration = durationMs / steps;
  const volumeStep = targetVolume / steps;

  guildQueue.muted = false;

  for (let i = 0; i <= steps; i++) {
    const currentVolume = (i * volumeStep) / 100;
    guildQueue.volumeResource.setVolume(currentVolume);
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
  }

  logger.info({ guildId, durationMs, targetVolume }, "Fade in complete");
  return true;
}

/**
 * 重置音量到預設值
 */
export function resetVolume(guildId: string): boolean {
  const guildQueue = guildQueues.get(guildId);
  if (!guildQueue) return false;

  guildQueue.volume = DEFAULT_VOLUME;
  guildQueue.muted = false;
  if (guildQueue.volumeResource) {
    guildQueue.volumeResource.setVolume(DEFAULT_VOLUME / 100);
  }
  logger.info({ guildId, volume: DEFAULT_VOLUME }, "Volume reset");
  return true;
}
