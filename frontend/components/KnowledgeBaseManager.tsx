'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  List, Button, Modal, Input, message, Popconfirm, Typography, Space,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const BookStackSvg = () => (
  <svg
    width="96"
    height="96"
    viewBox="0 0 96 96"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 78h64M16 22v56M80 22v56M26 78V42a3 3 0 0 1 6 0v36M42 78V34a3 3 0 0 1 6 0v44M58 78V50a3 3 0 0 1 6 0v28M74 78l-8-26a3 3 0 0 0-5 1l8 25" />
  </svg>
);

interface Collection { name: string; chunk_count: number; }

interface Props {
  selectedCollection: string;
  onSelectCollection: (name: string) => void;
}

export default function KnowledgeBaseManager({ selectedCollection, onSelectCollection }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState<'create' | 'rename' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [renameTarget, setRenameTarget] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch { message.error('加载知识库失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    const n = nameInput.trim();
    if (!n || n.length < 2) { message.warning('Name must be 2-50 characters'); return; }
    try {
      await axios.post('/api/collections', { name: n });
      message.success(`知识库 "${n}" 创建成功`);
      setNameInput(''); setModalOpen(null); fetch();
    } catch (err: any) { message.error(err.response?.data?.detail || '创建失败'); }
  };

  const handleRename = async () => {
    const n = nameInput.trim();
    if (!n || n.length < 2) { message.warning('Invalid name'); return; }
    try {
      await axios.put(`/api/collections/${renameTarget}`, { new_name: n });
      message.success('重命名成功');
      if (selectedCollection === renameTarget) onSelectCollection(n);
      setModalOpen(null); fetch();
    } catch (err: any) { message.error(err.response?.data?.detail || '重命名失败'); }
  };

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/collections/${name}`);
      message.success(`知识库 "${name}" 已删除`);
      if (selectedCollection === name) onSelectCollection('knowledge_chunks');
      fetch();
    } catch { message.error('删除失败'); }
  };

  return (
    <div className="kb-root">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined style={{ fontSize: 22, color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>知识库管理</h2>
        </div>
        <Button
          className="op-btn op-btn-primary"
          icon={<PlusOutlined />}
          onClick={() => { setNameInput(''); setModalOpen('create'); }}
        >
          新建知识库
        </Button>
      </div>

      {collections.length === 0 && !loading ? (
        <div className="op-empty">
          <div className="op-empty-illustration">
            <BookStackSvg />
          </div>
          <h3>书包还是空的，先建一个知识库</h3>
          <Button
            className="op-btn op-btn-primary"
            icon={<PlusOutlined />}
            onClick={() => { setNameInput(''); setModalOpen('create'); }}
          >
            新建知识库
          </Button>
        </div>
      ) : (
        <List
          loading={loading}
          grid={{ gutter: 16, column: 1 }}
          dataSource={collections}
          renderItem={(item) => (
            <List.Item style={{ marginBottom: 0 }}>
              <div
                className={`op-card op-kb-item ${selectedCollection === item.name ? 'op-kb-item-active' : ''}`}
                onClick={() => onSelectCollection(item.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCollection(item.name);
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    <DatabaseOutlined
                      style={{
                        fontSize: 22,
                        color: selectedCollection === item.name
                          ? 'var(--brand)'
                          : 'var(--ink-secondary)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <Space size={8} style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                          {item.name}
                        </span>
                        {selectedCollection === item.name && (
                          <span className="op-tag">当前</span>
                        )}
                      </Space>
                      <div style={{
                        color: 'var(--ink-secondary)',
                        marginTop: 4,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                      >
                        {item.chunk_count.toLocaleString()} 个切片
                      </div>
                    </div>
                  </div>
                  <Space onClick={(e) => e.stopPropagation()} size={4}>
                    <Button
                      className="op-link"
                      icon={<EditOutlined />}
                      size="small"
                      type="text"
                      onClick={() => { setRenameTarget(item.name); setNameInput(item.name); setModalOpen('rename'); }}
                    >
                      重命名
                    </Button>
                    <Popconfirm
                      title="删除该知识库？"
                      description="所有数据将被永久删除，不可恢复。"
                      onConfirm={() => handleDelete(item.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        className="op-link-danger"
                        icon={<DeleteOutlined />}
                        size="small"
                        type="text"
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      <Modal
        title={modalOpen === 'create' ? '创建知识库' : `重命名 "${renameTarget}"`}
        open={modalOpen !== null}
        onOk={modalOpen === 'create' ? handleCreate : handleRename}
        onCancel={() => setModalOpen(null)}
        okText={modalOpen === 'create' ? '创建' : '重命名'}
        className="op-modal"
      >
        <Input
          className="op-input"
          placeholder="知识库名称（2-50 个字符）"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onPressEnter={modalOpen === 'create' ? handleCreate : handleRename}
          maxLength={50}
          style={{ marginTop: 8 }}
          autoFocus
        />
      </Modal>

      <style jsx>{`
        .kb-root {
          color: var(--ink);
        }
        /* 手剪贴纸特许特例（STYLE_GUIDE 4.2），禁止扩散 */
        .op-tag {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          background: var(--brand-soft);
          color: var(--brand);
          border: 1.5px solid var(--ink);
          border-radius: 3px 4px 2px 5px;
          font-size: 12px;
          font-weight: 600;
          transform: rotate(-2deg);
          box-shadow: 1.5px 1.5px 0 var(--ink);
        }
        .op-empty-illustration {
          color: var(--ink-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .op-tag {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
