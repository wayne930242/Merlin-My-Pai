/**
 * 讀取 Merlin 配置
 */

import { join } from "node:path";
import { getProjectRoot } from "./paths";

const CONFIG_PATH = join(getProjectRoot(), "merlin-config.json");

interface MerlinConfig {
  site_domain?: string;
  site_url?: string;
  features: {
    memory: boolean;
    memory_provider?: "gemini" | "anthropic";
    transcription?: boolean;
    fabric?: boolean;
  };
}

let cachedConfig: MerlinConfig | null = null;

/**
 * 取得 Merlin 配置
 */
export function getConfig(): MerlinConfig {
  if (cachedConfig) return cachedConfig;

  try {
    // 同步讀取
    const text = require("fs").readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = JSON.parse(text) as MerlinConfig;
    return cachedConfig;
  } catch {
    // 預設配置（功能全關）
    return {
      features: {
        memory: false,
      },
    };
  }
}

/**
 * 檢查 memory 功能是否啟用
 */
export function isMemoryEnabled(): boolean {
  return getConfig().features.memory === true;
}

/**
 * 取得 memory provider
 */
export function getMemoryProvider(): "gemini" | "anthropic" {
  return getConfig().features.memory_provider || "gemini";
}
