import { readdir } from "node:fs/promises";
import { join } from "node:path";

interface SnapshotOptions {
  maxDepth?: number;
  maxEntries?: number;
}

interface WalkResult {
  lines: string[];
  entries: number;
  files: number;
  directories: number;
  truncated: boolean;
}

function indent(depth: number): string {
  if (depth <= 0) return "";
  return `${"  ".repeat(depth - 1)}- `;
}

async function walk(
  root: string,
  depth: number,
  maxDepth: number,
  state: { count: number; maxEntries: number },
): Promise<WalkResult> {
  if (state.count >= state.maxEntries) {
    return { lines: [], entries: 0, files: 0, directories: 0, truncated: true };
  }

  const dirents = await readdir(root, { withFileTypes: true });
  const sorted = dirents
    .filter((d) => !d.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const result: WalkResult = {
    lines: [],
    entries: 0,
    files: 0,
    directories: 0,
    truncated: false,
  };

  for (const entry of sorted) {
    if (state.count >= state.maxEntries) {
      result.truncated = true;
      break;
    }

    const isDir = entry.isDirectory();
    const label = `${indent(depth)}${entry.name}${isDir ? "/" : ""}`;
    result.lines.push(label);

    state.count += 1;
    result.entries += 1;
    if (isDir) result.directories += 1;
    else result.files += 1;

    if (isDir && depth < maxDepth) {
      const child = await walk(join(root, entry.name), depth + 1, maxDepth, state);
      result.lines.push(...child.lines);
      result.entries += child.entries;
      result.files += child.files;
      result.directories += child.directories;
      result.truncated = result.truncated || child.truncated;
    }
  }

  return result;
}

function readGitStatus(root: string): string[] {
  const proc = Bun.spawnSync(["git", "-C", root, "status", "--short"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    return ["Git: (not a repository)"];
  }

  const output = proc.stdout.toString().trim();
  if (!output) {
    return ["Git: clean"];
  }

  const lines = output.split("\n").slice(0, 10);
  const extra = output.split("\n").length - lines.length;
  const mapped = lines.map((line) => `  ${line}`);
  if (extra > 0) {
    mapped.push(`  ... (${extra} more)`);
  }

  return ["Git:", ...mapped];
}

export async function renderWorkspaceSnapshot(
  root: string,
  options: SnapshotOptions = {},
): Promise<string> {
  const maxDepth = options.maxDepth ?? 2;
  const maxEntries = options.maxEntries ?? 80;
  const state = { count: 0, maxEntries };

  try {
    const walked = await walk(root, 1, maxDepth, state);
    const lines = [
      `Workspace: ${root}`,
      "",
      ...walked.lines,
      "",
      `Files: ${walked.files} | Dirs: ${walked.directories} | Entries shown: ${walked.entries}`,
      ...(walked.truncated ? [`(truncated at ${maxEntries} entries)`] : []),
      "",
      ...readGitStatus(root),
    ];

    return lines.join("\n");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `Workspace: ${root}\n\nUnable to read workspace tree: ${reason}`;
  }
}
