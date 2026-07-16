'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Input, Progress, Typography, Space, Spin, Alert, Divider, Segmented,
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

const CHALK = '#F0EDE4';
const CHALK_BRIGHT = '#FFFBF0';
const BOARD = '#2E4A3D';

function scoreColor(score: number) {
  if (score >= 7) return 'var(--cite-3, #7CB518)';
  if (score >= 5) return 'var(--cite-4, #E5A50A)';
  return 'var(--brand, #C8392B)';
}

function ReferencePointsCard({ points }: { points: string[] }) {
  return (
    <div className="op-hint-box" style={{ marginBottom: 12 }}>
      <Text strong style={{ fontSize: 12, color: CHALK_BRIGHT }}>参考答案要点</Text>
      <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: CHALK, lineHeight: 1.7 }}>
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </div>
  );
}

function PointsResultCard({ points }: { points?: ExamPoint[] }) {
  if (!points || points.length === 0) return null;
  const hitCount = points.filter((p) => p.hit).length;
  return (
    <div style={{ marginTop: 12 }}>
      <Text strong style={{ fontSize: 12, color: CHALK_BRIGHT }}>
        要点命中 {hitCount} / {points.length}
      </Text>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {points.map((p, i) => (
          <div
            key={i}
            className="op-point"
            style={{
              borderColor: p.hit ? 'var(--cite-3, #7CB518)' : 'var(--brand, #C8392B)',
            }}
          >
            <Space size={6}>
              {p.hit ? (
                <CheckCircle2 size={14} color="var(--cite-3, #7CB518)" />
              ) : (
                <AlertTriangle size={14} color="var(--brand, #C8392B)" />
              )}
              <Text style={{ color: CHALK_BRIGHT, fontWeight: 500 }}>
                {p.hit ? '命中' : '未命中'}
              </Text>
            </Space>
            <div style={{ marginTop: 4, color: CHALK }}>{p.point}</div>
            {p.evidence && (
              <div style={{ marginTop: 4, color: 'rgba(240,237,228,0.65)', fontSize: 11 }}>
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
      <div className="ep-root" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', minHeight: '100%' }}>
        <div className="op-card">
          <div className="op-card-header ep-config-header">
            <Space>
              <GraduationCap size={20} color="var(--brand, #C8392B)" />
              <span>配置模拟面试</span>
            </Space>
          </div>
          <div style={{ padding: 24 }}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: CHALK_BRIGHT }}>目标岗位</Text>
                <Input
                  className="op-input"
                  placeholder="例如：后端开发工程师"
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  size="large"
                />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: CHALK_BRIGHT }}>面试方向</Text>
                <Input
                  className="op-input"
                  placeholder="例如：Java 并发 / Redis / Vue 响应式"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  size="large"
                />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: CHALK_BRIGHT }}>题目数量</Text>
                <Segmented
                  className="ep-segmented"
                  value={MAX_QUESTIONS}
                  options={[{ label: `${MAX_QUESTIONS} 题`, value: MAX_QUESTIONS }]}
                  disabled
                />
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'rgba(240,237,228,0.65)' }}>
                  默认 5 题，由浅入深；单题最多追问 2 次
                </Text>
              </div>
              <Button
                className="op-btn op-btn-primary"
                size="large"
                icon={<Play size={16} />}
                onClick={startExam}
                loading={loading}
                disabled={!targetPosition.trim() || !topic.trim()}
                block
              >
                开始面试
              </Button>
            </Space>
          </div>
        </div>

        <style jsx>{`
          .ep-root {
            --ep-board: var(--board, ${BOARD});
            --ep-chalk: ${CHALK};
            --ep-chalk-bright: ${CHALK_BRIGHT};
            --ep-chalk-faint: rgba(240, 237, 228, 0.55);
            --ep-chalk-weak: rgba(240, 237, 228, 0.12);
            color: var(--ep-chalk);
            background: var(--ep-board);
          }
          .ep-config-header {
            font-family: 'ZCOOL KuaiLe', 'PingFang SC', 'Microsoft YaHei', cursive, sans-serif;
            font-size: 18px;
            letter-spacing: 0.5px;
          }
          .op-card {
            background: var(--ep-board);
            border: 1.5px solid var(--ep-chalk-bright);
            border-radius: 3px;
            background-image:
              repeating-linear-gradient(0deg, var(--ep-chalk-weak) 0 1px, transparent 1px 24px),
              repeating-linear-gradient(90deg, var(--ep-chalk-weak) 0 1px, transparent 1px 24px);
          }
          .op-card-header {
            padding: 14px 24px;
            border-bottom: 1px solid var(--ep-chalk-weak);
            font-size: 15px;
            font-weight: 600;
            color: var(--ep-chalk-bright);
          }
          .op-input {
            border: 1.5px solid var(--ep-chalk-bright) !important;
            border-radius: 3px !important;
            background: var(--ep-board) !important;
            color: var(--ep-chalk-bright) !important;
            transition: border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
              box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
          }
          .op-input::placeholder {
            color: var(--ep-chalk-faint) !important;
          }
          .op-input:focus {
            border-color: var(--brand, #C8392B) !important;
            outline: 2px solid var(--brand, #C8392B);
            outline-offset: 2px;
          }
          .ep-root :global(.ant-input) {
            background: var(--ep-board) !important;
            border-color: var(--ep-chalk-bright) !important;
            color: var(--ep-chalk-bright) !important;
          }
          .ep-root :global(.ant-input::placeholder) {
            color: var(--ep-chalk-faint) !important;
          }
          .ep-root :global(.ant-input:hover) {
            border-color: var(--ep-chalk-bright) !important;
          }
          .ep-root :global(.ant-input:focus) {
            border-color: var(--brand, #C8392B) !important;
            outline: 2px solid var(--brand, #C8392B);
            outline-offset: 2px;
            box-shadow: none !important;
          }
          .ep-segmented :global(.ant-segmented) {
            background: rgba(240, 237, 228, 0.12) !important;
          }
          .ep-segmented :global(.ant-segmented-item) {
            color: var(--ep-chalk-faint) !important;
          }
          .ep-segmented :global(.ant-segmented-item-selected) {
            background: var(--ep-board) !important;
            color: var(--ep-chalk-bright) !important;
            border: 1.5px solid var(--ep-chalk-bright) !important;
          }
          .op-btn {
            border-radius: 3px;
            border: 1.5px solid var(--ep-chalk-bright);
            background: var(--ep-board);
            color: var(--ep-chalk-bright);
            transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
              box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
              border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
              background 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
              color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
          }
          .ep-root :global(.ant-btn).op-btn {
            background: var(--ep-board) !important;
            border-color: var(--ep-chalk-bright) !important;
            color: var(--ep-chalk-bright) !important;
          }
          .op-btn:hover {
            transform: translate(-1px, -1px);
            box-shadow: 3px 3px 0 var(--ep-chalk-bright);
            background: rgba(240, 237, 228, 0.08);
          }
          .op-btn:active {
            transform: translate(2px, 2px);
            box-shadow: none;
            transition: none;
          }
          .op-btn-primary {
            background: var(--brand, #C8392B);
            border-color: var(--ep-chalk-bright);
            color: #fff;
          }
          .ep-root :global(.ant-btn).op-btn-primary {
            background: var(--brand, #C8392B) !important;
            border-color: var(--ep-chalk-bright) !important;
            color: #fff !important;
          }
          .op-btn-primary:hover {
            background: var(--brand-hover, #A92E22);
          }
          .op-btn-primary:disabled {
            background: rgba(240, 237, 228, 0.12);
            color: var(--ep-chalk-faint);
            border-color: var(--ep-chalk-faint);
          }
          .ep-root :global(.ant-btn).op-btn-primary:disabled {
            background: rgba(240, 237, 228, 0.12) !important;
            color: var(--ep-chalk-faint) !important;
            border-color: var(--ep-chalk-faint) !important;
          }
          @media (prefers-reduced-motion: reduce) {
            .op-card, .op-input, .op-btn {
              transition: opacity 100ms ease;
            }
          }
        `}</style>
      </div>
    );
  }

  if (!state) return <Spin style={{ margin: '40px auto', display: 'block' }} />;

  return (
    <div className="ep-root" style={{ maxWidth: 900, margin: '0 auto', padding: '24px', minHeight: '100%' }}>
      <div className="op-card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space size={16}>
            <Target size={24} color="var(--brand, #C8392B)" />
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16, color: CHALK_BRIGHT }}>
                模拟面试 · {state.question_index} / {MAX_QUESTIONS} 题
              </Title>
              <Text type="secondary" style={{ fontSize: 12, color: CHALK }}>
                {state.status === 'follow_up' ? '追问环节' : '正式题目'}
                {state.follow_up_count > 0 && ` · 已追问 ${state.follow_up_count} 次`}
              </Text>
            </div>
          </Space>
          <Space size={24} align="center">
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', color: CHALK }}>当前均分</Text>
              <Text strong style={{ fontSize: 20, color: scoreColor(avgScore), fontVariantNumeric: 'tabular-nums' }}>
                {avgScore.toFixed(1)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, color: CHALK }}> / 10</Text>
            </div>
            <div style={{ width: 160 }}>
              <Progress
                className="ep-progress"
                percent={progressPercent}
                size="small"
                strokeColor="var(--brand, #C8392B)"
                trailColor="rgba(240,237,228,0.15)"
              />
            </div>
          </Space>
        </div>
      </div>

      <div className="op-card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="ep-question">
          <ReactMarkdown>{state.current_question}</ReactMarkdown>
        </div>
        <Space size={8} wrap style={{ marginTop: 14 }}>
          {state.current_expectations.map((e, i) => (
            <span key={i} className="op-tag-sunken">
              考察：{e}
            </span>
          ))}
        </Space>
      </div>

      {state.reference_points && state.reference_points.length > 0 && (
        <ReferencePointsCard points={state.reference_points} />
      )}

      {state.status !== 'finished' && (
        <div className="op-card" style={{ marginBottom: 16, padding: 16 }}>
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
            className="op-textarea"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Space>
              <Button className="op-btn" onClick={() => submitAnswer('不知道')} disabled={loading}>
                不知道
              </Button>
              <Button className="op-btn op-btn-danger" onClick={() => submitAnswer('结束')} disabled={loading}>
                结束面试
              </Button>
            </Space>
            <Button
              className="op-btn op-btn-primary"
              icon={<Send size={16} />}
              onClick={() => submitAnswer()}
              loading={loading}
              disabled={!answer.trim()}
            >
              提交答案
            </Button>
          </div>
        </div>
      )}

      {state.evaluation && (
        <div className="op-card" style={{ marginBottom: 16 }}>
          <div className="op-card-header">
            <Space>
              {state.cheating_detected ? (
                <AlertTriangle size={18} color="var(--brand, #C8392B)" />
              ) : (
                <CheckCircle2 size={18} color={scoreColor(state.evaluation.score)} />
              )}
              <span>评分反馈</span>
              <span
                className="op-tag"
                style={{
                  background: 'var(--board, #2E4A3D)',
                  color: scoreColor(state.evaluation.score),
                }}
              >
                {state.evaluation.score} / 10 分
              </span>
            </Space>
          </div>
          <div style={{ padding: 16 }}>
            {state.cheating_detected && (
              <Alert
                className="ep-alert"
                message="反作弊提示"
                description="系统检测到您的回答与参考资料或历史回答高度重合。模拟面试要求独立作答。"
                type="warning"
                showIcon
                style={{
                  marginBottom: 12,
                  background: 'rgba(200,57,43,0.12)',
                  border: '1.5px solid var(--ep-chalk-bright)',
                  borderRadius: 3,
                  boxShadow: 'none',
                }}
              />
            )}
            <div className="markdown-body" style={{ fontSize: 14, color: CHALK }}>
              <ReactMarkdown>{state.evaluation.raw}</ReactMarkdown>
            </div>
            <PointsResultCard points={state.evaluation.points} />
          </div>
        </div>
      )}

      {state.summary && (
        <div className="op-card">
          <div className="op-card-header">
            <Space>
              <Flag size={18} color="var(--cite-3, #7CB518)" />
              <span>面试总结</span>
              <span className="op-tag" style={{ background: 'var(--board, #2E4A3D)', color: 'var(--cite-3, #7CB518)' }}>
                总体 {state.summary.total_score} / 100 分
              </span>
            </Space>
          </div>
          <div style={{ padding: 16 }}>
            <div className="markdown-body" style={{ fontSize: 14, color: CHALK }}>
              <ReactMarkdown>{state.summary.raw}</ReactMarkdown>
            </div>
            {state.weak_points && state.weak_points.length > 0 && (
              <>
                <Divider style={{ borderColor: 'rgba(240,237,228,0.2)' }} />
                <div>
                  <Text strong style={{ fontSize: 13, color: 'var(--brand, #C8392B)' }}>
                    高频遗漏点
                  </Text>
                  <ul style={{ marginTop: 8, paddingLeft: 18, color: CHALK, fontSize: 13, lineHeight: 1.7 }}>
                    {state.weak_points.slice(0, 10).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <Divider style={{ borderColor: 'rgba(240,237,228,0.2)' }} />
            <Button
              className="op-btn"
              icon={<RotateCcw size={16} />}
              onClick={() => {
                setPhase('config');
                setState(null);
                setAnswer('');
              }}
            >
              重新开始
            </Button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ep-root {
          --ep-board: var(--board, ${BOARD});
          --ep-chalk: ${CHALK};
          --ep-chalk-bright: ${CHALK_BRIGHT};
          --ep-chalk-faint: rgba(240, 237, 228, 0.55);
          --ep-chalk-weak: rgba(240, 237, 228, 0.12);
          color: var(--ep-chalk);
          background: var(--ep-board);
        }
        .op-card {
          background: var(--ep-board);
          border: 1.5px solid var(--ep-chalk-bright);
          border-radius: 3px;
          background-image:
            repeating-linear-gradient(0deg, var(--ep-chalk-weak) 0 1px, transparent 1px 24px),
            repeating-linear-gradient(90deg, var(--ep-chalk-weak) 0 1px, transparent 1px 24px);
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--ep-chalk-bright);
        }
        .op-card-header {
          padding: 14px 16px;
          border-bottom: 1px solid var(--ep-chalk-weak);
          font-size: 15px;
          font-weight: 600;
          color: var(--ep-chalk-bright);
        }
        .ep-question {
          font-size: 17px;
          line-height: 1.7;
          color: var(--ep-chalk-bright);
        }
        .ep-question p { color: var(--ep-chalk-bright); }
        .op-tag {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          border: 1.5px solid var(--ep-chalk-bright);
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .op-tag-sunken {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          background: rgba(240, 237, 228, 0.08);
          color: var(--ep-chalk-bright);
          border: 1.5px solid var(--ep-chalk-bright);
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .op-hint-box {
          padding: 12px;
          background: var(--ep-board);
          border: 1.5px solid rgba(240, 237, 228, 0.35);
          border-radius: 3px;
        }
        .op-textarea {
          width: 100%;
          padding: 12px;
          background: var(--ep-board);
          border: 1.5px solid var(--ep-chalk-bright);
          border-radius: 3px;
          font-size: 15px;
          line-height: 1.6;
          resize: none;
          outline: none;
          color: var(--ep-chalk-bright);
          transition: border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .op-textarea:focus {
          border-color: var(--brand, #C8392B);
          outline: 2px solid var(--brand, #C8392B);
          outline-offset: 2px;
        }
        .op-textarea::placeholder {
          color: var(--ep-chalk-faint);
        }
        .op-btn {
          border-radius: 3px;
          border: 1.5px solid var(--ep-chalk-bright);
          background: var(--ep-board);
          color: var(--ep-chalk-bright);
          transition: transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            box-shadow 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            border-color 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            background 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
            color 150ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .ep-root :global(.ant-btn).op-btn {
          background: var(--ep-board) !important;
          border-color: var(--ep-chalk-bright) !important;
          color: var(--ep-chalk-bright) !important;
        }
        .op-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--ep-chalk-bright);
          background: rgba(240, 237, 228, 0.08);
        }
        .op-btn:active {
          transform: translate(0, 0);
          box-shadow: none;
        }
        .op-btn-primary {
          background: var(--brand, #C8392B);
          border-color: var(--ep-chalk-bright);
          color: #fff;
        }
        .ep-root :global(.ant-btn).op-btn-primary {
          background: var(--brand, #C8392B) !important;
          border-color: var(--ep-chalk-bright) !important;
          color: #fff !important;
        }
        .op-btn-primary:hover {
          background: var(--brand-hover, #A92E22);
        }
        .op-btn-primary:disabled {
          background: rgba(240, 237, 228, 0.12);
          color: var(--ep-chalk-faint);
          border-color: var(--ep-chalk-faint);
        }
        .ep-root :global(.ant-btn).op-btn-primary:disabled {
          background: rgba(240, 237, 228, 0.12) !important;
          color: var(--ep-chalk-faint) !important;
          border-color: var(--ep-chalk-faint) !important;
        }
        .op-btn-danger {
          color: var(--brand, #C8392B);
          border-color: var(--brand, #C8392B);
        }
        .ep-root :global(.ant-btn).op-btn-danger {
          color: var(--brand, #C8392B) !important;
          border-color: var(--brand, #C8392B) !important;
        }
        .op-btn-danger:hover {
          background: rgba(200, 57, 43, 0.12);
        }
        .ep-root :global(.ant-btn).op-btn-danger:hover {
          background: rgba(200, 57, 43, 0.12) !important;
        }
        .op-point {
          padding: 8px 10px;
          border: 1.5px solid var(--ep-chalk-bright);
          border-radius: 3px;
          font-size: 12px;
          background: var(--ep-board);
        }
        .ep-progress :global(.ant-progress-bg) {
          background: var(--brand, #C8392B) !important;
        }
        .ep-progress :global(.ant-progress-inner) {
          background: rgba(240, 237, 228, 0.15) !important;
          border-radius: 3px !important;
        }
        .ep-progress :global(.ant-progress-bg) {
          border-radius: 3px !important;
          height: 8px !important;
        }
        .ep-alert :global(.ant-alert-message) {
          color: var(--ep-chalk-bright) !important;
        }
        .ep-alert :global(.ant-alert-description) {
          color: var(--ep-chalk) !important;
        }
        .ep-alert :global(.ant-alert-icon) {
          color: var(--brand, #C8392B) !important;
        }
        .ep-root :global(.ant-divider) {
          border-color: var(--ep-chalk-weak) !important;
        }
        .ep-root :global(.markdown-body) { color: var(--ep-chalk); }
        .ep-root :global(.markdown-body) h1,
        .ep-root :global(.markdown-body) h2,
        .ep-root :global(.markdown-body) h3,
        .ep-root :global(.markdown-body) h4,
        .ep-root :global(.markdown-body) h5,
        .ep-root :global(.markdown-body) h6 {
          color: var(--ep-chalk-bright);
        }
        .ep-root :global(.markdown-body) p { color: var(--ep-chalk); }
        .ep-root :global(.markdown-body) strong { color: var(--ep-chalk-bright); }
        .ep-root :global(.markdown-body) li { color: var(--ep-chalk); }
        .ep-root :global(.markdown-body) code {
          background: rgba(240, 237, 228, 0.12);
          color: var(--ep-chalk-bright);
        }
        .ep-root :global(.markdown-body) pre {
          background: rgba(0, 0, 0, 0.25);
          color: var(--ep-chalk-bright);
        }
        .ep-root :global(.markdown-body) pre code { background: transparent; color: inherit; }
        .ep-root :global(.markdown-body) blockquote {
          border-left-color: var(--brand, #C8392B);
          background: rgba(200, 57, 43, 0.12);
          color: var(--ep-chalk);
        }
        .ep-root :global(.markdown-body) table {
          border-color: var(--ep-chalk-bright);
        }
        .ep-root :global(.markdown-body) th,
        .ep-root :global(.markdown-body) td {
          border-color: var(--ep-chalk-weak);
        }
        .ep-root :global(.markdown-body) th {
          background: rgba(240, 237, 228, 0.1);
          color: var(--ep-chalk-bright);
        }
        .ep-root :global(.markdown-body) td { color: var(--ep-chalk); }
        @media (prefers-reduced-motion: reduce) {
          .op-card, .op-btn, .op-textarea {
            transition: opacity 100ms ease;
          }
        }
      `}</style>
    </div>
  );
}
