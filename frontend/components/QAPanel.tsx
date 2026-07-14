'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Select, Typography, Tag, Space, Collapse,
  Empty, Spin, Tooltip, Badge, Avatar,
} from 'antd';
import {
  SendOutlined, ClearOutlined, FileTextOutlined,
  UserOutlined, RobotOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const { Text } = Typography;
const { TextArea } = Input;

interface TokenCost {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  session_total: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    similarity: number;
    file_name: string;
  }>;
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

const SESSION_BUDGET = 50000;

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
            role: m.role, content: m.content,
            sources: undefined, token_cost: m.token_cost,
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

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || loading || !sessionId) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);
    setLastCost(null);

    try {
      const res = await axios.post('/api/chat', {
        session_id: sessionId, question, top_k: 5,
        persona: propsPersona, collection_name: collectionName,
      });
      const cost: TokenCost = res.data.token_cost;
      setMessages((prev) => [...prev, {
        role: 'assistant', content: res.data.answer,
        sources: res.data.sources, token_cost: cost,
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

  const handlePersonaChange = async (newPersona: string) => {
    if (sessionId) {
      try {
        await axios.put(`/api/sessions/${sessionId}/persona`, {
          persona: newPersona, clear_history: false,
        });
        onSessionUpdate(sessionId, newPersona, propsSessionTotal);
      } catch { /* ignore */ }
    }
  };

  const budgetRatio = propsSessionTotal / SESSION_BUDGET;
  const budgetColor = budgetRatio < 0.5 ? '#10b981' : budgetRatio < 0.8 ? '#f59e0b' : '#ef4444';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSend(); }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name, label: `${c.name} (${c.chunk_count})`,
  }));
  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 88px)' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThunderboltOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>AI Assistant</h2>
        </div>
        <Space>
          <Select
            placeholder="Persona"
            value={propsPersona}
            onChange={handlePersonaChange}
            options={personas.map((p) => ({ value: p.id, label: p.name }))}
            style={{ width: 130 }}
            size="small"
          />
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 200 }}
            size="small"
          />
          <Tooltip title="Clear Chat">
            <Button icon={<ClearOutlined />} onClick={handleClear}
              disabled={messages.length === 0} size="small" type="text" />
          </Tooltip>
        </Space>
      </div>

      {/* Token Budget */}
      <div style={{
        marginBottom: 16, padding: '8px 14px',
        background: `${budgetColor}10`, border: `1px solid ${budgetColor}30`,
        borderRadius: 'var(--radius-sm)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Text style={{ fontWeight: 600, fontSize: 12, color: budgetColor }}>
          ⚡ Token Usage
        </Text>
        <Space size={16}>
          {lastCost && (
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              This turn: <strong>{lastCost.total_tokens.toLocaleString()}</strong>
            </Text>
          )}
          <div style={{
            width: 120, height: 6, background: '#e2e8f0',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(budgetRatio * 100, 100)}%`,
              height: '100%', background: budgetColor,
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          <Text style={{ fontSize: 12, color: budgetColor, fontWeight: 600 }}>
            {propsSessionTotal.toLocaleString()} / {SESSION_BUDGET.toLocaleString()}
          </Text>
        </Space>
      </div>

      {/* Messages */}
      <div className="chat-container" style={{ flex: 1, borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 32, color: '#fff',
            }}>
              <ThunderboltOutlined />
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
              Start a Conversation
            </h3>
            <Text type="secondary">
              Ask questions based on your knowledge base documents · Ctrl+Enter to send
            </Text>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 20, alignItems: 'flex-start', gap: 10,
            }}>
              {msg.role === 'assistant' && (
                <Avatar icon={<RobotOutlined />}
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', flexShrink: 0 }} />
              )}
              <div style={{ maxWidth: '75%' }}>
                <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                  {msg.role === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <Collapse ghost size="small" style={{ marginTop: 8 }}
                    items={[{
                      key: 'src', label: (
                        <Space><FileTextOutlined />
                          <span style={{ fontSize: 12 }}>Sources ({msg.sources.length})</span>
                        </Space>
                      ),
                      children: msg.sources.map((src, i) => (
                        <Card key={i} size="small" style={{ marginBottom: 6, borderRadius: 8 }}
                          title={<Space><Tag color="blue">{src.file_name}</Tag>
                            <Tag>{(src.similarity * 100).toFixed(0)}% match</Tag></Space>}>
                          <Text style={{ fontSize: 12 }}>{src.content}...</Text>
                        </Card>
                      )),
                    }]} />
                )}
              </div>
              {msg.role === 'user' && (
                <Avatar icon={<UserOutlined />}
                  style={{ background: '#64748b', flexShrink: 0 }} />
              )}
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <Avatar icon={<RobotOutlined />}
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <TextArea
            value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown} disabled={loading}
            placeholder="Type your question... Ctrl+Enter to send"
            autoSize={{ minRows: 1, maxRows: 4 }}
            variant="borderless"
            style={{ flex: 1, fontSize: 14, resize: 'none' }}
          />
          <Button type="primary" icon={<SendOutlined />}
            onClick={handleSend} loading={loading}
            disabled={!inputValue.trim()}
            style={{ height: 40, width: 40, borderRadius: 10 }} />
        </div>
      </Card>
    </div>
  );
}
