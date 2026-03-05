/**
 * Prompt Store
 * In-memory store for pending user prompts (MCP → user → MCP)
 */

export interface PendingPrompt {
  id: string;
  sessionId: number;
  question: string;
  options: string[];
  result: number | null; // index of selected option, null = pending
  createdAt: number;
  timeoutMs: number;
}

const prompts = new Map<string, PendingPrompt>();

let nextId = 1;

export function createPrompt(
  sessionId: number,
  question: string,
  options: string[],
  timeoutMs = 60_000,
): PendingPrompt {
  const id = `p${nextId++}`;
  const prompt: PendingPrompt = {
    id,
    sessionId,
    question,
    options,
    result: null,
    createdAt: Date.now(),
    timeoutMs,
  };
  prompts.set(id, prompt);

  // Auto-cleanup after timeout + buffer
  setTimeout(() => prompts.delete(id), timeoutMs + 10_000);

  return prompt;
}

export function resolvePrompt(id: string, optionIndex: number): boolean {
  const prompt = prompts.get(id);
  if (!prompt || prompt.result !== null) return false;
  if (optionIndex < 0 || optionIndex >= prompt.options.length) return false;
  prompt.result = optionIndex;
  return true;
}

export function getPrompt(id: string): PendingPrompt | undefined {
  return prompts.get(id);
}

export function isExpired(prompt: PendingPrompt): boolean {
  return Date.now() - prompt.createdAt > prompt.timeoutMs;
}
