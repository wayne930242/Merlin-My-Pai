#!/usr/bin/env python3
"""Intel Feed Agent - LangGraph 實現

使用 LangGraph StateGraph 管理新聞分析流程：
score → filter → outline → format → merge
"""

from __future__ import annotations

import json
import os
import sys
from typing import TYPE_CHECKING, Any, Literal, TypedDict

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

# Constants
MIN_RELEVANCE_SCORE = 6
ITEMS_PER_CATEGORY = 3

CATEGORY_META = {
    "ai": {"label": "AI/技術", "emoji": "🤖"},
    "startup": {"label": "創業/產品", "emoji": "💼"},
    "productivity": {"label": "生產力", "emoji": "🎯"},
    "trpg": {"label": "TRPG", "emoji": "🎲"},
    "gamedev": {"label": "遊戲開發", "emoji": "🎮"},
}


# Type definitions
class FeedItem(TypedDict):
    """原始新聞項目"""

    id: str
    source: Literal["reddit", "rss"]
    sourceName: str
    category: str
    title: str
    url: str
    score: int | None
    comments: int | None
    author: str | None
    publishedAt: str | None
    summary: str | None


class ScoredItem(FeedItem):
    """含評分的項目"""

    relevanceScore: int


class DigestItem(TypedDict):
    """摘要項目"""

    title: str
    summary: str
    url: str
    source: str


class CategoryDigest(TypedDict):
    """分類摘要"""

    category: str
    label: str
    emoji: str
    items: list[DigestItem]


class IntelFeedState(TypedDict):
    """LangGraph 狀態"""

    # 輸入
    items: list[FeedItem]

    # 中間狀態
    scored_items: list[ScoredItem]
    filtered_items: dict[str, list[ScoredItem]]  # category → items
    outlines: dict[str, str]  # category → outline

    # 輸出
    digests: list[CategoryDigest]

    # 控制
    categories_to_process: list[str]


# Pydantic models for structured output
class RelevanceScore(BaseModel):
    """相關性評分"""

    score: int = Field(description="1-10 的相關性分數", ge=1, le=10)


def _check_api_key() -> None:
    """檢查 API key"""
    if not os.environ.get("GOOGLE_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        raise ValueError("GOOGLE_API_KEY 或 GEMINI_API_KEY 環境變數未設定")


def get_lite_llm() -> ChatGoogleGenerativeAI:
    """取得輕量 LLM（用於評分等簡單任務）"""
    _check_api_key()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        temperature=0,
    )


def get_main_llm() -> ChatGoogleGenerativeAI:
    """取得主要 LLM（用於摘要生成等複雜任務）"""
    _check_api_key()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
    )


def create_intel_feed_graph() -> CompiledStateGraph[IntelFeedState]:
    """建立 Intel Feed 處理圖"""

    lite_llm = get_lite_llm()
    main_llm = get_main_llm()

    # Score prompt
    score_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一個內容評分助手。
評估這篇文章對一位關注 AI/技術、創業、生產力工具和 TRPG 的開發者的相關性。

評分標準 (1-10):
- 1-3: 不相關或低品質（廣告、重複、無實質內容）
- 4-5: 一般內容，無特殊價值
- 6-7: 有趣、原創或有價值的內容
- 8-10: 高價值內容，必讀

只回答一個數字 (1-10)，不要其他內容。""",
            ),
            (
                "human",
                "標題: {title}\n來源: {source}\n分類: {category}",
            ),
        ]
    )

    # Outline prompt
    outline_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一位資深科技編輯。為以下文章建立詳細綱要，幫助讀者快速了解今日重點。

要求：
1. 每篇文章寫 2-3 句說明核心觀點及為何重要
2. 如有關聯，指出文章之間的連結
3. 使用英文
4. 總長度：800-1000 字

直接輸出綱要，不要加前綴。""",
            ),
            ("human", "文章：\n{articles}"),
        ]
    )

    # Format prompt
    format_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一位 Telegram 推送編輯。將以下綱要整理成適合 Telegram 推送的格式。

要求：
1. 每篇文章寫 150-250 字的摘要
2. 包含：核心觀點、關鍵發現、為什麼值得關注
3. 可用 • 條列重點
4. 語氣專業但易讀
5. **必須使用繁體中文**（不可使用簡體中文或英文，所有內容都要翻譯成繁體中文）

輸出格式（每篇文章）：
標題
摘要內容（150-250字）
---

直接輸出，不要額外說明。""",
            ),
            (
                "human",
                "原始綱要：\n{outline}\n\n文章資訊：\n{articles}",
            ),
        ]
    )

    # Node: Score items
    def score_items(state: IntelFeedState) -> dict[str, Any]:
        """評分所有項目"""
        items = state["items"]
        scored: list[ScoredItem] = []

        print(f"  [score] 評分 {len(items)} 個項目...", file=sys.stderr)

        for item in items:
            try:
                prompt = score_prompt.format(
                    title=item["title"],
                    source=item["sourceName"],
                    category=item["category"],
                )
                response = lite_llm.invoke(prompt)
                score_text = str(response.content).strip()
                score = min(10, max(1, int(score_text) if score_text.isdigit() else 5))
            except Exception as e:
                print(f"  [score] 評分失敗: {e}", file=sys.stderr)
                score = 5

            scored_item: ScoredItem = {**item, "relevanceScore": score}  # type: ignore[typeddict-item]
            scored.append(scored_item)

        avg_score = sum(i["relevanceScore"] for i in scored) / len(scored)
        print(f"  [score] 完成，平均分數: {avg_score:.1f}", file=sys.stderr)
        return {"scored_items": scored}

    # Node: Filter and group items
    def filter_items(state: IntelFeedState) -> dict[str, Any]:
        """過濾低分項目並按類別分組"""
        scored = state["scored_items"]

        # 過濾低分和無摘要的項目
        filtered = [
            item
            for item in scored
            if item["relevanceScore"] >= MIN_RELEVANCE_SCORE
            and item.get("summary")
            and item["summary"].strip()
            and item["summary"].strip() != "無摘要"
        ]

        print(f"  [filter] 過濾後: {len(filtered)}/{len(scored)} 項目", file=sys.stderr)

        # 按類別分組
        by_category: dict[str, list[ScoredItem]] = {}
        for item in filtered:
            cat = item["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(item)

        # 每個類別取 top N
        for cat in by_category:
            by_category[cat] = sorted(
                by_category[cat], key=lambda x: x["relevanceScore"], reverse=True
            )[:ITEMS_PER_CATEGORY]

        categories = list(by_category.keys())
        print(f"  [filter] 類別: {categories}", file=sys.stderr)

        return {
            "filtered_items": by_category,
            "categories_to_process": categories,
        }

    # Node: Generate outlines for all categories
    def generate_outlines(state: IntelFeedState) -> dict[str, Any]:
        """為每個類別生成綱要"""
        filtered_items = state["filtered_items"]
        outlines: dict[str, str] = {}

        for category, items in filtered_items.items():
            if not items:
                continue

            print(f"  [outline] 處理 {category} ({len(items)} 項)...", file=sys.stderr)

            articles_text = "\n\n".join(
                f"{i + 1}. 【{item['sourceName']}】{item['title']}\n"
                f"   {item.get('summary', '無摘要')}\n"
                f"   連結：{item['url']}"
                for i, item in enumerate(items)
            )

            try:
                response = main_llm.invoke(outline_prompt.format(articles=articles_text))
                outlines[category] = str(response.content).strip()
            except Exception as e:
                print(f"  [outline] 生成失敗: {e}", file=sys.stderr)
                outlines[category] = "\n".join(
                    f"{item['title']}: {item.get('summary', '無摘要')}" for item in items
                )

        return {"outlines": outlines}

    # Node: Format digests
    def format_digests(state: IntelFeedState) -> dict[str, Any]:
        """格式化為最終通知"""
        filtered_items = state["filtered_items"]
        outlines = state["outlines"]
        digests: list[CategoryDigest] = []

        for category, items in filtered_items.items():
            if not items:
                continue

            outline = outlines.get(category, "")
            meta = CATEGORY_META.get(category, {"label": category, "emoji": "📰"})

            print(f"  [format] 格式化 {category}...", file=sys.stderr)

            articles_text = "\n\n".join(
                f"{i + 1}. {item['title']}\n   來源：{item['sourceName']}\n   連結：{item['url']}"
                for i, item in enumerate(items)
            )

            try:
                response = main_llm.invoke(
                    format_prompt.format(outline=outline, articles=articles_text)
                )
                formatted = str(response.content).strip()

                # Parse formatted response
                digest_items = _parse_formatted_response(formatted, items)
            except Exception as e:
                print(f"  [format] 格式化失敗: {e}", file=sys.stderr)
                digest_items = [
                    DigestItem(
                        title=item["title"],
                        summary=item.get("summary") or "無摘要",
                        url=item["url"],
                        source=item["sourceName"],
                    )
                    for item in items
                ]

            digests.append(
                CategoryDigest(
                    category=category,
                    label=meta["label"],
                    emoji=meta["emoji"],
                    items=digest_items,
                )
            )

        return {"digests": digests}

    # Helper: Parse formatted response
    def _parse_formatted_response(response: str, items: list[ScoredItem]) -> list[DigestItem]:
        """解析格式化的回應"""
        blocks = [b.strip() for b in response.split("---") if b.strip()]
        digest_items: list[DigestItem] = []

        for i, item in enumerate(items):
            if i < len(blocks):
                lines = [line for line in blocks[i].split("\n") if line.strip()]
                summary = (
                    "\n".join(lines[1:]).strip()
                    if len(lines) > 1
                    else item.get("summary") or "無摘要"
                )
            else:
                summary = item.get("summary") or "無摘要"

            digest_items.append(
                DigestItem(
                    title=item["title"],
                    summary=summary,
                    url=item["url"],
                    source=item["sourceName"],
                )
            )

        return digest_items

    # Build graph
    workflow: StateGraph[IntelFeedState] = StateGraph(IntelFeedState)

    # Add nodes
    workflow.add_node("score", score_items)
    workflow.add_node("filter", filter_items)
    workflow.add_node("outline", generate_outlines)
    workflow.add_node("format", format_digests)

    # Add edges
    workflow.add_edge(START, "score")
    workflow.add_edge("score", "filter")

    # Conditional: skip if no items
    def should_continue(state: IntelFeedState) -> Literal["outline", "end"]:
        if not state.get("categories_to_process"):
            return "end"
        return "outline"

    workflow.add_conditional_edges(
        "filter",
        should_continue,
        {"outline": "outline", "end": END},
    )

    workflow.add_edge("outline", "format")
    workflow.add_edge("format", END)

    return workflow.compile()  # type: ignore[return-value]


def process_items(items: list[FeedItem]) -> list[CategoryDigest]:
    """處理新聞項目並返回摘要"""
    if not items:
        return []

    graph = create_intel_feed_graph()

    initial_state: IntelFeedState = {
        "items": items,
        "scored_items": [],
        "filtered_items": {},
        "outlines": {},
        "digests": [],
        "categories_to_process": [],
    }

    print(f"[intel-feed-agent] 開始處理 {len(items)} 個項目", file=sys.stderr)
    result = graph.invoke(initial_state)
    print(f"[intel-feed-agent] 完成，生成 {len(result['digests'])} 個類別摘要", file=sys.stderr)

    return result["digests"]


def main() -> None:
    """主入口"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: agent.py <items_json>"}))
        sys.exit(1)

    try:
        items_json = sys.argv[1]
        items: list[FeedItem] = json.loads(items_json)

        digests = process_items(items)

        # Output JSON result
        print(json.dumps({"digests": digests}, ensure_ascii=False))

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
