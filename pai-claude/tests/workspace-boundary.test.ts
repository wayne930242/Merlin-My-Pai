import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getMemoryRoot, getWorkspaceRoot } from "../hooks/lib/paths";

describe("workspace boundary", () => {
  test("hooks in settings are executed from ../hooks", () => {
    const settingsPath = join(import.meta.dir, "..", "workspace", ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const commands: string[] = [];
    for (const hooks of Object.values(settings.hooks)) {
      for (const group of hooks) {
        for (const hook of group.hooks) {
          commands.push(hook.command);
        }
      }
    }

    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(cmd).toContain("../hooks/");
      expect(cmd).not.toContain("scripts/");
    }
  });

  test("memory root stays under workspace", () => {
    expect(getWorkspaceRoot().endsWith("/pai-claude/workspace")).toBeTrue();
    expect(getMemoryRoot().endsWith("/pai-claude/workspace/memory")).toBeTrue();
  });
});
