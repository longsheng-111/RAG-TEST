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
      if (file.size > 50 * 1024 * 1024) { message.error('File too large (max 50MB)'); return false; }
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
        message.success(`Uploaded! ${res.data.chunks} chunks`);
        onSuccess?.(res.data, undefined as any);
        fetchCollections();
      } catch (err: any) {
        message.error(err.response?.data?.detail || 'Upload failed');
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
    { type: 'Documents', tags: ['.pdf', '.docx', '.md', '.txt'], color: 'blue' },
    { type: 'Data', tags: ['.xlsx', '.csv', '.json'], color: 'green' },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CloudUploadOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <h2 style={{ margin: 0 }}>Upload Files</h2>
        </div>
      </div>

      <Card style={{ marginBottom: 20 }} className="modern-card">
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginRight: 12 }}>Target Collection:</Text>
          <Select value={targetCollection} onChange={setTargetCollection}
            options={collectionOptions} style={{ width: 280 }} />
        </div>

        <div className="custom-dragger">
          <Dragger {...uploadProps} disabled={uploading}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--primary)' }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
              Click or drag files here
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 13 }}>
              PDF · Word · Excel · Markdown · TXT — Max 50MB per file
            </p>
          </Dragger>
        </div>

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={99} status="active"
              format={() => 'Processing...'}
              strokeColor={{ from: 'var(--primary)', to: 'var(--accent)' }} />
          </div>
        )}
      </Card>

      {uploadResult && (
        <Alert
          type="success" showIcon icon={<FileTextOutlined />}
          message="Upload Successful"
          description={
            <Space direction="vertical" size={2}>
              <Text><strong>File:</strong> {uploadResult.file_name}</Text>
              <Text><strong>Collection:</strong> {uploadResult.collection_name}</Text>
              <Text><strong>Chunks:</strong> {uploadResult.chunks}</Text>
            </Space>
          }
          style={{ marginBottom: 20, borderRadius: 'var(--radius)' }}
        />
      )}

      <Card title="Supported Formats" className="modern-card">
        {formatTypes.map((group) => (
          <div key={group.type} style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13 }}>{group.type}:</Text>
            <br />
            <Space wrap style={{ marginTop: 6 }}>
              {group.tags.map((t) => (
                <Tag key={t} color={group.color}>{t}</Tag>
              ))}
            </Space>
          </div>
        ))}
        <Text type="secondary" style={{ fontSize: 12 }}>
          * Scanned PDFs require DashScope API key for OCR
        </Text>
      </Card>
    </div>
  );
}
