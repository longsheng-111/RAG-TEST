'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, List, Tag, Typography, Popconfirm, Empty, Spin, Tooltip,
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

const PERSONA_COLORS: Record<string, string> = {
  default: 'blue', frontend: 'green', backend: 'purple', interview: 'orange',
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
        padding: '16px 16px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageOutlined style={{ color: 'var(--primary)', fontSize: 16 }} />
          <Text strong style={{ fontSize: 15 }}>Sessions</Text>
        </div>
        <Tooltip title="New Session">
          <Button type="primary" size="small" icon={<PlusOutlined />}
            onClick={onCreateSession}
            style={{ borderRadius: 8 }} />
        </Tooltip>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : sessions.length === 0 ? (
          <Empty description="No sessions yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                    padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 13, maxWidth: 140 }} ellipsis>
                      {session.title || 'New Session'}
                    </Text>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <Tooltip title="Export">
                        <Button type="text" size="small"
                          icon={<DownloadOutlined style={{ fontSize: 12 }} />}
                          onClick={(e) => handleExport(e, session.session_id)} />
                      </Tooltip>
                      <Popconfirm title="Delete this session?" onConfirm={(e) => handleDelete(e as any, session.session_id)}
                        okText="Yes" cancelText="No">
                        <Button type="text" size="small" danger
                          icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                          onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color={PERSONA_COLORS[session.persona] || 'default'}
                      style={{ fontSize: 10, lineHeight: '18px' }}>
                      {personas[session.persona] || session.persona}
                    </Tag>
                    <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {session.total_tokens.toLocaleString()} tokens
                    </Text>
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ClockCircleOutlined style={{ fontSize: 10, color: 'var(--text-muted)' }} />
                    <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {formatTime(session.updated_at)} · {session.message_count} msgs
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
