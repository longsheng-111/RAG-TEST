'use client';

import React, { useEffect, useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DatabaseOutlined,
  UploadOutlined,
  MessageOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { MenuKey } from '@/app/layout';
import axios from 'axios';

const { Sider } = Layout;

interface SidebarProps {
  activeMenu: MenuKey;
  onMenuChange: (key: MenuKey) => void;
  selectedCollection: string;
  onCollectionChange: (name: string) => void;
}

interface Collection {
  name: string;
  chunk_count: number;
}

const menuItems = [
  { key: 'knowledge-base', icon: <DatabaseOutlined />, label: '知识库管理' },
  { key: 'upload', icon: <UploadOutlined />, label: '上传文件' },
  { key: 'qa', icon: <MessageOutlined />, label: '知识问答' },
  { key: 'files', icon: <FileTextOutlined />, label: '文件管理' },
];

export default function Sidebar({
  activeMenu,
  onMenuChange,
  selectedCollection,
  onCollectionChange,
}: SidebarProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const fetchCollections = async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch {
      // 忽略错误
    }
  };

  useEffect(() => {
    fetchCollections();
    const timer = setInterval(fetchCollections, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={220}
      style={{
        background: 'linear-gradient(180deg, #001529 0%, #002140 100%)',
      }}
    >
      <div className="sidebar-logo">
        {collapsed ? 'DX' : 'DX-RAG'}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeMenu]}
        onClick={({ key }) => onMenuChange(key as MenuKey)}
        items={menuItems}
        style={{ background: 'transparent', marginTop: 12 }}
      />

      {!collapsed && (
        <div style={{ padding: '0 16px', marginTop: 24 }}>
          <div
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            当前知识库
          </div>
          <div
            style={{
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={selectedCollection}
          >
            📚 {selectedCollection}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 11,
              marginTop: 6,
            }}
          >
            {collections.length} 个知识库
          </div>
        </div>
      )}
    </Sider>
  );
}
