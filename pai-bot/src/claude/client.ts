import { resolve } from "node:path";
import { spawn } from "bun";
import { config } from "../config";
import { emitEvent } from "../events";
import { logger } from "../utils/logger";
import { processManager } from "./process-manager";

/**
 * Abort any active Claude process for a user
 * Returns true if a process was aborted
 */
export function abortUserProcess(userId: number): boolean {
  return processManager.abort(userId);
}

/**
 * Check if user has an active Claude process
 */
export function hasActiveProcess(userId: number): boolean {
  return processManager.hasActiveProcess(userId);
}

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
  userId?: number;
  signal?: AbortSignal;
  platform?: string;
  sessionId?: string;
  idleTimeoutMs?: number;
}

// Default idle timeout: 5 minutes without any output
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Session -> reset function mapping for heartbeat
const sessionResetFunctions = new Map<string, () => void>();

/**
 * Reset idle timeout for a session (called by heartbeat API)
 * Returns true if the session was found and reset
 */
export function resetIdleTimeoutBySession(sessionId: string): boolean {
  const resetFn = sessionResetFunctions.get(sessionId);
  if (resetFn) {
    resetFn();
    return true;
  }
  return false;
}

// Streaming version - yields events as they come
export async function* streamClaude(
  prompt: string,
  options?: ClaudeOptions,
): AsyncGenerator<StreamEvent> {
  let fullPrompt = prompt;

  if (options?.conversationHistory) {
    fullPrompt = `[Previous conversation]\n${options.conversationHistory}\n\n[Current message]\n${prompt}`;
  }

  const projectDir = resolve(process.cwd(), config.claude.projectDir);

  logger.debug({ promptLength: fullPrompt.length, cwd: projectDir }, "Streaming Claude call");

  // 生成或使用提供的 sessionId
  const sessionId = options?.sessionId || crypto.randomUUID();

  // 發射 claude:start 事件
  if (options?.userId) {
    emitEvent("claude:start", {
      sessionId,
      platform: options.platform || "unknown",
      userId: options.userId,
      prompt: prompt.slice(0, 500), // 只發送前 500 字
    });
  }

  const proc = spawn({
    cmd: [
      config.claude.bin,
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
    env: {
      ...process.env,
      PAI_SESSION_ID: sessionId, // 傳給 hook 用於心跳
    },
  });

  // 並行捕獲 stderr，避免時序競爭導致 stderr 丟失
  let stderrBuffer = "";
  const stderrPromise = (async () => {
    try {
      const stderrDecoder = new TextDecoder();
      for await (const chunk of proc.stderr) {
        stderrBuffer += stderrDecoder.decode(chunk, { stream: true });
      }
    } catch (error) {
      logger.warn({ error }, "Error reading stderr stream");
    }
  })();

  // Create abort controller for this process
  const abortController = new AbortController();

  // Register process if userId is provided
  if (options?.userId) {
    processManager.register(options.userId, proc, abortController);
  }

  // Link external signal to our abort controller
  if (options?.signal) {
    options.signal.addEventListener("abort", () => {
      abortController.abort();
      proc.kill();
    });
  }

  // Idle timeout mechanism
  const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isIdleTimeout = false;

  const resetIdleTimeout = () => {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      isIdleTimeout = true;
      logger.warn({ userId: options?.userId, sessionId }, "Claude process idle timeout");
      abortController.abort();
      proc.kill();
    }, idleTimeoutMs);
  };

  const clearIdleTimeout = () => {
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    }
  };

  // Start idle timeout
  resetIdleTimeout();

  // Register reset function for heartbeat API
  sessionResetFunctions.set(sessionId, resetIdleTimeout);

  const decoder = new TextDecoder();
  let buffer = "";
  let lastThinking = "";
  let lastText = "";

  try {
    for await (const chunk of proc.stdout) {
      // Reset idle timeout on any output
      resetIdleTimeout();

      // Check if aborted
      if (abortController.signal.aborted) {
        yield { type: "error", content: isIdleTimeout ? "任務逾時（5 分鐘無輸出）" : "任務已中斷" };
        return;
      }
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
                  emitEvent("claude:thinking", { sessionId, content: block.thinking });
                  yield { type: "thinking", content: block.thinking };
                }
              } else if (block.type === "text" && block.text) {
                // Only yield if text content changed
                if (block.text !== lastText) {
                  lastText = block.text;
                  emitEvent("claude:text", { sessionId, content: block.text });
                  yield { type: "text", content: block.text };
                }
              } else if (block.type === "tool_use") {
                emitEvent("claude:tool", {
                  sessionId,
                  tool: block.name || "unknown",
                  input: block.input,
                });
              }
            }
          } else if (event.type === "result") {
            emitEvent("claude:done", { sessionId, response: event.result || "" });
            yield { type: "done", content: event.result || "" };
          }
        } catch (parseError) {
          // 記錄 JSON 解析錯誤（可能是重要的診斷信息）
          logger.debug(
            {
              line: line.substring(0, 100),
              error: parseError instanceof Error ? parseError.message : String(parseError),
            },
            "Failed to parse JSON line",
          );
        }
      }
    }

    const exitCode = await proc.exited;

    // 確保 stderr 捕獲完成
    await stderrPromise;

    if (exitCode !== 0 && !abortController.signal.aborted) {
      logger.error(
        { exitCode, stderr: stderrBuffer.trim(), lastStdout: buffer.trim() },
        "Claude process failed",
      );
      throw new Error(`Claude 執行失敗 (exit ${exitCode}):\n${stderrBuffer || "(無錯誤訊息)"}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      { error: errorMessage, stack: errorStack, stderr: stderrBuffer, exitCode: proc.exitCode },
      "Stream error",
    );
    emitEvent("claude:error", { sessionId, error: errorMessage });
    yield { type: "error", content: errorMessage };
  } finally {
    // Clear idle timeout
    clearIdleTimeout();

    // Unregister reset function
    sessionResetFunctions.delete(sessionId);

    // Unregister process when done
    if (options?.userId) {
      processManager.unregister(options.userId);
    }
  }
}

// Non-streaming version for backward compatibility
export async function callClaude(
  prompt: string,
  options?: ClaudeOptions,
  retryCount = 0,
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
