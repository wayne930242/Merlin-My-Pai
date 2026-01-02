#!/usr/bin/env bun

/**
 * 批次更新「寂靜之音」跑團行程時間
 * 將所有行程設定為台北時間 20:00-23:00
 */

import * as calendar from "../src/services/google/calendar";
import { getAuthClient } from "../src/services/google/auth";
import { google } from "googleapis";

async function main() {
  // 寂靜之音日曆 ID
  const calendarId = "4532966132fa796f7bd6bc1ce4d2184fb7dd9ffbd1c28b4f8b445732bd1cc36b@group.calendar.google.com";

  console.log("正在查詢「寂靜之音」日曆中的所有行程...\n");

  // 查詢所有未來的行程
  const events = await calendar.listEvents(calendarId, {
    maxResults: 100,
  });

  if (events.length === 0) {
    console.log("沒有找到任何行程");
    return;
  }

  console.log(`找到 ${events.length} 個行程:\n`);

  // 取得 calendar 實例用於更新
  const auth = getAuthClient();
  const calendarApi = google.calendar({ version: "v3", auth });

  // 更新每個行程
  for (const event of events) {
    const eventId = event.id!;
    const summary = event.summary || "(無標題)";

    // 取得原始日期
    let dateStr: string;
    if (event.start?.date) {
      // 全天活動,使用 date 格式
      dateStr = event.start.date;
    } else if (event.start?.dateTime) {
      // 已有時間的活動,提取日期部分
      dateStr = event.start.dateTime.split("T")[0];
    } else {
      console.log(`⚠️  跳過: ${summary} - 無法取得日期`);
      continue;
    }

    // 建立台北時間 20:00-23:00 的時間字串
    const startDateTime = `${dateStr}T20:00:00+08:00`;
    const endDateTime = `${dateStr}T23:00:00+08:00`;

    console.log(`📝 更新: ${summary}`);
    console.log(`   日期: ${dateStr}`);
    console.log(`   時間: 20:00-23:00 (台北時間)`);

    try {
      // 先取得完整的事件資料
      const existingEvent = await calendarApi.events.get({
        calendarId,
        eventId,
      });

      // 更新事件,移除 date 欄位並設定 dateTime
      const updatedEvent = {
        ...existingEvent.data,
        start: {
          dateTime: startDateTime,
          timeZone: "Asia/Taipei",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "Asia/Taipei",
        },
      };

      // 移除可能衝突的 date 欄位
      delete (updatedEvent.start as any).date;
      delete (updatedEvent.end as any).date;

      await calendarApi.events.update({
        calendarId,
        eventId,
        requestBody: updatedEvent,
      });
      console.log(`   ✅ 更新成功\n`);
    } catch (error) {
      console.log(`   ❌ 更新失敗: ${error}\n`);
    }
  }

  console.log("批次更新完成!");
}

// 執行腳本
main().catch((error) => {
  console.error("執行失敗:", error);
  process.exit(1);
});
