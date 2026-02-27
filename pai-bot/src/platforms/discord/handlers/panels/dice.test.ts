/**
 * Dice Panel Unit Tests
 */

import { describe, expect, test } from "bun:test";
import {
  buildDiceComponents,
  clearCustomExpressions,
  parseAndRoll,
  saveCustomExpression,
  setDicePanel,
} from "./dice";

function getAllCustomIds(rows: ReturnType<typeof buildDiceComponents>): string[] {
  return rows.flatMap((row) => {
    const json = row.toJSON();
    return json.components
      .map((component) => ("custom_id" in component ? component.custom_id : undefined))
      .filter((id): id is string => typeof id === "string");
  });
}

describe("parseAndRoll", () => {
  describe("basic dice", () => {
    test("d20 returns result between 1 and 20", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("d20");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(1);
        expect(result!.total).toBeLessThanOrEqual(20);
      }
    });

    test("1d6 returns result between 1 and 6", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("1d6");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(1);
        expect(result!.total).toBeLessThanOrEqual(6);
      }
    });

    test("2d6 returns result between 2 and 12", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("2d6");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(2);
        expect(result!.total).toBeLessThanOrEqual(12);
      }
    });

    test("d100 returns result between 1 and 100", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("d100");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(1);
        expect(result!.total).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("modifiers", () => {
    test("d20+5 adds modifier", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("d20+5");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(6);
        expect(result!.total).toBeLessThanOrEqual(25);
      }
    });

    test("d20-3 subtracts modifier", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("d20-3");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(-2);
        expect(result!.total).toBeLessThanOrEqual(17);
      }
    });
  });

  describe("keep/drop mechanics", () => {
    test("4d6k3 keeps highest 3 (range: 3-18)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("4d6k3");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(3);
        expect(result!.total).toBeLessThanOrEqual(18);
      }
    });

    test("2d20k1 (advantage) keeps highest (range: 1-20)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("2d20k1");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(1);
        expect(result!.total).toBeLessThanOrEqual(20);
      }
    });

    test("2d20kl1 (disadvantage) keeps lowest (range: 1-20)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("2d20kl1");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(1);
        expect(result!.total).toBeLessThanOrEqual(20);
      }
    });

    test("4d6d1 drops lowest 1 (same as 4d6k3)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("4d6d1");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(3);
        expect(result!.total).toBeLessThanOrEqual(18);
      }
    });
  });

  describe("Fate dice", () => {
    test("4df returns result between -4 and 4", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("4df");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(-4);
        expect(result!.total).toBeLessThanOrEqual(4);
      }
    });

    test("df defaults to 4dF", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("df");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(-4);
        expect(result!.total).toBeLessThanOrEqual(4);
      }
    });

    test("4df+2 adds modifier", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("4df+2");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(-2);
        expect(result!.total).toBeLessThanOrEqual(6);
      }
    });
  });

  describe("compound expressions", () => {
    test("10*2d10k1+1d10 (CoC bonus die)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("10*2d10k1+1d10");
        expect(result).not.toBeNull();
        // 10 * (1-10) + (1-10) = 10-100 + 1-10 = 11-110
        expect(result!.total).toBeGreaterThanOrEqual(11);
        expect(result!.total).toBeLessThanOrEqual(110);
      }
    });

    test("10*2d10kl1+1d10 (CoC penalty die)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("10*2d10kl1+1d10");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(11);
        expect(result!.total).toBeLessThanOrEqual(110);
      }
    });

    test("10*3d10k1+1d10 (CoC double bonus)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("10*3d10k1+1d10");
        expect(result).not.toBeNull();
        expect(result!.total).toBeGreaterThanOrEqual(11);
        expect(result!.total).toBeLessThanOrEqual(110);
      }
    });

    test("2d6+1d4 (multiple dice groups)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("2d6+1d4");
        expect(result).not.toBeNull();
        // 2d6 (2-12) + 1d4 (1-4) = 3-16
        expect(result!.total).toBeGreaterThanOrEqual(3);
        expect(result!.total).toBeLessThanOrEqual(16);
      }
    });

    test("1d20+1d6+5 (dice with modifier)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("1d20+1d6+5");
        expect(result).not.toBeNull();
        // 1d20 (1-20) + 1d6 (1-6) + 5 = 7-31
        expect(result!.total).toBeGreaterThanOrEqual(7);
        expect(result!.total).toBeLessThanOrEqual(31);
      }
    });

    test("2d6*10 (dice multiplied)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("2d6*10");
        expect(result).not.toBeNull();
        // 2d6 (2-12) * 10 = 20-120
        expect(result!.total).toBeGreaterThanOrEqual(20);
        expect(result!.total).toBeLessThanOrEqual(120);
      }
    });
  });

  describe("subtraction", () => {
    test("1d20-1d6 (dice subtraction)", () => {
      for (let i = 0; i < 100; i++) {
        const result = parseAndRoll("1d20-1d6");
        expect(result).not.toBeNull();
        // 1d20 (1-20) - 1d6 (1-6) = -5 to 19
        expect(result!.total).toBeGreaterThanOrEqual(-5);
        expect(result!.total).toBeLessThanOrEqual(19);
      }
    });
  });

  describe("text output format", () => {
    test("includes expression in output", () => {
      const result = parseAndRoll("2d6+3");
      expect(result).not.toBeNull();
      expect(result!.text).toContain("2d6+3");
    });

    test("shows individual rolls", () => {
      const result = parseAndRoll("2d6");
      expect(result).not.toBeNull();
      // Should contain roll results like [3,5]
      expect(result!.text).toMatch(/\[\d+,\d+\]/);
    });

    test("shows strikethrough for dropped dice", () => {
      const result = parseAndRoll("4d6k3");
      expect(result).not.toBeNull();
      // Should contain strikethrough for dropped die
      expect(result!.text).toMatch(/~~\d+~~/);
    });
  });

  describe("invalid expressions", () => {
    test("returns null for empty string", () => {
      expect(parseAndRoll("")).toBeNull();
    });

    test("returns null for invalid expression", () => {
      expect(parseAndRoll("abc")).toBeNull();
    });

    test("returns null for d0", () => {
      expect(parseAndRoll("d0")).toBeNull();
    });

    test("returns null for d1", () => {
      expect(parseAndRoll("d1")).toBeNull();
    });

    test("returns null for keep more than rolled", () => {
      expect(parseAndRoll("2d6k3")).toBeNull();
    });
  });

  describe("whitespace handling", () => {
    test("handles spaces in expression", () => {
      const result = parseAndRoll("2d6 + 3");
      expect(result).not.toBeNull();
      expect(result!.total).toBeGreaterThanOrEqual(5);
      expect(result!.total).toBeLessThanOrEqual(15);
    });

    test("handles leading/trailing spaces", () => {
      const result = parseAndRoll("  d20  ");
      expect(result).not.toBeNull();
      expect(result!.total).toBeGreaterThanOrEqual(1);
      expect(result!.total).toBeLessThanOrEqual(20);
    });
  });

  describe("case insensitivity", () => {
    test("handles uppercase D", () => {
      const result = parseAndRoll("D20");
      expect(result).not.toBeNull();
      expect(result!.total).toBeGreaterThanOrEqual(1);
      expect(result!.total).toBeLessThanOrEqual(20);
    });

    test("handles mixed case", () => {
      const result = parseAndRoll("2D6K1");
      expect(result).not.toBeNull();
      expect(result!.total).toBeGreaterThanOrEqual(1);
      expect(result!.total).toBeLessThanOrEqual(6);
    });
  });
});

describe("buildDiceComponents", () => {
  test("includes instant-roll dice buttons that use quick action", () => {
    const customIds = getAllCustomIds(buildDiceComponents("guild-1"));

    expect(customIds).toContain("dice:quick:1d20:guild-1");
    expect(customIds).toContain("dice:quick:1d100:guild-1");
    expect(customIds).toContain("dice:quick:d4:guild-1");
    expect(customIds).toContain("dice:quick:d6:guild-1");
    expect(customIds).toContain("dice:quick:d8:guild-1");
    expect(customIds).toContain("dice:quick:d10:guild-1");
    expect(customIds).toContain("dice:quick:d12:guild-1");
  });

  test("does not include accumulation actions", () => {
    const customIds = getAllCustomIds(buildDiceComponents("guild-1"));

    for (const id of customIds) {
      expect(id.startsWith("dice:add:")).toBe(false);
      expect(id.startsWith("dice:roll:")).toBe(false);
      expect(id.startsWith("dice:undo:")).toBe(false);
      expect(id.startsWith("dice:clear:")).toBe(false);
    }
  });

  test("shows saved custom dice buttons on panel (up to 5 visible)", () => {
    setDicePanel("channel-1", {
      historyMessageId: "history-1",
      panelMessageId: "panel-1",
      channelId: "channel-1",
      gameSystem: "generic",
      savedCustomExpressions: [],
    });

    saveCustomExpression("channel-1", "2d6+3");
    saveCustomExpression("channel-1", "4d6k3");
    saveCustomExpression("channel-1", "2d20kl1");
    saveCustomExpression("channel-1", "3d8+2");
    saveCustomExpression("channel-1", "2d8+1");
    saveCustomExpression("channel-1", "1d12+2");

    const customIds = getAllCustomIds(buildDiceComponents("guild-1", "channel-1"));

    expect(customIds).toContain("dice:saved:0:guild-1");
    expect(customIds).toContain("dice:saved:1:guild-1");
    expect(customIds).toContain("dice:saved:2:guild-1");
    expect(customIds).toContain("dice:saved:3:guild-1");
    expect(customIds).toContain("dice:saved:4:guild-1");
  });

  test("includes custom reset button", () => {
    const customIds = getAllCustomIds(buildDiceComponents("guild-1"));
    expect(customIds).toContain("dice:customreset:guild-1");
  });
});

describe("saved custom expressions", () => {
  test("keeps latest 5 unique expressions", () => {
    setDicePanel("channel-2", {
      historyMessageId: "history-2",
      panelMessageId: "panel-2",
      channelId: "channel-2",
      gameSystem: "generic",
      savedCustomExpressions: [],
    });

    saveCustomExpression("channel-2", "d20");
    saveCustomExpression("channel-2", "2d6");
    saveCustomExpression("channel-2", "3d6");
    saveCustomExpression("channel-2", "4d6k3");
    saveCustomExpression("channel-2", "2d20k1");
    const saved = saveCustomExpression("channel-2", "2d6");

    expect(saved.length).toBe(5);
    expect(saved[0]).toBe("2d6");
  });

  test("clear removes all saved expressions", () => {
    setDicePanel("channel-3", {
      historyMessageId: "history-3",
      panelMessageId: "panel-3",
      channelId: "channel-3",
      gameSystem: "generic",
      savedCustomExpressions: ["2d6+3"],
    });

    clearCustomExpressions("channel-3");
    const customIds = getAllCustomIds(buildDiceComponents("guild-1", "channel-3"));
    expect(customIds.some((id) => id.startsWith("dice:saved:"))).toBe(false);
  });
});
