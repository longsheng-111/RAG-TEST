"""
API 路由定义 - 文件上传、知识问答、知识库管理、文件管理
"""
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
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

router = APIRouter(prefix="/api")

# ============================================================
#  请求/响应模型
# ============================================================

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    collection_name: str = "knowledge_chunks"
    history: list[dict] = []


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

    # 保存文件到 uploads 目录
    settings.ensure_dirs()
    safe_name = Path(file.filename).name
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
    """知识库问答"""
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
    name = req.name.strip()

    if not name or len(name) < 2 or len(name) > 50:
        raise HTTPException(status_code=400, detail="知识库名称需 2-50 个字符")

    # 只允许字母、数字、中文、短横线、下划线
    import re
    if not re.match(r'^[\w一-龥-]+$', name):
        raise HTTPException(status_code=400, detail="知识库名称包含非法字符")

    try:
        return create_collection(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collections/{name}")
async def rename_collection_api(name: str, req: RenameCollectionRequest):
    """重命名知识库"""
    new_name = req.new_name.strip()

    if not new_name or len(new_name) < 2 or len(new_name) > 50:
        raise HTTPException(status_code=400, detail="新名称需 2-50 个字符")

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

        # 同时尝试删除本地文件
        local_path = Path(settings.upload_dir) / file_name
        if local_path.exists():
            os.remove(local_path)

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

    local_path = Path(settings.upload_dir) / file_name
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
