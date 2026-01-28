/**
 * Discord Voice Recording Module
 * 錄製語音頻道對話，合併多音軌後上傳至 Google Drive
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type VoiceConnection, EndBehaviorType } from "@discordjs/voice";
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
