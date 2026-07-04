'use client';

import React, { useState } from 'react';
import { ConfigProvider, Layout, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Sidebar from '@/components/Sidebar';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import FileUpload from '@/components/FileUpload';
import QAPanel from '@/components/QAPanel';
import FileManager from '@/components/FileManager';

const { Content } = Layout;

export type MenuKey = 'knowledge-base' | 'upload' | 'qa' | 'files';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('qa');
  const [selectedCollection, setSelectedCollection] = useState<string>('knowledge_chunks');

  const renderContent = () => {
    switch (activeMenu) {
      case 'knowledge-base':
        return (
          <KnowledgeBaseManager
            selectedCollection={selectedCollection}
            onSelectCollection={setSelectedCollection}
          />
        );
      case 'upload':
        return <FileUpload collectionName={selectedCollection} />;
      case 'qa':
        return (
          <QAPanel
            collectionName={selectedCollection}
            onCollectionChange={setSelectedCollection}
          />
        );
      case 'files':
        return (
          <FileManager
            collectionName={selectedCollection}
            onCollectionChange={setSelectedCollection}
          />
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
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: '#1677ff',
              borderRadius: 8,
            },
          }}
        >
          <Layout style={{ minHeight: '100vh' }}>
            <Sidebar
              activeMenu={activeMenu}
              onMenuChange={setActiveMenu}
              selectedCollection={selectedCollection}
              onCollectionChange={setSelectedCollection}
            />
            <Layout>
              <Content
                style={{
                  padding: 24,
                  background: '#fff',
                  minHeight: 'calc(100vh - 0px)',
                  overflow: 'auto',
                }}
              >
                {renderContent()}
              </Content>
            </Layout>
          </Layout>
        </ConfigProvider>
      </body>
    </html>
  );
}
