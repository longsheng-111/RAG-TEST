'use client';

import React, { useState, useCallback } from 'react';
import { ConfigProvider, Layout, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import SessionPanel from '@/components/SessionPanel';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import FileUpload from '@/components/FileUpload';
import QAPanel from '@/components/QAPanel';
import ExaminerPanel from '@/components/ExaminerPanel';
import FileManager from '@/components/FileManager';
import NewSessionModal from '@/components/NewSessionModal';
import axios from 'axios';

const { Content } = Layout;
const { Text } = Typography;

export type MenuKey = 'knowledge-base' | 'upload' | 'qa' | 'files';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('qa');
  const [selectedCollection, setSelectedCollection] = useState('knowledge_chunks');
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activePersona, setActivePersona] = useState('default');
  const [sessionTotal, setSessionTotal] = useState(0);
  const [refreshSessions, setRefreshSessions] = useState(0);
  const [qaMode, setQaMode] = useState<'qa' | 'examiner'>('qa');
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  const handleCreateSession = useCallback(() => {
    setNewSessionOpen(true);
  }, []);

  const handleSessionCreated = useCallback((session: Session) => {
    setActiveSessionId(session.session_id);
    setActivePersona(session.persona || 'default');
    setSessionTotal(session.total_tokens || 0);
    setSelectedCollection(session.kb_id || selectedCollection);
    const mode = session.mode || 'qa';
    setQaMode(mode);
    setRefreshSessions((n) => n + 1);
    setNewSessionOpen(false);
  }, [selectedCollection]);

  const handleSelectSession = useCallback((session: Session) => {
    setActiveSessionId(session.session_id);
    setActivePersona(session.persona);
    setSessionTotal(session.total_tokens || 0);
    setSelectedCollection(session.kb_id || selectedCollection);
    setQaMode(session.mode || 'qa');
  }, [selectedCollection]);

  const handleSessionUpdate = useCallback((sessionId: string, persona: string, totalTokens: number) => {
    setActivePersona(persona);
    setSessionTotal(totalTokens);
    setRefreshSessions((n) => n + 1);
  }, []);

  const renderContent = () => {
    if (activeMenu === 'qa') {
      return (
        <div style={{ display: 'flex', height: '100%', gap: 0 }}>
          {/* Session Panel */}
          <div style={{
            width: 200,
            flexShrink: 0,
            borderRight: '1.5px solid var(--ink)',
            background: 'var(--bg-panel)',
            height: '100%',
            zIndex: 1,
          }}>
            <SessionPanel
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={handleCreateSession}
              refreshTrigger={refreshSessions}
            />
          </div>
          {/* Chat Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-paper)' }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid rgba(28,26,23,0.15)',
              background: 'var(--bg-panel)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  borderBottom: '2px solid var(--brand)',
                  paddingBottom: 2,
                }}
              >
                {qaMode === 'qa' ? '知识问答' : '模拟面试'}
              </span>
              <Text style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                {qaMode === 'qa' ? '用户提问，AI 检索回答' : 'AI 出题，用户回答并评分'}
              </Text>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {activeSessionId ? (
                qaMode === 'qa' ? (
                  <QAPanel
                    sessionId={activeSessionId}
                    persona={activePersona}
                    sessionTotal={sessionTotal}
                    collectionName={selectedCollection}
                    onCollectionChange={setSelectedCollection}
                    onSessionUpdate={handleSessionUpdate}
                  />
                ) : (
                  <ExaminerPanel
                    sessionId={activeSessionId}
                    collectionName={selectedCollection}
                  />
                )
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <InboxOutlined />
                  </div>
                  <span className="empty-state-title">选择一个会话开始</span>
                  <span className="empty-state-desc">
                    在左侧面板新建或选择会话，开始知识库问答
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    switch (activeMenu) {
      case 'knowledge-base':
        return (
          <div className="page-container">
            <KnowledgeBaseManager
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
            />
          </div>
        );
      case 'upload':
        return (
          <div className="page-container" style={{ maxWidth: 720 }}>
            <FileUpload collectionName={selectedCollection} />
          </div>
        );
      case 'files':
        return (
          <div className="page-container">
            <FileManager
              collectionName={selectedCollection}
              onCollectionChange={setSelectedCollection}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <html lang="zh-CN">
      <body>
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#DE5126',
                colorText: '#1C1A17',
                colorBgLayout: '#FFF6EC',
                colorBgContainer: '#FFFDF8',
                colorBorder: '#1C1A17',
                colorBorderSecondary: 'rgba(28,26,23,0.15)',
                borderRadius: 3,
                fontSize: 14,
                fontFamily: '-apple-system, "PingFang SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
                boxShadow: '3px 3px 0 #1C1A17',
                boxShadowSecondary: '3px 3px 0 rgba(28,26,23,0.25)',
              },
              components: {
                Button: { borderRadius: 3, primaryShadow: 'none' },
                Modal: { borderRadiusLG: 3 },
                Tag: { borderRadiusSM: 3 },
              },
            }}
          >
            <Layout style={{ minHeight: '100vh', background: 'var(--bg-paper)' }}>
              <Sidebar
                activeMenu={activeMenu}
                onMenuChange={setActiveMenu}
              />
              <Layout style={{ background: 'transparent' }}>
                <Content style={{ height: '100vh', overflow: 'hidden' }}>
                  {renderContent()}
                </Content>
              </Layout>
            </Layout>
            <NewSessionModal
              open={newSessionOpen}
              onCancel={() => setNewSessionOpen(false)}
              onCreated={handleSessionCreated}
              defaultCollection={selectedCollection}
            />
          </ConfigProvider>
        </div>
      </body>
    </html>
  );
}
