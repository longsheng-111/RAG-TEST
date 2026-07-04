@echo off
title DX-RAG Launcher

echo.
echo ========================================
echo   DX-RAG Knowledge Base QA System v1.0
echo ========================================
echo.

cd /d "%~dp0"

REM ---- Find Python ----
echo [1/5] Finding Python...
set PYCMD=

py -3.12 --version >/dev/null 2>&1
if %errorlevel% equ 0 (
    set PYCMD=py -3.12
    goto :found_python
)

py --version >/dev/null 2>&1
if %errorlevel% equ 0 (
    set PYCMD=py
    goto :found_python
)

python --version >/dev/null 2>&1
if %errorlevel% equ 0 (
    set PYCMD=python
    goto :found_python
)

echo   [ERROR] Python not found.
echo   Install Python 3.10+ from https://python.org
pause
exit /b 1

:found_python
%PYCMD% --version 2>&1
echo   Python OK

REM ---- Check Node.js ----
echo [2/5] Checking Node.js...
where node >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js not found. Install Node.js 18+
    pause
    exit /b 1
)
node --version 2>&1
echo   Node OK

REM ---- Check .env ----
echo [3/5] Checking config...
if not exist ".env" (
    echo   .env not found, creating from template...
    copy .env.example .env >/dev/null
    echo   Please edit .env with your API keys and re-run.
    start notepad .env
    pause
    exit /b 1
)
echo   Config OK

REM ---- Backend deps ----
echo [4/5] Checking backend deps...
%PYCMD% -c "import fastapi, faiss, sentence_transformers" >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo   Installing backend dependencies...
    cd backend
    %PYCMD% -m pip install -r requirements.txt -q
    cd ..
)
echo   Backend deps OK

REM ---- Frontend deps ----
echo [5/5] Checking frontend deps...
if not exist "frontend
ode_modules" (
    echo   Installing frontend dependencies...
    cd frontend
    call npm install --silent
    cd ..
)
echo   Frontend deps OK

echo.
echo ========================================
echo   Starting services...
echo ========================================
echo.

start "DX-RAG-Backend" cmd /k "cd /d %cd%ackend && %PYCMD% -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo   Waiting for backend to start...
ping -n 6 127.0.0.1 >/dev/null

start "DX-RAG-Frontend" cmd /k "cd /d %cd%rontend && npm run dev"

echo   Opening browser...
ping -n 5 127.0.0.1 >/dev/null
start http://localhost:3000

echo.
echo ========================================
echo   System started!
echo   Frontend : http://localhost:3000
echo   API Docs : http://localhost:8000/docs
echo ========================================
echo.
pause
