'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  List,
  Button,
  Modal,
  Input,
  message,
  Popconfirm,
  Empty,
  Typography,
  Space,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface Collection {
  name: string;
  chunk_count: number;
}

interface Props {
  selectedCollection: string;
  onSelectCollection: (name: string) => void;
}

export default function KnowledgeBaseManager({ selectedCollection, onSelectCollection }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/collections');
      setCollections(res.data.collections || []);
    } catch {
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || name.length < 2 || name.length > 50) {
      message.warning('知识库名称需 2-50 个字符');
      return;
    }
    try {
      await axios.post('/api/collections', { name });
      message.success(`知识库 "${name}" 创建成功`);
      setNewName('');
      setCreateModalOpen(false);
      fetchCollections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败');
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/collections/${name}`);
      message.success(`知识库 "${name}" 已删除`);
      if (selectedCollection === name) {
        onSelectCollection('knowledge_chunks');
      }
      fetchCollections();
    } catch {
      message.error('删除失败');
    }
  };

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name || name.length < 2 || name.length > 50) {
      message.warning('新名称需 2-50 个字符');
      return;
    }
    try {
      await axios.put(`/api/collections/${renameTarget}`, { new_name: name });
      message.success('重命名成功');
      setRenameModalOpen(false);
      if (selectedCollection === renameTarget) {
        onSelectCollection(name);
      }
      fetchCollections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '重命名失败');
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <DatabaseOutlined /> 知识库管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          创建知识库
        </Button>
      </div>

      {collections.length === 0 && !loading ? (
        <Empty description="暂无知识库，点击上方按钮创建" />
      ) : (
        <List
          loading={loading}
          grid={{ gutter: 16, column: 1 }}
          dataSource={collections}
          renderItem={(item) => (
            <List.Item>
              <Card
                hoverable
                style={{
                  borderColor: selectedCollection === item.name ? '#1677ff' : undefined,
                  borderWidth: selectedCollection === item.name ? 2 : 1,
                }}
                onClick={() => onSelectCollection(item.name)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Space>
                      <DatabaseOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{item.name}</span>
                      {selectedCollection === item.name && (
                        <Tag color="blue">当前使用</Tag>
                      )}
                    </Space>
                    <div style={{ color: '#888', marginTop: 4 }}>
                      {item.chunk_count} 个文本片段
                    </div>
                  </div>
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => {
                        setRenameTarget(item.name);
                        setRenameValue(item.name);
                        setRenameModalOpen(true);
                      }}
                    >
                      重命名
                    </Button>
                    <Popconfirm
                      title="确定删除此知识库？"
                      description="所有向量数据将被永久删除"
                      onConfirm={() => handleDelete(item.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button icon={<DeleteOutlined />} size="small" danger>
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

      {/* 创建知识库弹窗 */}
      <Modal
        title="创建知识库"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入知识库名称（2-50 个字符）"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
          maxLength={50}
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title={`重命名 "${renameTarget}"`}
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => setRenameModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新名称"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          maxLength={50}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
