/**
 * Dice Panel (TRPG Dice Roller)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

// Dice types
const DICE_ROW_1 = ["d4", "d6", "d8", "d10", "d12"] as const;
const DICE_ROW_2 = ["d20", "d100"] as const;
const ALL_DICE = [...DICE_ROW_1, ...DICE_ROW_2] as const;
const MAX_SAVED_CUSTOM = 5;
const MAX_VISIBLE_SAVED_CUSTOM = 5;

export type DiceType = (typeof ALL_DICE)[number];

// Game system types and presets
export type GameSystem = "generic" | "coc" | "dnd" | "fate";

export interface DicePreset {
  label: string;
  expression: string;
}

// Basic presets shared by all systems
const BASIC_PRESETS: DicePreset[] = [
  { label: "1d20", expression: "1d20" },
  { label: "1d100", expression: "1d100" },
  { label: "2d6", expression: "2d6" },
];

// System-specific presets (will be combined with basic)
const SYSTEM_SPECIFIC_PRESETS: Record<GameSystem, DicePreset[]> = {
  generic: [],
  coc: [
    { label: "獎1", expression: "10*2d10kl1+1d10" }, // keep lowest tens = lower result (better in CoC)
    { label: "罰1", expression: "10*2d10k1+1d10" }, // keep highest tens = higher result (worse in CoC)
    { label: "獎2", expression: "10*3d10kl1+1d10" }, // keep lowest from 3 tens dice
    { label: "罰2", expression: "10*3d10k1+1d10" }, // keep highest from 3 tens dice
    { label: "3d6", expression: "3d6" },
  ],
  dnd: [
    { label: "優勢", expression: "2d20k1" },
    { label: "劣勢", expression: "2d20kl1" },
    { label: "4d6k3", expression: "4d6k3" },
  ],
  fate: [{ label: "4dF", expression: "4dF" }],
};

// Combined presets: system-specific first, then basic
export const GAME_SYSTEM_PRESETS: Record<GameSystem, DicePreset[]> = {
  generic: [...BASIC_PRESETS],
  coc: [...SYSTEM_SPECIFIC_PRESETS.coc, ...BASIC_PRESETS],
  dnd: [...SYSTEM_SPECIFIC_PRESETS.dnd, ...BASIC_PRESETS],
  fate: [...SYSTEM_SPECIFIC_PRESETS.fate, ...BASIC_PRESETS],
};

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = {
  generic: "通用",
  coc: "CoC",
  dnd: "DnD",
  fate: "Fate",
};

// Per-channel dice history message tracking
export interface DicePanel {
  historyMessageId: string;
  panelMessageId: string;
  channelId: string;
  gameSystem: GameSystem;
  savedCustomExpressions: string[];
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
 * Update game system for a channel (resets panel)
 */
export function setGameSystem(channelId: string, system: GameSystem): void {
  const panel = dicePanels.get(channelId);
  if (panel) {
    panel.gameSystem = system;
  }
}

/**
 * Save custom expression for a channel (shared by everyone in the channel)
 * Keeps latest 5 unique expressions.
 */
export function saveCustomExpression(channelId: string, expression: string): string[] {
  const panel = dicePanels.get(channelId);
  if (!panel) return [];

  const normalized = expression.toLowerCase().trim().replace(/\s+/g, "");
  const filtered = (panel.savedCustomExpressions || []).filter(
    (expr) => expr.toLowerCase().trim().replace(/\s+/g, "") !== normalized,
  );

  panel.savedCustomExpressions = [expression.trim(), ...filtered].slice(0, MAX_SAVED_CUSTOM);
  return panel.savedCustomExpressions;
}

/**
 * Clear all saved custom expressions for a channel.
 */
export function clearCustomExpressions(channelId: string): void {
  const panel = dicePanels.get(channelId);
  if (!panel) return;
  panel.savedCustomExpressions = [];
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
 * Roll a single dice term (e.g., "2d6", "4d6k3", "d20")
 * Returns { value, text } or null if invalid
 */
function rollSingleDice(term: string): { value: number; text: string } | null {
  // Fate dice: df, 4df
  const fateMatch = term.match(/^(\d*)df$/);
  if (fateMatch) {
    const count = fateMatch[1] ? parseInt(fateMatch[1], 10) : 4;
    if (count < 1 || count > 20) return null;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(rollFateDie());
    }
    const value = rolls.reduce((a, b) => a + b, 0);
    return { value, text: `${count}dF[${rolls.map(formatFateRoll).join(" ")}]=${value}` };
  }

  // Normal dice: XdY[k|kh|kl|d|dh|dl]Z
  const match = term.match(/^(\d*)d(\d+)(?:(k|kh|kl|d|dh|dl)(\d+))?$/);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const keepDropOp = match[3] as "k" | "kh" | "kl" | "d" | "dh" | "dl" | undefined;
  const keepDropCount = match[4] ? parseInt(match[4], 10) : 0;

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  if (keepDropOp && (keepDropCount < 1 || keepDropCount >= count)) return null;

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }

  // Apply keep/drop
  const droppedIndices: Set<number> = new Set();
  if (keepDropOp) {
    const sorted = rolls.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    if (keepDropOp === "k" || keepDropOp === "kh") {
      for (const x of sorted.slice(0, count - keepDropCount)) droppedIndices.add(x.i);
    } else if (keepDropOp === "kl") {
      for (const x of sorted.slice(keepDropCount)) droppedIndices.add(x.i);
    } else if (keepDropOp === "d" || keepDropOp === "dl") {
      for (const x of sorted.slice(0, keepDropCount)) droppedIndices.add(x.i);
    } else if (keepDropOp === "dh") {
      for (const x of sorted.slice(count - keepDropCount)) droppedIndices.add(x.i);
    }
  }

  const keptRolls = rolls.filter((_, i) => !droppedIndices.has(i));
  const value = keptRolls.reduce((a, b) => a + b, 0);

  // Format output
  let diceStr = `${count}d${sides}`;
  if (keepDropOp) diceStr += `${keepDropOp}${keepDropCount}`;

  const formattedRolls = rolls.map((r, i) => (droppedIndices.has(i) ? `~~${r}~~` : `${r}`));
  return { value, text: `${diceStr}[${formattedRolls.join(",")}]=${value}` };
}

/**
 * Parse and roll dice expression
 * Supports: "2d6+3", "d20", "4d6k3", "4dF", "10*2d10k1+1d10"
 */
export function parseAndRoll(expression: string): { text: string; total: number } | null {
  const expr = expression.toLowerCase().trim().replace(/\s+/g, "");

  // Tokenize: split by + and - while keeping the sign
  const tokens: { sign: number; term: string }[] = [];
  let current = "";
  let sign = 1;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if ((char === "+" || char === "-") && current.length > 0) {
      tokens.push({ sign, term: current });
      sign = char === "+" ? 1 : -1;
      current = "";
    } else if (char !== "+" && char !== "-") {
      current += char;
    } else if (current.length === 0) {
      // Handle leading sign
      sign = char === "+" ? 1 : -1;
    }
  }
  if (current.length > 0) {
    tokens.push({ sign, term: current });
  }

  if (tokens.length === 0) return null;

  const results: { value: number; text: string; sign: number }[] = [];
  let grandTotal = 0;

  for (const { sign: tokenSign, term } of tokens) {
    // Check for multiplier: N*dice or dice*N
    const multMatch = term.match(/^(\d+)\*(.+)$/) || term.match(/^(.+)\*(\d+)$/);

    if (multMatch) {
      const [, first, second] = multMatch;
      const multiplier = /^\d+$/.test(first) ? parseInt(first, 10) : parseInt(second, 10);
      const dicePart = /^\d+$/.test(first) ? second : first;

      const result = rollSingleDice(dicePart);
      if (!result) return null;

      const value = result.value * multiplier * tokenSign;
      grandTotal += value;
      results.push({
        value: Math.abs(value),
        text: `${multiplier}×${result.text}`,
        sign: tokenSign,
      });
    } else if (/^\d+$/.test(term)) {
      // Pure number modifier
      const value = parseInt(term, 10) * tokenSign;
      grandTotal += value;
      results.push({ value: parseInt(term, 10), text: term, sign: tokenSign });
    } else {
      // Single dice
      const result = rollSingleDice(term);
      if (!result) return null;

      grandTotal += result.value * tokenSign;
      results.push({ value: result.value, text: result.text, sign: tokenSign });
    }
  }

  // Build output text
  let text = "";
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (i === 0) {
      text = r.sign < 0 ? `-${r.text}` : r.text;
    } else {
      text += r.sign < 0 ? ` - ${r.text}` : ` + ${r.text}`;
    }
  }
  text = `**${expression}**: ${text} → **${grandTotal}**`;

  return { text, total: grandTotal };
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
 * Build game system selector dropdown
 */
function buildSystemSelector(
  guildId: string,
  currentSystem: GameSystem,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = (Object.keys(GAME_SYSTEM_LABELS) as GameSystem[]).map((sys) => ({
    label: GAME_SYSTEM_LABELS[sys],
    value: sys,
    default: sys === currentSystem,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`dice:system:${guildId}`)
    .setPlaceholder("選擇遊戲系統")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Build preset rows (based on current game system)
 * Returns 1-2 rows depending on number of presets
 */
function buildPresetRows(guildId: string, system: GameSystem): ActionRowBuilder<ButtonBuilder>[] {
  const presets = GAME_SYSTEM_PRESETS[system];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Row 1: up to 5 presets
  const row1Buttons: ButtonBuilder[] = [];
  for (let i = 0; i < Math.min(presets.length, 5); i++) {
    const preset = presets[i];
    row1Buttons.push(
      new ButtonBuilder()
        .setCustomId(`dice:quick:${preset.expression}:${guildId}`)
        .setLabel(preset.label)
        .setStyle(ButtonStyle.Primary),
    );
  }
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...row1Buttons));

  // Row 2: remaining presets + Custom (if more than 5 presets)
  const row2Buttons: ButtonBuilder[] = [];
  for (let i = 5; i < presets.length; i++) {
    const preset = presets[i];
    row2Buttons.push(
      new ButtonBuilder()
        .setCustomId(`dice:quick:${preset.expression}:${guildId}`)
        .setLabel(preset.label)
        .setStyle(ButtonStyle.Primary),
    );
  }
  // Add Custom button
  row2Buttons.push(
    new ButtonBuilder()
      .setCustomId(`dice:custom:${guildId}`)
      .setLabel("Custom")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`dice:customreset:${guildId}`)
      .setLabel("重置Custom")
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...row2Buttons));

  return rows;
}

/**
 * Build dice buttons row 1 - instant roll mode
 */
function buildDiceRow1(guildId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...DICE_ROW_1.map((dice) =>
      new ButtonBuilder()
        .setCustomId(`dice:quick:${dice}:${guildId}`)
        .setLabel(dice)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

/**
 * Build row 2 as saved custom buttons (up to 5).
 * d20/d100 can still be rolled from basic presets (1d20/1d100).
 */
function buildDiceRow2(
  guildId: string,
  savedCustomExpressions: string[],
): ActionRowBuilder<ButtonBuilder> | null {
  const buttons: ButtonBuilder[] = [];

  const visibleSaved = savedCustomExpressions.slice(0, MAX_VISIBLE_SAVED_CUSTOM);
  visibleSaved.forEach((expression, index) => {
    const label = expression.length > 18 ? `${expression.slice(0, 15)}...` : expression;
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`dice:saved:${index}:${guildId}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary),
    );
  });

  if (buttons.length === 0) return null;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

/**
 * Build dice panel content
 */
export function buildDiceContent(): string {
  return "**[Dice]**";
}

/**
 * Build custom dice modal
 */
export function buildCustomDiceModal(guildId: string): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`dice:modal:${guildId}`).setTitle("自定義骰子");

  const diceInput = new TextInputBuilder()
    .setCustomId("dice_expression")
    .setLabel("骰子表達式")
    .setPlaceholder("2d6+3 | 4d6k3 取高 | 2d20kl1 取低 | 4d6d1 去低")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(50);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(diceInput);
  modal.addComponents(row);

  return modal;
}

/**
 * Build all components for dice panel
 * Layout (5 rows max):
 * 1. System dropdown
 * 2. Presets row 1 (up to 5)
 * 3. Presets row 2 (remaining + Custom + 重置Custom)
 * 4. Instant roll d4-d12
 * 5. Saved custom buttons (up to 5)
 */
export function buildDiceComponents(
  guildId: string,
  channelId?: string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  // Get current game system from panel, default to generic
  let gameSystem: GameSystem = "generic";
  let savedCustomExpressions: string[] = [];
  if (channelId) {
    const panel = getDicePanel(channelId);
    if (panel) {
      gameSystem = panel.gameSystem;
      savedCustomExpressions = panel.savedCustomExpressions || [];
    }
  }

  const presetRows = buildPresetRows(guildId, gameSystem);
  const savedCustomRow = buildDiceRow2(guildId, savedCustomExpressions);

  const rows = [
    buildSystemSelector(guildId, gameSystem) as ActionRowBuilder<MessageActionRowComponentBuilder>,
    ...presetRows.map((row) => row as ActionRowBuilder<MessageActionRowComponentBuilder>),
    buildDiceRow1(guildId) as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];

  if (savedCustomRow) {
    rows.push(savedCustomRow as ActionRowBuilder<MessageActionRowComponentBuilder>);
  }

  return rows;
}
