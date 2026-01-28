/**
 * Discord Voice Recording Module
 * 錄製語音頻道對話，合併多音軌後上傳至 Google Drive
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type VoiceConnection, EndBehaviorType } from "@discordjs/voice";
import prism from "prism-media";
import { logger } from "../../utils/logger";

// 錄音暫存目錄
const RECORDING_TEMP_DIR = "/tmp/pai-recordings";

// Google Drive 錄音資料夾 ID (可透過環境變數設定)
const RECORDINGS_FOLDER_ID = process.env.GOOGLE_DRIVE_RECORDINGS_FOLDER_ID;

export interface UserStream {
  userId: string;
  username: string;
  pcmPath: string;
  startOffset: number; // 相對於錄音開始的毫秒偏移
}

export interface RecordingSession {
  guildId: string;
  channelId: string;
  startTime: Date;
  userStreams: Map<string, UserStream>;
  isActive: boolean;
  isPaused: boolean;
}

// 每個 guild 的錄音 session
const recordingSessions = new Map<string, RecordingSession>();

/**
 * 建立錄音 session
 */
export function createRecordingSession(
  guildId: string,
  channelId: string
): RecordingSession {
  const session: RecordingSession = {
    guildId,
    channelId,
    startTime: new Date(),
    userStreams: new Map(),
    isActive: true,
    isPaused: false,
  };
  recordingSessions.set(guildId, session);
  return session;
}

/**
 * 檢查是否正在錄音
 */
export function isRecording(guildId: string): boolean {
  const session = recordingSessions.get(guildId);
  return session?.isActive ?? false;
}

/**
 * 取得錄音 session
 */
export function getRecordingSession(guildId: string): RecordingSession | null {
  return recordingSessions.get(guildId) ?? null;
}

/**
 * 刪除錄音 session（用於測試和清理）
 */
export function deleteRecordingSession(guildId: string): boolean {
  return recordingSessions.delete(guildId);
}

/**
 * 清理所有 session（用於測試）
 */
export function clearAllSessions(): void {
  recordingSessions.clear();
}

/**
 * 確保暫存目錄存在
 */
async function ensureTempDir(): Promise<void> {
  await mkdir(RECORDING_TEMP_DIR, { recursive: true });
}

/**
 * 開始錄音
 */
export async function startRecording(
  guildId: string,
  channelId: string,
  connection: VoiceConnection
): Promise<{ ok: true; session: RecordingSession } | { ok: false; error: string }> {
  if (isRecording(guildId)) {
    return { ok: false, error: "已在錄音中" };
  }

  try {
    await ensureTempDir();

    const session = createRecordingSession(guildId, channelId);
    const receiver = connection.receiver;

    // 監聽使用者開始說話
    receiver.speaking.on("start", (userId: string) => {
      if (!session.isActive || session.isPaused) return;

      // 避免重複訂閱
      if (session.userStreams.has(userId)) return;

      const startOffset = Date.now() - session.startTime.getTime();
      const pcmPath = join(
        RECORDING_TEMP_DIR,
        `${guildId}-${userId}-${Date.now()}.pcm`
      );

      session.userStreams.set(userId, {
        userId,
        username: "Unknown",
        pcmPath,
        startOffset,
      });

      // 訂閱音訊流
      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000,
        },
      });

      // Opus 解碼器
      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      // 寫入 PCM 檔案
      const writeStream = createWriteStream(pcmPath, { flags: "a" });

      opusStream.pipe(decoder).pipe(writeStream);

      opusStream.on("end", () => {
        logger.debug({ userId, guildId }, "User audio stream ended");
      });

      logger.info({ userId, guildId, pcmPath }, "Started recording user audio");
    });

    logger.info({ guildId, channelId }, "Recording started");
    return { ok: true, session };
  } catch (error) {
    logger.error({ error, guildId }, "Failed to start recording");
    return { ok: false, error: String(error) };
  }
}

/**
 * 停止錄音並合併音軌
 */
export async function stopRecording(
  guildId: string,
): Promise<{ ok: true; mp3Path: string; duration: number } | { ok: false; error: string }> {
  const session = recordingSessions.get(guildId);
  if (!session || !session.isActive) {
    return { ok: false, error: "沒有進行中的錄音" };
  }

  session.isActive = false;
  const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);

  try {
    // 等待所有 stream 寫入完成
    await new Promise((resolve) => setTimeout(resolve, 500));

    const userStreams = Array.from(session.userStreams.values());

    if (userStreams.length === 0) {
      recordingSessions.delete(guildId);
      return { ok: false, error: "沒有錄到任何音訊" };
    }

    const timestamp = session.startTime.toISOString().replace(/[:.]/g, "-");
    const mp3Path = join(RECORDING_TEMP_DIR, `recording-${guildId}-${timestamp}.mp3`);

    // 使用 ffmpeg 合併音軌
    await mergeAudioTracks(userStreams, mp3Path);

    // 清理 PCM 檔案
    for (const stream of userStreams) {
      await unlink(stream.pcmPath).catch(() => {});
    }

    recordingSessions.delete(guildId);
    logger.info({ guildId, mp3Path, duration }, "Recording stopped and merged");

    return { ok: true, mp3Path, duration };
  } catch (error) {
    recordingSessions.delete(guildId);
    logger.error({ error, guildId }, "Failed to stop recording");
    return { ok: false, error: String(error) };
  }
}

/**
 * 使用 ffmpeg 合併多個 PCM 音軌為 MP3
 */
async function mergeAudioTracks(
  userStreams: UserStream[],
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 建立 ffmpeg 指令
    const inputs: string[] = [];
    const filterParts: string[] = [];

    for (let i = 0; i < userStreams.length; i++) {
      const stream = userStreams[i];
      // PCM 輸入參數
      inputs.push("-f", "s16le", "-ar", "48000", "-ac", "2", "-i", stream.pcmPath);

      // 計算延遲 (毫秒)
      const delayMs = stream.startOffset;
      filterParts.push(`[${i}]adelay=${delayMs}|${delayMs}[a${i}]`);
    }

    // 合併所有音軌
    const mixInputs = userStreams.map((_, i) => `[a${i}]`).join("");
    const filterComplex = [
      ...filterParts,
      `${mixInputs}amix=inputs=${userStreams.length}:duration=longest:normalize=0[out]`,
    ].join(";");

    const args = [
      ...inputs,
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-acodec", "libmp3lame",
      "-q:a", "2",
      "-y",
      outputPath,
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", reject);
  });
}

/**
 * 暫停錄音
 */
export function pauseRecording(guildId: string): boolean {
  const session = recordingSessions.get(guildId);
  if (!session || !session.isActive) return false;

  session.isPaused = true;
  logger.info({ guildId }, "Recording paused");
  return true;
}

/**
 * 繼續錄音
 */
export function resumeRecording(guildId: string): boolean {
  const session = recordingSessions.get(guildId);
  if (!session || !session.isActive) return false;

  session.isPaused = false;
  logger.info({ guildId }, "Recording resumed");
  return true;
}
