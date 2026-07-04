"""
问答服务模块 - 混合检索 + LLM 生成
"""
import re
import json
from collections import defaultdict
from typing import Optional
from openai import OpenAI

from app.core.config import settings
from app.core.vector_store import get_vector_store, encode_query


class HybridRetriever:
    """混合检索引擎：关键词检索 (30%) + 向量检索 (70%)"""

    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.inverted_index: Optional[defaultdict] = None
        self.all_docs: list[dict] = []

    # ---- 倒排索引 ----
    def _build_inverted_index(self) -> None:
        """构建倒排索引"""
        if self.inverted_index is not None:
            return

        self.inverted_index = defaultdict(set)
        self.all_docs = []

        try:
            results = get_vector_store(self.collection_name)
        except Exception:
            return

        docs = results.get("documents", [])
        metadatas = results.get("metadatas", [])

        for idx, doc in enumerate(docs):
            if not doc:
                continue
            file_name = metadatas[idx].get("file_name", "") if metadatas[idx] else ""
            words = re.findall(r"[一-龥a-zA-Z0-9]+", doc.lower())
            for word in words:
                if len(word) >= 2:
                    self.inverted_index[word].add((file_name, idx))
            self.all_docs.append({"content": doc, "file_name": file_name})

    # ---- 关键词检索 ----
    def keyword_search(
        self, query: str, top_k: int = 10
    ) -> list[tuple[str, str, float]]:
        """基于倒排索引的关键词匹配"""
        self._build_inverted_index()

        if not self.inverted_index:
            return []

        query_words = re.findall(r"[一-龥a-zA-Z0-9]+", query.lower())
        scores: defaultdict = defaultdict(float)

        for word in query_words:
            if len(word) >= 2 and word in self.inverted_index:
                for file_name, idx in self.inverted_index[word]:
                    scores[(file_name, idx)] += 1.0

        results: list[tuple[str, str, float]] = []
        for (file_name, idx), score in scores.items():
            if idx < len(self.all_docs):
                normalized = score / max(len(query_words), 1)
                results.append((file_name, self.all_docs[idx]["content"], normalized))

        results.sort(key=lambda x: x[2], reverse=True)
        return results[:top_k]

    # ---- 向量检索 ----
    def vector_search(
        self, query: str, top_k: int = 10
    ) -> list[tuple[str, str, float]]:
        """语义向量检索"""
        from app.core.vector_store import vector_search as vs

        return vs(query, self.collection_name, top_k)

    # ---- 混合检索 ----
    def hybrid_search(
        self,
        query: str,
        weights: tuple[float, float] = (0.3, 0.7),
        top_k: int = 10,
    ) -> list[tuple[str, str, float]]:
        """关键词 + 向量加权融合"""
        kw_weight, vec_weight = weights

        # 各自检索（扩大召回范围）
        kw_results = self.keyword_search(query, top_k * 2)
        vec_results = self.vector_search(query, top_k * 2)

        # 加权融合
        score_map: dict[str, float] = {}
        content_map: dict[str, tuple[str, str]] = {}

        for file_name, content, score in kw_results:
            key = content[:200]  # 用前200字符当去重key
            score_map[key] = score_map.get(key, 0) + score * kw_weight
            content_map[key] = (file_name, content)

        for file_name, content, score in vec_results:
            key = content[:200]
            score_map[key] = score_map.get(key, 0) + score * vec_weight
            content_map[key] = (file_name, content)

        # 排序、去重、截断
        sorted_items = sorted(score_map.items(), key=lambda x: x[1], reverse=True)

        results: list[tuple[str, str, float]] = []
        seen: set[str] = set()
        for key, score in sorted_items:
            file_name, content = content_map[key]
            normalized = content[:200]
            if normalized not in seen and len(results) < top_k:
                seen.add(normalized)
                results.append((file_name, content, score))

        return results


# ============================================================
#  LLM 问答生成
# ============================================================

def _build_prompt(question: str, context_chunks: list[str], history: list[dict]) -> str:
    """构建发给 DeepSeek 的 prompt"""
    context_text = "\n\n---\n\n".join(
        f"[参考片段 {i + 1}]\n{chunk}"
        for i, chunk in enumerate(context_chunks)
    )

    # 历史对话
    history_text = ""
    if history:
        lines = []
        for msg in history[-6:]:  # 最多保留最近6条
            role = "用户" if msg["role"] == "user" else "助手"
            lines.append(f"{role}: {msg['content']}")
        history_text = "\n".join(lines)

    prompt = f"""你是一个专业的知识库问答助手。请根据以下参考资料回答用户的问题。

## 对话历史
{history_text or "（无历史）"}

## 参考资料
{context_text}

## 用户问题
{question}

## 回答要求
1. 使用 Markdown 格式组织回答，包含标题、列表、加粗等
2. 如果参考资料不足以回答问题，请明确说明
3. 引用具体来源时注明 [参考片段 N]
4. 回答要简洁、准确、有条理

## 回答"""
    return prompt


def generate_answer(
    question: str,
    context_chunks: list[str],
    history: Optional[list[dict]] = None,
) -> str:
    """调用 DeepSeek Chat API 生成回答"""
    if not settings.deepseek_api_key:
        return "⚠️ 未配置 DEEPSEEK_API_KEY，请在 .env 文件中设置 API 密钥。"

    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    prompt = _build_prompt(question, context_chunks, history or [])

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业、准确的知识库问答助手。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"❌ 调用 DeepSeek API 失败: {str(e)}"


# ============================================================
#  完整问答流水线
# ============================================================

def qa_query(
    question: str,
    collection_name: str = "knowledge_chunks",
    top_k: int = 5,
    history: Optional[list[dict]] = None,
) -> dict:
    """
    完整问答流程：混合检索 → 构建 prompt → LLM 生成
    """
    # 1. 检索
    retriever = HybridRetriever(collection_name)
    search_results = retriever.hybrid_search(
        question, weights=(0.3, 0.7), top_k=top_k
    )

    # 2. 提取上下文
    context_chunks: list[str] = []
    sources: list[dict] = []
    for file_name, content, score in search_results:
        context_chunks.append(content)
        sources.append({
            "content": content[:300],
            "similarity": round(score, 4),
            "file_name": file_name,
        })

    # 3. 生成回答
    answer = generate_answer(question, context_chunks, history)

    return {
        "answer": answer,
        "sources": sources,
        "query": question,
        "collection_name": collection_name,
    }
