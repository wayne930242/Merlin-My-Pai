/**
 * Audio transcription service using Gemini
 * Transcribes voice messages to text
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";

interface TranscriptionResult {
  text: string;
  duration?: number;
}

/**
 * Transcribe audio file using Gemini
 * @param audioBuffer - Audio data as Buffer (OGG format from Telegram)
 * @param mimeType - MIME type of the audio (default: audio/ogg)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg",
): Promise<TranscriptionResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert buffer to base64
  const base64Audio = audioBuffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: "請將這段語音訊息轉錄為文字。只輸出轉錄內容，不要加任何說明或標點符號修飾。如果聽不清楚，請輸出 [無法辨識]。",
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? "";

    logger.info(
      { mimeType, audioSize: audioBuffer.length, textLength: text.length },
      "Audio transcribed",
    );

    return { text };
  } catch (error) {
    logger.error(
      { error, mimeType, audioSize: audioBuffer.length },
      "Transcription API call failed",
    );
    throw error;
  }
}
