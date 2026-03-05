import { GoogleGenAI } from "@google/genai";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const MODELS = {
  standard: "gemini-2.5-flash-image",
  pro: "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
} as const;

type ModelKey = keyof typeof MODELS;

const modelSchema = z
  .enum(["standard", "pro", "nano-banana-2"])
  .optional()
  .default("standard")
  .describe(
    "模型選擇：standard（預設，便宜快速）、pro（專業品質）、nano-banana-2（最新，速度+品質）",
  );

const resolutionSchema = z
  .enum(["512px", "1K", "2K", "4K"])
  .optional()
  .default("1K")
  .describe("輸出解析度（預設 1K）");

const aspectRatioSchema = z
  .string()
  .optional()
  .default("1:1")
  .describe("長寬比，例如 1:1、16:9、4:3、9:16");

const savePathSchema = z
  .string()
  .optional()
  .describe("儲存圖片的檔案路徑（可選），不指定則僅回傳 base64");

function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

function extractImageParts(
  response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>,
) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const texts: string[] = [];
  const images: Array<{ data: string; mimeType: string }> = [];

  for (const part of parts) {
    if ("thought" in part && part.thought) continue;
    if ("text" in part && part.text) {
      texts.push(part.text);
    } else if ("inlineData" in part && part.inlineData) {
      images.push({
        data: part.inlineData.data as string,
        mimeType: (part.inlineData.mimeType as string) || "image/png",
      });
    }
  }

  return { texts, images };
}

async function saveImage(data: string, path: string): Promise<void> {
  const buffer = Buffer.from(data, "base64");
  await Bun.write(path, buffer);
}

export function registerImageTools(server: McpServer): void {
  // --- image_generate ---
  server.registerTool(
    "image_generate",
    {
      title: "Generate Image",
      description: "使用 Nano Banana 生成圖片。支援三種模型：standard（預設）、pro、nano-banana-2",
      inputSchema: {
        prompt: z.string().describe("圖片生成提示詞"),
        model: modelSchema,
        resolution: resolutionSchema,
        aspect_ratio: aspectRatioSchema,
        save_path: savePathSchema,
      },
    },
    async ({ prompt, model, resolution, aspect_ratio, save_path }) => {
      try {
        const ai = getClient();
        const modelId = MODELS[model as ModelKey];

        const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: aspect_ratio,
              imageSize: resolution,
            },
          },
        });

        const { texts, images } = extractImageParts(response);

        if (images.length === 0) {
          return {
            content: [{ type: "text" as const, text: texts.join("\n") || "未能生成圖片" }],
            isError: true,
          };
        }

        const content: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
        > = [];

        for (const img of images) {
          if (save_path) {
            await saveImage(img.data, save_path);
            content.push({ type: "text", text: `圖片已儲存至 ${save_path}` });
          }
          content.push({ type: "image", data: img.data, mimeType: img.mimeType });
        }

        if (texts.length > 0) {
          content.push({ type: "text", text: texts.join("\n") });
        }

        return { content };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `圖片生成錯誤: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // --- image_edit ---
  server.registerTool(
    "image_edit",
    {
      title: "Edit Image",
      description: "使用 Nano Banana 編輯圖片。上傳圖片並提供修改指令",
      inputSchema: {
        prompt: z.string().describe("編輯指令，描述要如何修改圖片"),
        image_path: z.string().describe("要編輯的圖片檔案路徑"),
        model: modelSchema,
        resolution: resolutionSchema,
        aspect_ratio: aspectRatioSchema,
        save_path: savePathSchema,
      },
    },
    async ({ prompt, image_path, model, resolution, aspect_ratio, save_path }) => {
      try {
        const ai = getClient();
        const modelId = MODELS[model as ModelKey];

        const file = Bun.file(image_path);
        if (!(await file.exists())) {
          return {
            content: [{ type: "text" as const, text: `找不到圖片: ${image_path}` }],
            isError: true,
          };
        }

        const imageBuffer = await file.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");
        const mimeType = file.type || "image/png";

        const response = await ai.models.generateContent({
          model: modelId,
          contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: aspect_ratio,
              imageSize: resolution,
            },
          },
        });

        const { texts, images } = extractImageParts(response);

        if (images.length === 0) {
          return {
            content: [{ type: "text" as const, text: texts.join("\n") || "未能編輯圖片" }],
            isError: true,
          };
        }

        const content: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
        > = [];

        for (const img of images) {
          if (save_path) {
            await saveImage(img.data, save_path);
            content.push({ type: "text", text: `圖片已儲存至 ${save_path}` });
          }
          content.push({ type: "image", data: img.data, mimeType: img.mimeType });
        }

        if (texts.length > 0) {
          content.push({ type: "text", text: texts.join("\n") });
        }

        return { content };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `圖片編輯錯誤: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // --- image_analyze ---
  server.registerTool(
    "image_analyze",
    {
      title: "Analyze Image",
      description: "使用 Nano Banana 分析或描述圖片內容",
      inputSchema: {
        prompt: z.string().describe("分析指令，例如「描述這張圖片」或「這張圖片中有什麼物體？」"),
        image_path: z.string().describe("要分析的圖片檔案路徑"),
        model: modelSchema,
      },
    },
    async ({ prompt, image_path, model }) => {
      try {
        const ai = getClient();
        const modelId = MODELS[model as ModelKey];

        const file = Bun.file(image_path);
        if (!(await file.exists())) {
          return {
            content: [{ type: "text" as const, text: `找不到圖片: ${image_path}` }],
            isError: true,
          };
        }

        const imageBuffer = await file.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");
        const mimeType = file.type || "image/png";

        const response = await ai.models.generateContent({
          model: modelId,
          contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
        });

        const text = response.text ?? "";

        return {
          content: [{ type: "text" as const, text: text || "無法分析圖片" }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `圖片分析錯誤: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
