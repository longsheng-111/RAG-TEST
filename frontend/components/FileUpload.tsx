'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  Select,
  message,
  Typography,
  Space,
  Progress,
  Alert,
  Tag,
} from 'antd';
import { InboxOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface Props {
  collectionName: string;
}

interface Collection {
  name: string;
  chunk_count: number;
}

export default function FileUpload({ collectionName }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [targetCollection, setTargetCollection] = useState(collectionName);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    file_name: string;
    chunks: number;
    collection_name: string;
  } | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    setTargetCollection(collectionName);
  }, [collectionName]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    accept: '.txt,.md,.csv,.json,.log,.pdf,.docx,.xlsx,.xlsm,.xltx,.xltm',
    beforeUpload: (file) => {
      // 检查文件大小 (50MB 限制)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        message.error('文件大小不能超过 50MB');
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('collection_name', targetCollection);

      try {
        const res = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadResult(res.data);
        message.success(`上传成功！切分为 ${res.data.chunks} 个文本片段`);
        onSuccess?.(res.data, undefined as any);
        fetchCollections(); // 刷新知识库列表
      } catch (err: any) {
        const detail = err.response?.data?.detail || '上传失败';
        message.error(detail);
        onError?.(err as any);
      } finally {
        setUploading(false);
      }
    },
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.chunk_count} 片段)`,
  }));

  if (!collectionOptions.find((o) => o.value === targetCollection)) {
    collectionOptions.unshift({
      value: targetCollection,
      label: targetCollection,
    });
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={3}>
        <CloudUploadOutlined /> 上传文件
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>目标知识库：</Text>
          <Select
            value={targetCollection}
            onChange={setTargetCollection}
            options={collectionOptions}
            style={{ width: 300, marginLeft: 12 }}
            placeholder="选择知识库"
          />
        </div>

        <Dragger {...uploadProps} disabled={uploading} className="upload-dragger">
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 PDF、Word、Excel、Markdown、TXT 等格式，单文件最大 50MB
          </p>
        </Dragger>

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={99} status="active" format={() => '处理中...'} />
          </div>
        )}
      </Card>

      {uploadResult && (
        <Alert
          type="success"
          showIcon
          message="上传成功"
          description={
            <div>
              <p><strong>文件:</strong> {uploadResult.file_name}</p>
              <p><strong>知识库:</strong> {uploadResult.collection_name}</p>
              <p><strong>切分片段:</strong> {uploadResult.chunks} 个</p>
            </div>
          }
        />
      )}

      <Card title="支持的文件格式" style={{ marginTop: 24 }}>
        <Space wrap size="middle">
          <Tag color="blue">.txt</Tag>
          <Tag color="blue">.md</Tag>
          <Tag color="blue">.csv</Tag>
          <Tag color="blue">.json</Tag>
          <Tag color="green">.pdf</Tag>
          <Tag color="orange">.docx</Tag>
          <Tag color="purple">.xlsx</Tag>
          <Tag color="purple">.xlsm</Tag>
        </Space>
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            PDF 文件支持文本型和图片型（自动调用 OCR），图片型需配置 DashScope API Key
          </Text>
        </div>
      </Card>
    </div>
  );
}
