'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, List, Button, Modal, Input, message, Popconfirm, Typography, Space, Tag,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

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
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0 }}>知识库管理</h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setNameInput(''); setModalOpen('create'); }}>
          新建知识库
        </Button>
      </div>

      {collections.length === 0 && !loading ? (
        <div
          className="modern-card"
          style={{
            textAlign: 'center',
            padding: '56px 24px',
            background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: '0 auto 20px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <DatabaseOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            暂无知识库
          </h3>
          <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
            创建第一个知识库，开始上传文档并问答。
          </p>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
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
              <Card
                hoverable
                className={selectedCollection === item.name ? 'modern-card modern-card-active' : 'modern-card'}
                bodyStyle={{ padding: 18 }}
                onClick={() => onSelectCollection(item.name)}
                style={{
                  overflow: 'hidden',
                  transition: 'all 0.25s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        borderRadius: 'var(--radius)',
                        background: selectedCollection === item.name
                          ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                          : 'linear-gradient(135deg, var(--gray-100), var(--gray-150))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: selectedCollection === item.name
                          ? 'var(--shadow-glow)'
                          : 'none',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <DatabaseOutlined
                        style={{
                          color: selectedCollection === item.name ? '#fff' : 'var(--primary)',
                          fontSize: 22,
                          transition: 'color 0.25s ease',
                        }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Space size={8} style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.name}
                        </span>
                        {selectedCollection === item.name && (
                          <Tag
                            style={{
                                              background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                                              color: '#fff',
                                              border: 'none',
                                              fontWeight: 500,
                                            }}
                          >
                            当前
                          </Tag>
                        )}
                      </Space>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
                        {item.chunk_count.toLocaleString()} 个切片
                      </div>
                    </div>
                  </div>
                  <Space onClick={(e) => e.stopPropagation()} size={4}>
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      type="text"
                      style={{
                        color: 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)';
                        (e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
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
                        icon={<DeleteOutlined />}
                        size="small"
                        type="text"
                        danger
                        style={{ transition: 'all 0.2s ease' }}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
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
      >
        <Input
          placeholder="知识库名称（2-50 个字符）"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onPressEnter={modalOpen === 'create' ? handleCreate : handleRename}
          maxLength={50}
          style={{ marginTop: 8 }}
          autoFocus
        />
      </Modal>
    </div>
  );
}
