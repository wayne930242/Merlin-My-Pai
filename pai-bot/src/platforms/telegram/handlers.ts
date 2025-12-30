import { Context } from "grammy";
import { streamClaude } from "../../claude/client";
import { contextManager } from "../../context/manager";
import { logger } from "../../utils/logger";

// Telegram rate limit for message edits (roughly 1 per second per chat)
const EDIT_THROTTLE_MS = 1000;

// Escape special characters for MarkdownV2
// Characters that need escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// Convert Claude's markdown to Telegram MarkdownV2
function toMarkdownV2(text: string): string {
  // First, protect code blocks and inline code
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract and protect code blocks
  let result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`\`\`\`${lang}\n${code}\`\`\``);
    return `__CODE_BLOCK_${idx}__`;
  });

  // Extract and protect inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`\`${code}\``);
    return `__INLINE_CODE_${idx}__`;
  });

  // Escape special characters in regular text
  result = escapeMarkdownV2(result);

  // Convert markdown syntax to MarkdownV2
  // Bold: **text** or __text__ -> *text*
  result = result.replace(/\\\*\\\*(.+?)\\\*\\\*/g, "*$1*");
  result = result.replace(/\\_\\_(.+?)\\_\\_/g, "*$1*");

  // Italic: *text* or _text_ -> _text_
  result = result.replace(/(?<!\\\*)\\\*([^*]+)\\\*(?!\\\*)/g, "_$1_");

  // Restore code blocks and inline code
  codeBlocks.forEach((code, idx) => {
    result = result.replace(`\\_\\_CODE\\_BLOCK\\_${idx}\\_\\_`, code);
  });
  inlineCodes.forEach((code, idx) => {
    result = result.replace(`\\_\\_INLINE\\_CODE\\_${idx}\\_\\_`, code);
  });

  return result;
}

// Handle /start command
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.reply(
    `🧙 Merlin 已甦醒

可用指令：
• \`/clear\` \\- 清除對話歷史
• \`/status\` \\- 查看狀態
• \`/cc:<command>\` \\- 執行 Claude slash command

直接輸入訊息即可與我對話。`,
    { parse_mode: "MarkdownV2" }
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
    `📊 狀態

• User ID: \`${userId}\`
• 對話訊息數: ${messageCount}`,
    { parse_mode: "MarkdownV2" }
  );
}

// Handle regular messages with streaming
export async function handleMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  const chatId = ctx.chat?.id;

  if (!userId || !text || !chatId) return;

  // 處理 /cc: Claude slash command
  let prompt = text;
  if (text.startsWith("/cc:")) {
    const commandPart = text.slice(4);
    prompt = `/${commandPart}`;
  }

  try {
    // Save user message
    contextManager.saveMessage(userId, "user", text);

    // Get conversation context
    const history = contextManager.getConversationContext(userId);

    // Send initial message
    const msg = await ctx.api.sendMessage(chatId, "🔮 _施法中\\.\\.\\._", {
      parse_mode: "MarkdownV2",
    });
    const messageId = msg.message_id;

    let currentThinking = "";
    let currentText = "";
    let lastEditTime = 0;
    let pendingEdit: ReturnType<typeof setTimeout> | null = null;
    let lastContent = "";

    // Throttled edit function
    const editMessage = async (content: string) => {
      // Skip if content hasn't changed
      if (content === lastContent) return;
      lastContent = content;

      const now = Date.now();
      const timeSinceLastEdit = now - lastEditTime;

      if (timeSinceLastEdit < EDIT_THROTTLE_MS) {
        // Schedule a pending edit if not already scheduled
        if (!pendingEdit) {
          pendingEdit = setTimeout(async () => {
            pendingEdit = null;
            await doEdit(content);
          }, EDIT_THROTTLE_MS - timeSinceLastEdit);
        }
        return;
      }

      await doEdit(content);
    };

    const doEdit = async (content: string) => {
      try {
        lastEditTime = Date.now();
        await ctx.api.editMessageText(chatId, messageId, content, {
          parse_mode: "MarkdownV2",
        });
      } catch (error) {
        // Ignore "message not modified" errors
        const errStr = String(error);
        if (!errStr.includes("message is not modified")) {
          logger.warn({ error }, "Failed to edit message");
          // Try sending without parse_mode as fallback
          try {
            await ctx.api.editMessageText(
              chatId,
              messageId,
              content.replace(/\\/g, "")
            );
          } catch {
            // Ignore fallback errors
          }
        }
      }
    };

    // Build display content
    const buildContent = () => {
      if (currentThinking && !currentText) {
        // Show thinking only
        const thinkingPreview =
          currentThinking.length > 300
            ? currentThinking.slice(0, 300) + "..."
            : currentThinking;
        return `💭 _${escapeMarkdownV2(thinkingPreview)}_

🔮 _思考中\\.\\.\\._`;
      }

      if (currentThinking && currentText) {
        // Show both thinking and text
        const thinkingPreview =
          currentThinking.length > 200
            ? currentThinking.slice(0, 200) + "..."
            : currentThinking;
        return `💭 _${escapeMarkdownV2(thinkingPreview)}_

${toMarkdownV2(currentText)}`;
      }

      if (currentText) {
        return toMarkdownV2(currentText);
      }

      return "🔮 _施法中\\.\\.\\._";
    };

    // Stream the response
    for await (const event of streamClaude(prompt, {
      conversationHistory: history,
    })) {
      if (event.type === "thinking") {
        currentThinking = event.content;
        await editMessage(buildContent());
      } else if (event.type === "text") {
        currentText = event.content;
        await editMessage(buildContent());
      } else if (event.type === "done") {
        // Final update with complete response
        currentText = event.content || currentText;
      } else if (event.type === "error") {
        throw new Error(event.content);
      }
    }

    // Cancel any pending edit
    if (pendingEdit) {
      clearTimeout(pendingEdit);
    }

    // Final edit with complete content (no thinking shown in final)
    const finalContent = currentText.trim();
    if (finalContent) {
      // Wait a bit to ensure we don't hit rate limit
      await Bun.sleep(EDIT_THROTTLE_MS);
      await doEdit(toMarkdownV2(finalContent));

      // Save assistant response
      contextManager.saveMessage(userId, "assistant", finalContent);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ error: errorMessage, stack: errorStack, userId }, "Failed to process message");
    await ctx.reply("❌ 魔法失效了，請稍後再試");
  }
}
