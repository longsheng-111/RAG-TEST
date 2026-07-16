# Mac 开发机问题记录

> 记录人：Kimi Code CLI  
> 日期：2026-07-16  
> 适用场景：macOS + 系统 Python 3.9.6 临时开发机

## 1. 后端随机崩溃（已修复）

### 现象
启动后端后，处理 `POST /api/upload` 或 query 请求时，uvicorn 进程会随机退出，终端显示：

```text
Segmentation fault: 11
```

### 根因
`faiss-cpu` 自带的 Intel OpenMP 运行时（`libiomp5.dylib`）与 `torch` / `sentence-transformers` 的多线程机制冲突。

macOS 崩溃报告（`~/Library/Logs/DiagnosticReports/Python-*.ips`）中 faulting thread 一致指向：

```text
0  _swigfaiss_avx2.cpython-39-darwin.so  __kmp_suspend_initialize_thread
1  _swigfaiss_avx2.cpython-39-darwin.so  __kmp_suspend_64
2  libiomp5.dylib                          __kmp_wait_template
3  libiomp5.dylib                          __kmp_fork_barrier
```

触发链路：

```
uvicorn 处理请求
  → sentence-transformers 加载/编码（torch + OpenMP）
  → FAISS add/search（libiomp5 OpenMP）
  → Segmentation fault: 11
```

### 修复方案
在 `start.sh` 开头加入环境变量限制 OpenMP 为单线程：

```bash
export OMP_NUM_THREADS=1
```

该变量在 Windows 上无副作用，在 Mac 上可立即避免崩溃。

保守组合（若后续仍出现崩溃可尝试）：

```bash
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export VECLIB_MAXIMUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
```

## 2. 虚拟环境路径损坏（已修复）

### 现象
原 `backend/venv` 是从含中文路径的旧目录（`~/Desktop/日常学习/rag/RAG-TEST`）移动过来的，导致：

- `backend/venv/bin/pip` 等脚本的 shebang 指向不存在的旧路径
- 直接运行 `./backend/venv/bin/pip` 会报 `bad interpreter`

### 修复方案
在 `backend/venv_new` 重新创建虚拟环境：

```bash
cd backend
/usr/bin/python3 -m venv venv_new
./venv_new/bin/python -m pip install -r requirements.txt
```

并修改 `start.sh` 优先使用 `backend/venv_new/bin/python`。

## 3. .gitignore 补充（已修复）

确保以下 Mac 本地环境文件不会被提交：

```gitignore
backend/venv/
backend/venv_new/
.env
__pycache__/
```

已在 `.gitignore` 中显式添加 `backend/venv_new/`。

## 4. 验证结果

在应用上述修复后，通过 `bash start.sh` 启动：

- 后端 `http://localhost:8000` ✅
- 前端 `http://localhost:3000` ✅
- 文件上传 `POST /api/upload` ✅
- 知识查询 `POST /api/query` ✅（检索正常，LLM 因未配置 API key 返回提示）
- 上传/查询后持续运行，无崩溃 ✅

## 5. 后续建议

### 短期（本机可用）
保持当前 `OMP_NUM_THREADS=1` 方案即可稳定开发。

### 长期（根治）
该问题属于 **macOS + Python 3.9 + faiss-cpu (libiomp5) + torch** 这一特定二进制轮子组合的 OpenMP 冲突。要根治，建议：

1. 在主力 Windows 机上无需此 workaround（Windows 使用不同 OpenMP 运行时）。
2. 若 Mac 机长期作为开发机，建议安装 Python 3.10+（通过 python.org 或 Homebrew），并使用 conda-forge 构建的 `faiss-cpu` / `pytorch`：

   ```bash
   conda install -c conda-forge faiss-cpu pytorch sentence-transformers
   ```

3. 避免使用 macOS 系统 Python（`/usr/bin/python3`）运行科学计算/ML 项目。
