import { spawn } from "bun";
import { resolve } from "path";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface ClaudeResult {
  response: string;
  thinking?: string;
}

export interface StreamEvent {
  type: "thinking" | "text" | "done" | "error";
  content: string;
}

interface ClaudeOptions {
  conversationHistory?: string;
}

// Streaming version - yields events as they come
export async function* streamClaude(
  prompt: string,
  options?: ClaudeOptions
): AsyncGenerator<StreamEvent> {
  let fullPrompt = prompt;

  if (options?.conversationHistory) {
    fullPrompt = `[Previous conversation]\n${options.conversationHistory}\n\n[Current message]\n${prompt}`;
  }

  const projectDir = resolve(process.cwd(), config.claude.projectDir);

  logger.debug(
    { promptLength: fullPrompt.length, cwd: projectDir },
    "Streaming Claude call"
  );

  const proc = spawn({
    cmd: [
      "claude",
      "-p",
      fullPrompt,
      "--dangerously-skip-permissions",
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const decoder = new TextDecoder();
  let buffer = "";
  let lastThinking = "";
  let lastText = "";

  try {
    for await (const chunk of proc.stdout) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "thinking" && block.thinking) {
                // Only yield if thinking content changed
                if (block.thinking !== lastThinking) {
                  lastThinking = block.thinking;
                  yield { type: "thinking", content: block.thinking };
                }
              } else if (block.type === "text" && block.text) {
                // Only yield if text content changed
                if (block.text !== lastText) {
                  lastText = block.text;
                  yield { type: "text", content: block.text };
                }
              }
            }
          } else if (event.type === "result") {
            yield { type: "done", content: event.result || "" };
          }
        } catch {
          // Ignore JSON parse errors for incomplete lines
        }
      }
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Claude exited with code ${exitCode}: ${stderr}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ error: errorMessage, stack: errorStack }, "Stream error");
    yield { type: "error", content: errorMessage };
  }
}

// Non-streaming version for backward compatibility
export async function callClaude(
  prompt: string,
  options?: ClaudeOptions,
  retryCount = 0
): Promise<ClaudeResult> {
  try {
    let thinking = "";
    let response = "";

    for await (const event of streamClaude(prompt, options)) {
      if (event.type === "thinking") {
        thinking = event.content;
      } else if (event.type === "text") {
        response = event.content;
      } else if (event.type === "done") {
        response = event.content || response;
      } else if (event.type === "error") {
        throw new Error(event.content);
      }
    }

    logger.debug({ responseLength: response.length }, "Claude response received");

    return {
      response: response.trim(),
      thinking: thinking || undefined,
    };
  } catch (error) {
    logger.error({ error, attempt: retryCount + 1 }, "Claude call failed");

    if (retryCount < 3) {
      const delay = 1000 * (retryCount + 1);
      logger.info({ delay }, "Retrying...");
      await Bun.sleep(delay);
      return callClaude(prompt, options, retryCount + 1);
    }

    throw new Error("魔法暫時失效了，請稍後再試");
  }
}
