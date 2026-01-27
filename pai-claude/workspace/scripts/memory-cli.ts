#!/usr/bin/env bun
/**
 * Long-term Memory CLI
 *
 * Usage:
 *   bun run scripts/memory-cli.ts save <path> --title "..." --summary "..." --content "..." [--tags "a,b"]
 *   bun run scripts/memory-cli.ts get <path>
 *   bun run scripts/memory-cli.ts search <keywords...> [--limit N]
 *   bun run scripts/memory-cli.ts find-similar <keywords...> [--category <cat>] [--limit N]
 *   bun run scripts/memory-cli.ts update <path> [--summary "..."] [--content "..."] [--tags "a,b"] [--append]
 *   bun run scripts/memory-cli.ts list
 *   bun run scripts/memory-cli.ts init
 *
 * Output: JSON ({ ok: true, ... } or { ok: false, error: "..." })
 */

import {
  getMemory,
  saveMemory,
  searchMemory,
  findSimilarMemory,
  updateMemory,
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
          "Usage: memory-cli.ts <command> [args]\nCommands: save, get, search, find-similar, update, list, init"
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

      case "find-similar": {
        const keywords = positional;
        const category = options.category;
        const limit = options.limit ? parseInt(options.limit, 10) : 5;

        if (keywords.length === 0) {
          result = error("Missing keywords");
          break;
        }

        const results = await findSimilarMemory(keywords, category, limit);
        result = success({
          count: results.length,
          results: results.map((r) => ({
            path: r.memory.path,
            title: r.memory.title,
            summary: r.memory.summary,
            score: r.score,
          })),
        });
        break;
      }

      case "update": {
        const path = positional[0];

        if (!path) {
          result = error("Missing path argument");
          break;
        }

        const { summary, content, tags, append } = options;

        if (!summary && !content && !tags) {
          result = error("At least one of --summary, --content, or --tags required");
          break;
        }

        const tagList = tags ? tags.split(",").map((t) => t.trim()) : undefined;

        const updated = await updateMemory(path, {
          summary,
          content,
          tags: tagList,
          appendContent: append === "true",
        });

        if (!updated) {
          result = error(`Memory not found: ${path}`);
          break;
        }

        result = success({ message: "Memory updated", path });
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
