'use client';

import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  Database,
  Upload,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { MenuKey } from '@/app/layout';

const { Sider } = Layout;

interface SidebarProps {
  activeMenu: MenuKey;
  onMenuChange: (key: MenuKey) => void;
}

const menuItems = [
  { key: 'qa', icon: <MessageSquare size={18} />, label: '知识问答' },
  { key: 'knowledge-base', icon: <Database size={18} />, label: '知识库管理' },
  { key: 'upload', icon: <Upload size={18} />, label: '上传文件' },
  { key: 'files', icon: <FileText size={18} />, label: '文件管理' },
];

export default function Sidebar({
  activeMenu,
  onMenuChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={220}
      collapsedWidth={60}
      className="glass-sidebar"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid rgba(0,0,0,0.04)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Brand */}
        <div
          className="sidebar-brand"
          style={{
            flexShrink: 0,
            height: 64,
            padding: collapsed ? 0 : '0 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 12,
          }}
        >
          <div className="sidebar-brand-icon">DX</div>
          {!collapsed && (
            <div>
              <div className="sidebar-brand-text">DX-RAG</div>
              <div className="sidebar-brand-sub">Knowledge Engine</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '12px 12px' : '12px 14px',
        }}>
          <Menu
            theme="light"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[activeMenu]}
            onClick={({ key }) => onMenuChange(key as MenuKey)}
            items={menuItems}
            style={{
              background: 'transparent',
              borderInlineEnd: 'none',
            }}
          />
        </div>

        {/* Bottom section: collapse toggle only */}
        <div style={{
          flexShrink: 0,
          padding: '0 14px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              height: 32,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--coral-50)';
              e.currentTarget.style.color = 'var(--coral-600)';
              e.currentTarget.style.borderColor = 'var(--coral-200)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </Sider>
  );
}
