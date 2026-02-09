/**
 * Discord Voice Recording Module
 * 錄製語音頻道對話，合併多音軌後上傳至 Google Drive
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { EndBehaviorType, type VoiceConnection } from "@discordjs/voice";
import prism from "prism-media";
import { uploadBinaryFile } from "../../services/google/drive";
import { logger } from "../../utils/logger";

// 錄音暫存目錄
const RECORDING_TEMP_DIR = "/tmp/pai-recordings";

// Google Drive 錄音資料夾 ID (可透過環境變數設定)
const RECORDINGS_FOLDER_ID =
  process.env.GOOGLE_DRIVE_RECORDINGS_FOLDER_ID || "1YdEuUcrTxq8ap3ETJk46FbLRsl-iGqFv";

export interface UserStream {
  userId: string;
  username: string;
  pcmPath: string;
  startOffset: number; // 相對於錄音開始的毫秒偏移
  lastWriteTime: number | null; // 最後一次寫入 PCM 的時間戳（用於填充靜音）
}

export interface RecordingSession {
  guildId: string;
  channelId: string;
  startTime: Date;
  userStreams: Map<string, UserStream>;
  isActive: boolean;
  isPaused: boolean;
  lastActivityTime: Date;
  autoStopTimer: ReturnType<typeof setInterval> | null;
}

// 每個 guild 的錄音 session
const recordingSessions = new Map<string, RecordingSession>();

// 自動停止超時（15 分鐘）
const AUTO_STOP_TIMEOUT_MS = 15 * 60 * 1000;

// 自動停止時的 callback（由 handler 設定）
let onAutoStop: ((guildId: string, reason: string) => Promise<void>) | null = null;

/**
 * 設定自動停止 callback
 */
export function setAutoStopCallback(
  callback: (guildId: string, reason: string) => Promise<void>,
): void {
  onAutoStop = callback;
}

/**
 * 啟動自動停止計時器
 */
function startAutoStopTimer(session: RecordingSession): void {
  // 清除現有計時器
  if (session.autoStopTimer) {
    clearInterval(session.autoStopTimer);
  }

  session.autoStopTimer = setInterval(async () => {
    if (!session.isActive) {
      if (session.autoStopTimer) {
        clearInterval(session.autoStopTimer);
        session.autoStopTimer = null;
      }
      return;
    }

    const now = Date.now();
    const lastActivity = session.lastActivityTime.getTime();
    const elapsed = now - lastActivity;

    if (elapsed >= AUTO_STOP_TIMEOUT_MS) {
      const reason = session.isPaused ? "暫停超時" : "無聲超時";
      logger.info({ guildId: session.guildId, reason, elapsed }, "Auto-stopping recording");

      if (session.autoStopTimer) {
        clearInterval(session.autoStopTimer);
        session.autoStopTimer = null;
      }

      if (onAutoStop) {
        await onAutoStop(session.guildId, reason);
      }
    }
  }, 60_000); // 每分鐘檢查一次
}

/**
 * 更新最後活動時間
 */
function updateLastActivity(session: RecordingSession): void {
  session.lastActivityTime = new Date();
}

/**
 * 建立錄音 session
 */
export function createRecordingSession(guildId: string, channelId: string): RecordingSession {
  const session: RecordingSession = {
    guildId,
    channelId,
    startTime: new Date(),
    userStreams: new Map(),
    isActive: true,
    isPaused: false,
    lastActivityTime: new Date(),
    autoStopTimer: null,
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
  connection: VoiceConnection,
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

      // 更新最後活動時間
      updateLastActivity(session);

      // 取得或建立 userStream 記錄
      let userStream = session.userStreams.get(userId);

      // 如果該使用者還沒有 PCM 檔案，建立一個
      if (!userStream) {
        const startOffset = Date.now() - session.startTime.getTime();
        const pcmPath = join(RECORDING_TEMP_DIR, `${guildId}-${userId}-${Date.now()}.pcm`);

        userStream = {
          userId,
          username: "Unknown",
          pcmPath,
          startOffset,
          lastWriteTime: null,
        };
        session.userStreams.set(userId, userStream);
        logger.info({ userId, guildId, pcmPath }, "Created new PCM file for user");
      }

      // 追加寫入 PCM 檔案（使用 flags: "a"）
      const writeStream = createWriteStream(userStream.pcmPath, { flags: "a" });

      // 如果有上一段音訊，填充中間的靜音
      if (userStream.lastWriteTime !== null) {
        const now = Date.now();
        const gapMs = now - userStream.lastWriteTime;
        if (gapMs > 0) {
          // PCM 格式: 48000Hz, 2 channels, 16-bit (2 bytes)
          // 每秒 bytes = 48000 * 2 * 2 = 192000
          const silenceBytes = Math.floor((192000 * gapMs) / 1000);
          const silence = Buffer.alloc(silenceBytes, 0);
          writeStream.write(silence);
          logger.debug(
            { userId, guildId, gapMs, silenceBytes },
            "Filled silence gap between segments",
          );
        }
      }

      // 訂閱音訊流（每次說話都重新訂閱）
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

      // 手動處理 decoder 輸出，追蹤最後寫入時間
      opusStream.pipe(decoder);
      decoder.on("data", (chunk: Buffer) => {
        writeStream.write(chunk);
        userStream.lastWriteTime = Date.now();
      });

      opusStream.on("end", () => {
        writeStream.end();
        logger.debug({ userId, guildId }, "User audio stream segment ended");
      });

      logger.debug({ userId, guildId }, "Subscribed to user audio stream");
    });

    // 啟動自動停止計時器
    startAutoStopTimer(session);

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

  // 清除自動停止計時器
  if (session.autoStopTimer) {
    clearInterval(session.autoStopTimer);
    session.autoStopTimer = null;
  }

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
async function mergeAudioTracks(userStreams: UserStream[], outputPath: string): Promise<void> {
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
    // 加入 silenceremove filter 切除開頭和結尾的靜音
    // start_periods=1: 移除開頭靜音
    // stop_periods=-1: 移除結尾靜音
    // start_threshold=-50dB: 靜音閾值
    // stop_threshold=-50dB: 靜音閾值
    // start_silence=0.5: 保留 0.5 秒過渡
    // stop_silence=0.5: 保留 0.5 秒過渡
    const mixInputs = userStreams.map((_, i) => `[a${i}]`).join("");
    const filterComplex = [
      ...filterParts,
      `${mixInputs}amix=inputs=${userStreams.length}:duration=longest:normalize=0[mixed]`,
      `[mixed]silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.5:stop_periods=-1:stop_threshold=-50dB:stop_silence=0.5[out]`,
    ].join(";");

    const args = [
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "2",
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
  // 不更新 lastActivityTime，讓自動停止計時器可以在 15 分鐘後觸發
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
  session.lastActivityTime = new Date(); // 重置活動時間
  logger.info({ guildId }, "Recording resumed");
  return true;
}

/**
 * 上傳錄音至 Google Drive
 */
export async function uploadRecording(
  mp3Path: string,
  channelName: string,
): Promise<{ ok: true; webViewLink: string } | { ok: false; error: string }> {
  try {
    const buffer = await readFile(mp3Path);
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `${timestamp}-${channelName.replace(/[^a-zA-Z0-9-_\u4e00-\u9fff]/g, "_")}.mp3`;

    const result = await uploadBinaryFile(fileName, buffer, "audio/mpeg", RECORDINGS_FOLDER_ID);

    // 清理本地檔案
    await unlink(mp3Path).catch(() => {});

    if (result.err) {
      logger.error({ error: result.val.message, mp3Path }, "Failed to upload recording");
      return { ok: false, error: result.val.message };
    }

    logger.info({ fileName, fileId: result.val.id }, "Recording uploaded to Google Drive");

    return { ok: true, webViewLink: result.val.webViewLink ?? "" };
  } catch (error) {
    logger.error({ error, mp3Path }, "Failed to upload recording");
    return { ok: false, error: String(error) };
  }
}
