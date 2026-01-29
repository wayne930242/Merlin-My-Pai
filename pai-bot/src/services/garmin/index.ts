// Garmin Connect 服務

import { join } from "node:path";
import { $ } from "bun";
import { Err, Ok, type Result } from "ts-results";
import type {
  GarminActivity,
  GarminHealthSummary,
  GarminHeartRateSummary,
  GarminSleep,
  GarminStats,
} from "./types";

const SYNC_SCRIPT = join(import.meta.dir, "sync.py");

// 環境變數
const GARMIN_EMAIL = process.env.GARMIN_EMAIL;
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD;

export function isGarminConfigured(): boolean {
  return !!(GARMIN_EMAIL && GARMIN_PASSWORD);
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

async function runSync<T>(command: string, args: string[] = []): Promise<Result<T, Error>> {
  if (!isGarminConfigured()) {
    return Err(new Error("Garmin credentials not configured"));
  }

  const allArgs = [GARMIN_EMAIL!, GARMIN_PASSWORD!, command, ...args];

  try {
    const result = await $`uv run --with garminconnect python3 ${SYNC_SCRIPT} ${allArgs}`.text();
    const parsed = JSON.parse(result.trim());

    if (parsed.error) {
      return Err(new Error(parsed.error));
    }

    return Ok(parsed as T);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 取得日期範圍內的每日統計數據
 */
export async function getStats(
  startDate?: string,
  endDate?: string,
): Promise<Result<GarminStats[], Error>> {
  const start = startDate || getToday();
  const end = endDate || start;
  return runSync<GarminStats[]>("stats", [start, end]);
}

/**
 * 取得日期範圍內的睡眠數據
 */
export async function getSleep(
  startDate?: string,
  endDate?: string,
): Promise<Result<GarminSleep[], Error>> {
  const start = startDate || getToday();
  const end = endDate || start;
  return runSync<GarminSleep[]>("sleep", [start, end]);
}

/**
 * 取得最近活動
 */
export async function getActivities(limit = 10): Promise<Result<GarminActivity[], Error>> {
  return runSync<GarminActivity[]>("activities", [limit.toString()]);
}

/**
 * 取得日期範圍內的心率數據摘要
 */
export async function getHeartRates(
  startDate?: string,
  endDate?: string,
): Promise<Result<GarminHeartRateSummary[], Error>> {
  const start = startDate || getToday();
  const end = endDate || start;
  return runSync<GarminHeartRateSummary[]>("heart", [start, end]);
}

/**
 * 取得日期範圍內的所有健康數據
 */
export async function getAll(
  startDate?: string,
  endDate?: string,
): Promise<
  Result<
    {
      stats: GarminStats[];
      sleep: GarminSleep[];
      activities: GarminActivity[];
    },
    Error
  >
> {
  const start = startDate || getToday();
  const end = endDate || start;
  return runSync("all", [start, end]);
}

/**
 * 產生健康摘要（適合記憶保存）
 */
export async function getHealthSummary(
  startDate?: string,
  endDate?: string,
): Promise<Result<GarminHealthSummary[], Error>> {
  const allResult = await getAll(startDate, endDate);
  if (allResult.err) {
    return allResult;
  }

  const { stats, sleep } = allResult.val;

  const summaries = stats.map((stat, i) => {
    const sleepData = sleep[i] || {};
    const sleepHours = (sleepData.sleepTimeSeconds || 0) / 3600;
    const deepHours = (sleepData.deepSleepSeconds || 0) / 3600;
    const remHours = (sleepData.remSleepSeconds || 0) / 3600;

    // 睡眠品質評估
    let sleepQuality = "一般";
    const sleepScore = sleepData.sleepScores?.overall || 0;
    if (sleepScore >= 80) sleepQuality = "優良";
    else if (sleepScore >= 60) sleepQuality = "良好";
    else if (sleepScore < 40) sleepQuality = "不佳";

    return {
      date: stat.date,
      steps: {
        current: stat.steps || 0,
        goal: stat.stepGoal || 10000,
        percentage: Math.round(((stat.steps || 0) / (stat.stepGoal || 10000)) * 100),
      },
      sleep: {
        totalHours: Math.round(sleepHours * 10) / 10,
        quality: sleepQuality,
        deepHours: Math.round(deepHours * 10) / 10,
        remHours: Math.round(remHours * 10) / 10,
      },
      heart: {
        resting: stat.restingHeartRate || 0,
        min: stat.minHeartRate || 0,
        max: stat.maxHeartRate || 0,
      },
      stress: {
        average: stat.averageStressLevel || 0,
        max: stat.maxStressLevel || 0,
      },
      bodyBattery: {
        highest: stat.bodyBatteryHighestValue || 0,
        lowest: stat.bodyBatteryLowestValue || 0,
        charged: stat.bodyBatteryChargedValue || 0,
        drained: stat.bodyBatteryDrainedValue || 0,
      },
    };
  });

  return Ok(summaries);
}

/**
 * 格式化單日健康摘要為可讀文字
 */
function formatSingleSummary(summary: GarminHealthSummary): string {
  return [
    `📅 ${summary.date} 健康摘要`,
    "",
    `🚶 步數: ${summary.steps.current.toLocaleString()} / ${summary.steps.goal.toLocaleString()} (${summary.steps.percentage}%)`,
    `😴 睡眠: ${summary.sleep.totalHours}h (${summary.sleep.quality}) - 深睡 ${summary.sleep.deepHours}h / REM ${summary.sleep.remHours}h`,
    `❤️ 心率: 靜息 ${summary.heart.resting} / 最低 ${summary.heart.min} / 最高 ${summary.heart.max}`,
    `😰 壓力: 平均 ${summary.stress.average} / 最高 ${summary.stress.max}`,
    `🔋 Body Battery: ${summary.bodyBattery.lowest} → ${summary.bodyBattery.highest} (+${summary.bodyBattery.charged} / -${summary.bodyBattery.drained})`,
  ].join("\n");
}

/**
 * 格式化健康摘要為可讀文字
 */
export function formatSummary(summaries: GarminHealthSummary[]): string {
  return summaries.map(formatSingleSummary).join("\n\n---\n\n");
}
