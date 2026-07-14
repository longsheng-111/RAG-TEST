'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Menu, Button, Typography, Select } from 'antd';
import {
  DatabaseOutlined,
  UploadOutlined,
  MessageOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuKey } from '@/app/layout';
import axios from 'axios';

const { Sider } = Layout;
const { Text } = Typography;

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
  { key: 'qa', icon: <MessageOutlined />, label: '知识问答' },
  { key: 'knowledge-base', icon: <DatabaseOutlined />, label: '知识库管理' },
  { key: 'upload', icon: <UploadOutlined />, label: '上传文件' },
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

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCollections();
    const timer = setInterval(fetchCollections, 10000);
    return () => clearInterval(timer);
  }, [fetchCollections]);

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.chunk_count})`,
  }));

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
      trigger={
        <div style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 16,
        }}>
          {collapsed ? '›' : '‹'}
        </div>
      }
    >
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">DX</div>
        {!collapsed && (
          <div>
            <div className="sidebar-brand-text">DX-RAG</div>
            <div className="sidebar-brand-sub">Knowledge Engine</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeMenu]}
        onClick={({ key }) => onMenuChange(key as MenuKey)}
        items={menuItems}
        style={{
          background: 'transparent',
          borderInlineEnd: 'none',
          marginTop: 8,
          padding: '0 8px',
        }}
      />

      {/* Collection Selector */}
      {!collapsed && (
        <div style={{ padding: '0 16px', marginTop: 32 }}>
          <Text style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 2,
            fontWeight: 600,
          }}>
            Active Knowledge Base
          </Text>
          <Select
            value={selectedCollection}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: '100%', marginTop: 8 }}
            variant="borderless"
            popupClassName="sidebar-select-dropdown"
            optionFilterProp="label"
          />
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: 16,
        }}>
          <div style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius)',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              {collections.length} knowledge bases
            </Text>
          </div>
        </div>
      )}
    </Sider>
  );
}
