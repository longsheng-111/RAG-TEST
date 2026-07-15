'use client';

import React, { useState, useCallback } from 'react';
import { ConfigProvider, Layout, Tag, Typography } from 'antd';
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
import RibbonBackground from '@/components/RibbonBackground';
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
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-card)',
            height: '100%',
            boxShadow: 'var(--shadow-sm)',
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-page)' }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Tag
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 12px',
                  color: qaMode === 'qa' ? '#2c6fc7' : '#7e22ce',
                  background: qaMode === 'qa'
                    ? 'linear-gradient(135deg, #d2e4fa, #edf4fd)'
                    : 'linear-gradient(135deg, #f3e8ff, #ede9fe)',
                }}
              >
                {qaMode === 'qa' ? '知识问答' : '模拟面试'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
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
                  <div className="empty-state-icon">DX</div>
                  <h2 className="empty-state-title">Welcome to DX-RAG</h2>
                  <span className="empty-state-desc">
                    选择或创建一个会话，开始您的知识库问答之旅
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
        <RibbonBackground />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#ff6b6b',
              colorPrimaryHover: '#f25454',
              colorPrimaryActive: '#d64040',
              borderRadius: 12,
              borderRadiusSM: 8,
              borderRadiusLG: 16,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: 14,
              colorBgContainer: '#ffffff',
              colorBgLayout: '#fbfcfd',
              colorText: '#1a1a1a',
              colorTextSecondary: '#4b5563',
              colorBorder: '#eceff3',
              controlHeight: 38,
            },
            components: {
              Menu: {
                itemBg: 'transparent',
                itemSelectedBg: 'rgba(255,107,107,0.08)',
                itemHoverBg: 'rgba(255,107,107,0.06)',
                itemHoverColor: '#ff6b6b',
                itemSelectedColor: '#ff6b6b',
                itemBorderRadius: 12,
                iconMarginInlineEnd: 12,
              },
              Button: {
                primaryShadow: '0 4px 12px rgba(255,107,107,0.25)',
                borderRadius: 12,
                borderRadiusSM: 8,
              },
              Input: {
                borderRadius: 12,
                paddingInline: 12,
              },
              Select: {
                borderRadius: 12,
              },
              Card: {
                borderRadius: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              },
              Progress: {
                defaultColor: '#ff6b6b',
                colorSuccess: '#00c9a7',
                colorError: '#ff6b6b',
              },
              Tag: {
                borderRadius: 8,
              },
              Segmented: {
                itemSelectedBg: '#ffffff',
                itemHoverBg: 'rgba(255,107,107,0.06)',
                itemActiveBg: '#ffffff',
              },
            },
          }}
        >
          <Layout style={{ minHeight: '100vh', background: 'rgba(251, 252, 253, 0.92)' }}>
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
