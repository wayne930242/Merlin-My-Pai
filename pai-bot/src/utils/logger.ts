import pino from "pino";
import { config } from "../config";

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
];

export const logger = pino(
  { level: config.logging.level },
  pino.multistream(streams, { dedupe: true })
);
