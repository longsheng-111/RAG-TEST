"""
会话标题自动生成模块

根据用户问题生成 5-10 字的精炼标题，便于会话列表展示。
失败时回退到问题前 20 字。
"""
from openai import OpenAI

from app.core.config import settings
from app.services.token_tracker import TokenTracker, TokenCost


def generate_session_title(question: str) -> tuple[str, TokenCost]:
    """
    基于用户问题生成会话标题。
    返回 (title, token_cost)
    """
    if not settings.deepseek_api_key:
        return _fallback_title(question), TokenCost()

    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    prompt = f"""请根据以下用户问题，生成一个 5-10 字的精炼标题，用于会话列表展示。
要求：简洁、准确、不添加标点符号。

用户问题：{question}

标题："""

    try:
        tracker = TokenTracker(client)
        response, token_cost = tracker.chat_completion(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是标题生成助手，只输出标题文本。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=20,
        )
        title = response.choices[0].message.content or ""
        title = title.strip().strip('"').strip("'").strip("#").strip()

        # 长度控制
        if len(title) < 2:
            title = _fallback_title(question)
        elif len(title) > 20:
            title = title[:20]

        return title, token_cost
    except Exception:
        return _fallback_title(question), TokenCost()


def _fallback_title(question: str) -> str:
    """兜底标题"""
    return question.strip()[:20] or "新会话"
