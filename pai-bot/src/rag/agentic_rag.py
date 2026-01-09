#!/usr/bin/env python3
"""Obsidian Agentic RAG - 使用 LangGraph 實現多步推理檢索"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Any, Literal, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from obsidian_rag import ObsidianRAG
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

# Constants
DEFAULT_VAULT_PATH = Path.home() / "obsidian"
MAX_RETRIES = 2


class AgentState(TypedDict):
    """Agentic RAG 狀態"""

    messages: Annotated[list[Any], add_messages]
    question: str
    rewritten_query: str | None
    documents: list[Document]
    generation: str | None
    retry_count: int
    grade_decision: str | None


class RelevanceGrade(BaseModel):
    """文件相關性評分"""

    binary_score: Literal["yes", "no"] = Field(description="文件是否與問題相關")


class RewrittenQuery(BaseModel):
    """重寫的查詢"""

    query: str = Field(description="重寫後的搜尋查詢")


def _check_api_key() -> None:
    """檢查 API key"""
    if not os.environ.get("GOOGLE_API_KEY"):
        raise ValueError("GOOGLE_API_KEY 環境變數未設定")


def get_lite_llm() -> ChatGoogleGenerativeAI:
    """取得輕量 LLM（用於 grading 等簡單任務）"""
    _check_api_key()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        temperature=0,
    )


def get_main_llm() -> ChatGoogleGenerativeAI:
    """取得主要 LLM（用於 rewrite、generate 等複雜任務）"""
    _check_api_key()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
    )


def create_rag_graph(
    vault_path: str | Path, max_retries: int = MAX_RETRIES
) -> CompiledStateGraph[AgentState]:
    """建立 Agentic RAG 圖

    使用混合模型策略：
    - lite_llm (gemini-2.5-flash-lite): grading 等簡單任務
    - main_llm (gemini-2.5-flash): rewrite、generate 等複雜任務
    """

    rag = ObsidianRAG(vault_path)
    lite_llm = get_lite_llm()
    main_llm = get_main_llm()

    # Grader prompt (uses lite_llm)
    grade_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一個評估文件相關性的評分員。
判斷檢索到的文件是否與使用者問題相關。
如果文件包含與問題相關的關鍵字或語意，就評為相關。
只回答 'yes' 或 'no'。""",
            ),
            (
                "human",
                "文件內容:\n{document}\n\n問題: {question}",
            ),
        ]
    )
    grader_chain = grade_prompt | lite_llm.with_structured_output(RelevanceGrade)

    # Rewriter prompt (uses main_llm)
    rewrite_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一個查詢重寫專家。
將使用者的問題改寫成更適合語意搜尋的查詢。
保持原意，但使用更精確的關鍵字。
直接輸出重寫後的查詢，不要加任何前綴。""",
            ),
            (
                "human",
                "原始問題: {question}\n\n請重寫這個查詢以改善檢索效果:",
            ),
        ]
    )
    rewriter_chain = rewrite_prompt | main_llm.with_structured_output(RewrittenQuery)

    # Generator prompt (uses main_llm)
    generate_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """你是一個知識庫助手，根據檢索到的文件回答問題。
只使用提供的文件內容來回答，不要編造資訊。
如果文件中沒有相關資訊，請誠實說明。
回答要簡潔、有重點。
在回答最後列出參考的檔案路徑。""",
            ),
            (
                "human",
                "問題: {question}\n\n檢索到的文件:\n{context}",
            ),
        ]
    )

    # Node functions
    def route_question(state: AgentState) -> Literal["retrieve", "direct"]:
        """判斷是否需要檢索"""
        question = state["question"].lower()

        greetings = ["你好", "嗨", "哈囉", "hello", "hi", "hey"]
        if any(g in question for g in greetings) and len(question) < 20:
            return "direct"

        return "retrieve"

    def retrieve(state: AgentState) -> dict[str, Any]:
        """從向量庫檢索文件"""
        query = state.get("rewritten_query") or state["question"]
        print(f"  [retrieve] 查詢: {query}", file=sys.stderr)

        results = rag.search(query, top_k=5)

        documents = [
            Document(
                page_content=r["chunk"],
                metadata={"file_path": r["file_path"], "distance": r["distance"]},
            )
            for r in results
        ]

        print(f"  [retrieve] 找到 {len(documents)} 個文件", file=sys.stderr)
        return {"documents": documents}

    def grade_documents(state: AgentState) -> dict[str, str]:
        """評估文件相關性"""
        documents = state["documents"]
        question = state["question"]
        retry_count = state.get("retry_count", 0)

        if not documents:
            if retry_count < max_retries:
                print("  [grade] 無文件，重寫查詢", file=sys.stderr)
                return {"grade_decision": "rewrite"}
            print("  [grade] 無文件，直接生成", file=sys.stderr)
            return {"grade_decision": "generate"}

        doc = documents[0]
        result = grader_chain.invoke({"document": doc.page_content, "question": question})

        # Handle both dict and Pydantic model responses
        if isinstance(result, RelevanceGrade):
            score = result.binary_score
        else:
            score = result["binary_score"]  # type: ignore[index]

        if score == "yes":
            print("  [grade] 文件相關，進入生成", file=sys.stderr)
            return {"grade_decision": "generate"}
        elif retry_count < max_retries:
            print(f"  [grade] 文件不相關，重寫查詢 (retry {retry_count + 1}/{max_retries})", file=sys.stderr)
            return {"grade_decision": "rewrite"}
        else:
            print("  [grade] 達到重試上限，使用現有文件生成", file=sys.stderr)
            return {"grade_decision": "generate"}

    def rewrite_question(state: AgentState) -> dict[str, Any]:
        """重寫查詢"""
        question = state["question"]
        retry_count = state.get("retry_count", 0)

        result = rewriter_chain.invoke({"question": question})
        # Handle both dict and Pydantic model responses
        if isinstance(result, RewrittenQuery):
            new_query = result.query
        else:
            new_query = result["query"]  # type: ignore[index]

        print(f"  [rewrite] 新查詢: {new_query}", file=sys.stderr)
        return {"rewritten_query": new_query, "retry_count": retry_count + 1}

    def generate_answer(state: AgentState) -> dict[str, Any]:
        """生成答案"""
        question = state["question"]
        documents = state["documents"]

        if not documents:
            return {
                "generation": "抱歉，在知識庫中找不到相關資訊。",
                "messages": [AIMessage(content="抱歉，在知識庫中找不到相關資訊。")],
            }

        context_parts = []
        for i, doc in enumerate(documents, 1):
            file_path = doc.metadata.get("file_path", "unknown")
            context_parts.append(f"[{i}] 來源: {file_path}\n{doc.page_content}")

        context = "\n\n---\n\n".join(context_parts)

        response = main_llm.invoke(generate_prompt.format(question=question, context=context))
        answer = response.content

        print("  [generate] 生成完成", file=sys.stderr)
        return {"generation": answer, "messages": [AIMessage(content=str(answer))]}

    def direct_response(state: AgentState) -> dict[str, Any]:
        """直接回應（不需要檢索）"""
        return {
            "generation": "你好！有什麼我可以幫你在知識庫中查找的嗎？",
            "messages": [AIMessage(content="你好！有什麼我可以幫你在知識庫中查找的嗎？")],
        }

    # Build graph
    workflow: StateGraph[AgentState] = StateGraph(AgentState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade", grade_documents)
    workflow.add_node("rewrite", rewrite_question)
    workflow.add_node("generate", generate_answer)
    workflow.add_node("direct", direct_response)

    workflow.add_conditional_edges(
        START,
        route_question,
        {"retrieve": "retrieve", "direct": "direct"},
    )
    workflow.add_edge("retrieve", "grade")
    workflow.add_conditional_edges(
        "grade",
        lambda state: state["grade_decision"],
        {"generate": "generate", "rewrite": "rewrite"},
    )
    workflow.add_edge("rewrite", "retrieve")
    workflow.add_edge("generate", END)
    workflow.add_edge("direct", END)

    return workflow.compile()  # type: ignore[return-value]


def query(
    question: str,
    vault_path: str | Path = DEFAULT_VAULT_PATH,
    max_retries: int = MAX_RETRIES,
) -> dict[str, Any]:
    """執行 Agentic RAG 查詢"""
    graph = create_rag_graph(vault_path, max_retries)

    initial_state: AgentState = {
        "messages": [HumanMessage(content=question)],
        "question": question,
        "rewritten_query": None,
        "documents": [],
        "generation": None,
        "retry_count": 0,
        "grade_decision": None,
    }

    result = graph.invoke(initial_state)

    return {
        "question": question,
        "answer": result.get("generation", ""),
        "documents": [
            {"file_path": d.metadata.get("file_path"), "distance": d.metadata.get("distance")}
            for d in result.get("documents", [])
        ],
        "retry_count": result.get("retry_count", 0),
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Obsidian Agentic RAG")
    parser.add_argument("command", choices=["query"], help="執行的命令")
    parser.add_argument("--vault", default=str(DEFAULT_VAULT_PATH), help="Vault 路徑")
    parser.add_argument("--question", "-q", required=True, help="查詢問題")
    parser.add_argument("--max-retries", "-r", type=int, default=MAX_RETRIES, help="最大重試次數")
    parser.add_argument("--json", action="store_true", help="輸出 JSON 格式")

    args = parser.parse_args()

    if args.command == "query":
        if not args.json:
            print(f"Agentic RAG 查詢: {args.question}", file=sys.stderr)
            print("-" * 50, file=sys.stderr)

        result = query(args.question, args.vault, args.max_retries)

        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(f"\n回答:\n{result['answer']}")
            if result["documents"]:
                print(f"\n參考文件 ({len(result['documents'])} 個):")
                for doc in result["documents"]:
                    print(f"  - {doc['file_path']} (distance: {doc['distance']:.4f})")
            if result["retry_count"] > 0:
                print(f"\n查詢重寫次數: {result['retry_count']}")


if __name__ == "__main__":
    main()
