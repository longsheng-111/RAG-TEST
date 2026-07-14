'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, List, Button, Modal, Input, message, Popconfirm, Empty, Typography, Space, Tag,
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
    } catch { message.error('Failed to load collections'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    const n = nameInput.trim();
    if (!n || n.length < 2) { message.warning('Name must be 2-50 characters'); return; }
    try {
      await axios.post('/api/collections', { name: n });
      message.success(`Collection "${n}" created`);
      setNameInput(''); setModalOpen(null); fetch();
    } catch (err: any) { message.error(err.response?.data?.detail || 'Create failed'); }
  };

  const handleRename = async () => {
    const n = nameInput.trim();
    if (!n || n.length < 2) { message.warning('Invalid name'); return; }
    try {
      await axios.put(`/api/collections/${renameTarget}`, { new_name: n });
      message.success('Renamed');
      if (selectedCollection === renameTarget) onSelectCollection(n);
      setModalOpen(null); fetch();
    } catch (err: any) { message.error(err.response?.data?.detail || 'Rename failed'); }
  };

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/collections/${name}`);
      message.success(`Collection "${name}" deleted`);
      if (selectedCollection === name) onSelectCollection('knowledge_chunks');
      fetch();
    } catch { message.error('Delete failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0 }}>Knowledge Bases</h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setNameInput(''); setModalOpen('create'); }}>
          New Collection
        </Button>
      </div>

      {collections.length === 0 && !loading ? (
        <Empty description="No collections yet — create one to get started" />
      ) : (
        <List
          loading={loading}
          grid={{ gutter: 16, column: 1 }}
          dataSource={collections}
          renderItem={(item) => (
            <List.Item>
              <Card
                hoverable
                className={selectedCollection === item.name ? 'modern-card modern-card-active' : 'modern-card'}
                onClick={() => onSelectCollection(item.name)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Space>
                      <DatabaseOutlined style={{ color: 'var(--primary)', fontSize: 18 }} />
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{item.name}</span>
                      {selectedCollection === item.name && <Tag color="purple">Active</Tag>}
                    </Space>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
                      {item.chunk_count} chunks
                    </div>
                  </div>
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Button icon={<EditOutlined />} size="small" type="text"
                      onClick={() => { setRenameTarget(item.name); setNameInput(item.name); setModalOpen('rename'); }}>
                      Rename
                    </Button>
                    <Popconfirm title="Delete this collection?" description="All data will be permanently removed."
                      onConfirm={() => handleDelete(item.name)} okText="Yes" cancelText="No">
                      <Button icon={<DeleteOutlined />} size="small" type="text" danger>Delete</Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      <Modal
        title={modalOpen === 'create' ? 'Create Collection' : `Rename "${renameTarget}"`}
        open={modalOpen !== null}
        onOk={modalOpen === 'create' ? handleCreate : handleRename}
        onCancel={() => setModalOpen(null)}
        okText={modalOpen === 'create' ? 'Create' : 'Rename'}
      >
        <Input
          placeholder="Collection name (2-50 chars)"
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
