# Fix Recording Duration Bug - 修復錄音只錄到部分音訊

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修復 Discord 語音錄音功能中「顯示 21 秒但實際只有 3 秒音訊」的 bug

**Architecture:**
- 問題在於 opus stream 結束時沒有從 `userStreams` 移除使用者
- 導致使用者再次說話時無法重新訂閱
- 修復方案：stream 結束時允許重新訂閱，同時保留原有 PCM 檔案追加寫入

**Tech Stack:** Bun, @discordjs/voice, prism-media

---

## Task 1: 修復重新訂閱邏輯

**Files:**
- Modify: `pai-bot/src/platforms/discord/recording.ts:179-226`

**Step 1: 閱讀並理解現有程式碼**

關鍵問題在第 186 行和第 221-223 行：
- 第 186 行：`if (session.userStreams.has(userId)) return;` 阻止重新訂閱
- 第 221-223 行：stream 結束時只記錄 log，沒有清除 `userStreams`

**Step 2: 修改 speaking.on("start") 處理邏輯**

將原本的「阻止重複訂閱」改為「允許重複訂閱但重用 PCM 檔案」：

```typescript
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
    const pcmPath = join(
      RECORDING_TEMP_DIR,
      `${guildId}-${userId}-${Date.now()}.pcm`
    );

    userStream = {
      userId,
      username: "Unknown",
      pcmPath,
      startOffset,
    };
    session.userStreams.set(userId, userStream);
    logger.info({ userId, guildId, pcmPath }, "Created new PCM file for user");
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

  // 追加寫入 PCM 檔案（使用 flags: "a"）
  const writeStream = createWriteStream(userStream.pcmPath, { flags: "a" });

  opusStream.pipe(decoder).pipe(writeStream);

  opusStream.on("end", () => {
    logger.debug({ userId, guildId }, "User audio stream segment ended");
  });

  logger.debug({ userId, guildId }, "Subscribed to user audio stream");
});
```

**Step 3: 執行測試確認通過**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun test src/platforms/discord/recording.test.ts`

Expected: PASS

**Step 4: 執行 typecheck**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run typecheck`

Expected: 無錯誤

**Step 5: Commit**

```bash
git add pai-bot/src/platforms/discord/recording.ts
git commit -m "fix: allow re-subscription when user speaks again during recording"
```

---

## Task 2: 本地測試驗證

**Step 1: 啟動 Bot**

Run: `cd /home/weihung/weihung-pai/pai-bot && bun run dev`

**Step 2: 測試流程**

1. 在 Discord 使用 `/record` 開始錄音
2. 說一句話（約 3 秒）
3. 停頓 2-3 秒（超過 1 秒的靜音門檻）
4. 再說一句話（約 3 秒）
5. 再停頓 2-3 秒
6. 再說一句話
7. 停止錄音
8. 檢查上傳的 MP3：
   - 時長應該接近總說話時間（約 9 秒）
   - 而非只有第一句的 3 秒

**Step 3: 多人測試**

1. 請另一位使用者加入語音頻道
2. 兩人交替說話
3. 確認兩人的音訊都有被錄製

---

## Task 3: 部署到 VPS

**Step 1: 部署**

Run: `uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml`

**Step 2: 確認服務狀態**

Run: `uv run pai ssh connect "systemctl status pai-bot"`

Expected: active (running)

**Step 3: 檢查日誌**

Run: `uv run pai ssh connect "journalctl -u pai-bot -f"`

觀察錄音時的日誌，應該看到：
- 每次使用者開始說話時有 "Subscribed to user audio stream"
- 每次靜音 1 秒後有 "User audio stream segment ended"

---

## 技術說明

### 原本的問題

```
時間線：
0s     3s      4s        7s      8s       11s
|------|-------|---------|-------|--------|
說話1   靜音    說話2     靜音    說話3    停止

原本的行為：
- 0s: 訂閱 user1 的 stream，建立 PCM 檔案
- 3s: 說話結束
- 4s: stream 因 1 秒靜音而結束，但 userStreams 中還有 user1
- 4s: 使用者再次說話，但因為 userStreams.has(user1) = true，跳過
- 結果：只錄到 0-3 秒的音訊
```

### 修復後的行為

```
- 0s: 訂閱 user1 的 stream，建立 PCM 檔案
- 3s: 說話結束
- 4s: stream 結束，但 PCM 檔案保留
- 4s: 使用者再次說話，重新訂閱 stream，追加到同一個 PCM 檔案
- 7s: 說話結束
- 8s: stream 結束
- 8s: 使用者再次說話，再次重新訂閱
- 結果：完整錄到所有音訊
```

### 多使用者支援

每位使用者有獨立的：
- `userStream` 記錄
- PCM 檔案
- opus stream 訂閱

合併時 ffmpeg 會根據 `startOffset` 對齊時間軸，然後 mix 所有音軌。

---

## 測試檢查清單

- [ ] 單人：說話 → 靜音 → 說話，音訊完整
- [ ] 單人：長時間連續說話（>30 秒）
- [ ] 多人：兩人交替說話
- [ ] 多人：兩人同時說話
- [ ] 自動停止：15 分鐘無活動後自動停止
- [ ] 暫停/繼續：暫停期間的音訊不錄製
