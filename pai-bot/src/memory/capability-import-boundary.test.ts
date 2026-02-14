import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("capability adapter must not import monorepo package paths at runtime", () => {
  const file = readFileSync(join(import.meta.dir, "capability.ts"), "utf-8");
  expect(file).not.toContain("../../../packages/");
});
