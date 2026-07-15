'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, List, Tag, Typography, Popconfirm, Spin, Tooltip, Space,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, MessageOutlined,
  DownloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

interface Session {
  session_id: string;
  title: string;
  persona: string;
  kb_id: string;
  mode?: 'qa' | 'examiner';
  exam_state?: any;
  total_tokens: number;
  updated_at: string;
  message_count: number;
}

interface Persona { id: string; name: string; }

interface Props {
  activeSessionId: string;
  onSelectSession: (session: Session) => void;
  onCreateSession: () => void;
  refreshTrigger?: number;
}

const PERSONA_GRADIENTS: Record<string, string> = {
  default: 'linear-gradient(135deg, #ff6b6b, #ff8a89)',
  frontend: 'linear-gradient(135deg, #00c9a7, #33d6bc)',
  backend: 'linear-gradient(135deg, #4a90e2, #6ba8f0)',
  interview: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
};

export default function SessionPanel({
  activeSessionId, onSelectSession, onCreateSession, refreshTrigger = 0,
}: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await axios.get('/api/personas');
      const map: Record<string, string> = {};
      (res.data.personas || []).forEach((p: Persona) => { map[p.id] = p.name; });
      setPersonas(map);
    } catch { /* ignore */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/sessions');
      setSessions(res.data.sessions || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPersonas(); fetchSessions(); }, [fetchPersonas, fetchSessions, refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/sessions/${sessionId}`);
      const remaining = sessions.filter((s) => s.session_id !== sessionId);
      if (sessionId === activeSessionId) {
        remaining.length > 0 ? onSelectSession(remaining[0]) : onCreateSession();
      }
      fetchSessions();
    } catch { /* ignore */ }
  };

  const handleExport = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const res = await axios.get(`/api/sessions/${sessionId}/export`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `session_${sessionId}.md`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return iso; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <MessageOutlined style={{ color: '#fff', fontSize: 14 }} />
          </div>
          <Text strong style={{ fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
            会话
          </Text>
        </div>
        <Tooltip title="新建会话">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateSession}
            style={{
              borderRadius: 8,
              height: 32,
              width: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          />
        </Tooltip>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}>
              <MessageOutlined style={{ color: '#fff', fontSize: 28 }} />
            </div>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              暂无会话
            </Text>
            <div style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={onCreateSession}
              >
                开始对话
              </Button>
            </div>
          </div>
        ) : (
          <List
            dataSource={sessions}
            renderItem={(session) => {
              const isActive = activeSessionId === session.session_id;
              return (
                <div
                  onClick={() => onSelectSession(session)}
                  className={isActive ? 'modern-card modern-card-active' : 'modern-card'}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    borderLeft: isActive ? '3px solid var(--primary-light)' : '3px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    className="session-actions"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      display: 'flex',
                      gap: 2,
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 0.2s ease',
                      zIndex: 2,
                    }}
                  >
                    <Tooltip title="Export">
                      <Button type="text" size="small"
                        style={{ width: 22, height: 22, padding: 0, borderRadius: 5 }}
                        icon={<DownloadOutlined style={{ fontSize: 11, color: 'var(--text-secondary)' }} />}
                        onClick={(e) => handleExport(e, session.session_id)} />
                    </Tooltip>
                    <Popconfirm title="Delete this session?" onConfirm={(e) => handleDelete(e as any, session.session_id)}
                      okText="Yes" cancelText="No">
                      <Button type="text" size="small" danger
                        style={{ width: 22, height: 22, padding: 0, borderRadius: 5 }}
                        icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                        onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                  </div>
                  <div style={{ marginBottom: 6, paddingRight: 28 }}>
                    <Text strong style={{ fontSize: 13, lineHeight: '1.4', color: 'var(--text-primary)' }} ellipsis>
                      {session.title || 'New Session'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', marginBottom: 6 }}>
                    <Tag
                      style={{
                        fontSize: 10,
                        lineHeight: '18px',
                        border: 'none',
                        borderRadius: 6,
                        color: '#fff',
                        background: PERSONA_GRADIENTS[session.persona] || PERSONA_GRADIENTS.default,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        margin: 0,
                      }}
                    >
                      {personas[session.persona] || session.persona}
                    </Tag>
                    {session.mode === 'examiner' && (
                      <Tag
                        style={{
                          fontSize: 10,
                          lineHeight: '18px',
                          border: 'none',
                          borderRadius: 6,
                          margin: 0,
                          color: '#7e22ce',
                          background: 'linear-gradient(135deg, #f3e8ff, #ede9fe)',
                        }}
                      >
                        模拟面试
                      </Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ClockCircleOutlined style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }} />
                    <Text style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatTime(session.updated_at)} · {session.message_count} msgs
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {session.total_tokens.toLocaleString()} tokens
                    </Text>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
