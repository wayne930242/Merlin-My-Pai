import { Writable } from "node:stream";
import pino from "pino";
import { config } from "../config";
import { paiEvents } from "../events";

// 自訂 stream：發送 log 到 WebSocket
class EventEmitterStream extends Writable {
  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    try {
      const log = JSON.parse(chunk.toString());
      const levelMap: Record<number, "debug" | "info" | "warn" | "error" | "fatal"> = {
        10: "debug",
        20: "debug",
        30: "info",
        40: "warn",
        50: "error",
        60: "fatal",
      };

      paiEvents.emit("log:entry", {
        level: levelMap[log.level] || "info",
        msg: log.msg || "",
        context: log.context,
        timestamp: Date.now(),
      });
    } catch {
      // ignore parse errors
    }
    callback();
  }
}

// 使用 pino.multistream 分流：error+ 到 stderr，其他到 stdout
const streams: pino.StreamEntry[] = [
  // info 以下 (debug, info) → stdout
  {
    level: "debug",
    stream: pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        destination: 1, // stdout
      },
    }),
  },
  // error 以上 (warn, error, fatal) → stderr
  {
    level: "warn",
    stream: pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        destination: 2, // stderr
      },
    }),
  },
  // 發送到 WebSocket
  {
    level: "info",
    stream: new EventEmitterStream(),
  },
];

export const logger = pino(
  { level: config.logging.level },
  pino.multistream(streams, { dedupe: true }),
);
