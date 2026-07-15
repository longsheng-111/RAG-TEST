'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Popconfirm, message, Typography,
  Select, Space, Drawer, Tag,
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
    } catch { message.error('加载文件失败'); }
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
      message.success(`文件 "${fileName}" 已删除`);
      fetchFiles();
    } catch { message.error('删除失败'); }
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
    } catch { message.error('预览失败'); }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name, label: `${c.name} (${c.chunk_count})`,
  }));
  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  const columns = [
    {
      title: '文件名', dataIndex: 'file_name', key: 'file_name',
      render: (name: string) => (
        <Space size={10}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #f0f4ff, #e0f2fe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileTextOutlined style={{ color: 'var(--primary)', fontSize: 15 }} />
          </div>
          <Text strong style={{ color: 'var(--text-primary)' }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: '切片数', dataIndex: 'chunk_count', key: 'chunk_count', width: 120,
      render: (count: number) => (
        <Tag
          style={{
            background: 'linear-gradient(135deg, var(--mint-100), var(--mint-50))',
            color: 'var(--mint-700)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 500,
          }}
        >
          {count.toLocaleString()} chunks
        </Tag>
      ),
    },
    {
      title: '所属知识库', dataIndex: 'collection_name', key: 'collection_name', width: 180,
      render: (name: string) => (
        <Tag
          style={{
            background: 'var(--bg-page)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 500,
          }}
        >
          {name}
        </Tag>
      ),
    },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_: any, record: FileItem) => (
        <Space size={4}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.file_name)}
          >
            预览
          </Button>
          <Popconfirm
            title="删除该文件？"
            description="向量数据也将被删除，不可恢复。"
            onConfirm={() => handleDelete(record.file_name)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 'var(--radius-sm)', transition: 'all 0.2s ease' }}
            >
              删除
            </Button>
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
          <h2 style={{ margin: 0 }}>文件管理</h2>
        </div>
        <Space size={12}>
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 220 }}
            dropdownStyle={{ borderRadius: 'var(--radius-sm)' }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchFiles}
            style={{
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary-light)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '';
              (e.currentTarget as HTMLButtonElement).style.color = '';
            }}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Card className="modern-card" bodyStyle={{ padding: 0 }}>
        {files.length === 0 && !loading ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto 18px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #f0f4ff, #e0f2fe)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileTextOutlined style={{ fontSize: 28, color: 'var(--primary)' }} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              该知识库暂无文件
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              上传文件后将在此列出。
            </p>
          </div>
        ) : (
          <Table
            dataSource={files}
            columns={columns}
            rowKey="file_name"
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个文件` }}
            style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}
          />
        )}
      </Card>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700 }}>预览：{preview.name}</span>
          </div>
        }
        open={preview.open}
        onClose={() => setPreview((p) => ({ ...p, open: false }))}
        width={700}
        bodyStyle={{ padding: 20, background: 'var(--bg-page)' }}
        headerStyle={{ borderBottom: '1px solid var(--border)' }}
      >
        {preview.truncated && (
          <Tag
            color="orange"
            style={{
              marginBottom: 14,
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontWeight: 500,
            }}
          >
            已截断 — 仅显示前 5,000 个字符（共 {preview.total.toLocaleString()} 个）
          </Tag>
        )}
        <div
          style={{
            background: 'var(--bg-card)',
            padding: 20,
            borderRadius: 'var(--radius-lg)',
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            fontSize: 13,
            lineHeight: 1.7,
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)',
          }}
        >
          {preview.content}
        </div>
      </Drawer>
    </div>
  );
}
