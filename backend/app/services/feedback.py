"""
反馈闭环 MVP - 本地 JSON 文件持久化

每个会话的反馈按 session_id 分组，存放在 backend/app/data/feedback/feedbacks.json。
当前不引入数据库，保持项目最小化。
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.core.config import settings


class FeedbackStore:
    """本地 JSON 文件存储会话反馈"""

    _instance: Optional["FeedbackStore"] = None

    def __new__(cls) -> "FeedbackStore":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self) -> None:
        # 与会话数据放在同一父目录下，便于迁移/备份
        self.feedback_dir = Path(settings.session_dir).parent / "feedback"
        self.feedback_dir.mkdir(parents=True, exist_ok=True)
        self.feedback_file = self.feedback_dir / "feedbacks.json"
        if not self.feedback_file.exists():
            self._save({})

    def _load(self) -> dict:
        try:
            with open(self.feedback_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save(self, data: dict) -> None:
        with open(self.feedback_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_feedback(
        self,
        session_id: str,
        original_chunk_id: str,
        target_chunk_id: str,
        feedback_type: str,
        original_content: str = "",
        target_content: str = "",
        note: str = "",
    ) -> dict:
        """追加一条反馈记录"""
        data = self._load()
        feedback = {
            "id": f"fb_{uuid.uuid4().hex[:12]}",
            "session_id": session_id,
            "original_chunk_id": original_chunk_id,
            "target_chunk_id": target_chunk_id,
            "type": feedback_type,
            "original_content": original_content,
            "target_content": target_content,
            "note": note,
            "created_at": datetime.now().isoformat(),
        }
        if session_id not in data:
            data[session_id] = []
        data[session_id].append(feedback)
        self._save(data)
        return feedback

    def get_session_feedback(self, session_id: str) -> list[dict]:
        """获取指定会话的全部历史反馈"""
        data = self._load()
        return data.get(session_id, [])

    def format_feedback_for_prompt(self, session_id: str) -> str:
        """把历史反馈格式化为 System Prompt 中的事实修正约束"""
        feedbacks = self.get_session_feedback(session_id)
        if not feedbacks:
            return ""

        lines = ["【历史反馈 / 事实修正约束】"]
        for i, fb in enumerate(feedbacks, 1):
            lines.append(f"{i}. 反馈类型：{fb['type']}")
            if fb.get("original_content"):
                lines.append(f"   原引用片段：{fb['original_content'][:200]}")
            if fb.get("target_content"):
                lines.append(f"   应优先采用的片段：{fb['target_content'][:200]}")
            if fb.get("note"):
                lines.append(f"   用户备注：{fb['note']}")
        lines.append("以上约束优先级高于检索结果，后续回答请优先遵守。")
        return "\n".join(lines)


# 全局单例
feedback_store = FeedbackStore()
