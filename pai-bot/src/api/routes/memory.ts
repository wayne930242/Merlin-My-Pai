/**
 * Memory API Routes Handler
 * 支援雙層記憶系統的 REST API
 */

import { createMemoryCapabilityForUser } from "../../memory/capability";
import { MAX_MEMORIES_PER_USER } from "../../memory/constants";

function resolveDefaultUserId(): number {
  const raw = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0];
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const DEFAULT_USER_ID = resolveDefaultUserId();
const memoryCapability = createMemoryCapabilityForUser(DEFAULT_USER_ID);

interface MemoryRouteResult {
  response: Response;
  handled: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle memory API routes
 * Returns { handled: true, response } if matched, { handled: false } otherwise
 */
export async function handleMemoryRoutes(
  path: string,
  method: string,
  req: Request,
): Promise<MemoryRouteResult> {
  // POST /api/memory/save - 保存中短期記憶
  if (path === "/api/memory/save" && method === "POST") {
    const body = await req.json();
    const { content, category = "context", importance = 1 } = body;

    if (!content) {
      return {
        handled: true,
        response: Response.json(
          { ok: false, error: "content required" },
          { status: 400, headers: corsHeaders },
        ),
      };
    }

    const id = await memoryCapability.saveShortTerm({
      content,
      category,
      importance,
    });

    if (id === null) {
      return {
        handled: true,
        response: Response.json({ ok: true, duplicate: true }, { headers: corsHeaders }),
      };
    }

    return {
      handled: true,
      response: Response.json({ ok: true, id }, { headers: corsHeaders }),
    };
  }

  // POST /api/memory/search - 搜尋記憶（支援關鍵字陣列或查詢字串）
  if (path === "/api/memory/search" && method === "POST") {
    const body = await req.json();
    const { keywords: inputKeywords, query, limit = 10 } = body;

    let keywords = inputKeywords || [];
    if (query && keywords.length === 0) {
      keywords = extractKeywords(query);
    }

    const memories = await memoryCapability.search(keywords, limit);

    return {
      handled: true,
      response: Response.json(
        {
          ok: true,
          count: memories.length,
          memories: memories.map((m) => ({
            id: m.id,
            content: m.content,
            category: m.category,
            importance: m.importance,
          })),
        },
        { headers: corsHeaders },
      ),
    };
  }

  // GET /api/memory/stats - 記憶統計
  if (path === "/api/memory/stats" && method === "GET") {
    const count = memoryCapability.count();
    return {
      handled: true,
      response: Response.json(
        {
          total: count,
          limit: MAX_MEMORIES_PER_USER,
          usage: `${count}/${MAX_MEMORIES_PER_USER}`,
        },
        { headers: corsHeaders },
      ),
    };
  }

  // POST /api/memory/cleanup - 清理舊記憶（強制執行上限）
  if (path === "/api/memory/cleanup" && method === "POST") {
    const removed = memoryCapability.cleanup();
    return {
      handled: true,
      response: Response.json({ ok: true, removed }, { headers: corsHeaders }),
    };
  }

  return { handled: false, response: new Response() };
}

/**
 * 從文字中提取關鍵字
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    // 中文停用詞
    "的",
    "是",
    "在",
    "了",
    "和",
    "與",
    "有",
    "我",
    "你",
    "這",
    "那",
    "什麼",
    "怎麼",
    "可以",
    "需要",
    "想要",
    "請",
    // 英文停用詞
    "the",
    "a",
    "an",
    "is",
    "are",
    "to",
    "of",
    "in",
    "for",
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w))
    .slice(0, 10);
}
