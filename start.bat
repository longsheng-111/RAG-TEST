@echo off
chcp 65001 >nul
title DX-RAG 知识库问答系统

echo.
echo ╔══════════════════════════════════════╗
echo ║   DX-RAG 知识库问答系统 v1.0        ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ============================================
:: 1. 检查 Python
:: ============================================
echo [1/5] 检查 Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] 未找到 Python，请安装 Python 3.10+
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do echo   Python %%v ✓

:: ============================================
:: 2. 检查 Node.js
:: ============================================
echo [2/5] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] 未找到 Node.js，请安装 Node.js 18+
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version 2^>^&1') do echo   Node %%v ✓

:: ============================================
:: 3. 检查 .env 配置
:: ============================================
echo [3/5] 检查配置文件...
if not exist ".env" (
    echo   [WARN] .env 不存在，正在从 .env.example 创建...
    copy .env.example .env >nul
    echo   请编辑 .env 填入 API 密钥后重新运行
    start notepad .env
    pause
    exit /b 1
)
echo   .env ✓

:: ============================================
:: 4. 安装后端依赖
:: ============================================
echo [4/5] 检查后端依赖...
if not exist "backend\chroma_db" mkdir "backend\chroma_db" >nul 2>&1

python -c "import fastapi, faiss, sentence_transformers" >nul 2>&1
if %errorlevel% neq 0 (
    echo   正在安装后端依赖...
    cd backend
    pip install -r requirements.txt -q
    cd ..
)
echo   后端依赖 ✓

:: ============================================
:: 5. 安装前端依赖
:: ============================================
echo [5/5] 检查前端依赖...
if not exist "frontend\node_modules" (
    echo   正在安装前端依赖...
    cd frontend
    call npm install --silent
    cd ..
)
echo   前端依赖 ✓

echo.
echo ══════════════════════════════════════
echo   启动服务...
echo ══════════════════════════════════════
echo.

:: 启动后端 (新窗口)
start "DX-RAG Backend" cmd /c "cd /d %cd%\backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 等待后端就绪
echo   等待后端启动...
timeout /t 5 /nobreak >nul

:: 启动前端 (新窗口)
start "DX-RAG Frontend" cmd /c "cd /d %cd%\frontend && npm run dev"

:: 打开浏览器
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ╔══════════════════════════════════════╗
echo ║  系统已启动!                        ║
echo ║  前端: http://localhost:3000        ║
echo ║  后端: http://localhost:8000/docs   ║
echo ║  关闭此窗口不会停止服务              ║
echo ╚══════════════════════════════════════╝
echo.
pause
