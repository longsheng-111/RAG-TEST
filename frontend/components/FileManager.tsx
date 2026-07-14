'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Popconfirm, message, Typography,
  Select, Space, Drawer, Tag, Empty,
} from 'antd';
import {
  DeleteOutlined, EyeOutlined, FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface FileItem {
  file_name: string;
  chunk_count: number;
  collection_name: string;
}

interface Collection { name: string; chunk_count: number; }

interface Props {
  collectionName: string;
  onCollectionChange: (name: string) => void;
}

export default function FileManager({ collectionName, onCollectionChange }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState({ open: false, name: '', content: '', total: 0, truncated: false });

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/files', { params: { collection_name: collectionName } });
      setFiles(res.data.files || []);
    } catch { message.error('Failed to load files'); }
    finally { setLoading(false); }
  }, [collectionName]);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchFiles(); fetchCollections(); }, [fetchFiles, fetchCollections]);

  const handleDelete = async (fileName: string) => {
    try {
      await axios.delete(`/api/files/${fileName}`, { params: { collection_name: collectionName } });
      message.success(`File "${fileName}" deleted`);
      fetchFiles();
    } catch { message.error('Delete failed'); }
  };

  const handlePreview = async (fileName: string) => {
    try {
      const res = await axios.get(`/api/files/${fileName}/preview`, {
        params: { collection_name: collectionName },
      });
      setPreview({
        open: true, name: res.data.file_name,
        content: res.data.content,
        total: res.data.total_length,
        truncated: res.data.truncated,
      });
    } catch { message.error('Preview failed'); }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name, label: `${c.name} (${c.chunk_count})`,
  }));
  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  const columns = [
    {
      title: 'File Name', dataIndex: 'file_name', key: 'file_name',
      render: (name: string) => (
        <Space>
          <FileTextOutlined style={{ color: 'var(--primary)' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Chunks', dataIndex: 'chunk_count', key: 'chunk_count', width: 120,
      render: (count: number) => <Tag color="purple">{count} chunks</Tag>,
    },
    {
      title: 'Collection', dataIndex: 'collection_name', key: 'collection_name', width: 180,
      render: (name: string) => <Tag>{name}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 160,
      render: (_: any, record: FileItem) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />}
            onClick={() => handlePreview(record.file_name)}>Preview</Button>
          <Popconfirm title="Delete this file?" description="Vector data will also be removed."
            onConfirm={() => handleDelete(record.file_name)} okText="Yes" cancelText="No">
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0 }}>File Manager</h2>
        </div>
        <Space>
          <Select value={collectionName} onChange={onCollectionChange}
            options={collectionOptions} style={{ width: 220 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchFiles}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card className="modern-card">
        {files.length === 0 && !loading ? (
          <Empty description="No files in this collection" />
        ) : (
          <Table dataSource={files} columns={columns} rowKey="file_name"
            loading={loading} pagination={{ pageSize: 10, showTotal: (t) => `${t} files` }} />
        )}
      </Card>

      <Drawer title={`Preview: ${preview.name}`} open={preview.open}
        onClose={() => setPreview((p) => ({ ...p, open: false }))} width={700}>
        {preview.truncated && (
          <Tag color="orange" style={{ marginBottom: 12 }}>
            Truncated — showing first 5,000 of {preview.total.toLocaleString()} chars
          </Tag>
        )}
        <div style={{
          background: '#f8fafc', padding: 16, borderRadius: 'var(--radius)',
          maxHeight: 'calc(100vh - 200px)', overflow: 'auto',
          whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          fontSize: 13, lineHeight: 1.7,
        }}>
          {preview.content}
        </div>
      </Drawer>
    </div>
  );
}
