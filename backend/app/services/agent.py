"""
Agent Loop：ReAct 模式实现

思考（Thought）→ 行动（Action: knowledge_search）→ 观察（Observation）→
判断充分性 → 不充分则改写查询重试（最多 3 轮）
"""
from typing import Optional, Callable
from openai import OpenAI

from app.core.config import settings
from app.services.token_tracker import TokenTracker, TokenCost, estimate_tokens


MAX_ITERATIONS = 3
# 使用与检索层一致的相似度阈值，超过此值才认为资料充分
SUFFICIENCY_THRESHOLD = settings.retrieval_similarity_threshold


def _create_client() -> Optional[OpenAI]:
    """创建 DeepSeek client"""
    if not settings.deepseek_api_key:
        return None
    return OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )


def is_sufficient(search_results: list[tuple[str, str, float]]) -> bool:
    """判断检索结果是否充分"""
    if not search_results:
        return False
    max_score = max(score for _, _, score in search_results)
    return max_score >= SUFFICIENCY_THRESHOLD


def rewrite_query(
    original_question: str,
    search_results: list[tuple[str, str, float]],
    history: list[dict],
) -> tuple[str, TokenCost]:
    """
    基于上一轮检索结果改写查询。
    返回 (新查询字符串, token_cost)；若改写失败则返回原始问题和空 cost。
    """
    client = _create_client()
    if not client:
        return original_question, TokenCost()

    # 构建观察文本
    observation_text = "\n".join(
        f"[片段 {i + 1}] {content[:200]}..."
        for i, (_, content, _) in enumerate(search_results[:5])
    )

    history_text = ""
    if history:
        lines = []
        for msg in history[-4:]:
            role = "用户" if msg["role"] == "user" else "助手"
            lines.append(f"{role}: {msg['content']}")
        history_text = "\n".join(lines)

    prompt = f"""你是一位查询改写专家。请根据原始问题和上一轮检索结果，生成一个更精准、更可能召回相关资料的查询词。

## 原始问题
{original_question}

## 对话历史
{history_text or "（无历史）"}

## 上一轮检索结果
{observation_text}

## 要求
- 查询词应保留原始问题的核心意图
- 可补充同义词、专业术语或更具体的表达
- 只输出改写后的查询词，不要解释

## 改写后的查询词"""

    try:
        tracker = TokenTracker(client)
        response, cost = tracker.chat_completion(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是查询改写专家，只输出查询词。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=100,
        )
        rewritten = response.choices[0].message.content or ""
        rewritten = rewritten.strip().strip('"').strip("'")
        return rewritten or original_question, cost
    except Exception:
        return original_question, TokenCost()


def detect_loop(
    prev_results: list[tuple[str, str, float]],
    curr_results: list[tuple[str, str, float]],
) -> bool:
    """循环检测：连续两次检索结果高度相似则终止"""
    if not prev_results or not curr_results:
        return False

    prev_keys = {content[:100] for _, content, _ in prev_results[:5]}
    curr_keys = {content[:100] for _, content, _ in curr_results[:5]}

    if not prev_keys or not curr_keys:
        return False

    intersection = prev_keys & curr_keys
    jaccard = len(intersection) / len(prev_keys | curr_keys)
    return jaccard > 0.8


def agent_query(
    question: str,
    retrieve_func: Callable[[str], list[tuple[str, str, float]]],
    generate_func: Callable,
    history: Optional[list[dict]] = None,
) -> dict:
    """
    ReAct Agent Loop 主入口。

    Args:
        question: 用户问题
        retrieve_func: 检索函数，接收 query 返回 [(file_name, content, score), ...]
        generate_func: 生成函数，接收 (question, context_chunks, history) 返回 (answer, token_cost)
        history: 对话历史

    Returns:
        {
            "answer": str,
            "sources": list[dict],
            "token_cost": TokenCost,
            "iterations": int,
            "rewritten_query": str | None,
        }
    """
    history = history or []
    total_cost = TokenCost()

    queries = [question]
    all_results: list[tuple[str, str, float]] = []
    step_results: list[list[tuple[str, str, float]]] = []
    iterations = 0
    rewritten_query = None
    prev_results: list[tuple[str, str, float]] = []

    for step in range(MAX_ITERATIONS):
        iterations = step + 1
        current_query = queries[-1]

        # Action: knowledge_search
        search_results = retrieve_func(current_query)
        step_results.append(search_results)

        # Observation: 合并到总结果
        all_results.extend(search_results)

        # 判断充分性
        if is_sufficient(search_results):
            break

        # 循环检测
        if step > 0 and detect_loop(prev_results, search_results):
            break

        # 最后一轮不再改写
        if step == MAX_ITERATIONS - 1:
            break

        # Thought + Action: 改写查询
        rewritten, rewrite_cost = rewrite_query(question, search_results, history)
        total_cost["prompt_tokens"] += rewrite_cost.prompt
        total_cost["completion_tokens"] += rewrite_cost.completion
        total_cost["total_tokens"] += rewrite_cost.total

        if rewritten != current_query:
            queries.append(rewritten)
            rewritten_query = rewritten

        # 保存上一轮结果用于循环检测
        prev_results = search_results

    # 去重并选择 top 结果
    seen_contents: set[str] = set()
    unique_results: list[tuple[str, str, float]] = []
    for file_name, content, score in sorted(
        all_results, key=lambda x: x[2], reverse=True
    ):
        key = content[:200]
        if key not in seen_contents:
            seen_contents.add(key)
            unique_results.append((file_name, content, score))
        if len(unique_results) >= 5:
            break

    # 生成答案
    context_chunks = [content for _, content, _ in unique_results]
    answer, gen_cost = generate_func(question, context_chunks, history)
    total_cost = TokenCost(
        prompt_tokens=gen_cost.prompt,
        completion_tokens=gen_cost.completion,
        total_tokens=gen_cost.total,
    )

    sources = [
        {
            "id": f"src_{idx + 1}",
            "content": content,
            "similarity": round(score, 4),
            "file_name": file_name,
        }
        for idx, (file_name, content, score) in enumerate(unique_results)
    ]

    max_source_score = unique_results[0][2] if unique_results else 0.0
    overall_confidence = (
        "high" if max_source_score >= SUFFICIENCY_THRESHOLD + 0.1
        else "medium" if max_source_score >= SUFFICIENCY_THRESHOLD
        else "low"
    )

    reasoning_steps = []
    for step_idx, q in enumerate(queries):
        hits = step_results[step_idx] if step_idx < len(step_results) else []
        reasoning_steps.append({
            "step": step_idx + 1,
            "action": "knowledge_search",
            "query": q,
            "hits": len(hits),
            "top_score": round(max((s for _, _, s in hits), default=0.0), 4),
            "confidence": overall_confidence,
        })
    if rewritten_query:
        reasoning_steps.append({
            "step": len(queries) + 1,
            "action": "query_rewrite",
            "query": rewritten_query,
            "hits": 0,
            "top_score": 0.0,
            "confidence": "medium",
        })

    return {
        "answer": answer,
        "sources": sources,
        "token_cost": total_cost,
        "iterations": iterations,
        "rewritten_query": rewritten_query,
        "reasoning_steps": reasoning_steps,
        "queries": queries,
    }
