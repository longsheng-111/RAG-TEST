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

/* Warm-paper workbook palette (local fallback until global tokens land) */
const INK = '#1C1A17';
const INK_SECONDARY = '#6B645A';
const INK_FAINT = '#A39A8C';
const PANEL = '#FFFDF8';
const PAPER = '#FFF6EC';
const BRAND = '#DE5126';
const BRAND_SOFT = '#FBE9E0';
const BRAND_HOVER = '#C4431B';

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

  const stickerRotation = (index: number) => index % 2 === 0 ? -1.5 : 1.5;

  return (
    <div className="dx-session-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageOutlined style={{ color: BRAND, fontSize: 18 }} />
          <Text strong style={{ fontSize: 15, color: INK, letterSpacing: '-0.2px' }}>
            会话
          </Text>
        </div>
        <Tooltip title="新建会话">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateSession}
            style={{
              borderRadius: '3px !important',
              height: 32,
              width: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              background: `${BRAND} !important`,
              border: `1.5px solid ${INK} !important`,
              boxShadow: 'none !important',
            }}
          />
        </Tooltip>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : sessions.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 48,
            gap: 12,
          }}>
            <MessageOutlined style={{ color: INK_FAINT, fontSize: 32 }} />
            <Text style={{ color: INK_SECONDARY, fontSize: 14 }}>
              暂无会话
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={onCreateSession}
              style={{
                borderRadius: '3px !important',
                background: `${BRAND} !important`,
                border: `1.5px solid ${INK} !important`,
                boxShadow: 'none !important',
              }}
            >
              开始对话
            </Button>
          </div>
        ) : (
          <List
            dataSource={sessions}
            renderItem={(session, index) => {
              const isActive = activeSessionId === session.session_id;
              return (
                <div
                  onClick={() => onSelectSession(session)}
                  className={`dx-session-card ${isActive ? 'dx-session-card-active' : ''}`}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 200ms cubic-bezier(0.25, 0.8, 0.25, 1)',
                  }}
                >
                  <div
                    className="dx-session-actions"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      display: 'flex',
                      gap: 2,
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 200ms cubic-bezier(0.25, 0.8, 0.25, 1)',
                      zIndex: 2,
                    }}
                  >
                    <Tooltip title="导出">
                      <Button type="text" size="small"
                        style={{
                          width: 22, height: 22, padding: 0, borderRadius: 3,
                          border: 'none',
                          background: 'transparent',
                        }}
                        icon={<DownloadOutlined style={{ fontSize: 11, color: INK_SECONDARY }} />}
                        onClick={(e) => handleExport(e, session.session_id)} />
                    </Tooltip>
                    <Popconfirm title="删除该会话？" onConfirm={(e) => handleDelete(e as any, session.session_id)}
                      okText="删除" cancelText="取消">
                      <Button type="text" size="small"
                        style={{
                          width: 22, height: 22, padding: 0, borderRadius: 3,
                          border: 'none',
                          background: 'transparent',
                        }}
                        icon={<DeleteOutlined style={{ fontSize: 11, color: BRAND }} />}
                        onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                  </div>
                  <div style={{ marginBottom: 6, paddingRight: 28 }}>
                    <Text strong style={{ fontSize: 13, lineHeight: '1.4', color: INK }} ellipsis>
                      {session.title || '新会话'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', marginBottom: 6 }}>
                    <Tag
                      style={{
                        fontSize: 10,
                        lineHeight: '18px',
                        border: `1.5px solid ${INK} !important`,
                        borderRadius: '3px !important',
                        color: INK,
                        background: BRAND_SOFT,
                        margin: 0,
                        fontWeight: 500,
                        transform: `rotate(${stickerRotation(index)}deg)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      {personas[session.persona] || session.persona}
                    </Tag>
                    {session.mode === 'examiner' && (
                      <Tag
                        style={{
                          fontSize: 10,
                          lineHeight: '18px',
                          border: `1.5px solid ${INK} !important`,
                          borderRadius: '3px !important',
                          margin: 0,
                          color: INK,
                          background: PAPER,
                          fontWeight: 500,
                          transform: `rotate(${-stickerRotation(index)}deg)`,
                          transformOrigin: 'center center',
                        }}
                      >
                        模拟面试
                      </Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ClockCircleOutlined style={{ fontSize: 10, color: INK_FAINT, flexShrink: 0 }} />
                    <Text style={{ fontSize: 10, color: INK_FAINT, whiteSpace: 'nowrap' }}>
                      {formatTime(session.updated_at)} · {session.message_count} 条消息
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Text style={{
                      fontSize: 11,
                      color: INK_FAINT,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {session.total_tokens.toLocaleString()} tokens
                    </Text>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      <style>{`
        .dx-session-card {
          background: ${PANEL};
          border: 1.5px solid ${INK};
          border-radius: 3px;
          box-shadow: none;
        }
        .dx-session-card-active {
          background: ${BRAND_SOFT} !important;
          border-color: ${INK} !important;
          box-shadow: none !important;
        }
        .dx-session-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 ${INK};
        }
        .dx-session-card:hover .dx-session-actions,
        .dx-session-card-active .dx-session-actions {
          opacity: 1 !important;
        }
        .dx-session-panel .ant-btn-primary:hover {
          background: ${BRAND_HOVER} !important;
          box-shadow: 3px 3px 0 ${INK} !important;
          transform: translate(-1px, -1px);
        }
        .dx-session-panel .ant-btn-primary:active {
          background: ${BRAND_HOVER} !important;
          box-shadow: none !important;
          transform: translate(0, 0);
        }
      `}</style>
    </div>
  );
}
