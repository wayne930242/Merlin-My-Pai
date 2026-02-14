import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("memory-cli routes write/search operations through capability adapter", () => {
  const file = readFileSync(join(import.meta.dir, "..", "hooks", "memory-cli.ts"), "utf-8");

  expect(file).toContain('from "./lib/memory-capability"');
  expect(file).toContain("semanticUpsert(");
  expect(file).toContain("semanticSearch(");
  expect(file).toContain("semanticFindSimilar(");

  expect(file).not.toContain("saveMemory(");
  expect(file).not.toContain("updateMemory(");
  expect(file).not.toContain("searchMemory(");
  expect(file).not.toContain("findSimilarMemory(");
});
