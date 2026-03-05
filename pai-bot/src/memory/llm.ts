/**
 * LLM Provider for memory operations
 * Uses Gemini for text generation
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";

export interface LLMResponse {
  text: string;
}

/**
 * Generate text using Gemini
 */
export async function generateText(prompt: string, maxTokens: number = 512): Promise<LLMResponse> {
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
