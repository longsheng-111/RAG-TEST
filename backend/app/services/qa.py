"""
问答服务模块 - 混合检索 + LLM 生成
"""
from typing import Optional
from openai import OpenAI

from app.core.config import settings
from app.services.token_tracker import TokenTracker, TokenCost, estimate_tokens
from app.services.agent import agent_query
from app.services.harness import guard_input, fallback_error
from app.services.retrieval import AdvancedRetriever


# ============================================================
#  LLM 问答生成
# ============================================================

def _build_prompt(
    question: str,
    context_chunks: list[str],
    history: list[dict],
) -> str:
    """构建发给 DeepSeek 的 user prompt，并控制上下文长度"""

    # 根据预算截断参考资料
    max_context_tokens = settings.max_input_tokens - settings.max_output_tokens - 500
    selected_chunks = []
    current_tokens = estimate_tokens(question)
    for history_msg in history[-6:]:
        current_tokens += estimate_tokens(history_msg.get("content", ""))

    for chunk in context_chunks:
        chunk_tokens = estimate_tokens(chunk)
        if current_tokens + chunk_tokens > max_context_tokens and selected_chunks:
            break
        selected_chunks.append(chunk)
        current_tokens += chunk_tokens

    context_text = "\n\n---\n\n".join(
        f"[参考片段 {i + 1}]\n{chunk}"
        for i, chunk in enumerate(selected_chunks)
    )

    # 历史对话
    history_text = ""
    if history:
        lines = []
        for msg in history[-6:]:  # 最多保留最近6条
            role = "用户" if msg["role"] == "user" else "助手"
            lines.append(f"{role}: {msg['content']}")
        history_text = "\n".join(lines)

    prompt = f"""请根据以下参考资料回答用户的问题。

## 对话历史
{history_text or "（无历史）"}

## 参考资料
{context_text}

## 用户问题
{question}

## 回答要求
1. 使用 Markdown 格式组织回答，包含标题、列表、加粗等
2. 如果参考资料不足以回答问题，请明确说明
3. 引用具体来源时，必须在对应事实陈述后使用 Markdown 上标格式 [^N^]，其中 N 为参考资料编号（从 1 开始）
4. 同一条事实可引用多个来源，格式为 [^1^][^2^]
5. 回答要简洁、准确、有条理，总字数控制在 800 字以内

## 回答"""
    return prompt


def generate_answer(
    question: str,
    context_chunks: list[str],
    history: Optional[list[dict]] = None,
    system_prompt: str = "",
) -> tuple[str, TokenCost]:
    """调用 DeepSeek Chat API 生成回答，返回 (answer, token_cost)"""
    empty_cost = TokenCost()
    if not settings.deepseek_api_key:
        return "⚠️ 未配置 DEEPSEEK_API_KEY，请在 .env 文件中设置 API 密钥。", empty_cost

    if not context_chunks:
        return "根据现有知识库，无法找到与该问题相关的内容。", empty_cost

    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    prompt = _build_prompt(question, context_chunks, history or [])

    try:
        tracker = TokenTracker(client)
        response, token_cost = tracker.chat_completion(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt or "你是一个专业、准确的知识库问答助手。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=settings.max_output_tokens,
        )
        answer = response.choices[0].message.content or ""
        return answer, token_cost
    except Exception as e:
        return f"❌ 调用 DeepSeek API 失败: {str(e)}", empty_cost


# ============================================================
#  完整问答流水线
# ============================================================

def qa_query(
    question: str,
    collection_name: str = "knowledge_chunks",
    top_k: int = 5,
    history: Optional[list[dict]] = None,
    system_prompt: str = "",
) -> dict:
    """
    完整问答流程：Agent Loop（ReAct）→ 混合检索 → LLM 生成
    """
    # 1. Harness 输入校验
    input_error = guard_input(question)
    if input_error:
        return {
            "answer": fallback_error(input_error),
            "sources": [],
            "query": question,
            "collection_name": collection_name,
            "token_cost": dict(TokenCost()),
        }

    # 2. 准备检索和生成函数
    retriever = AdvancedRetriever(collection_name)

    def retrieve_func(query: str) -> list[tuple[str, str, float]]:
        return retriever.hybrid_search(query, top_k=top_k * 2)

    def generate_func(
        q: str,
        context_chunks: list[str],
        hist: list[dict],
    ) -> tuple[str, TokenCost]:
        return generate_answer(q, context_chunks, hist, system_prompt)

    # 3. Agent Loop
    try:
        result = agent_query(
            question=question,
            retrieve_func=retrieve_func,
            generate_func=generate_func,
            history=history,
        )
    except Exception as e:
        return {
            "answer": fallback_error(str(e)),
            "sources": [],
            "query": question,
            "collection_name": collection_name,
            "token_cost": dict(TokenCost()),
        }

    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "query": question,
        "collection_name": collection_name,
        "token_cost": dict(result["token_cost"]),
    }
