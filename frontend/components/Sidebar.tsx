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
      className="dx-sidebar"
      style={{
        background: 'var(--bg-panel)',
        borderRight: '1.5px solid var(--ink)',
        boxShadow: 'none',
      }}
    >
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--bg-panel)',
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
            borderBottom: '1px solid rgba(43, 36, 25, 0.15)',
            background: 'var(--bg-panel)',
          }}
        >
          <div
            className="sidebar-brand-icon"
            style={{
              width: 36,
              height: 36,
              borderRadius: 3,
              background: 'var(--brand)',
              border: '1.5px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: 'none',
            }}
          >
            DX
          </div>
          {!collapsed && (
            <div>
              <div
                className="sidebar-brand-text"
                style={{
                  color: 'var(--ink)',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '-0.3px',
                  lineHeight: '1.2',
                }}
              >
                DX-RAG
              </div>
              <div
                className="sidebar-brand-sub"
                style={{
                  color: 'var(--ink-secondary)',
                  fontSize: 10,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  lineHeight: '1.2',
                }}
              >
                Knowledge Engine
              </div>
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

        {/* Bottom section: collapse toggle */}
        <div style={{
          flexShrink: 0,
          padding: '0 14px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="dx-sidebar-collapse"
            style={{
              width: '100%',
              height: 32,
              borderRadius: 3,
              border: '1.5px solid var(--ink)',
              background: 'var(--bg-panel)',
              color: 'var(--ink-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 200ms cubic-bezier(0.25, 0.8, 0.25, 1)',
              boxShadow: '2px 2px 0 var(--ink)',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      <style>{`
        .dx-sidebar .ant-menu {
          background: transparent !important;
          border-inline-end: none !important;
        }
        .dx-sidebar .ant-menu-item {
          color: var(--ink-secondary) !important;
          border-radius: 3px !important;
          margin: 4px 0 !important;
          border: 1.5px solid transparent !important;
          transition: all 200ms cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }
        .dx-sidebar .ant-menu-item:hover {
          color: var(--ink) !important;
          background: var(--bg-sunken) !important;
          border-color: var(--ink) !important;
        }
        .dx-sidebar .ant-menu-item-selected {
          color: var(--ink) !important;
          background: var(--brand-soft) !important;
          border-color: var(--ink) !important;
          font-weight: 600 !important;
        }
        .dx-sidebar .ant-menu-item-selected::after {
          display: none !important;
        }
        .dx-sidebar .ant-menu-inline .ant-menu-item-selected::after {
          opacity: 0 !important;
        }
        .dx-sidebar-collapse:hover {
          transform: translate(-1px, -1px) !important;
          box-shadow: 3px 3px 0 var(--ink) !important;
          color: var(--ink) !important;
          background: var(--bg-paper) !important;
        }
        .dx-sidebar-collapse:active {
          transform: translate(0, 0) !important;
          box-shadow: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .dx-sidebar .ant-menu-item,
          .dx-sidebar-collapse {
            transition-duration: 100ms !important;
          }
          .dx-sidebar-collapse:hover {
            transform: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Sider>
  );
}
