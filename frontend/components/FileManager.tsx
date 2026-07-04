'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Popconfirm,
  message,
  Typography,
  Select,
  Space,
  Drawer,
  Tag,
  Empty,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface FileItem {
  file_name: string;
  chunk_count: number;
  collection_name: string;
}

interface Collection {
  name: string;
  chunk_count: number;
}

interface Props {
  collectionName: string;
  onCollectionChange: (name: string) => void;
}

export default function FileManager({ collectionName, onCollectionChange }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewTotalLen, setPreviewTotalLen] = useState(0);
  const [previewTruncated, setPreviewTruncated] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/files', {
        params: { collection_name: collectionName },
      });
      setFiles(res.data.files || []);
    } catch {
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchCollections();
  }, [fetchFiles, fetchCollections]);

  const handleDelete = async (fileName: string) => {
    try {
      await axios.delete(`/api/files/${fileName}`, {
        params: { collection_name: collectionName },
      });
      message.success(`文件 "${fileName}" 已删除`);
      fetchFiles();
    } catch {
      message.error('删除失败');
    }
  };

  const handlePreview = async (fileName: string) => {
    try {
      const res = await axios.get(`/api/files/${fileName}/preview`, {
        params: { collection_name: collectionName },
      });
      setPreviewFileName(res.data.file_name);
      setPreviewContent(res.data.content);
      setPreviewTotalLen(res.data.total_length);
      setPreviewTruncated(res.data.truncated);
      setPreviewOpen(true);
    } catch {
      message.error('预览失败');
    }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.chunk_count} 片段)`,
  }));

  if (!collectionOptions.find((o) => o.value === collectionName)) {
    collectionOptions.unshift({ value: collectionName, label: collectionName });
  }

  const columns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (name: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1677ff' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '文本片段数',
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      width: 140,
      render: (count: number) => <Tag color="blue">{count} chunks</Tag>,
    },
    {
      title: '所属知识库',
      dataIndex: 'collection_name',
      key: 'collection_name',
      width: 200,
      render: (name: string) => <Tag>{name}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: FileItem) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.file_name)}
          >
            预览
          </Button>
          <Popconfirm
            title="确定删除此文件？"
            description="向量数据将一并删除"
            onConfirm={() => handleDelete(record.file_name)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined /> 文件管理
        </Title>
        <Space>
          <Select
            value={collectionName}
            onChange={onCollectionChange}
            options={collectionOptions}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchFiles}>
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        {files.length === 0 && !loading ? (
          <Empty description="该知识库暂无文件" />
        ) : (
          <Table
            dataSource={files}
            columns={columns}
            rowKey="file_name"
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个文件` }}
          />
        )}
      </Card>

      {/* 文件预览抽屉 */}
      <Drawer
        title={`预览: ${previewFileName}`}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={700}
      >
        {previewTruncated && (
          <Tag color="orange" style={{ marginBottom: 12 }}>
            内容已截断，仅显示前 5000 字符（完整 {previewTotalLen} 字符）
          </Tag>
        )}
        <div
          style={{
            background: '#f9f9f9',
            padding: 16,
            borderRadius: 8,
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {previewContent}
        </div>
      </Drawer>
    </div>
  );
}
