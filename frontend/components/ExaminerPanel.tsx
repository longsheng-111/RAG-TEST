'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Input, Tag, Progress, Typography, Space, Spin, Alert, Divider, Segmented,
} from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Play, RotateCcw, Send, Flag, CheckCircle2, AlertTriangle, GraduationCap, Target,
} from 'lucide-react';

const { Title, Text } = Typography;

interface ExamPoint {
  point: string;
  hit: boolean;
  evidence: string;
}

interface ExamScore {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  points?: ExamPoint[];
  missed_points?: string[];
}

interface ExamSummary {
  raw: string;
  total_score: number;
}

interface ExamEvaluation {
  raw: string;
  score: number;
  points?: ExamPoint[];
  comment?: string;
  supplement?: string;
  correction?: string;
}

interface ExamState {
  session_id: string;
  status: 'asking' | 'follow_up' | 'finished';
  question_index: number;
  current_question: string;
  current_expectations: string[];
  reference_points: string[];
  follow_up_count: number;
  evaluation?: ExamEvaluation;
  summary?: ExamSummary;
  scores: ExamScore[];
  weak_points: string[];
  cheating_detected?: boolean;
}

interface Props {
  sessionId: string;
  collectionName: string;
}

const MAX_QUESTIONS = 5;

function ReferencePointsCard({ points }: { points: string[] }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 12, borderRadius: 8, background: 'var(--gray-50)', borderColor: 'var(--border)' }}
      title={<Text strong style={{ fontSize: 12 }}>参考答案要点</Text>}
    >
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </Card>
  );
}

function PointsResultCard({ points }: { points?: ExamPoint[] }) {
  if (!points || points.length === 0) return null;
  const hitCount = points.filter((p) => p.hit).length;
  return (
    <div style={{ marginTop: 12 }}>
      <Text strong style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        要点命中 {hitCount} / {points.length}
      </Text>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              background: p.hit ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${p.hit ? '#a7f3d0' : '#fecaca'}`,
              fontSize: 12,
            }}
          >
            <Space size={6}>
              {p.hit ? (
                <CheckCircle2 size={14} color="var(--success)" />
              ) : (
                <AlertTriangle size={14} color="var(--error)" />
              )}
              <Text style={{ color: p.hit ? 'var(--success)' : 'var(--error)', fontWeight: 500 }}>
                {p.hit ? '命中' : '未命中'}
              </Text>
            </Space>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{p.point}</div>
            {p.evidence && (
              <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                依据：{p.evidence}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExaminerPanel({ sessionId, collectionName }: Props) {
  const [phase, setPhase] = useState<'config' | 'exam'>('config');
  const [state, setState] = useState<ExamState | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetPosition, setTargetPosition] = useState('');
  const [topic, setTopic] = useState('');

  const fetchSessionConfig = useCallback(async () => {
    try {
      const res = await axios.get(`/api/sessions/${sessionId}`);
      const examState = res.data?.exam_state || {};
      if (examState.target_position && examState.topic) {
        setTargetPosition(examState.target_position);
        setTopic(examState.topic);
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  const fetchState = useCallback(async () => {
    try {
      const res = await axios.get(`/api/exam/${sessionId}`);
      if (res.data?.status && res.data.status !== 'configuring') {
        setState(res.data);
        setPhase('exam');
      }
    } catch {
      // 未开始面试则停留在配置页
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSessionConfig();
    fetchState();
  }, [fetchSessionConfig, fetchState]);

  const startExam = async () => {
    if (!targetPosition.trim() || !topic.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/exam/start', {
        session_id: sessionId,
        target_position: targetPosition.trim(),
        topic: topic.trim(),
        collection_name: collectionName,
        top_k: 5,
      });
      setState(res.data);
      setPhase('exam');
      setAnswer('');
    } catch (err: any) {
      alert(err.response?.data?.detail || '启动面试失败');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (value?: string) => {
    const text = (value ?? answer).trim();
    if (!text || !state) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/exam/${state.session_id}/next`, {
        answer: text,
        top_k: 5,
      });
      setState(res.data);
      setAnswer('');
    } catch (err: any) {
      alert(err.response?.data?.detail || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const avgScore = state?.scores?.length
    ? state.scores.reduce((s, i) => s + i.score, 0) / state.scores.length
    : 0;

  const progressPercent = Math.min(((state?.scores?.length || 0) / MAX_QUESTIONS) * 100, 100);

  if (phase === 'config') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <Card
          title={
            <Space>
              <GraduationCap size={20} style={{ color: 'var(--brand-600)' }} />
              <span>配置模拟面试</span>
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>目标岗位</Text>
              <Input
                placeholder="例如：后端开发工程师"
                value={targetPosition}
                onChange={(e) => setTargetPosition(e.target.value)}
                size="large"
              />
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>面试方向</Text>
              <Input
                placeholder="例如：Java 并发 / Redis / Vue 响应式"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                size="large"
              />
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>题目数量</Text>
              <Segmented
                value={MAX_QUESTIONS}
                options={[{ label: `${MAX_QUESTIONS} 题`, value: MAX_QUESTIONS }]}
                disabled
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                默认 5 题，由浅入深；单题最多追问 2 次
              </Text>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<Play size={16} />}
              onClick={startExam}
              loading={loading}
              disabled={!targetPosition.trim() || !topic.trim()}
              block
              style={{ background: 'var(--brand-600)' }}
            >
              开始面试
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  if (!state) return <Spin style={{ margin: '40px auto', display: 'block' }} />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      {/* Header progress */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space size={16}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--brand-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Target size={20} color="#fff" />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                模拟面试 · {state.question_index} / {MAX_QUESTIONS} 题
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {state.status === 'follow_up' ? '追问环节' : '正式题目'}
                {state.follow_up_count > 0 && ` · 已追问 ${state.follow_up_count} 次`}
              </Text>
            </div>
          </Space>
          <Space size={24} align="center">
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>当前均分</Text>
              <Text strong style={{ fontSize: 20, color: avgScore >= 7 ? 'var(--success)' : avgScore >= 5 ? 'var(--warning)' : 'var(--error)' }}>
                {avgScore.toFixed(1)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}> / 10</Text>
            </div>
            <div style={{ width: 160 }}>
              <Progress percent={progressPercent} size="small" strokeColor="var(--brand-600)" />
            </div>
          </Space>
        </div>
      </Card>

      {/* Question card */}
      <Card style={{ marginBottom: 16, borderRadius: 12, borderLeft: '4px solid var(--brand-600)' }}>
        <div style={{ fontSize: 16, lineHeight: 1.7 }}>
          <ReactMarkdown>{state.current_question}</ReactMarkdown>
        </div>
        <Space size={8} wrap style={{ marginTop: 14 }}>
          {state.current_expectations.map((e, i) => (
            <Tag key={i} color="blue" style={{ borderRadius: 6 }}>
              考察：{e}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* Reference points */}
      {state.reference_points && state.reference_points.length > 0 && (
        <ReferencePointsCard points={state.reference_points} />
      )}

      {/* Answer input */}
      {state.status !== 'finished' && (
        <Card style={{ marginBottom: 16, borderRadius: 12 }}>
          <TextareaAutosize
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                submitAnswer();
              }
            }}
            placeholder="请组织语言回答，不要直接复制参考资料…"
            minRows={3}
            maxRows={8}
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Space>
              <Button onClick={() => submitAnswer('不知道')} disabled={loading}>
                不知道
              </Button>
              <Button danger onClick={() => submitAnswer('结束')} disabled={loading}>
                结束面试
              </Button>
            </Space>
            <Button
              type="primary"
              className="send-btn-macaron"
              icon={<Send size={16} />}
              onClick={() => submitAnswer()}
              loading={loading}
              disabled={!answer.trim()}
            >
              提交答案
            </Button>
          </div>
        </Card>
      )}

      {/* Evaluation */}
      {state.evaluation && (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 12,
            borderLeft: `4px solid ${state.evaluation.score >= 7 ? 'var(--success)' : state.evaluation.score >= 5 ? 'var(--warning)' : 'var(--error)'}`,
          }}
          title={
            <Space>
              {state.cheating_detected ? (
                <AlertTriangle size={18} color="var(--error)" />
              ) : (
                <CheckCircle2 size={18} color={state.evaluation.score >= 7 ? 'var(--success)' : 'var(--warning)'} />
              )}
              <span>评分反馈</span>
              <Tag color={state.evaluation.score >= 7 ? 'success' : state.evaluation.score >= 5 ? 'warning' : 'error'}>
                {state.evaluation.score} / 10 分
              </Tag>
            </Space>
          }
        >
          {state.cheating_detected && (
            <Alert
              message="反作弊提示"
              description="系统检测到您的回答与参考资料或历史回答高度重合。模拟面试要求独立作答。"
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          <div className="markdown-body" style={{ fontSize: 14 }}>
            <ReactMarkdown>{state.evaluation.raw}</ReactMarkdown>
          </div>
          <PointsResultCard points={state.evaluation.points} />
        </Card>
      )}

      {/* Summary */}
      {state.summary && (
        <Card
          style={{ borderRadius: 12, borderLeft: '4px solid var(--success)' }}
          title={
            <Space>
              <Flag size={18} color="var(--success)" />
              <span>面试总结</span>
              <Tag color="success">总体 {state.summary.total_score} / 100 分</Tag>
            </Space>
          }
        >
          <div className="markdown-body" style={{ fontSize: 14 }}>
            <ReactMarkdown>{state.summary.raw}</ReactMarkdown>
          </div>
          {state.weak_points && state.weak_points.length > 0 && (
            <>
              <Divider />
              <div>
                <Text strong style={{ fontSize: 13, color: 'var(--error)' }}>
                  高频遗漏点
                </Text>
                <ul style={{ marginTop: 8, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                  {state.weak_points.slice(0, 10).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <Divider />
          <Button
            icon={<RotateCcw size={16} />}
            onClick={() => {
              setPhase('config');
              setState(null);
              setAnswer('');
            }}
          >
            重新开始
          </Button>
        </Card>
      )}
    </div>
  );
}
