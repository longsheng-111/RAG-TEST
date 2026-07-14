"""
应用配置管理 - 基于 pydantic-settings 从 .env 文件加载配置
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


# 项目根目录 (backend/)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# 如果项目路径含非 ASCII 字符（如中文），ChromaDB 底层 C 库可能崩溃，
# 此时使用用户目录下的安全路径
def _safe_data_dir(dirname: str) -> str:
    raw = str(BACKEND_DIR / dirname)
    if raw.isascii():
        return raw
    # 回退到用户目录
    safe = Path.home() / ".dx-rag" / dirname
    return str(safe)


class Settings(BaseSettings):
    """应用配置，所有值优先从 .env 读取"""

    # ---- 应用 ----
    app_name: str = "dx-rag-demo"

    # ---- API Keys ----
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # ---- 向量数据库 ----
    chroma_collection: str = "knowledge_chunks"
    chroma_persist_dir: str = _safe_data_dir("chroma_db")

    # ---- 会话数据 ----
    session_dir: str = _safe_data_dir("data/sessions")

    # ---- 嵌入模型 ----
    embed_model: str = "BAAI/bge-small-zh-v1.5"

    # ---- 文件上传 ----
    upload_dir: str = _safe_data_dir("uploads")

    # ---- 文本切分 ----
    max_chunk_size: int = 800
    chunk_overlap: int = 120

    # ---- Token 预算 ----
    max_input_tokens: int = 4000
    max_output_tokens: int = 1024
    max_total_tokens_per_session: int = 50000
    context_compression_threshold: float = 0.6  # 超过 60% 触发上下文压缩

    # ---- 检索过滤 ----
    # BGE / 向量检索的余弦相似度阈值，低于此值认为检索结果不相关
    retrieval_similarity_threshold: float = 0.65

    # ---- CORS ----
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = {
        "env_file": str(BACKEND_DIR.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def ensure_dirs(self) -> None:
        """确保必要的目录存在"""
        os.makedirs(self.chroma_persist_dir, exist_ok=True)
        os.makedirs(self.upload_dir, exist_ok=True)


# 单例
settings = Settings()
