'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Input, Button, Select, Typography, Space, Tooltip,
  Avatar, Modal, Tag, message,
} from 'antd';
import {
  Send,
  Trash2,
  FileText,
  User,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Pencil,
  Flag,
  Check,
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================
//  Types
// ============================================================

interface TokenCost {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  session_total: number;
}

interface Source {
  id: string;
  content: string;
  similarity: number;
  file_name: string;
}

interface ReasoningStep {
  step: number;
  action: string;
  query: string;
  hits: number;
  top_score: number;
  confidence: 'high' | 'medium' | 'low';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  reasoning_steps?: ReasoningStep[];
  queries?: string[];
  token_cost?: TokenCost;
}

interface Collection {
  name: string;
  chunk_count: number;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  default_kb: string;
}

interface Props {
  sessionId: string;
  persona: string;
  sessionTotal: number;
  collectionName: string;
  onCollectionChange: (name: string) => void;
  onSessionUpdate: (sessionId: string, persona: string, totalTokens: number) => void;
}

interface Cluster {
  key: string;
  label: string;
  color: string;
  sources: Source[];
}

// ============================================================
//  Constants
// ============================================================

const SESSION_BUDGET = 50000;

const CLUSTER_PALETTE = [
  { color: '#ff6b6b', bg: '#fff1f0' },
  { color: '#00c9a7', bg: '#e6faf6' },
  { color: '#4a90e2', bg: '#edf4fd' },
  { color: '#f59e0b', bg: '#fffbeb' },
  { color: '#8b5cf6', bg: '#f5f3ff' },
  { color: '#ec4899', bg: '#fdf2f8' },
];

const THEME_KEYWORDS: Record<string, string[]> = {
  '语义标签': ['语义', '标签', 'html5', '结构', 'section', 'article', 'header', 'nav'],
  '拖拽API': ['拖拽', 'drag', 'drop', '拖放'],
  '性能数据': ['性能', '速度', '耗时', '吞吐', 'latency', 'qps', '并发', '优化'],
  '接口规范': ['接口', 'api', '参数', '请求', '响应', 'rest', 'url', 'http'],
  '架构原理': ['原理', '机制', '实现', '底层', '结构', '流程', '模型'],
  '持久化': ['持久', '存储', '磁盘', '快照', 'aof', 'rdb', '保存'],
  '数据类型': ['类型', '数据', 'string', 'list', 'hash', 'set', 'zset'],
};

// ============================================================
//  Helpers
// ============================================================

function clusterSources(sources: Source[]): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  Object.entries(THEME_KEYWORDS).forEach(([label, keywords], idx) => {
    const group = sources.filter((s) => {
      if (assigned.has(s.id)) return false;
      const text = `${s.file_name} ${s.content}`.toLowerCase();
      return keywords.some((k) => text.includes(k.toLowerCase()));
    });
    if (group.length > 0) {
      group.forEach((s) => assigned.add(s.id));
      clusters.push({
        key: label,
        label,
        color: CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length].color,
        sources: group,
      });
    }
  });

  const remaining = sources.filter((s) => !assigned.has(s.id));
  if (remaining.length > 0) {
    clusters.push({
      key: '其他相关',
      label: '其他相关',
      color: CLUSTER_PALETTE[clusters.length % CLUSTER_PALETTE.length].color,
      sources: remaining,
    });
  }

  return clusters;
}

function getSourceClusterIndex(sourceId: string, clusters: Cluster[]): number {
  return clusters.findIndex((c) => c.sources.some((s) => s.id === sourceId));
}

function getSourceById(sourceId: string, sources: Source[]): Source | undefined {
  return sources.find((s) => s.id === sourceId);
}

function sourceIndexToId(index: number, sources: Source[]): string | undefined {
  return sources[index - 1]?.id;
}

// ============================================================
//  Sub-components
// ============================================================

function ReasoningTimeline({ steps }: { steps: ReasoningStep[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="kw-reasoning">
      <div className="kw-reasoning-summary" onClick={() => setExpanded(!expanded)}>
        <Space size={8}>
          <Bot size={14} style={{ color: 'var(--brand-600)' }} />
          <span>推理路径</span>
          <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
            {steps.length} 步
          </Tag>
        </Space>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="kw-reasoning-steps">
              {steps.map((step, i) => (
                <motion.div
                  key={step.step}
                  className="kw-step"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="kw-step-num">{step.step}</div>
                  <div className="kw-step-body">
                    <div className="kw-step-action">
                      {step.action === 'knowledge_search' ? '检索知识库' : '改写查询'}
                    </div>
                    <div className="kw-step-detail">
                      查询：{step.query}
                      {step.action === 'knowledge_search' && (
                        <span style={{ marginLeft: 12 }}>
                          命中 {step.hits} 条 · 最高分 {(step.top_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`kw-step-confidence kw-confidence-${step.confidence}`}>
                    {step.confidence === 'high' ? '高置信' : step.confidence === 'medium' ? '中置信' : '低置信'}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextWindow({ source, highlightNum }: { source?: Source; highlightNum?: number }) {
  if (!source) return null;
  const lines = source.content.split('\n').filter((l) => l.trim() !== '');
  return (
    <motion.div
      className="kw-context-window"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="kw-context-window-title">
        引用上下文 · {source.file_name} · 片段 {highlightNum ?? '-'}
      </div>
      <div className="kw-context-lines">
        {lines.slice(0, 12).map((line, idx) => (
          <div key={idx}>
            <span className="kw-context-line-num">{idx + 1}</span>
            <span className={idx >= 3 && idx <= 6 ? 'kw-context-hit' : undefined}>{line}</span>
          </div>
        ))}
        {lines.length > 12 && (
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>… 共 {lines.length} 行</div>
        )}
      </div>
    </motion.div>
  );
}

function CitationText({
  value,
  sources,
  clusters,
  activeId,
  onActivate,
  onDropReplace,
}: {
  value: string;
  sources: Source[];
  clusters: Cluster[];
  activeId?: string;
  onActivate: (sourceId: string | undefined) => void;
  onDropReplace?: (fromSourceId: string, toCitationNum: number) => void;
}) {
  const parts = value.split(/(\[\^\d+\^\])/g);

  return (
    <>
      {parts.map((part, idx) => {
        const match = part.match(/\[\^(\d+)\^\]/);
        if (!match) return <span key={idx}>{part}</span>;
        const num = parseInt(match[1], 10);
        const sourceId = sourceIndexToId(num, sources);
        const clusterIdx = sourceId ? getSourceClusterIndex(sourceId, clusters) : -1;
        const isActive = sourceId === activeId;
        const className = `kw-citation kw-citation-cluster-${Math.max(0, clusterIdx % 6)}`;

        return (
          <span
            key={idx}
            className={className}
            style={isActive ? { boxShadow: '0 0 0 2px #fff, 0 0 0 4px currentColor' } : undefined}
            onMouseEnter={() => onActivate(sourceId)}
            onMouseLeave={() => onActivate(undefined)}
            onClick={() => onActivate(sourceId)}
            draggable={false}
            onDragOver={(e) => {
              if (onDropReplace) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!onDropReplace) return;
              e.preventDefault();
              const fromId = e.dataTransfer.getData('text/source-id');
              if (fromId && sourceId) {
                onDropReplace(fromId, num);
              }
            }}
            title={`来源 ${num}${sourceId ? ': ' + (getSourceById(sourceId, sources)?.file_name || '') : ''}`}
          >
            {num}
          </span>
        );
      })}
    </>
  );
}

function SourcePanel({
  sources,
  clusters,
  activeId,
  onActivate,
  onRef,
  panelCollapsed,
  onToggle,
}: {
  sources: Source[];
  clusters: Cluster[];
  activeId?: string;
  onActivate: (id: string | undefined) => void;
  onRef: (id: string, el: HTMLDivElement | null) => void;
  panelCollapsed: boolean;
  onToggle: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (panelCollapsed) {
    return (
      <motion.div
        className="kw-retrieval-panel collapsed"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <button
          onClick={onToggle}
          title="展开检索结果"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--coral-500)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ChevronRight size={18} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="kw-retrieval-panel"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="kw-panel-header">
        <span>检索结果</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            共 {sources.length} 条
          </span>
          <button
            onClick={onToggle}
            title="收起检索结果"
            style={{
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--gray-100)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--coral-50)';
              e.currentTarget.style.color = 'var(--coral-500)';
              e.currentTarget.style.borderColor = 'var(--coral-200)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-100)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>
      <div className="kw-scroll">
        {clusters.map((cluster, cIdx) => {
          const isCollapsed = collapsed[cluster.key];
          return (
            <motion.div
              key={cluster.key}
              className="kw-cluster"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cIdx * 0.05 }}
            >
              <div
                className="kw-cluster-header"
                onClick={() => setCollapsed((prev) => ({ ...prev, [cluster.key]: !isCollapsed }))}
              >
                <div className="kw-cluster-title">
                  <span className="kw-cluster-dot" style={{ background: cluster.color }} />
                  <span>{cluster.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="kw-cluster-count">{cluster.sources.length}</span>
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </div>
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    className="kw-cluster-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {cluster.sources.map((src, idx) => {
                      const globalIdx = sources.findIndex((s) => s.id === src.id) + 1;
                      const isActive = activeId === src.id;
                      return (
                        <motion.div
                          key={src.id}
                          ref={(el) => onRef(src.id, el)}
                          className={`kw-source ${isActive ? 'kw-source-active' : ''}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          draggable
                          onDragStart={(e) => {
                            const ev = e as unknown as React.DragEvent<HTMLDivElement>;
                            ev.dataTransfer.setData('text/source-id', src.id);
                            ev.dataTransfer.effectAllowed = 'move';
                          }}
                          onMouseEnter={() => onActivate(src.id)}
                          onMouseLeave={() => onActivate(undefined)}
                          onClick={() => onActivate(src.id)}
                        >
                          <div className="kw-source-meta">
                            <span
                              className="kw-source-id"
                              style={{ background: cluster.color }}
                            >
                              {globalIdx}
                            </span>
                            <span className="kw-source-file">{src.file_name}</span>
                            <span className="kw-source-score">{(src.similarity * 100).toFixed(0)}%</span>
                          </div>
                          <div className="kw-source-text">{src.content}</div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================
//  Main component
// ============================================================

export default function QAPanel({
  sessionId, persona: propsPersona, sessionTotal: propsSessionTotal,
  collectionName, onCollectionChange, onSessionUpdate,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [lastCost, setLastCost] = useState<TokenCost | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | undefined>();
  const [citationOverrides, setCitationOverrides] = useState<Record<number, string>>({});
  const [feedbackMsgIdx, setFeedbackMsgIdx] = useState<number | null>(null);
  const [feedbackType, setFeedbackType] = useState<'replace' | 'inaccurate' | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [replaceCitationNum, setReplaceCitationNum] = useState<number | null>(null);
  const [retrievalCollapsed, setRetrievalCollapsed] = useState(false);
  const sourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch { /* ignore */ }
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await axios.get('/api/personas');
      setPersonas(res.data.personas || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const loadSession = async () => {
      try {
        const res = await axios.get(`/api/sessions/${sessionId}`);
        if (res.data) {
          setMessages((res.data.messages || []).map((m: any) => ({
            role: m.role,
            content: m.content,
            sources: m.sources || undefined,
            reasoning_steps: m.reasoning_steps || undefined,
            queries: m.queries || undefined,
            token_cost: m.token_cost,
          })));
        }
      } catch { /* ignore */ }
    };
    loadSession();
  }, [sessionId]);

  useEffect(() => { fetchCollections(); fetchPersonas(); }, [fetchCollections, fetchPersonas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeCitationId) return;
    const el = sourceRefs.current.get(activeCitationId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCitationId]);

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || loading || !sessionId) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);
    setLastCost(null);
    setActiveCitationId(undefined);
    setCitationOverrides({});

    try {
      const res = await axios.post('/api/chat', {
        session_id: sessionId, question, top_k: 5,
        persona: propsPersona, collection_name: collectionName,
      });
      const cost: TokenCost = res.data.token_cost;
      if (!res.data.sources || res.data.sources.length === 0) {
        console.warn('[QAPanel] 后端返回的 sources 为空，检索面板将为空白');
      }
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        reasoning_steps: res.data.reasoning_steps,
        queries: res.data.queries,
        token_cost: cost,
      }]);
      setLastCost(cost);
      onSessionUpdate(sessionId, res.data.persona, cost.session_total);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `❌ ${err.response?.data?.detail || err.message}`,
      }]);
    } finally { setLoading(false); }
  };

  const handleClear = () => { setMessages([]); };

  const handleDropReplace = useCallback((fromSourceId: string, toCitationNum: number) => {
    setReplaceCitationNum(toCitationNum);
    setFeedbackType('replace');
  }, []);

  const confirmReplace = () => {
    if (replaceCitationNum === null) return;
    setCitationOverrides((prev) => ({ ...prev, [replaceCitationNum]: feedbackNote }));
    message.success(`已将引用 [^${replaceCitationNum}^] 替换为所选片段`);
    setFeedbackType(null);
    setFeedbackNote('');
    setReplaceCitationNum(null);
    setFeedbackMsgIdx(null);
  };

  const submitInaccurate = () => {
    if (!feedbackNote.trim()) return;
    message.success('已记录您的反馈，将用于优化后续检索');
    setFeedbackType(null);
    setFeedbackNote('');
    setFeedbackMsgIdx(null);
  };

  const budgetRatio = propsSessionTotal / SESSION_BUDGET;
  const isOverBudget = budgetRatio >= 1;
  const budgetColor = budgetRatio < 0.5 ? 'var(--brand-600)' : budgetRatio < 0.8 ? 'var(--warning)' : 'var(--error)';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSend(); }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name, label: `${c.name} (${c.chunk_count})`,
  }));
  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  const lastAssistantIdx = messages.length - 1;

  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      padding: '0 12px',
    }}>
      {/* Slim toolbar: persona + kb + token + clear */}
      <motion.div
        className="modern-card"
        style={{
          padding: '8px 14px',
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          minHeight: 44,
        }}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Space size={10}>
          <Tag color="blue" style={{ margin: 0 }}>
            {personas.find((p) => p.id === propsPersona)?.name || propsPersona}
          </Tag>
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 180 }}
            size="small"
          />
        </Space>
        <Space size={12}>
          {lastCost && (
            <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              本轮 <strong style={{ color: 'var(--text-primary)' }}>{lastCost.total_tokens.toLocaleString()}</strong>
            </Text>
          )}
          <div style={{
            width: 100,
            height: 5,
            background: 'var(--border)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(budgetRatio * 100, 100)}%`,
              height: '100%',
              background: budgetColor,
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <Text style={{ fontSize: 11, color: budgetColor, fontWeight: 600, minWidth: 82, textAlign: 'right' }}>
            {propsSessionTotal.toLocaleString()} / {SESSION_BUDGET.toLocaleString()}
          </Text>
          <Tooltip title="清空对话">
            <Button
              icon={<Trash2 size={14} />}
              onClick={handleClear}
              disabled={messages.length === 0}
              size="small"
              type="text"
              style={{ color: 'var(--text-muted)' }}
            />
          </Tooltip>
        </Space>
      </motion.div>

      {/* Main workspace */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {messages.length === 0 ? (
          <motion.div
            className="empty-state"
            style={{ flex: 1 }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="empty-state-icon" style={{ borderRadius: 'var(--radius-lg)' }}>
              <FileText size={24} color="#fff" />
            </div>
            <h2 className="empty-state-title">开始知识检索</h2>
            <span className="empty-state-desc">
              输入问题后，左侧将展示按主题聚类的检索结果，右侧呈现带引用溯源的答案与推理路径。
            </span>
          </motion.div>
        ) : (
          <>
            {/* Left: retrieval panel for the last assistant message */}
            {(() => {
              const lastAssistant = messages[messages.length - 1];
              if (lastAssistant?.role !== 'assistant' || !lastAssistant.sources?.length) {
                return (
                  <div className={`kw-retrieval-panel${retrievalCollapsed ? ' collapsed' : ''}`}>
                    {retrievalCollapsed ? (
                      <button
                        onClick={() => setRetrievalCollapsed(false)}
                        title="展开检索结果"
                        style={{
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          transition: 'color 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--coral-500)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    ) : (
                      <>
                        <div className="kw-panel-header">
                          <span>检索结果</span>
                          <button
                            onClick={() => setRetrievalCollapsed(true)}
                            title="收起检索结果"
                            style={{
                              width: 22,
                              height: 22,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--gray-100)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--coral-50)';
                              e.currentTarget.style.color = 'var(--coral-500)';
                              e.currentTarget.style.borderColor = 'var(--coral-200)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--gray-100)';
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <ChevronLeft size={12} />
                          </button>
                        </div>
                        <div className="kw-scroll">
                          <Text style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16, lineHeight: 1.6 }}>
                            {lastAssistant?.role !== 'assistant'
                              ? '等待助手回答…'
                              : '当前回答未引用任何检索片段（可能知识库不匹配或检索为空）'}
                          </Text>
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              const clusters = clusterSources(lastAssistant.sources);
              return (
                <SourcePanel
                  sources={lastAssistant.sources}
                  clusters={clusters}
                  activeId={activeCitationId}
                  onActivate={setActiveCitationId}
                  onRef={(id, el) => {
                    if (el) sourceRefs.current.set(id, el);
                    else sourceRefs.current.delete(id);
                  }}
                  panelCollapsed={retrievalCollapsed}
                  onToggle={() => setRetrievalCollapsed((v) => !v)}
                />
              );
            })()}

            {/* Right: answer area */}
            <div className="kw-answer-area">
              <div className="kw-scroll" style={{ padding: 16 }}>
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => {
                    const isLastAssistant = idx === lastAssistantIdx && msg.role === 'assistant';
                    const clusters = msg.sources ? clusterSources(msg.sources) : [];

                    if (msg.role === 'user') {
                      return (
                        <motion.div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginBottom: 16,
                            gap: 10,
                          }}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="chat-bubble chat-bubble-user" style={{ maxWidth: '80%' }}>
                            {msg.content}
                          </div>
                          <Avatar
                            icon={<User size={16} />}
                            style={{ background: 'var(--gray-600)', flexShrink: 0 }}
                            size="small"
                          />
                        </motion.div>
                      );
                    }

                    if (msg.content.startsWith('❌')) {
                      return (
                        <motion.div
                          key={idx}
                          style={{ marginBottom: 16, color: 'var(--error)', fontSize: 14 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {msg.content}
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={idx}
                        className="kw-answer-card"
                        style={{ marginBottom: 16 }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {msg.reasoning_steps && msg.reasoning_steps.length > 0 && (
                          <ReasoningTimeline steps={msg.reasoning_steps} />
                        )}

                        <div className="kw-answer-toolbar">
                          <Space size={8}>
                            <Bot size={16} style={{ color: 'var(--brand-600)' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              生成答案
                            </span>
                            {msg.token_cost && (
                              <Tag style={{ margin: 0, fontSize: 10 }}>
                                {(msg.token_cost.total_tokens / 1000).toFixed(1)}k tokens
                              </Tag>
                            )}
                          </Space>
                          <Space size={8}>
                            {msg.sources && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                引用 {msg.sources.length} 条来源
                              </span>
                            )}
                          </Space>
                        </div>

                        <div className="kw-answer-body">
                          <div className="markdown-body">
                            <ReactMarkdown
                              components={{
                                text: (props: any) => (
                                  <CitationText
                                    value={props.value || props.children}
                                    sources={msg.sources || []}
                                    clusters={clusters}
                                    activeId={activeCitationId}
                                    onActivate={setActiveCitationId}
                                    onDropReplace={isLastAssistant ? handleDropReplace : undefined}
                                  />
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          <AnimatePresence>
                            {isLastAssistant && activeCitationId && (
                              <ContextWindow
                                source={getSourceById(activeCitationId, msg.sources || [])}
                                highlightNum={(msg.sources || []).findIndex((s) => s.id === activeCitationId) + 1}
                              />
                            )}
                          </AnimatePresence>
                        </div>

                        {isLastAssistant && (
                          <div className="kw-feedback">
                            <span className="kw-feedback-note">
                              <HelpCircle size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                              发现引用或结论有问题？
                            </span>
                            <div className="kw-feedback-actions">
                              <Button
                                size="small"
                                icon={<Pencil size={14} />}
                                onClick={() => {
                                  setFeedbackMsgIdx(idx);
                                  setFeedbackType('replace');
                                }}
                              >
                                替换引用
                              </Button>
                              <Button
                                size="small"
                                icon={<Flag size={14} />}
                                danger
                                onClick={() => {
                                  setFeedbackMsgIdx(idx);
                                  setFeedbackType('inaccurate');
                                }}
                              >
                                标记不准确
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {loading && (
                  <motion.div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Avatar icon={<Bot size={16} />} style={{ background: 'var(--gray-500)' }} size="small" />
                    <div style={{
                      display: 'flex',
                      gap: 4,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                    }}>
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <motion.div
                className="kw-composer"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1 }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <TextareaAutosize
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    placeholder="输入问题，检索并生成带引用的答案…"
                    minRows={1}
                    maxRows={8}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: 1.5,
                      resize: 'none',
                      padding: '8px 0',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <Tooltip title="发送 (Ctrl+Enter)">
                    <Button
                      type="primary"
                      className="send-btn-macaron"
                      icon={<Send size={18} />}
                      onClick={handleSend}
                      loading={loading}
                      disabled={!inputValue.trim()}
                      style={{
                        height: 40,
                        width: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    />
                  </Tooltip>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                }}>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    AI 生成内容仅供参考，关键决策请核对原文
                  </Text>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Ctrl + Enter 发送
                  </Text>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>

      {/* Feedback modal */}
      <Modal
        open={feedbackType !== null}
        onCancel={() => {
          setFeedbackType(null);
          setFeedbackNote('');
          setReplaceCitationNum(null);
          setFeedbackMsgIdx(null);
        }}
        footer={null}
        title={feedbackType === 'replace' ? '替换引用' : '标记不准确'}
        width={480}
      >
        {feedbackType === 'replace' && (
          <div>
            <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
              从左侧检索面板拖拽一个片段到答案区，或在此选择要替换为的来源：
            </Text>
            <Select
              style={{ width: '100%' }}
              placeholder="选择更合适的来源片段"
              value={feedbackNote || undefined}
              onChange={(val) => setFeedbackNote(val)}
              options={(() => {
                const msg = feedbackMsgIdx !== null ? messages[feedbackMsgIdx] : null;
                return (msg?.sources || []).map((s, i) => ({
                  value: s.id,
                  label: `[${i + 1}] ${s.file_name} — ${s.content.slice(0, 60)}…`,
                }));
              })()}
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => { setFeedbackType(null); setFeedbackNote(''); }}>取消</Button>
              <Button type="primary" icon={<Check size={14} />} onClick={confirmReplace}>
                确认替换
              </Button>
            </div>
          </div>
        )}
        {feedbackType === 'inaccurate' && (
          <div>
            <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              请简要说明正确信息或备注。您的反馈将用于优化后续检索结果。
            </Text>
            <TextArea
              rows={4}
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="例如：此处应引用“语义标签”相关内容，而非拖拽 API…"
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => { setFeedbackType(null); setFeedbackNote(''); }}>取消</Button>
              <Button type="primary" danger icon={<Check size={14} />} onClick={submitInaccurate}>
                提交反馈
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
