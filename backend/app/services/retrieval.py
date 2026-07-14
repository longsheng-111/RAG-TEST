"""
检索层升级：BM25 + 密集向量 + RRF 融合 + BGE 重排序

召回流程：
1. BM25 召回 top 20
2. 向量检索召回 top 20
3. RRF 融合得到 top 15
4. BGE 向量交叉相似度重排序，取 top 5
"""
import re
import numpy as np
from typing import Optional

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None

from app.core.config import settings
from app.core.vector_store import vector_search, get_vector_store, encode_query, encode_texts


class AdvancedRetriever:
    """高级混合检索器"""

    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.documents: list[str] = []
        self.metadatas: list[dict] = []
        self.tokenized_docs: list[list[str]] = []
        self.bm25: Optional[BM25Okapi] = None
        self._build_index()

    def _tokenize(self, text: str) -> list[str]:
        """
        轻量级分词：
        - 中文字符逐字切分
        - 英文、数字按连续片段切分
        """
        if not text:
            return []
        tokens = re.findall(r"[\u4e00-\u9fa5]|[a-zA-Z0-9]+", text.lower())
        # 过滤过短且无意义的 token
        return [t for t in tokens if len(t) >= 1]

    def _build_index(self) -> None:
        """从向量库构建 BM25 索引"""
        try:
            data = get_vector_store(self.collection_name)
        except Exception:
            data = {"documents": [], "metadatas": [], "ids": []}

        self.documents = data.get("documents", []) or []
        self.metadatas = data.get("metadatas", []) or []

        if not self.documents:
            return

        self.tokenized_docs = [self._tokenize(d) for d in self.documents]
        if BM25Okapi is not None and self.tokenized_docs:
            self.bm25 = BM25Okapi(self.tokenized_docs)

    def bm25_search(
        self, query: str, top_k: int = 20
    ) -> list[tuple[str, str, float]]:
        """基于 BM25 的关键词检索"""
        if not self.bm25 or not self.documents:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            if scores[idx] <= 0:
                continue
            file_name = self.metadatas[idx].get("file_name", "") if self.metadatas[idx] else ""
            results.append((file_name, self.documents[idx], float(scores[idx])))
        return results

    def vector_search(
        self, query: str, top_k: int = 20
    ) -> list[tuple[str, str, float]]:
        """语义向量检索"""
        return vector_search(query, self.collection_name, top_k)

    def rrf_fuse(
        self,
        bm25_results: list[tuple[str, str, float]],
        vec_results: list[tuple[str, str, float]],
        k: int = 60,
        top_k: int = 15,
    ) -> list[tuple[str, str, float]]:
        """Reciprocal Rank Fusion 融合 BM25 和向量检索结果"""
        scores: dict[str, float] = {}
        content_map: dict[str, tuple[str, str]] = {}

        for rank, (file_name, content, _) in enumerate(bm25_results):
            key = content[:300]
            scores[key] = scores.get(key, 0) + 1.0 / (k + rank + 1)
            content_map[key] = (file_name, content)

        for rank, (file_name, content, _) in enumerate(vec_results):
            key = content[:300]
            scores[key] = scores.get(key, 0) + 1.0 / (k + rank + 1)
            content_map[key] = (file_name, content)

        sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        results = []
        for key, score in sorted_items[:top_k]:
            file_name, content = content_map[key]
            results.append((file_name, content, score))
        return results

    def rerank(
        self,
        query: str,
        results: list[tuple[str, str, float]],
        top_k: int = 5,
    ) -> list[tuple[str, str, float]]:
        """使用 BGE 向量相似度对结果重排序，并过滤低相似度结果"""
        if not results:
            return []

        try:
            query_vec = encode_query(query)
            contents = [content for _, content, _ in results]
            content_vecs = encode_texts(contents)

            # 归一化后点积 = 余弦相似度
            similarities = (content_vecs @ query_vec).tolist()

            scored = [
                (file_name, content, float(sim))
                for (file_name, content, _), sim in zip(results, similarities)
            ]
            scored.sort(key=lambda x: x[2], reverse=True)

            # 按配置阈值过滤不相关结果
            threshold = settings.retrieval_similarity_threshold
            filtered = [item for item in scored if item[2] >= threshold]
            return filtered[:top_k]
        except Exception:
            # 重排序失败，返回原始排序（不做阈值过滤，避免误伤）
            return results[:top_k]

    def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[tuple[str, str, float]]:
        """完整混合检索：BM25 + 向量 + RRF + Rerank"""
        # 1. 多路召回
        bm25_results = self.bm25_search(query, top_k=20)
        vec_results = self.vector_search(query, top_k=20)

        # 2. RRF 融合
        fused = self.rrf_fuse(bm25_results, vec_results, top_k=15)

        # 3. Rerank 精排
        reranked = self.rerank(query, fused, top_k=top_k)

        return reranked
