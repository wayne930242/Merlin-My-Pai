#!/usr/bin/env bun
/**
 * Long-term Memory CLI
 *
 * Usage:
 *   bun run scripts/memory-cli.ts save <path> --title "..." --summary "..." --content "..." [--tags "a,b"]
 *   bun run scripts/memory-cli.ts get <path>
 *   bun run scripts/memory-cli.ts search <keywords...> [--limit N]
 *   bun run scripts/memory-cli.ts list
 *   bun run scripts/memory-cli.ts init
 *
 * Output: JSON ({ ok: true, ... } or { ok: false, error: "..." })
 */

import {
  getMemory,
  saveMemory,
  searchMemory,
  listMemory,
  initMemory,
  getMemoryRoot,
} from "./lib/long-term-memory";

interface CliResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function success(data: unknown): CliResult {
  return { ok: true, data };
}

function error(message: string): CliResult {
  return { ok: false, error: message };
}

function parseArgs(args: string[]): {
  positional: string[];
  options: Record<string, string>;
} {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, options };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      JSON.stringify(
        error(
          "Usage: memory-cli.ts <command> [args]\nCommands: save, get, search, list, init"
        ),
        null,
        2
      )
    );
    process.exit(1);
  }

  const command = args[0];
  const { positional, options } = parseArgs(args.slice(1));

  let result: CliResult;

  try {
    switch (command) {
      case "init": {
        await initMemory();
        result = success({ message: "Memory initialized", root: getMemoryRoot() });
        break;
      }

      case "save": {
        const path = positional[0];
        const { title, summary, content, tags } = options;

        if (!path) {
          result = error("Missing path argument");
          break;
        }
        if (!title) {
          result = error("Missing --title option");
          break;
        }
        if (!summary) {
          result = error("Missing --summary option");
          break;
        }
        if (!content) {
          result = error("Missing --content option");
          break;
        }

        const tagList = tags ? tags.split(",").map((t) => t.trim()) : [];

        await saveMemory(path, {
          title,
          summary,
          content,
          tags: tagList,
        });

        result = success({
          message: "Memory saved",
          path,
          title,
          summary,
          tags: tagList,
        });
        break;
      }

      case "get": {
        const path = positional[0];

        if (!path) {
          result = error("Missing path argument");
          break;
        }

        const memory = await getMemory(path);

        if (!memory) {
          result = error(`Memory not found: ${path}`);
          break;
        }

        result = success(memory);
        break;
      }

      case "search": {
        const keywords = positional;
        const limit = options.limit ? parseInt(options.limit, 10) : 10;

        if (keywords.length === 0) {
          result = error("Missing keywords");
          break;
        }

        const results = await searchMemory(keywords, limit);
        result = success({ count: results.length, results });
        break;
      }

      case "list": {
        const entries = await listMemory();
        result = success({ count: entries.length, entries });
        break;
      }

      default:
        result = error(`Unknown command: ${command}`);
    }
  } catch (err) {
    result = error(err instanceof Error ? err.message : String(err));
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main();
