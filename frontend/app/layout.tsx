'use client';

import React, { useState, useCallback } from 'react';
import { ConfigProvider, Layout, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Sidebar from '@/components/Sidebar';
import SessionPanel from '@/components/SessionPanel';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import FileUpload from '@/components/FileUpload';
import QAPanel from '@/components/QAPanel';
import FileManager from '@/components/FileManager';
import axios from 'axios';

const { Content } = Layout;

export type MenuKey = 'knowledge-base' | 'upload' | 'qa' | 'files';

interface Session {
  session_id: string;
  title: string;
  persona: string;
  kb_id: string;
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

  const handleCreateSession = useCallback(async () => {
    try {
      const res = await axios.post('/api/sessions', {
        persona: 'default',
        kb_id: selectedCollection,
      });
      const session = res.data;
      setActiveSessionId(session.session_id);
      setActivePersona(session.persona || 'default');
      setSessionTotal(0);
      setRefreshSessions((n) => n + 1);
    } catch {
      // ignore
    }
  }, [selectedCollection]);

  const handleSelectSession = useCallback((session: Session) => {
    setActiveSessionId(session.session_id);
    setActivePersona(session.persona);
    setSessionTotal(session.total_tokens || 0);
  }, []);

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
            width: 280, flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: '#fff',
            height: '100%',
          }}>
            <SessionPanel
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={handleCreateSession}
              refreshTrigger={refreshSessions}
            />
          </div>
          {/* Chat Area */}
          <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
            {activeSessionId ? (
              <QAPanel
                sessionId={activeSessionId}
                persona={activePersona}
                sessionTotal={sessionTotal}
                collectionName={selectedCollection}
                onCollectionChange={setSelectedCollection}
                onSessionUpdate={handleSessionUpdate}
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', flexDirection: 'column', gap: 16,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 24,
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36, color: '#fff',
                }}>DX</div>
                <h2 style={{ fontWeight: 700 }}>Welcome to DX-RAG</h2>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Create or select a session to start
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    switch (activeMenu) {
      case 'knowledge-base':
        return (
          <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>
            <KnowledgeBaseManager
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
            />
          </div>
        );
      case 'upload':
        return (
          <div style={{ padding: '20px 24px', maxWidth: 720, margin: '0 auto' }}>
            <FileUpload collectionName={selectedCollection} />
          </div>
        );
      case 'files':
        return (
          <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>
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
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#4f46e5',
              borderRadius: 8,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif",
              fontSize: 14,
              colorBgContainer: '#ffffff',
            },
            components: {
              Menu: {
                darkItemBg: 'transparent',
                darkItemSelectedBg: 'rgba(255,255,255,0.12)',
                itemBorderRadius: 8,
              },
              Button: {
                primaryShadow: '0 2px 8px rgba(79,70,229,0.3)',
              },
            },
          }}
        >
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
            <Sidebar
              activeMenu={activeMenu}
              onMenuChange={setActiveMenu}
              selectedCollection={selectedCollection}
              onCollectionChange={setSelectedCollection}
            />
            <Layout style={{ background: 'transparent' }}>
              <Content style={{ height: '100vh', overflow: 'auto' }}>
                {renderContent()}
              </Content>
            </Layout>
          </Layout>
        </ConfigProvider>
      </body>
    </html>
  );
}
