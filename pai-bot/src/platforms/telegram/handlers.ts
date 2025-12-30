import { Context } from "grammy";
import { callClaude } from "../../claude/client";
import { contextManager } from "../../context/manager";
import { logger } from "../../utils/logger";

// Handle /start command
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.reply(
    "🧙 Merlin 已甦醒\n\n" +
      "可用指令：\n" +
      "• <code>/clear</code> - 清除對話歷史\n" +
      "• <code>/status</code> - 查看狀態\n" +
      "• <code>/cc:&lt;command&gt;</code> - 執行 Claude slash command\n\n" +
      "直接輸入訊息即可與我對話。",
    { parse_mode: "HTML" }
  );
}

// Handle /clear command
export async function handleClear(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  contextManager.clearHistory(userId);
  await ctx.reply("✅ 對話歷史已清除");
}

// Handle /status command
export async function handleStatus(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const messageCount = contextManager.getMessageCount(userId);

  await ctx.reply(
    `📊 狀態\n\n` +
      `• User ID: \`${userId}\`\n` +
      `• 對話訊息數: ${messageCount}`,
    { parse_mode: "Markdown" }
  );
}

// Handle regular messages
export async function handleMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;

  if (!userId || !text) return;

  // 處理 /cc: Claude slash command
  let prompt = text;
  if (text.startsWith("/cc:")) {
    // /cc:commit -> 執行 /commit
    // /cc:commit message -> 執行 /commit message
    const commandPart = text.slice(4); // 移除 "/cc:"
    prompt = `/${commandPart}`;
  }

  // Show typing indicator
  await ctx.replyWithChatAction("typing");

  try {
    // Save user message
    contextManager.saveMessage(userId, "user", text);

    // Get conversation context
    const history = contextManager.getConversationContext(userId);

    // Call Claude
    const result = await callClaude(prompt, {
      conversationHistory: history,
    });

    // Save assistant response
    contextManager.saveMessage(userId, "assistant", result.response);

    // Send response
    await sendFormattedReply(ctx, result.response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to process message");
    await ctx.reply("❌ 魔法失效了，請稍後再試");
  }
}

// 轉換 Markdown 到 HTML（簡易版）
function markdownToHtml(text: string): string {
  return text
    // Code blocks (must be first)
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    // Italic
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<i>$1</i>")
    // Escape HTML special chars in remaining text (but not in tags we just added)
    .replace(/&(?!amp;|lt;|gt;)/g, "&amp;")
    .replace(/<(?!\/?(b|i|code|pre)[ >])/g, "&lt;");
}

// 發送格式化的回覆
async function sendFormattedReply(ctx: Context, text: string): Promise<void> {
  const html = markdownToHtml(text);

  if (html.length > 4096) {
    const chunks = splitMessage(html, 4096);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: "HTML" });
    }
  } else {
    await ctx.reply(html, { parse_mode: "HTML" });
  }
}

// Split long messages
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}
