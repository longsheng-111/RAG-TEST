"""
API 路由定义 - 文件上传、知识问答、知识库管理、文件管理
"""
import os
import re
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.core.persona import (
    list_personas,
    get_persona,
    get_persona_default_kb,
    get_persona_system_prompt,
    validate_persona,
)
from app.core.session import session_manager
from app.services.token_tracker import (
    compress_session_context,
    should_compress_context,
    TokenCost,
)
from app.services.qa import qa_query
from app.core.vector_store import (
    list_collections,
    create_collection,
    delete_collection,
    rename_collection,
    get_files,
    delete_file,
)
from app.services.ingest import process_file
from app.services.qa import qa_query
from app.services.title_generator import generate_session_title

router = APIRouter(prefix="/api")

# ---- 安全校验 ----

_COLLECTION_NAME_RE = re.compile(r'^[\w一-鿿-]+$')

def _validate_collection_name(name: str, label: str = "知识库名称") -> str:
    """校验知识库名称，防止注入"""
    name = name.strip()
    if not name or len(name) < 2 or len(name) > 50:
        raise HTTPException(status_code=400, detail=f"{label}需 2-50 个字符")
    if not _COLLECTION_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail=f"{label}包含非法字符")
    return name


def _safe_file_path(file_name: str) -> Path:
    """安全解析文件路径，防止路径穿越"""
    # 去掉路径分隔符和 .. 穿越
    safe_name = os.path.basename(file_name)
    if safe_name != file_name or ".." in file_name or "/" in file_name.replace("\\", "/"):
        raise HTTPException(status_code=400, detail="文件名包含非法路径字符")
    full = (Path(settings.upload_dir) / safe_name).resolve()
    base = Path(settings.upload_dir).resolve()
    if not str(full).startswith(str(base)):
        raise HTTPException(status_code=403, detail="路径越权访问被拒绝")
    return full

# ============================================================
#  请求/响应模型
# ============================================================

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    collection_name: str = "knowledge_chunks"
    history: list[dict] = []


class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    persona: str = "default"
    collection_name: Optional[str] = None
    top_k: int = 5


class CreateSessionRequest(BaseModel):
    persona: str = "default"
    collection_name: Optional[str] = None
    title: str = "新会话"


class SwitchPersonaRequest(BaseModel):
    persona: str
    clear_history: bool = False


class UpdateTitleRequest(BaseModel):
    title: str


class CreateCollectionRequest(BaseModel):
    name: str


class RenameCollectionRequest(BaseModel):
    new_name: str


# ============================================================
#  健康检查
# ============================================================

@router.get("/health")
async def health():
    return {"status": "ok"}


# ============================================================
#  文件上传
# ============================================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    collection_name: str = Form(default="knowledge_chunks"),
):
    """上传文件并自动入库"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="未选择文件")

    # 校验知识库名称
    _validate_collection_name(collection_name, "知识库名称")

    # 保存文件到 uploads 目录（安全文件名）
    settings.ensure_dirs()
    safe_name = Path(file.filename).name  # 去掉路径
    dest_path = Path(settings.upload_dir) / safe_name

    # 处理同名文件：添加序号
    counter = 1
    while dest_path.exists():
        stem = Path(file.filename).stem
        suffix = Path(file.filename).suffix
        dest_path = Path(settings.upload_dir) / f"{stem}_{counter}{suffix}"
        counter += 1

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件保存失败: {e}")

    # 处理入库
    try:
        result = process_file(str(dest_path), collection_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {e}")

    return {
        "message": "上传并入库成功",
        "file_name": result["file_name"],
        "chunks": result["chunks"],
        "collection_name": result["collection_name"],
    }


# ============================================================
#  知识问答
# ============================================================

@router.post("/query")
async def query(req: QueryRequest):
    """知识库问答（兼容旧接口）"""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    try:
        result = qa_query(
            question=req.question,
            collection_name=req.collection_name,
            top_k=req.top_k,
            history=req.history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"问答处理失败: {e}")

    return result


# ============================================================
#  会话管理 + 新聊天接口
# ============================================================

def _session_to_dict(session) -> dict:
    """将会话对象转为 API 返回字典"""
    return {
        "session_id": session.session_id,
        "title": session.title,
        "persona": session.persona,
        "kb_id": session.kb_id,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "total_tokens": session.total_tokens,
        "message_count": len(session.messages),
    }


@router.post("/sessions")
async def create_session_api(req: CreateSessionRequest):
    """创建新会话"""
    persona = validate_persona(req.persona)
    kb_id = req.collection_name or get_persona_default_kb(persona)

    try:
        session = session_manager.create_session(
            persona=persona,
            kb_id=kb_id,
            title=req.title,
        )
        return _session_to_dict(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建会话失败: {e}")


@router.get("/sessions")
async def list_sessions_api():
    """列出所有会话"""
    try:
        sessions = session_manager.list_sessions()
        return {"sessions": [_session_to_dict(s) for s in sessions]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取会话列表失败: {e}")


@router.get("/sessions/{session_id}")
async def get_session_api(session_id: str):
    """获取会话详情"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        **_session_to_dict(session),
        "messages": session.messages,
        "compressed_history": session.compressed_history,
    }


@router.delete("/sessions/{session_id}")
async def delete_session_api(session_id: str):
    """删除会话"""
    if session_manager.delete_session(session_id):
        return {"session_id": session_id, "status": "deleted"}
    raise HTTPException(status_code=404, detail="会话不存在")


@router.put("/sessions/{session_id}/persona")
async def switch_persona_api(session_id: str, req: SwitchPersonaRequest):
    """切换会话角色"""
    persona = validate_persona(req.persona)
    session = session_manager.switch_persona(
        session_id, persona, clear_history=req.clear_history
    )
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return _session_to_dict(session)


@router.put("/sessions/{session_id}/title")
async def update_session_title_api(session_id: str, req: UpdateTitleRequest):
    """更新会话标题"""
    title = req.title.strip()
    if not title or len(title) > 100:
        raise HTTPException(status_code=400, detail="标题需 1-100 个字符")
    session = session_manager.update_title(session_id, title)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return _session_to_dict(session)


@router.get("/sessions/{session_id}/export")
async def export_session_api(session_id: str):
    """导出会话历史为 Markdown"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    lines = [f"# {session.title or '未命名会话'}"]
    lines.append("")
    lines.append(f"- **会话 ID**: {session.session_id}")
    lines.append(f"- **角色**: {session.persona}")
    lines.append(f"- **知识库**: {session.kb_id}")
    lines.append(f"- **创建时间**: {session.created_at}")
    lines.append(f"- **累计 Token**: {session.total_tokens}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 对话历史")
    lines.append("")

    for msg in session.messages:
        role_label = "用户" if msg["role"] == "user" else "助手"
        lines.append(f"### {role_label}")
        lines.append("")
        lines.append(msg.get("content", ""))
        lines.append("")
        if msg.get("token_cost"):
            cost = msg["token_cost"]
            lines.append(
                f"_Tokens: {cost.get('total_tokens', 0)}_"
            )
            lines.append("")

    markdown = "\n".join(lines)

    from fastapi.responses import PlainTextResponse
    # 文件名只使用 session_id，避免中文标题导致 HTTP header 编码错误
    filename = f"session_{session_id}.md"
    return PlainTextResponse(
        markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/personas")
async def list_personas_api():
    """获取角色列表"""
    return {"personas": list_personas()}


@router.post("/chat")
async def chat(req: ChatRequest):
    """基于会话的聊天接口"""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    # 1. 获取或创建会话
    session = None
    if req.session_id:
        session = session_manager.get_session(req.session_id)

    if session is None:
        persona = validate_persona(req.persona)
        kb_id = req.collection_name or get_persona_default_kb(persona)
        session = session_manager.create_session(
            persona=persona,
            kb_id=kb_id,
        )

    # 2. 更新 persona / kb_id（如果请求中显式指定）
    if req.persona:
        session.persona = validate_persona(req.persona)
    if req.collection_name:
        session.kb_id = req.collection_name

    # 3. 添加上次问答的 Token 到累计
    # （用户消息的 token 在上一轮已经统计进 assistant 的 prompt 中）

    # 4. 上下文压缩：超过预算 60% 时触发
    if should_compress_context(session.total_tokens):
        from openai import OpenAI
        client = None
        if settings.deepseek_api_key:
            client = OpenAI(
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url,
            )
        compress_cost = compress_session_context(session, client)
        session.update_total_tokens(compress_cost.total)

    # 5. 添加用户消息
    session.add_message("user", req.question.strip())

    # 6. 构建对话历史（取最近 6 轮 / 12 条）
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in session.messages[:-1][-12:]
    ]

    # 7. 调用 QA
    system_prompt = get_persona_system_prompt(session.persona)
    try:
        result = qa_query(
            question=req.question,
            collection_name=session.kb_id,
            top_k=req.top_k,
            history=history,
            system_prompt=system_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"问答处理失败: {e}")

    # 8. 添加助手消息并保存
    token_cost = result.get("token_cost", {})
    session.add_message("assistant", result["answer"], token_cost=token_cost)
    session_manager.save_session(session)

    # 9. 生成标题（首次用户提问后）
    if len(session.messages) == 2 and session.title == "新会话":
        new_title, title_cost = generate_session_title(req.question.strip())
        if new_title:
            session.title = new_title
            session.update_total_tokens(title_cost.total)
            session_manager.save_session(session)

    # 10. 返回真实 token_cost
    response_cost = TokenCost(
        prompt_tokens=token_cost.get("prompt_tokens", 0),
        completion_tokens=token_cost.get("completion_tokens", 0),
        total_tokens=token_cost.get("total_tokens", 0),
        session_total=session.total_tokens,
    )

    return {
        "session_id": session.session_id,
        "title": session.title,
        "persona": session.persona,
        "kb_id": session.kb_id,
        "answer": result["answer"],
        "sources": result["sources"],
        "token_cost": dict(response_cost),
        "query": req.question,
    }


# ============================================================
#  知识库管理
# ============================================================

@router.get("/collections")
async def get_collections():
    """获取所有知识库列表"""
    try:
        return {"collections": list_collections()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collections")
async def create_collection_api(req: CreateCollectionRequest):
    """创建知识库"""
    name = _validate_collection_name(req.name, "知识库名称")

    try:
        return create_collection(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collections/{name}")
async def rename_collection_api(name: str, req: RenameCollectionRequest):
    """重命名知识库"""
    new_name = _validate_collection_name(req.new_name, "新名称")

    try:
        return rename_collection(name, new_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collections/{name}")
async def delete_collection_api(name: str):
    """删除知识库"""
    try:
        return delete_collection(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
#  文件管理
# ============================================================

@router.get("/files")
async def list_files(collection_name: str = Query(default="knowledge_chunks")):
    """获取知识库中的文件列表"""
    try:
        files = get_files(collection_name)
        return {"files": files, "collection_name": collection_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files/{file_name:path}")
async def delete_file_api(
    file_name: str,
    collection_name: str = Query(default="knowledge_chunks"),
):
    """删除知识库中的文件及向量数据"""
    try:
        result = delete_file(file_name, collection_name)

        # 同时尝试删除本地文件（安全路径校验）
        local_path = _safe_file_path(file_name)
        if local_path.exists():
            os.remove(str(local_path))

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{file_name:path}/preview")
async def preview_file(
    file_name: str,
    collection_name: str = Query(default="knowledge_chunks"),
):
    """预览文件内容（前 5000 字符）"""
    from app.services.ingest import read_text_from_file

    local_path = _safe_file_path(file_name)
    if not local_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        text = read_text_from_file(local_path)
        return {
            "file_name": file_name,
            "content": text[:5000],
            "total_length": len(text),
            "truncated": len(text) > 5000,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
#  统计信息
# ============================================================

@router.get("/stats")
async def get_stats():
    """获取系统统计信息"""
    try:
        collections = list_collections()
        total_chunks = sum(c["chunk_count"] for c in collections)
        total_files = 0
        for col in collections:
            files = get_files(col["name"])
            total_files += len(files)

        return {
            "collections": len(collections),
            "total_chunks": total_chunks,
            "total_files": total_files,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
