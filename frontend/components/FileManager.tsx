'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Popconfirm, message, Typography,
  Select, Space, Drawer,
} from 'antd';
import {
  DeleteOutlined, EyeOutlined, FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const FolderSvg = () => (
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
    <path d="M12 30h22l8 12h34a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4z" />
    <path d="M12 48h72" />
    <path d="M42 30l-6-10H12" />
  </svg>
);

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
          <FileTextOutlined style={{ fontSize: 18, color: 'var(--ink-secondary)', flexShrink: 0 }} />
          <Text strong style={{ color: 'var(--ink)' }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: '切片数', dataIndex: 'chunk_count', key: 'chunk_count', width: 120,
      render: (count: number) => (
        <span className="op-tag-sunken" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {count.toLocaleString()} chunks
        </span>
      ),
    },
    {
      title: '所属知识库', dataIndex: 'collection_name', key: 'collection_name', width: 180,
      render: (name: string) => (
        <span className="op-tag">{name}</span>
      ),
    },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_: any, record: FileItem) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="op-link"
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
              type="text"
              icon={<DeleteOutlined />}
              className="op-link-danger"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fm-root">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 22, color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>文件管理</h2>
        </div>
        <Space size={12}>
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 220 }}
            className="op-select"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchFiles}
            className="op-btn"
          >
            刷新
          </Button>
        </Space>
      </div>

      <div className="op-card" style={{ overflow: 'hidden' }}>
        {files.length === 0 && !loading ? (
          <div className="op-empty">
            <div className="op-empty-illustration">
              <FolderSvg />
            </div>
            <h3>这个书架还没放资料，去上传文件</h3>
          </div>
        ) : (
          <Table
            dataSource={files}
            columns={columns}
            rowKey="file_name"
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个文件` }}
            className="op-table"
          />
        )}
      </div>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>预览：{preview.name}</span>
          </div>
        }
        open={preview.open}
        onClose={() => setPreview((p) => ({ ...p, open: false }))}
        width={700}
        styles={{
          body: { padding: 20, background: 'var(--bg-paper)' },
          header: { borderBottom: '1px solid var(--border)' },
        }}
      >
        {preview.truncated && (
          <div className="op-tag-warn" style={{ marginBottom: 14 }}>
            已截断 — 仅显示前 5,000 个字符（共 {preview.total.toLocaleString()} 个）
          </div>
        )}
        <div className="op-code-block">
          {preview.content}
        </div>
      </Drawer>

      <style jsx>{`
        .fm-root {
          color: var(--ink);
        }
        .op-empty-illustration {
          color: var(--ink-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
