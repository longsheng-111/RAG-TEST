# DX-RAG 知识库问答系统

基于检索增强生成（RAG）技术的企业级知识库问答系统。

## 功能特性

- 📄 **多格式支持**：PDF（含图片型 OCR）、Word、Excel、Markdown、TXT 等
- 🔍 **混合检索**：关键词检索 + 向量检索 + 加权融合
- 📚 **多知识库**：支持创建多个独立知识库，按需切换
- 💬 **对话记忆**：保留对话历史，支持上下文理解
- 🎨 **Markdown 渲染**：结构化展示回答（标题、列表、表格、代码块）
- 🖼️ **视觉模型集成**：Qwen-VL-Plus 自动处理图片型 PDF

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 14 + Ant Design 5 + React Markdown |
| 后端 | FastAPI + ChromaDB + Sentence Transformers |
| 嵌入模型 | BGE-small-zh-v1.5 (384维) |
| LLM | DeepSeek Chat |
| 视觉模型 | Qwen-VL-Plus (DashScope) |

## 快速开始

### 1. 环境要求

- Python 3.10+
- Node.js 18+
- pip 22+
- npm 9+

### 2. 配置 API 密钥

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API 密钥：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DASHSCOPE_API_KEY=sk-your-dashscope-key
```

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`

## API 接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 文件上传 + 入库 |
| `/api/query` | POST | 知识问答 |
| `/api/collections` | GET/POST | 知识库管理 |
| `/api/files` | GET/DELETE | 文件管理 |
| `/api/stats` | GET | 统计信息 |

## 项目结构

```
dx-rag/
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/routes.py # API 路由
│   │   ├── core/
│   │   │   ├── config.py      # 配置管理
│   │   │   └── vector_store.py # 向量存储
│   │   ├── services/
│   │   │   ├── ingest.py      # 文件处理
│   │   │   └── qa.py          # 问答服务
│   │   └── main.py            # 应用入口
│   └── requirements.txt
├── frontend/             # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 主页面
│   └── components/
│       ├── Sidebar.tsx        # 侧边栏
│       ├── KnowledgeBaseManager.tsx
│       ├── FileUpload.tsx
│       ├── QAPanel.tsx        # 问答面板
│       └── FileManager.tsx
└── .env.example
```

## License

MIT
