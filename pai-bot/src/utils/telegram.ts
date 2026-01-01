/**
 * Telegram formatting utilities using @grammyjs/parse-mode
 */

export { fmt, bold, italic, code, pre, link } from "@grammyjs/parse-mode";

/**
 * Escape special characters for Telegram MarkdownV2
 * Characters: _ * [ ] ( ) ~ ` > # + - = | { } . ! \
 *
 * @deprecated Use `fmt` template literal instead for auto-escaping
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
