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
          <FileTextOutlined style={{ fontSize: 18, color: 'var(--ink-secondary, #6B645A)', flexShrink: 0 }} />
          <Text strong style={{ color: 'var(--ink, #1C1A17)' }}>{name}</Text>
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
          <FileTextOutlined style={{ fontSize: 22, color: 'var(--brand, #DE5126)' }} />
          <h2 style={{ margin: 0, color: 'var(--ink, #1C1A17)' }}>文件管理</h2>
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
            <FileTextOutlined style={{ fontSize: 32, color: 'var(--brand, #DE5126)' }} />
            <h3>该知识库暂无文件</h3>
            <p>上传文件后将在此列出。</p>
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
            <FileTextOutlined style={{ color: 'var(--brand, #DE5126)' }} />
            <span style={{ fontWeight: 600, color: 'var(--ink, #1C1A17)' }}>预览：{preview.name}</span>
          </div>
        }
        open={preview.open}
        onClose={() => setPreview((p) => ({ ...p, open: false }))}
        width={700}
        styles={{
          body: { padding: 20, background: 'var(--bg-paper, #FFF6EC)' },
          header: { borderBottom: '1px solid rgba(28,26,23,0.15)' },
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
          color: var(--ink, #1C1A17);
        }
        .op-card {
          background: var(--bg-panel, #FFFDF8);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-btn {
          border-radius: 3px;
          border: 1.5px solid var(--ink, #1C1A17);
          background: var(--bg-panel, #FFFDF8);
          color: var(--ink, #1C1A17);
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--ink, #1C1A17);
          border-color: var(--brand, #DE5126);
          color: var(--brand, #DE5126);
        }
        .op-btn:active {
          transform: translate(0, 0);
          box-shadow: none;
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
          background: var(--bg-panel, #FFFDF8);
          color: var(--ink-secondary, #6B645A);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .op-tag-sunken {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          background: var(--bg-sunken, #F5EDDF);
          color: var(--ink, #1C1A17);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .op-tag-warn {
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
        .op-empty {
          text-align: center;
          padding: 56px 24px;
        }
        .op-empty h3 {
          margin: 16px 0 6px;
          font-size: 16px;
          font-weight: 600;
          color: var(--ink, #1C1A17);
        }
        .op-empty p {
          margin: 0;
          color: var(--ink-secondary, #6B645A);
          font-size: 14px;
        }
        .op-code-block {
          background: var(--bg-panel, #FFFDF8);
          border: 1.5px solid var(--ink, #1C1A17);
          border-radius: 3px;
          padding: 16px;
          max-height: calc(100vh - 200px);
          overflow: auto;
          white-space: pre-wrap;
          font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
          font-size: 13px;
          line-height: 1.7;
        }
        .op-select :global(.ant-select-selector) {
          border: 1.5px solid var(--ink, #1C1A17) !important;
          border-radius: 3px !important;
          background: var(--bg-panel, #FFFDF8) !important;
        }
        .op-select :global(.ant-select-focused .ant-select-selector) {
          border-color: var(--brand, #DE5126) !important;
          outline: 2px solid var(--brand, #DE5126) !important;
          outline-offset: 2px !important;
        }
        .op-table :global(.ant-table) {
          border-radius: 3px !important;
        }
        .op-table :global(.ant-table-thead > tr > th) {
          background: var(--bg-sunken, #F5EDDF) !important;
          color: var(--ink, #1C1A17) !important;
          font-weight: 600 !important;
          border-bottom: 1px solid rgba(28, 26, 23, 0.15) !important;
        }
        .op-table :global(.ant-table-tbody > tr > td) {
          border-bottom: 1px solid rgba(28, 26, 23, 0.15) !important;
        }
        .op-table :global(.ant-table-tbody > tr:hover > td) {
          background: var(--bg-sunken, #F5EDDF) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .op-card, .op-btn, .op-link, .op-link-danger {
            transition: opacity 100ms ease;
          }
        }
      `}</style>
    </div>
  );
}
