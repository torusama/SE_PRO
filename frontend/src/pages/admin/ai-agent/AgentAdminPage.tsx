import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import './AgentAdminPage.css'

type Feedback = {
  feedbackId: number
  rating?: number
  feedbackType: string
  reason?: string
  correctedContent?: string
  status: string
  createdAt: string
  reviewNote?: string
}

type TrainingRun = {
  runId: number
  status: string
  datasetVersion: string
  sampleCount: number
  metrics?: Record<string, number>
  startedAt: string
}

type ModelVersion = {
  modelVersionId: number
  versionName: string
  status: string
  metrics?: Record<string, number>
  createdAt: string
}

type HistoryItem = {
  versionId: number
  versionName: string
  entityType: string
  entityId?: number
  fieldName?: string
  changeReason?: string
  createdAt: string
}

type Conversation = {
  conversationId: number
  sessionId: string
  status: string
  customerName?: string
  customerEmail?: string
  messageCount: number
  feedbackCount: number
  preview?: string
  llmModel: string
  updatedAt: string
}

type ConversationMessage = {
  messageId: number
  role: string
  content?: string
  intent?: string
  extractedData?: Record<string, unknown>
  metadata?: {
    recommendations?: Array<{ optionId?: string; plotCodes?: string[]; totalCost?: number }>
    actions?: Array<{ type?: string; optionId?: string; plotIds?: number[] }>
    draftRequestId?: number
  }
  createdAt: string
}

type ConversationDetail = Conversation & {
  createdAt: string
  rankerVersion?: string
  knowledgeVersion?: string
  messages: ConversationMessage[]
  toolCalls: Array<{
    toolCallId: number
    toolName: string
    status: string
    executionTimeMs?: number
    createdAt: string
  }>
  feedback: Feedback[]
}

type Tab = 'conversations' | 'feedback' | 'training' | 'models' | 'history'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'conversations', label: 'Nhật ký Agent' },
  { id: 'feedback', label: 'Phản hồi' },
  { id: 'training', label: 'Huấn luyện' },
  { id: 'models', label: 'Phiên bản model' },
  { id: 'history', label: 'Lịch sử học' },
]

const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

const metricsText = (metrics?: Record<string, number>) =>
  metrics && Object.keys(metrics).length
    ? Object.entries(metrics).map(([key, value]) => `${key}: ${Number(value).toFixed(3)}`).join(' · ')
    : 'Chưa có'

export default function AgentAdminPage() {
  const [tab, setTab] = useState<Tab>('conversations')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [runs, setRuns] = useState<TrainingRun[]>([])
  const [models, setModels] = useState<ModelVersion[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [conversationRes, feedbackRes, runsRes, modelsRes, historyRes] = await Promise.all([
        api.get('/admin/ai-agent/conversations', { params: { page: 1, pageSize: 100 } }),
        api.get('/admin/ai-agent/feedback'),
        api.get('/admin/ai-agent/training-runs'),
        api.get('/admin/ai-agent/model-versions'),
        api.get('/admin/ai-agent/learning-history'),
      ])
      setConversations(conversationRes.data.data?.items ?? [])
      setFeedback(feedbackRes.data.data ?? feedbackRes.data)
      setRuns(runsRes.data.data ?? runsRes.data)
      setModels(modelsRes.data.data ?? modelsRes.data)
      setHistory(historyRes.data.data ?? historyRes.data)
    } catch {
      setError('Không tải được dữ liệu AI Agent. Kiểm tra migration và kết nối backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  const openConversation = async (conversationId: number) => {
    setDetailLoading(true)
    setError(undefined)
    try {
      const response = await api.get(`/admin/ai-agent/conversations/${conversationId}`)
      setConversationDetail(response.data.data)
    } catch {
      setError('Không tải được chi tiết phiên trò chuyện.')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const reviewFeedback = async (item: Feedback, action: 'approve' | 'reject') => {
    const applyCorrection = action === 'approve' && Boolean(item.correctedContent)
    const message = applyCorrection
      ? 'Duyệt và đưa nội dung sửa này vào knowledge base?'
      : `${action === 'approve' ? 'Duyệt' : 'Từ chối'} phản hồi này?`
    if (!window.confirm(message)) return

    setBusy(`feedback-${item.feedbackId}`)
    try {
      await api.patch(`/admin/ai-agent/feedback/${item.feedbackId}/${action}`, {
        reviewerNote: action === 'approve' ? 'Đã kiểm tra bởi quản trị viên' : 'Không đủ căn cứ áp dụng',
        applyCorrection,
      })
      await loadData()
    } finally {
      setBusy(undefined)
    }
  }

  const retrain = async () => {
    if (!window.confirm('Bắt đầu một lượt huấn luyện mới từ các mẫu đã được duyệt?')) return
    setBusy('retrain')
    try {
      await api.post('/admin/ai-agent/retrain', {})
      await loadData()
      setTab('training')
    } finally {
      setBusy(undefined)
    }
  }

  const changeModel = async (model: ModelVersion, action: 'deploy' | 'rollback') => {
    if (!window.confirm(`${action === 'deploy' ? 'Triển khai' : 'Rollback về'} model ${model.versionName}?`)) return
    setBusy(`model-${model.modelVersionId}`)
    try {
      await api.post(`/admin/ai-agent/model-versions/${model.modelVersionId}/${action}`)
      await loadData()
    } finally {
      setBusy(undefined)
    }
  }

  const pendingCount = feedback.filter((item) => item.status === 'pending').length
  const activeModel = models.find((item) => item.status === 'active')

  return (
    <div className="agent-admin">
      <header className="agent-admin__hero">
        <div>
          <span className="agent-admin__eyebrow">AI GOVERNANCE</span>
          <h1>Trung tâm AI Agent</h1>
          <p>Kiểm duyệt tri thức, theo dõi huấn luyện và quản lý phiên bản đang phục vụ khách hàng.</p>
        </div>
        <button className="agent-admin__primary" disabled={busy === 'retrain'} onClick={retrain}>
          {busy === 'retrain' ? 'Đang huấn luyện…' : 'Huấn luyện lại'}
        </button>
      </header>

      <section className="agent-admin__stats">
        <article><span>Phiên trò chuyện</span><strong>{conversations.length}</strong></article>
        <article><span>Chờ duyệt</span><strong>{pendingCount}</strong></article>
        <article><span>Training runs</span><strong>{runs.length}</strong></article>
        <article><span>Model đang chạy</span><strong>{activeModel?.versionName ?? 'Rule fallback'}</strong></article>
      </section>

      <nav className="agent-admin__tabs" aria-label="Quản trị AI">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="agent-admin__error">{error}</div>}
      {loading ? (
        <div className="agent-admin__empty">Đang tải dữ liệu…</div>
      ) : (
        <section className="agent-admin__panel">
          {tab === 'conversations' && (
            <div className="agent-admin__conversation-layout">
              <div className="agent-admin__conversation-list">
                {conversations.map((item) => (
                  <button
                    className={conversationDetail?.conversationId === item.conversationId ? 'is-selected' : ''}
                    key={item.conversationId}
                    onClick={() => void openConversation(item.conversationId)}
                  >
                    <span>
                      <strong>{item.customerName || 'Khách chưa đăng nhập'}</strong>
                      <small>{item.customerEmail || item.sessionId}</small>
                    </span>
                    <span className="agent-admin__conversation-meta">
                      <small>{item.messageCount} tin nhắn · {item.feedbackCount} phản hồi</small>
                      <time>{formatDate(item.updatedAt)}</time>
                    </span>
                    <p>{item.preview || 'Chưa có nội dung'}</p>
                  </button>
                ))}
                {!conversations.length && <div className="agent-admin__empty">Chưa có phiên trò chuyện.</div>}
              </div>

              <div className="agent-admin__conversation-detail">
                {detailLoading ? (
                  <div className="agent-admin__empty">Đang tải chi tiết…</div>
                ) : !conversationDetail ? (
                  <div className="agent-admin__empty">Chọn một phiên để xem nhu cầu, tư vấn và thao tác của Agent.</div>
                ) : (
                  <>
                    <header>
                      <div>
                        <span className={`agent-admin__status status-${conversationDetail.status}`}>{conversationDetail.status}</span>
                        <h2>{conversationDetail.customerName || 'Khách chưa đăng nhập'}</h2>
                        <p>{conversationDetail.customerEmail || conversationDetail.sessionId}</p>
                      </div>
                      <dl>
                        <div><dt>LLM</dt><dd>{conversationDetail.llmModel}</dd></div>
                        <div><dt>Ranker</dt><dd>{conversationDetail.rankerVersion || 'rule-based'}</dd></div>
                        <div><dt>Knowledge</dt><dd>{conversationDetail.knowledgeVersion || '—'}</dd></div>
                      </dl>
                    </header>

                    <div className="agent-admin__messages">
                      {conversationDetail.messages
                        .filter((message) => message.role === 'user' || message.role === 'assistant')
                        .map((message) => {
                          const recommendations = message.metadata?.recommendations ?? []
                          const draftId = message.metadata?.draftRequestId
                          return (
                            <article className={`role-${message.role}`} key={message.messageId}>
                              <div className="agent-admin__message-head">
                                <strong>{message.role === 'user' ? 'Khách hàng' : 'AI Agent'}</strong>
                                <time>{formatDate(message.createdAt)}</time>
                              </div>
                              <p>{message.content || '—'}</p>
                              {message.intent && <small>Intent: {message.intent}</small>}
                              {message.extractedData && Object.keys(message.extractedData).length > 0 && (
                                <details>
                                  <summary>Nhu cầu đã trích xuất</summary>
                                  <pre>{JSON.stringify(message.extractedData, null, 2)}</pre>
                                </details>
                              )}
                              {recommendations.length > 0 && (
                                <div className="agent-admin__recommendations">
                                  {recommendations.map((option, index) => (
                                    <span key={option.optionId || index}>
                                      {option.optionId || `Phương án ${index + 1}`}: {(option.plotCodes ?? []).join(', ') || '—'}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(message.metadata?.actions?.length ?? 0) > 0 && (
                                <div className="agent-admin__recommendations">
                                  {message.metadata?.actions?.map((action, index) => (
                                    <span key={`${action.type}-${index}`}>
                                      {action.type || 'ACTION'}
                                      {action.plotIds?.length ? ` · lô ID ${action.plotIds.join(', ')}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {draftId && <strong className="agent-admin__draft">Draft reservation #{draftId}</strong>}
                            </article>
                          )
                        })}
                    </div>

                    <section className="agent-admin__trace">
                      <h3>Tool calls ({conversationDetail.toolCalls.length})</h3>
                      {conversationDetail.toolCalls.map((call) => (
                        <div key={call.toolCallId}>
                          <code>{call.toolName}</code>
                          <span className={`agent-admin__status status-${call.status}`}>{call.status}</span>
                          <small>{call.executionTimeMs ?? 0} ms · {formatDate(call.createdAt)}</small>
                        </div>
                      ))}
                      {!conversationDetail.toolCalls.length && <p>Phiên này chưa ghi nhận tool call.</p>}
                    </section>
                    <section className="agent-admin__trace">
                      <h3>Phản hồi ({conversationDetail.feedback.length})</h3>
                      {conversationDetail.feedback.map((item) => (
                        <div key={item.feedbackId}>
                          <strong>{item.feedbackType}</strong>
                          <span className={`agent-admin__status status-${item.status}`}>{item.status}</span>
                          <small>{item.rating ? `${item.rating}/5 sao` : 'Chưa chấm sao'} · {formatDate(item.createdAt)}</small>
                        </div>
                      ))}
                      {!conversationDetail.feedback.length && <p>Phiên này chưa có phản hồi.</p>}
                    </section>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'feedback' && (
            <div className="agent-admin__list">
              {feedback.map((item) => (
                <article className="agent-admin__feedback" key={item.feedbackId}>
                  <div className="agent-admin__row">
                    <span className={`agent-admin__status status-${item.status}`}>{item.status}</span>
                    <span>{item.rating ? '★'.repeat(Math.max(0, Math.min(5, item.rating))) : 'Chưa chấm sao'}</span>
                    <time>{formatDate(item.createdAt)}</time>
                  </div>
                  <h3>{item.feedbackType}</h3>
                  <p>{item.reason || 'Không có bình luận.'}</p>
                  {item.correctedContent && <blockquote>Đề xuất sửa: {item.correctedContent}</blockquote>}
                  {item.status === 'pending' && (
                    <div className="agent-admin__actions">
                      <button disabled={busy === `feedback-${item.feedbackId}`} onClick={() => reviewFeedback(item, 'approve')}>Duyệt</button>
                      <button className="danger" disabled={busy === `feedback-${item.feedbackId}`} onClick={() => reviewFeedback(item, 'reject')}>Từ chối</button>
                    </div>
                  )}
                </article>
              ))}
              {!feedback.length && <div className="agent-admin__empty">Chưa có phản hồi.</div>}
            </div>
          )}

          {tab === 'training' && (
            <div className="agent-admin__table-wrap">
              <table><thead><tr><th>ID</th><th>Trạng thái</th><th>Nguồn</th><th>Mẫu</th><th>Metrics</th><th>Thời gian</th></tr></thead>
                <tbody>{runs.map((run) => <tr key={run.runId}><td>#{run.runId}</td><td><span className={`agent-admin__status status-${run.status}`}>{run.status}</span></td><td>{run.datasetVersion}</td><td>{run.sampleCount}</td><td>{metricsText(run.metrics)}</td><td>{formatDate(run.startedAt)}</td></tr>)}</tbody>
              </table>
              {!runs.length && <div className="agent-admin__empty">Chưa có lượt huấn luyện.</div>}
            </div>
          )}

          {tab === 'models' && (
            <div className="agent-admin__list">
              {models.map((model) => (
                <article className="agent-admin__model" key={model.modelVersionId}>
                  <div><span className={`agent-admin__status status-${model.status}`}>{model.status}</span><h3>{model.versionName}</h3><p>{metricsText(model.metrics)}</p><small>{formatDate(model.createdAt)}</small></div>
                  <div className="agent-admin__actions">
                    {model.status === 'candidate' && <button disabled={busy === `model-${model.modelVersionId}`} onClick={() => changeModel(model, 'deploy')}>Deploy</button>}
                    {model.status === 'retired' && <button className="danger" disabled={busy === `model-${model.modelVersionId}`} onClick={() => changeModel(model, 'rollback')}>Rollback về bản này</button>}
                  </div>
                </article>
              ))}
              {!models.length && <div className="agent-admin__empty">Chưa có model version.</div>}
            </div>
          )}

          {tab === 'history' && (
            <div className="agent-admin__timeline">
              {history.map((item) => <article key={item.versionId}><span /><div><strong>{item.versionName}</strong><p>{item.entityType}{item.entityId ? ` #${item.entityId}` : ''}{item.fieldName ? ` · ${item.fieldName}` : ''}</p>{item.changeReason && <p>{item.changeReason}</p>}<time>{formatDate(item.createdAt)}</time></div></article>)}
              {!history.length && <div className="agent-admin__empty">Chưa có lịch sử.</div>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
