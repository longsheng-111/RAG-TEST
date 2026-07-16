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
          <DatabaseOutlined style={{ fontSize: 22, color: 'var(--brand, #DE5126)' }} />
          <h2 style={{ margin: 0, color: 'var(--ink, #1C1A17)' }}>知识库管理</h2>
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
          <DatabaseOutlined style={{ fontSize: 32, color: 'var(--brand, #DE5126)' }} />
          <h3>暂无知识库</h3>
          <p>创建第一个知识库，开始上传文档并问答。</p>
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
                          ? 'var(--brand, #DE5126)'
                          : 'var(--ink-secondary, #6B645A)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <Space size={8} style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink, #1C1A17)' }}>
                          {item.name}
                        </span>
                        {selectedCollection === item.name && (
                          <span className="op-tag">当前</span>
                        )}
                      </Space>
                      <div style={{
                        color: 'var(--ink-secondary, #6B645A)',
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
        styles={{
          content: {
            border: '1.5px solid var(--ink, #1C1A17)',
            borderRadius: 3,
            boxShadow: '6px 6px 0 var(--ink, #1C1A17)',
          },
          header: { borderBottom: '1px solid rgba(28,26,23,0.15)' },
        }}
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
          color: var(--ink, #1C1A17);
        }
        .op-card {
          background: var(--bg-panel, #FFFDF8);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            background 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-kb-item {
          padding: 18px;
          cursor: pointer;
        }
        .op-kb-item:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--ink, #1C1A17);
        }
        .op-kb-item:active {
          transform: translate(0, 0);
          box-shadow: none;
        }
        .op-kb-item-active {
          background: var(--brand-soft, #FBE9E0);
          border-color: var(--brand, #DE5126);
        }
        .op-btn {
          border-radius: 3px;
          border: 1.5px solid var(--ink, #1C1A17);
          background: var(--bg-panel, #FFFDF8);
          color: var(--ink, #1C1A17);
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            background 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--ink, #1C1A17);
        }
        .op-btn:active {
          transform: translate(0, 0);
          box-shadow: none;
        }
        .op-btn-primary {
          background: var(--brand, #DE5126);
          border-color: var(--ink, #1C1A17);
          color: #fff;
        }
        .op-btn-primary:hover {
          background: var(--brand-hover, #C4431B);
        }
        .op-btn-primary:disabled {
          background: var(--bg-sunken, #F5EDDF);
          color: var(--ink-faint, #A39A8C);
          border-color: var(--ink-faint, #A39A8C);
        }
        .op-link {
          color: var(--ink-secondary, #6B645A);
          transition: color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-link:hover {
          color: var(--brand, #DE5126);
        }
        .op-link-danger {
          color: var(--brand, #DE5126);
          transition: color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-link-danger:hover {
          color: var(--brand-hover, #C4431B);
        }
        .op-tag {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          background: var(--brand-soft, #FBE9E0);
          color: var(--brand, #DE5126);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .op-input {
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          background: var(--bg-panel, #FFFDF8);
          transition: border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-input:focus {
          border-color: var(--brand, #DE5126);
          outline: 2px solid var(--brand, #DE5126);
          outline-offset: 2px;
        }
        .op-empty {
          text-align: center;
          padding: 56px 24px;
          background: var(--bg-panel, #FFFDF8);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
        }
        .op-empty h3 {
          margin: 16px 0 8px;
          font-size: 16px;
          font-weight: 600;
          color: var(--ink, #1C1A17);
        }
        .op-empty p {
          margin: 0 0 24px;
          color: var(--ink-secondary, #6B645A);
          font-size: 14px;
        }
        .op-modal :global(.ant-modal-content) {
          background: var(--bg-panel, #FFFDF8) !important;
          border: 1.5px solid var(--ink, #1C1A17) !important;
          border-radius: 3px !important;
          box-shadow: 6px 6px 0 var(--ink, #1C1A17) !important;
        }
        .op-modal :global(.ant-modal-header) {
          background: var(--bg-panel, #FFFDF8) !important;
          border-bottom: 1px solid rgba(28, 26, 23, 0.15) !important;
        }
        .op-modal :global(.ant-modal-title) {
          color: var(--ink, #1C1A17) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .op-card, .op-btn, .op-link, .op-link-danger, .op-input {
            transition: opacity 100ms ease;
          }
        }
      `}</style>
    </div>
  );
}
