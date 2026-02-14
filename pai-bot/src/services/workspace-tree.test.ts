import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderWorkspaceSnapshot } from "./workspace-tree";

const toCleanup: string[] = [];

afterEach(async () => {
  await Promise.all(toCleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("renderWorkspaceSnapshot prints tree and file summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-tree-"));
  toCleanup.push(root);

  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "src", "api"), { recursive: true });
  await writeFile(join(root, "README.md"), "# test\n");
  await writeFile(join(root, "src", "main.ts"), "console.log('ok')\n");
  await writeFile(join(root, "src", "api", "server.ts"), "export {}\n");

  const output = await renderWorkspaceSnapshot(root, { maxDepth: 2, maxEntries: 20 });

  expect(output).toContain(`Workspace: ${root}`);
  expect(output).toContain("README.md");
  expect(output).toContain("src/");
  expect(output).toContain("api/");
  expect(output).toContain("Files:");
});
