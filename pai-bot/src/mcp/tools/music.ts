/**
 * MCP Music Tools
 * 讓 Claude 透過對話控制 Discord 音樂播放
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  playMusic,
  skip,
  stop,
  getQueue,
  getNowPlaying,
  leaveChannel,
  isInVoiceChannel,
  speakTts,
} from "../../platforms/discord/voice";

export function registerMusicTools(server: McpServer): void {
  server.registerTool(
    "music_play",
    {
      title: "Play Music",
      description: "播放 YouTube 音樂（需要提供 Guild ID）",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
        query: z.string().describe("歌曲名稱或 YouTube URL"),
      },
    },
    async ({ guildId, query }) => {
      if (!isInVoiceChannel(guildId)) {
        return {
          content: [{ type: "text", text: "Bot 不在語音頻道中。請先讓使用者執行 /join 加入語音頻道。" }],
          isError: true,
        };
      }

      const result = await playMusic(guildId, query);

      if (result.ok) {
        const queue = getQueue(guildId);
        const queueInfo = queue.length > 0 ? `（佇列: ${queue.length} 首）` : "";
        return {
          content: [{ type: "text", text: `🎵 已加入播放: ${result.item.title} [${result.item.duration}]${queueInfo}` }],
        };
      } else {
        return {
          content: [{ type: "text", text: `播放失敗: ${result.error}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "music_skip",
    {
      title: "Skip Track",
      description: "跳過目前歌曲",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
      },
    },
    async ({ guildId }) => {
      if (!isInVoiceChannel(guildId)) {
        return {
          content: [{ type: "text", text: "Bot 不在語音頻道中" }],
          isError: true,
        };
      }

      const nowPlaying = getNowPlaying(guildId);
      if (skip(guildId)) {
        return {
          content: [{ type: "text", text: `⏭️ 已跳過: ${nowPlaying?.title || "目前歌曲"}` }],
        };
      } else {
        return {
          content: [{ type: "text", text: "沒有正在播放的歌曲" }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "music_stop",
    {
      title: "Stop Music",
      description: "停止播放並清空佇列",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
      },
    },
    async ({ guildId }) => {
      if (!isInVoiceChannel(guildId)) {
        return {
          content: [{ type: "text", text: "Bot 不在語音頻道中" }],
          isError: true,
        };
      }

      if (stop(guildId)) {
        return {
          content: [{ type: "text", text: "⏹️ 已停止播放並清空佇列" }],
        };
      } else {
        return {
          content: [{ type: "text", text: "沒有正在播放的歌曲" }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "music_now_playing",
    {
      title: "Now Playing",
      description: "查看目前正在播放的歌曲",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
      },
    },
    async ({ guildId }) => {
      const nowPlaying = getNowPlaying(guildId);
      const queue = getQueue(guildId);

      if (!nowPlaying) {
        return {
          content: [{ type: "text", text: "目前沒有播放中的歌曲" }],
        };
      }

      let text = `🎵 正在播放: ${nowPlaying.title} [${nowPlaying.duration}]`;
      if (queue.length > 0) {
        text += `\n📋 佇列中還有 ${queue.length} 首歌曲`;
      }

      return {
        content: [{ type: "text", text }],
      };
    }
  );

  server.registerTool(
    "music_queue",
    {
      title: "View Queue",
      description: "查看播放佇列",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
      },
    },
    async ({ guildId }) => {
      const queue = getQueue(guildId);
      const nowPlaying = getNowPlaying(guildId);

      const lines: string[] = [];

      if (nowPlaying) {
        lines.push(`🎵 正在播放: ${nowPlaying.title} [${nowPlaying.duration}]`);
        lines.push("");
      }

      if (queue.length === 0) {
        lines.push("📋 播放佇列為空");
      } else {
        lines.push(`📋 播放佇列 (${queue.length} 首):`);
        for (let i = 0; i < Math.min(queue.length, 10); i++) {
          lines.push(`${i + 1}. ${queue[i].title} [${queue[i].duration}]`);
        }
        if (queue.length > 10) {
          lines.push(`...還有 ${queue.length - 10} 首`);
        }
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  server.registerTool(
    "music_leave",
    {
      title: "Leave Voice Channel",
      description: "離開語音頻道",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
      },
    },
    async ({ guildId }) => {
      if (!isInVoiceChannel(guildId)) {
        return {
          content: [{ type: "text", text: "Bot 不在語音頻道中" }],
          isError: true,
        };
      }

      leaveChannel(guildId);
      return {
        content: [{ type: "text", text: "👋 已離開語音頻道" }],
      };
    }
  );

  server.registerTool(
    "voice_speak",
    {
      title: "Speak in Voice Channel",
      description: "在語音頻道中使用 TTS 說話（台灣口音中文）。適合播報通知、回應使用者、或主動說話。",
      inputSchema: {
        guildId: z.string().describe("Discord Guild ID"),
        text: z.string().describe("要說的文字內容"),
        voice: z.string().optional().describe("語音名稱（預設：zh-TW-HsiaoChenNeural 台灣女聲）"),
        interrupt: z.boolean().optional().describe("是否中斷目前音樂播放（預設：true，播完會自動恢復）"),
      },
    },
    async ({ guildId, text, voice, interrupt }) => {
      if (!isInVoiceChannel(guildId)) {
        return {
          content: [{ type: "text", text: "Bot 不在語音頻道中。請先讓使用者執行 /join 加入語音頻道。" }],
          isError: true,
        };
      }

      const result = await speakTts(guildId, text, { voice, interrupt });

      if (result.ok) {
        return {
          content: [{ type: "text", text: `🎙️ 已說出: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"` }],
        };
      } else {
        return {
          content: [{ type: "text", text: `TTS 播放失敗: ${result.error}` }],
          isError: true,
        };
      }
    }
  );
}
