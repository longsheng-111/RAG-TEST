'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  Select,
  Typography,
  Tag,
  Space,
  Collapse,
  Empty,
  Spin,
} from 'antd';
import { SendOutlined, ClearOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    similarity: number;
    file_name: string;
  }>;
}

interface Collection {
  name: string;
  chunk_count: number;
}

interface Props {
  collectionName: string;
  onCollectionChange: (name: string) => void;
}

export default function QAPanel({ collectionName, onCollectionChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || loading) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    // 构建对话历史
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await axios.post('/api/query', {
        question,
        top_k: 5,
        collection_name: collectionName,
        history,
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        role: 'assistant',
        content: `❌ 查询失败: ${err.response?.data?.detail || err.message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.chunk_count} 片段)`,
  }));

  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>💬 知识问答</Title>
        <Space>
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 220 }}
          />
          <Button icon={<ClearOutlined />} onClick={handleClear} disabled={messages.length === 0}>
            清空对话
          </Button>
        </Space>
      </div>

      {/* 消息列表 */}
      <div className="chat-messages" style={{ flex: 1, borderRadius: 12, marginBottom: 16 }}>
        {messages.length === 0 ? (
          <Empty
            description="开始提问吧！基于已上传的文档获取智能回答"
            style={{ marginTop: 80 }}
          >
            <Text type="secondary">
              提示：按 Ctrl+Enter 发送消息
            </Text>
          </Empty>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#1677ff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  boxShadow: msg.role === 'assistant'
                    ? '0 1px 4px rgba(0,0,0,0.1)'
                    : undefined,
                }}
              >
                {msg.role === 'user' ? (
                  <div>{msg.content}</div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

                {/* 来源引用 */}
                {msg.sources && msg.sources.length > 0 && (
                  <Collapse
                    ghost
                    size="small"
                    items={[
                      {
                        key: 'sources',
                        label: (
                          <Space>
                            <FileTextOutlined />
                            <span style={{ fontSize: 12 }}>
                              参考来源 ({msg.sources.length})
                            </span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {msg.sources.map((src, i) => (
                              <Card
                                key={i}
                                size="small"
                                style={{ marginBottom: 8 }}
                                title={
                                  <Space>
                                    <Tag color="blue">{src.file_name}</Tag>
                                    <Tag>相似度: {(src.similarity * 100).toFixed(1)}%</Tag>
                                  </Space>
                                }
                              >
                                <Text style={{ fontSize: 12 }}>{src.content}...</Text>
                              </Card>
                            ))}
                          </div>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <Spin tip="思考中..." />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <Card bodyStyle={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题，Ctrl+Enter 发送"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim()}
            style={{ height: 'auto', minWidth: 64 }}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
}
