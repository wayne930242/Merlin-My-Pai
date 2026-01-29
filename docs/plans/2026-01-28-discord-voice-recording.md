# Discord 語音錄音功能實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Discord Bot 中新增語音錄音功能，錄製語音頻道中的對話，轉換為 MP3 格式後自動上傳至 Google Drive。

**Architecture:**
- 使用 `@discordjs/voice` 的 `VoiceReceiver` 接收每位使用者的 Opus 音訊流
- 透過 prism-media 解碼 Opus 為 PCM，使用 ffmpeg 合併多音軌並轉換為 MP3
- 利用現有的 Google Drive 服務上傳錄音檔至指定資料夾

**Tech Stack:**
- `@discordjs/voice` (已安裝 v0.19.0)
- `@discordjs/opus` (已安裝 v0.10.0)
- `prism-media` (需安裝)
- `ffmpeg` (系統已安裝)
- `googleapis` (已安裝)

---

## Task 1: 安裝 prism-media 依賴

**Files:**
- Modify: `pai-bot/package.json`

**Step 1: 安裝 prism-media**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun add prism-media`

Expected: prism-media 加入 dependencies

**Step 2: 驗證安裝**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run typecheck`

Expected: 無錯誤

---

## Task 2: 擴展 Google Drive 服務支援二進位檔案上傳

**Files:**
- Modify: `pai-bot/src/services/google/drive.ts`
- Test: `pai-bot/src/services/google/drive.test.ts`

**Step 1: 寫失敗測試**

```typescript
// pai-bot/src/services/google/drive.test.ts
import { test, expect, mock, beforeEach } from "bun:test";

// Mock googleapis
mock.module("googleapis", () => ({
  google: {
    drive: () => ({
      files: {
        create: mock(() => Promise.resolve({
          data: { id: "test-id", name: "test.mp3", webViewLink: "https://drive.google.com/test" }
        })),
      },
    }),
    auth: { OAuth2: class {} },
  },
}));

// Mock auth
mock.module("./auth", () => ({
  getAuthClient: () => ({}),
}));

import { uploadBinaryFile } from "./drive";

test("uploadBinaryFile uploads buffer to Google Drive", async () => {
  const buffer = Buffer.from("test audio data");
  const result = await uploadBinaryFile("recording.mp3", buffer, "audio/mpeg");

  expect(result).toBeDefined();
  expect(result.id).toBe("test-id");
  expect(result.name).toBe("test.mp3");
});
```

**Step 2: 執行測試確認失敗**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/services/google/drive.test.ts`

Expected: FAIL - uploadBinaryFile is not defined

**Step 3: 實作 uploadBinaryFile 函數**

在 `pai-bot/src/services/google/drive.ts` 末尾新增：

```typescript
export async function uploadBinaryFile(
  name: string,
  buffer: Buffer,
  mimeType: string,
  folderId?: string,
): Promise<drive_v3.Schema$File> {
  const drive = getDrive();

  const fileMetadata: drive_v3.Schema$File = { name };
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType,
    body: Readable.from(buffer),
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id,name,mimeType,webViewLink",
  });

  return res.data;
}
```

**Step 4: 執行測試確認通過**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/services/google/drive.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add pai-bot/src/services/google/drive.ts pai-bot/src/services/google/drive.test.ts
git commit -m "feat(drive): add uploadBinaryFile for binary file upload"
```

---

## Task 3: 建立錄音核心模組

**Files:**
- Create: `pai-bot/src/platforms/discord/recording.ts`
- Test: `pai-bot/src/platforms/discord/recording.test.ts`

**Step 1: 寫型別定義與基礎結構測試**

```typescript
// pai-bot/src/platforms/discord/recording.test.ts
import { test, expect } from "bun:test";
import {
  RecordingSession,
  createRecordingSession,
  isRecording
} from "./recording";

test("createRecordingSession returns session object", () => {
  const session = createRecordingSession("guild-1", "channel-1");

  expect(session).toBeDefined();
  expect(session.guildId).toBe("guild-1");
  expect(session.channelId).toBe("channel-1");
  expect(session.startTime).toBeInstanceOf(Date);
  expect(session.userStreams).toBeInstanceOf(Map);
});

test("isRecording returns false when no session exists", () => {
  expect(isRecording("nonexistent-guild")).toBe(false);
});
```

**Step 2: 執行測試確認失敗**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: FAIL - module not found

**Step 3: 實作錄音模組基礎結構**

```typescript
// pai-bot/src/platforms/discord/recording.ts
/**
 * Discord Voice Recording Module
 * 錄製語音頻道對話，合併多音軌後上傳至 Google Drive
 */

import { spawn } from "node:child_process";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type VoiceConnection,
  EndBehaviorType,
  getVoiceConnection,
} from "@discordjs/voice";
import type { GuildMember } from "discord.js";
import { logger } from "../../utils/logger";
import { uploadBinaryFile } from "../../services/google/drive";

// 錄音暫存目錄
const RECORDING_TEMP_DIR = "/tmp/pai-recordings";

// Google Drive 錄音資料夾 ID (可透過環境變數設定)
const RECORDINGS_FOLDER_ID = process.env.GOOGLE_DRIVE_RECORDINGS_FOLDER_ID;

export interface UserStream {
  oderId: string;
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
  channelId: string,
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
```

**Step 4: 執行測試確認通過**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add pai-bot/src/platforms/discord/recording.ts pai-bot/src/platforms/discord/recording.test.ts
git commit -m "feat(recording): add recording session management"
```

---

## Task 4: 實作開始錄音功能

**Files:**
- Modify: `pai-bot/src/platforms/discord/recording.ts`

**Step 1: 新增 startRecording 函數測試**

在 `recording.test.ts` 新增：

```typescript
import { startRecording, stopRecording } from "./recording";
import { mock } from "bun:test";

// Mock VoiceConnection
const mockReceiver = {
  speaking: {
    on: mock(() => {}),
    off: mock(() => {}),
  },
  subscribe: mock(() => ({
    pipe: mock(() => ({
      pipe: mock(() => ({
        on: mock(() => {}),
      })),
    })),
  })),
};

const mockConnection = {
  receiver: mockReceiver,
  joinConfig: { selfDeaf: false },
} as any;

test("startRecording creates session and sets up receiver", async () => {
  const result = await startRecording("guild-2", "channel-2", mockConnection);

  expect(result.ok).toBe(true);
  expect(isRecording("guild-2")).toBe(true);
});
```

**Step 2: 執行測試確認失敗**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: FAIL - startRecording is not defined

**Step 3: 實作 startRecording**

在 `recording.ts` 新增：

```typescript
import prism from "prism-media";

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
  // 檢查是否已在錄音
  if (isRecording(guildId)) {
    return { ok: false, error: "已在錄音中" };
  }

  try {
    await ensureTempDir();

    const session = createRecordingSession(guildId, channelId);
    const receiver = connection.receiver;

    // 監聽使用者開始說話
    receiver.speaking.on("start", (userId) => {
      if (!session.isActive) return;

      // 避免重複訂閱
      if (session.userStreams.has(userId)) return;

      const startOffset = Date.now() - session.startTime.getTime();
      const pcmPath = join(RECORDING_TEMP_DIR, `${guildId}-${userId}-${Date.now()}.pcm`);

      session.userStreams.set(userId, {
        oderId: oderId,
        username: "Unknown", // 稍後由 handler 設定
        pcmPath,
        startOffset,
      });

      // 訂閱音訊流
      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000, // 1秒靜音後結束此段
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

      opusStream
        .pipe(decoder)
        .pipe(writeStream);

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
```

**Step 4: 執行測試確認通過**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add pai-bot/src/platforms/discord/recording.ts pai-bot/src/platforms/discord/recording.test.ts
git commit -m "feat(recording): implement startRecording with opus decoder"
```

---

## Task 5: 實作停止錄音與音軌合併

**Files:**
- Modify: `pai-bot/src/platforms/discord/recording.ts`

**Step 1: 實作 stopRecording 函數**

在 `recording.ts` 新增：

```typescript
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
    await mergeAudioTracks(userStreams, mp3Path, duration);

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
  totalDurationSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 建立 ffmpeg 指令
    // 每個 PCM 輸入需要指定格式
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
      "-q:a", "2", // 高品質 MP3
      "-y", // 覆蓋輸出
      outputPath,
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", reject);
  });
}
```

**Step 2: 新增整合測試**

```typescript
test("stopRecording returns error when no session", async () => {
  const result = await stopRecording("nonexistent");
  expect(result.ok).toBe(false);
});
```

**Step 3: 執行測試確認通過**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add pai-bot/src/platforms/discord/recording.ts pai-bot/src/platforms/discord/recording.test.ts
git commit -m "feat(recording): implement stopRecording with ffmpeg audio merging"
```

---

## Task 6: 實作上傳至 Google Drive

**Files:**
- Modify: `pai-bot/src/platforms/discord/recording.ts`

**Step 1: 實作 uploadRecording 函數**

```typescript
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
    const fileName = `${timestamp}-${channelName.replace(/[^a-zA-Z0-9-_]/g, "_")}.mp3`;

    const file = await uploadBinaryFile(
      fileName,
      buffer,
      "audio/mpeg",
      RECORDINGS_FOLDER_ID,
    );

    // 清理本地檔案
    await unlink(mp3Path).catch(() => {});

    logger.info({ fileName, fileId: file.id }, "Recording uploaded to Google Drive");

    return { ok: true, webViewLink: file.webViewLink ?? "" };
  } catch (error) {
    logger.error({ error, mp3Path }, "Failed to upload recording");
    return { ok: false, error: String(error) };
  }
}
```

**Step 2: 執行 typecheck**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run typecheck`

Expected: 無錯誤

**Step 3: Commit**

```bash
git add pai-bot/src/platforms/discord/recording.ts
git commit -m "feat(recording): implement Google Drive upload"
```

---

## Task 7: 新增 Slash Commands

**Files:**
- Modify: `pai-bot/src/platforms/discord/commands.ts`
- Modify: `pai-bot/src/platforms/discord/handlers/slash-commands/voice.ts`
- Modify: `pai-bot/src/platforms/discord/handlers/slash-commands/index.ts`

**Step 1: 在 commands.ts 新增 /record 指令**

在 `slashCommands` 陣列新增：

```typescript
new SlashCommandBuilder()
  .setName("record")
  .setDescription("開始/停止語音錄音")
  .addSubcommand((sub) =>
    sub.setName("start").setDescription("開始錄音")
  )
  .addSubcommand((sub) =>
    sub.setName("stop").setDescription("停止錄音並上傳")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("查看錄音狀態")
  ),
```

**Step 2: 在 voice.ts 新增 handler**

```typescript
import {
  isRecording,
  startRecording,
  stopRecording,
  uploadRecording,
  getRecordingSession,
} from "../../recording";

export async function handleRecord(
  interaction: ChatInputCommandInteraction,
  discordUserId: string,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "此指令只能在伺服器中使用", flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "start") {
    // 檢查是否已在語音頻道
    if (!isInVoiceChannel(interaction.guildId)) {
      await interaction.reply({
        content: "Bot 不在語音頻道中，請先使用 /join",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 檢查是否已在錄音
    if (isRecording(interaction.guildId)) {
      await interaction.reply({
        content: "已在錄音中，使用 /record stop 停止",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const connection = getVoiceConnection(interaction.guildId);
    if (!connection) {
      await interaction.editReply("無法取得語音連線");
      return;
    }

    const result = await startRecording(
      interaction.guildId,
      interaction.channelId,
      connection,
    );

    if (result.ok) {
      await interaction.editReply("🔴 **錄音中...** 使用 `/record stop` 停止並上傳");
    } else {
      await interaction.editReply(`錯誤: ${result.error}`);
    }

  } else if (subcommand === "stop") {
    if (!isRecording(interaction.guildId)) {
      await interaction.reply({
        content: "目前沒有進行中的錄音",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const stopResult = await stopRecording(interaction.guildId);
    if (!stopResult.ok) {
      await interaction.editReply(`停止錄音失敗: ${stopResult.error}`);
      return;
    }

    await interaction.editReply("⏳ 正在處理錄音並上傳至 Google Drive...");

    const voiceChannel = interaction.guild.channels.cache.get(
      getRecordingSession(interaction.guildId)?.channelId ?? ""
    );
    const channelName = voiceChannel?.name ?? "unknown";

    const uploadResult = await uploadRecording(stopResult.mp3Path, channelName);

    if (uploadResult.ok) {
      const mins = Math.floor(stopResult.duration / 60);
      const secs = stopResult.duration % 60;
      await interaction.editReply(
        `✅ **錄音已上傳**\n` +
        `時長: ${mins}:${secs.toString().padStart(2, "0")}\n` +
        `連結: ${uploadResult.webViewLink}`
      );
    } else {
      await interaction.editReply(`上傳失敗: ${uploadResult.error}`);
    }

  } else if (subcommand === "status") {
    const session = getRecordingSession(interaction.guildId);
    if (!session || !session.isActive) {
      await interaction.reply("目前沒有進行中的錄音");
      return;
    }

    const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const userCount = session.userStreams.size;

    await interaction.reply(
      `🔴 **錄音中**\n` +
      `時長: ${mins}:${secs.toString().padStart(2, "0")}\n` +
      `錄製人數: ${userCount}`
    );
  }
}
```

**Step 3: 在 index.ts 新增路由**

在 `handleSlashCommand` 的 switch 中新增：

```typescript
case "record":
  return handleRecord(interaction, discordUserId);
```

**Step 4: 執行 typecheck**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run typecheck`

Expected: 無錯誤

**Step 5: Commit**

```bash
git add pai-bot/src/platforms/discord/commands.ts \
        pai-bot/src/platforms/discord/handlers/slash-commands/voice.ts \
        pai-bot/src/platforms/discord/handlers/slash-commands/index.ts
git commit -m "feat(discord): add /record command for voice recording"
```

---

## Task 8: 設定環境變數

**Files:**
- Modify: `ansible/inventory/group_vars/all/vault.yml.example`

**Step 1: 記錄需要的環境變數**

新增說明：

```yaml
# Google Drive Recordings
# 建立專門存放錄音的資料夾，取得其 ID
GOOGLE_DRIVE_RECORDINGS_FOLDER_ID: "your-folder-id"
```

**Step 2: Commit**

```bash
git add ansible/inventory/group_vars/all/vault.yml.example
git commit -m "docs: add GOOGLE_DRIVE_RECORDINGS_FOLDER_ID to vault example"
```

---

## Task 9: 整合測試

**Step 1: 本地啟動 Bot**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run dev`

**Step 2: 測試流程**

1. 在 Discord 伺服器中使用 `/join` 加入語音頻道
2. 使用 `/record start` 開始錄音
3. 在語音頻道說話
4. 使用 `/record status` 確認錄音狀態
5. 使用 `/record stop` 停止並上傳
6. 確認 Google Drive 中有新檔案

---

## Task 10: 部署

**Step 1: 更新 vault 設定**

Run: `uv run pai ansible ansible-vault edit ansible/inventory/group_vars/all/vault.yml`

新增 `GOOGLE_DRIVE_RECORDINGS_FOLDER_ID`

**Step 2: 部署**

Run: `uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml`

**Step 3: 確認服務正常**

Run: `uv run pai ssh connect "systemctl status pai-bot"`

---

## 注意事項

### 權限需求
- Bot 需要 `GatewayIntentBits.GuildVoiceStates` (已設定)
- 加入語音頻道時需設定 `selfDeaf: false` 才能接收音訊

### 限制
- Discord 不提供單一混合音軌，每位使用者的音訊是分開的
- 音軌同步依賴 timestamp 對齊，可能有輕微偏差
- 長時間錄音會產生大量 PCM 暫存檔

### 可能的改進
- 加入錄音時間限制（例如最長 2 小時）
- 加入自動清理舊暫存檔
- 支援僅錄製特定使用者
- 錄音前顯示參與者列表確認

---

## 參考資源

- [discord.js Voice Recording](https://v12.discordjs.guide/voice/receiving-audio.html)
- [discordjs-voice-recorder](https://github.com/Kirdock/discordjs-voice-recorder)
- [Google Drive API Node.js](https://developers.google.com/workspace/drive/api/quickstart/nodejs)
- [FFmpeg Audio Mixing](https://creatomate.com/blog/how-to-join-multiple-audio-clips-into-one-using-ffmpeg)
