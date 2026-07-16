'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, Radio, Space, Typography, Alert,
} from 'antd';
import { Briefcase, Target, BookOpen, MessageSquare } from 'lucide-react';
import axios from 'axios';

const { Text } = Typography;

interface Persona {
  id: string;
  name: string;
  description: string;
  default_kb: string;
}

interface Collection {
  name: string;
  chunk_count: number;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onCreated: (session: any) => void;
  defaultCollection?: string;
}

/* Warm-paper workbook palette (local fallback until global tokens land) */
const INK = '#1C1A17';
const INK_SECONDARY = '#6B645A';
const PANEL = '#FFFDF8';
const PAPER = '#FFF6EC';
const BRAND = '#DE5126';
const BRAND_SOFT = '#FBE9E0';
const BRAND_HOVER = '#C4431B';

export default function NewSessionModal({
  open, onCancel, onCreated, defaultCollection = 'knowledge_chunks',
}: Props) {
  const [form] = Form.useForm();
  const [mode, setMode] = useState<'qa' | 'examiner'>('qa');
  const [loading, setLoading] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    if (!open) return;
    axios.get('/api/personas').then((res) => {
      setPersonas((res.data.personas || []).filter((p: Persona) => p.id !== 'examiner'));
    }).catch(() => {});
    axios.get('/api/collections').then((res) => {
      setCollections(res.data.collections || []);
    }).catch(() => {});
    form.resetFields();
    setMode('qa');
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const payload: any = {
        persona: values.mode === 'examiner' ? 'examiner' : (values.persona || 'default'),
        collection_name: values.collection || defaultCollection,
        title: values.title || '新会话',
        mode: values.mode,
      };
      if (values.mode === 'examiner') {
        payload.target_position = values.target_position;
        payload.topic = values.topic;
        payload.title = `模拟面试 · ${values.target_position} · ${values.topic}`;
      }
      const res = await axios.post('/api/sessions', payload);
      onCreated(res.data);
      form.resetFields();
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建会话失败');
    } finally {
      setLoading(false);
    }
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.chunk_count})`,
  }));

  const qaPersonas = personas.filter((p) => p.id !== 'examiner');

  return (
    <Modal
      title="新建会话"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width="min(560px, 92vw)"
      okText="创建"
      cancelText="取消"
      className="dx-new-session-modal"
      styles={{
        header: {
          borderBottom: `1px solid ${INK}`,
          padding: '14px 20px',
        },
        body: {
          maxHeight: 'calc(100vh - 240px)',
          overflowY: 'auto',
          padding: '16px 20px',
        },
        footer: {
          borderTop: `1px solid ${INK}`,
          padding: '12px 20px',
        },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ mode: 'qa', persona: 'default', collection: defaultCollection }}
        onValuesChange={(changed) => {
          if (changed.mode) setMode(changed.mode);
        }}
      >
        <Form.Item
          name="mode"
          label="会话模式"
          rules={[{ required: true }]}
        >
          <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
            <Radio.Button value="qa" style={{ width: '50%', textAlign: 'center' }}>
              <Space>
                <MessageSquare size={14} />
                知识问答
              </Space>
            </Radio.Button>
            <Radio.Button value="examiner" style={{ width: '50%', textAlign: 'center' }}>
              <Space>
                <Target size={14} />
                模拟面试
              </Space>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="collection"
          label="知识库"
          rules={[{ required: true, message: '请选择知识库' }]}
        >
          <Select options={collectionOptions} placeholder="选择知识库" />
        </Form.Item>

        {mode === 'qa' && (
          <Form.Item
            name="persona"
            label="解答方向"
            rules={[{ required: true, message: '请选择解答方向' }]}
          >
            <Select
              placeholder="选择解答方向"
              style={{ width: '100%' }}
              popupMatchSelectWidth
              options={qaPersonas.map((p) => ({
                value: p.id,
                label: (
                  <Space direction="vertical" size={0} style={{ width: '100%', lineHeight: 1.4 }}>
                    <Text strong style={{ fontSize: 14, whiteSpace: 'normal', color: INK }}>{p.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'normal', color: INK_SECONDARY }}>{p.description}</Text>
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        )}

        {mode === 'examiner' && (
          <>
            <Alert
              message="模拟面试会在创建后自动生成第一道题"
              description="请准确填写目标岗位和面试方向，题目将严格围绕这两项生成。"
              type="info"
              showIcon
              style={{
                marginBottom: 16,
                border: `1.5px solid ${INK}`,
                borderRadius: 3,
                background: PANEL,
                color: INK,
              }}
            />
            <Form.Item
              name="target_position"
              label={
                <Space>
                  <Briefcase size={14} />
                  <span>目标岗位</span>
                </Space>
              }
              rules={[{ required: true, message: '请填写目标岗位' }]}
            >
              <Input placeholder="例如：后端开发工程师 / 前端工程师" />
            </Form.Item>
            <Form.Item
              name="topic"
              label={
                <Space>
                  <BookOpen size={14} />
                  <span>面试方向</span>
                </Space>
              }
              rules={[{ required: true, message: '请填写面试方向' }]}
            >
              <Input placeholder="例如：Java 并发 / Vue 响应式 / Redis" />
            </Form.Item>
          </>
        )}
      </Form>

      <style>{`
        .dx-new-session-modal .ant-modal-content {
          border: 1.5px solid ${INK} !important;
          border-radius: 3px !important;
          box-shadow: 6px 6px 0 ${INK} !important;
          background: ${PANEL} !important;
        }
        .dx-new-session-modal .ant-modal-header {
          background: ${PANEL} !important;
          border-radius: 3px 3px 0 0 !important;
        }
        .dx-new-session-modal .ant-modal-title {
          color: ${INK} !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        .dx-new-session-modal .ant-modal-footer {
          background: ${PANEL} !important;
          border-radius: 0 0 3px 3px !important;
        }
        .dx-new-session-modal .ant-btn-primary {
          background: ${BRAND} !important;
          border: 1.5px solid ${INK} !important;
          border-radius: 3px !important;
          box-shadow: none !important;
          transition: all 200ms cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }
        .dx-new-session-modal .ant-btn-primary:hover {
          background: ${BRAND_HOVER} !important;
          box-shadow: 3px 3px 0 ${INK} !important;
          transform: translate(-1px, -1px);
        }
        .dx-new-session-modal .ant-btn-primary:active {
          background: ${BRAND_HOVER} !important;
          box-shadow: none !important;
          transform: translate(0, 0);
        }
        .dx-new-session-modal .ant-btn-default {
          border: 1.5px solid ${INK} !important;
          border-radius: 3px !important;
          background: ${PAPER} !important;
          color: ${INK} !important;
          transition: all 200ms cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }
        .dx-new-session-modal .ant-btn-default:hover {
          background: ${BRAND_SOFT} !important;
          box-shadow: 3px 3px 0 ${INK} !important;
          transform: translate(-1px, -1px);
        }
        .dx-new-session-modal .ant-btn-default:active {
          box-shadow: none !important;
          transform: translate(0, 0);
        }
        .dx-new-session-modal .ant-radio-button-wrapper {
          border-color: ${INK} !important;
          color: ${INK_SECONDARY} !important;
          background: ${PAPER} !important;
          transition: all 200ms cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }
        .dx-new-session-modal .ant-radio-button-wrapper:not(:first-child)::before {
          background: ${INK} !important;
        }
        .dx-new-session-modal .ant-radio-button-wrapper:hover {
          color: ${INK} !important;
          background: ${BRAND_SOFT} !important;
        }
        .dx-new-session-modal .ant-radio-button-wrapper-checked {
          background: ${BRAND} !important;
          border-color: ${INK} !important;
          color: ${PAPER} !important;
        }
        .dx-new-session-modal .ant-radio-button-wrapper-checked:hover {
          background: ${BRAND_HOVER} !important;
          color: ${PAPER} !important;
        }
        .dx-new-session-modal .ant-select-selector {
          border-radius: 3px !important;
          border-color: ${INK} !important;
          background: ${PAPER} !important;
        }
        .dx-new-session-modal .ant-select:hover .ant-select-selector {
          border-color: ${INK} !important;
        }
        .dx-new-session-modal .ant-select-focused .ant-select-selector {
          border-color: ${BRAND} !important;
          box-shadow: none !important;
        }
        .dx-new-session-modal .ant-input {
          border-radius: 3px !important;
          border-color: ${INK} !important;
          background: ${PAPER} !important;
          color: ${INK} !important;
        }
        .dx-new-session-modal .ant-input:hover {
          border-color: ${INK} !important;
        }
        .dx-new-session-modal .ant-input:focus {
          border-color: ${BRAND} !important;
          box-shadow: none !important;
        }
        .dx-new-session-modal .ant-form-item-label > label {
          color: ${INK} !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        .dx-new-session-modal .ant-alert-icon {
          color: ${BRAND} !important;
        }
        .dx-new-session-modal .ant-alert-message {
          color: ${INK} !important;
          font-weight: 600 !important;
        }
        .dx-new-session-modal .ant-alert-description {
          color: ${INK_SECONDARY} !important;
        }
      `}</style>
    </Modal>
  );
}
