'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Upload, Select, message, Typography, Space, Progress, Alert, Tag,
} from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface Props { collectionName: string; }

interface Collection { name: string; chunk_count: number; }

export default function FileUpload({ collectionName }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [targetCollection, setTargetCollection] = useState(collectionName);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    file_name: string; chunks: number; collection_name: string;
  } | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);
  useEffect(() => { setTargetCollection(collectionName); }, [collectionName]);

  const uploadProps: UploadProps = {
    name: 'file', multiple: false, showUploadList: false,
    accept: '.txt,.md,.csv,.json,.log,.pdf,.docx,.xlsx,.xlsm,.xltx,.xltm',
    beforeUpload: (file) => {
      if (file.size > 50 * 1024 * 1024) { message.error('文件过大（最大 50MB）'); return false; }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true); setUploadResult(null);
      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('collection_name', targetCollection);
      try {
        const res = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadResult(res.data);
        message.success(`上传完成！共 ${res.data.chunks} 个切片`);
        onSuccess?.(res.data, undefined as any);
        fetchCollections();
      } catch (err: any) {
        message.error(err.response?.data?.detail || '上传失败');
        onError?.(err as any);
      } finally { setUploading(false); }
    },
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name, label: `${c.name} (${c.chunk_count} chunks)`,
  }));
  if (!collectionOptions.find((o) => o.value === targetCollection)) {
    collectionOptions.unshift({ value: targetCollection, label: targetCollection });
  }

  const formatTypes = [
    { type: '文档', tags: ['.pdf', '.docx', '.md', '.txt'], color: 'blue' },
    { type: '数据', tags: ['.xlsx', '.csv', '.json'], color: 'green' },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CloudUploadOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0 }}>上传文件</h2>
        </div>
      </div>

      <Card style={{ marginBottom: 20 }} className="modern-card" bodyStyle={{ padding: 24 }}>
        <div
          style={{
            marginBottom: 20,
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #f8fafc, #f0f4ff)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <Text strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
            目标知识库
          </Text>
          <Select
            value={targetCollection}
            onChange={setTargetCollection}
            options={collectionOptions}
            style={{ minWidth: 240, flex: 1 }}
            dropdownStyle={{ borderRadius: 'var(--radius-sm)' }}
          />
        </div>

        <div className="custom-dragger">
          <Dragger {...uploadProps} disabled={uploading}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--primary)', fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              点击或拖拽文件到此处
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '8px auto 0' }}>
              支持 PDF、Word、Excel、Markdown、TXT — 单个文件最大 50MB
            </p>
          </Dragger>
        </div>

        {uploading && (
          <div style={{ marginTop: 20 }}>
            <Progress
              percent={99}
              status="active"
              format={() => '处理中...'}
              strokeColor={{ from: 'var(--primary)', to: 'var(--accent)' }}
              trailColor="rgba(99,102,241,0.1)"
            />
          </div>
        )}
      </Card>

      {uploadResult && (
        <Alert
          type="success"
          showIcon
          icon={<FileTextOutlined />}
          message="上传成功"
          description={
            <Space direction="vertical" size={4}>
              <Text><strong>文件：</strong> {uploadResult.file_name}</Text>
              <Text><strong>知识库：</strong> {uploadResult.collection_name}</Text>
              <Text><strong>切片数：</strong> {uploadResult.chunks.toLocaleString()}</Text>
            </Space>
          }
          style={{
            marginBottom: 20,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #bbf7d0',
            background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
            boxShadow: 'var(--shadow-md)',
          }}
        />
      )}

      <Card
        title={<span style={{ fontWeight: 700, fontSize: 15 }}>支持格式</span>}
        className="modern-card"
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {formatTypes.map((group) => (
            <div
              key={group.type}
              style={{
                padding: 14,
                borderRadius: 'var(--radius)',
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
              }}
            >
              <Text strong style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>
                {group.type}
              </Text>
              <Space wrap size={8}>
                {group.tags.map((t) => (
                  <Tag
                    key={t}
                    color={group.color}
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </Tag>
                ))}
              </Space>
            </div>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
          * 扫描版 PDF 需要配置 DashScope API Key 进行 OCR 识别
        </Text>
      </Card>
    </div>
  );
}
