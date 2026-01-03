/**
 * Dice Panel (TRPG Dice Roller)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { buildModeSwitcher } from "./mode-switcher";

// Dice types
const DICE_ROW_1 = ["d4", "d6", "d8", "d10", "d12"] as const;
const DICE_ROW_2 = ["d20", "d100"] as const;
const ALL_DICE = [...DICE_ROW_1, ...DICE_ROW_2] as const;

export type DiceType = typeof ALL_DICE[number];

// Per-user dice accumulation state
export interface DiceState {
  dice: Map<DiceType, number>; // dice type -> count
  history: DiceType[]; // order of dice added (for undo)
  guildId: string;
}

const userDiceStates = new Map<string, DiceState>();

// Per-channel dice history message tracking
export interface DicePanel {
  historyMessageId: string;
  panelMessageId: string;
  channelId: string;
}

const dicePanels = new Map<string, DicePanel>(); // channelId -> DicePanel

export function setDicePanel(channelId: string, panel: DicePanel): void {
  dicePanels.set(channelId, panel);
}

export function getDicePanel(channelId: string): DicePanel | undefined {
  return dicePanels.get(channelId);
}

export function clearDicePanel(channelId: string): void {
  dicePanels.delete(channelId);
}

/**
 * Get user's dice state
 */
export function getDiceState(userId: string): DiceState | undefined {
  return userDiceStates.get(userId);
}

/**
 * Add a die to user's accumulation
 */
export function addDie(userId: string, diceType: DiceType, guildId: string): DiceState {
  let state = userDiceStates.get(userId);
  if (!state || state.guildId !== guildId) {
    state = { dice: new Map(), history: [], guildId };
    userDiceStates.set(userId, state);
  }
  state.dice.set(diceType, (state.dice.get(diceType) || 0) + 1);
  state.history.push(diceType);
  return state;
}

/**
 * Undo last added die
 */
export function undoLastDie(userId: string): DiceState | null {
  const state = userDiceStates.get(userId);
  if (!state || state.history.length === 0) return null;

  const lastDice = state.history.pop()!;
  const count = state.dice.get(lastDice) || 0;
  if (count <= 1) {
    state.dice.delete(lastDice);
  } else {
    state.dice.set(lastDice, count - 1);
  }

  return state;
}

/**
 * Clear user's dice state
 */
export function clearDiceState(userId: string): void {
  userDiceStates.delete(userId);
}

/**
 * Format accumulated dice for display
 */
export function formatAccumulatedDice(state: DiceState): string {
  const parts: string[] = [];
  for (const diceType of ALL_DICE) {
    const count = state.dice.get(diceType);
    if (count && count > 0) {
      parts.push(`${count}${diceType}`);
    }
  }
  return parts.length > 0 ? parts.join(" + ") : "—";
}

/**
 * Roll all accumulated dice and return formatted result
 */
export function rollAccumulatedDice(userId: string): string | null {
  const state = userDiceStates.get(userId);
  if (!state || state.dice.size === 0) return null;

  const results: string[] = [];
  let grandTotal = 0;

  for (const diceType of ALL_DICE) {
    const count = state.dice.get(diceType);
    if (!count || count === 0) continue;

    const sides = parseInt(diceType.slice(1), 10);
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(rollDie(sides));
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    grandTotal += sum;

    // Format: **2d6**: [3, 5] = 8
    results.push(`**${count}${diceType}**: [${rolls.join(", ")}] = **${sum}**`);
  }

  // Clear state after rolling
  clearDiceState(userId);

  return results.join("\n") + `\n\n**Total: ${grandTotal}**`;
}

export interface DiceResult {
  type: DiceType;
  rolls: number[];
  total: number;
  modifier?: number;
}

/**
 * Roll a die
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll dice
 */
export function roll(type: DiceType, modifier?: number): DiceResult {
  const sides = parseInt(type.slice(1), 10);
  const result = rollDie(sides);
  const rolls = [result];
  const total = modifier ? result + modifier : result;
  return { type, rolls, total, modifier };
}

/**
 * Roll a Fate die (-1, 0, +1)
 */
function rollFateDie(): number {
  const roll = Math.floor(Math.random() * 3) - 1;
  return roll;
}

/**
 * Format Fate die result
 */
function formatFateRoll(roll: number): string {
  if (roll === 1) return "+";
  if (roll === -1) return "-";
  return "0";
}

/**
 * Parse and roll dice expression (e.g., "2d6+3", "d20", "3d8-2", "4df", "df")
 */
export function parseAndRoll(expression: string): { text: string; total: number } | null {
  const expr = expression.toLowerCase().trim();

  // Fate dice: df, 4df, 4df+2
  const fateMatch = expr.match(/^(\d*)df([+-]\d+)?$/);
  if (fateMatch) {
    const count = fateMatch[1] ? parseInt(fateMatch[1], 10) : 4;
    const modifier = fateMatch[2] ? parseInt(fateMatch[2], 10) : 0;

    if (count < 1 || count > 20) return null;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(rollFateDie());
    }

    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    let text = `**${count}dF**: [${rolls.map(formatFateRoll).join(" ")}] = ${sum}`;
    if (modifier !== 0) text += ` ${modifier > 0 ? "+" : ""}${modifier} = **${total}**`;
    else text += ` → **${total}**`;

    return { text, total };
  }

  // Normal dice with keep/drop: 4d6k3, 4d6kh3, 4d6kl2, 4d6d1, 4d6dh1, 4d6dl1
  // Format: XdY[k|kh|kl|d|dh|dl]Z[+/-M]
  const match = expr.match(/^(\d*)d(\d+)(?:(k|kh|kl|d|dh|dl)(\d+))?([+-]\d+)?$/);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const keepDropOp = match[3] as "k" | "kh" | "kl" | "d" | "dh" | "dl" | undefined;
  const keepDropCount = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = match[5] ? parseInt(match[5], 10) : 0;

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  if (keepDropOp && (keepDropCount < 1 || keepDropCount >= count)) return null;

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }

  // Apply keep/drop
  let keptRolls = [...rolls];
  let droppedIndices: Set<number> = new Set();

  if (keepDropOp) {
    const sorted = rolls.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);

    if (keepDropOp === "k" || keepDropOp === "kh") {
      // Keep highest N
      const toDrop = sorted.slice(0, count - keepDropCount);
      toDrop.forEach((x) => droppedIndices.add(x.i));
    } else if (keepDropOp === "kl") {
      // Keep lowest N
      const toDrop = sorted.slice(keepDropCount);
      toDrop.forEach((x) => droppedIndices.add(x.i));
    } else if (keepDropOp === "d" || keepDropOp === "dl") {
      // Drop lowest N
      const toDrop = sorted.slice(0, keepDropCount);
      toDrop.forEach((x) => droppedIndices.add(x.i));
    } else if (keepDropOp === "dh") {
      // Drop highest N
      const toDrop = sorted.slice(count - keepDropCount);
      toDrop.forEach((x) => droppedIndices.add(x.i));
    }

    keptRolls = rolls.filter((_, i) => !droppedIndices.has(i));
  }

  const sum = keptRolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  // Build expression string
  let exprStr = `**${count}d${sides}`;
  if (keepDropOp) exprStr += `${keepDropOp}${keepDropCount}`;
  if (modifier !== 0) exprStr += modifier > 0 ? `+${modifier}` : `${modifier}`;
  exprStr += `**: `;

  // Format rolls with strikethrough for dropped
  if (count > 1 || keepDropOp) {
    const formattedRolls = rolls.map((r, i) =>
      droppedIndices.has(i) ? `~~${r}~~` : `${r}`
    );
    exprStr += `[${formattedRolls.join(", ")}]`;
    if (keepDropOp) exprStr += ` = ${sum}`;
    if (modifier !== 0) exprStr += ` ${modifier > 0 ? "+" : ""}${modifier}`;
    exprStr += ` → **${total}**`;
  } else {
    exprStr += `**${rolls[0]}**`;
    if (modifier !== 0) exprStr += ` ${modifier > 0 ? "+" : ""}${modifier} = **${total}**`;
  }

  return { text: exprStr, total };
}

/**
 * Format dice result for display
 */
export function formatResult(result: DiceResult): string {
  const { type, rolls, total, modifier } = result;

  let text = `**${type}**: **${rolls[0]}**`;

  if (modifier) {
    const sign = modifier > 0 ? "+" : "";
    text += ` ${sign}${modifier} = **${total}**`;
  }

  return text;
}

/**
 * Build dice buttons row 1 (d4-d12)
 */
function buildDiceRow1(guildId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...DICE_ROW_1.map((dice) =>
      new ButtonBuilder()
        .setCustomId(`dice:add:${dice}:${guildId}`)
        .setLabel(dice.toUpperCase())
        .setStyle(ButtonStyle.Secondary)
    )
  );
}

/**
 * Build dice buttons row 2 (d20, d100, Undo)
 */
function buildDiceRow2(guildId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...DICE_ROW_2.map((dice) =>
      new ButtonBuilder()
        .setCustomId(`dice:add:${dice}:${guildId}`)
        .setLabel(dice.toUpperCase())
        .setStyle(dice === "d20" ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ButtonBuilder()
      .setCustomId(`dice:undo:${guildId}`)
      .setLabel("↩ Undo")
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Build action row with Roll and Clear buttons
 */
function buildDiceActionRow(guildId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`dice:roll:${guildId}`)
      .setLabel("🎲 Roll")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`dice:clear:${guildId}`)
      .setLabel("Clear")
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Build dice panel content
 */
export function buildDiceContent(): string {
  return "**[Dice]** 點擊骰子累積，Roll 擲出";
}

/**
 * Build all components for dice panel
 */
export function buildDiceComponents(
  guildId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    buildModeSwitcher(guildId, "dice") as ActionRowBuilder<MessageActionRowComponentBuilder>,
    buildDiceRow1(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>,
    buildDiceRow2(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>,
    buildDiceActionRow(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}
