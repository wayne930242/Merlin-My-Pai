/**
 * LLM Provider abstraction for memory operations
 * Supports Gemini and Haiku
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface LLMResponse {
  text: string;
}

/**
 * Generate text using the configured LLM provider
 */
export async function generateText(prompt: string, maxTokens: number = 512): Promise<LLMResponse> {
  const provider = config.memory.provider;

  if (provider === "gemini") {
    return generateWithGemini(prompt, maxTokens);
  } else {
    return generateWithHaiku(prompt, maxTokens);
  }
}

async function generateWithGemini(prompt: string, maxTokens: number): Promise<LLMResponse> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      maxOutputTokens: maxTokens,
    },
  });

  const text = response.text ?? "";
  logger.debug(
    { provider: "gemini", promptLength: prompt.length, responseLength: text.length },
    "LLM response",
  );

  return { text };
}

async function generateWithHaiku(prompt: string, maxTokens: number): Promise<LLMResponse> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  logger.debug(
    { provider: "haiku", promptLength: prompt.length, responseLength: text.length },
    "LLM response",
  );

  return { text };
}
