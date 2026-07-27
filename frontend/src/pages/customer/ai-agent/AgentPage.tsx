import {
  Bot,
  CircleAlert,
  LoaderCircle,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import AgentMessage from './AgentMessage'
import AgentContextMap from './AgentContextMap'
import ComparisonPanel from './ComparisonPanel'
import FeedbackDialog from './FeedbackDialog'
import { buildFullMapUrl, getTourableRecommendations } from './guidedTour'
import type {
  AgentRecommendation,
  AgentResponse,
  AgentService,
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  FeedbackType,
} from './agent.types'
import './AgentPage.css'

const STARTER_PROMPTS = [
  {
    icon: '◇',
    title: 'Tìm theo ngân sách',
    text: 'Mình cần 1 lô dưới 150 triệu.',
  },
  {
    icon: '⌘',
    title: 'Lô liền kề',
    text: 'Tìm 3 lô liền nhau ở Khu A, ngân sách 450 triệu.',
  },
  {
    icon: '⇄',
    title: 'So sánh phương án',
    text: 'So sánh 2 phương án phù hợp ngân sách 300 triệu.',
  },
  {
    icon: '✦',
    title: 'Dịch vụ chăm sóc',
    text: 'Gợi ý dịch vụ chăm sóc mộ định kỳ.',
  },
]

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

const getTimestamp = () => Date.now()

const formatHistoryDate = (value: string) => {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })
}

export default function AgentPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const role = useAuthStore((state) => state.role)
  const user = useAuthStore((state) => state.user)
  const [sessionId, setSessionId] = useState<string>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [compared, setCompared] = useState<AgentRecommendation[]>([])
  const [mapOpen, setMapOpen] = useState(false)
  const [mapRecommendations, setMapRecommendations] = useState<
    AgentRecommendation[]
  >([])
  const [activeMapIndex, setActiveMapIndex] = useState(0)
  const [feedbackTarget, setFeedbackTarget] = useState<{
    message: ChatMessage
    type: FeedbackType
  } | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const accountIdRef = useRef(user?.id)
  const requestControllerRef = useRef<AbortController | null>(null)
  const requestStartedAtRef = useRef(0)
  const presentationTimersRef = useRef<number[]>([])

  const currentRecommendations = useMemo(
    () =>
      messages
        .flatMap((message) => message.response?.recommendations ?? [])
        .slice(-3),
    [messages],
  )

  const loadConversations = useCallback(async () => {
    if (!token || role !== 'customer') {
      setConversations([])
      return
    }
    setHistoryLoading(true)
    try {
      const response = await api.get('/ai-agent/conversations')
      setConversations((response.data.data ?? []) as ConversationSummary[])
    } catch {
      setConversations([])
    } finally {
      setHistoryLoading(false)
    }
  }, [role, token])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) return
    const updateElapsed = () =>
      setElapsedMs(Date.now() - requestStartedAtRef.current)
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 100)
    return () => window.clearInterval(timer)
  }, [loading])

  useEffect(
    () => () => {
      requestControllerRef.current?.abort()
      presentationTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      )
    },
    [],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(), 0)
    return () => window.clearTimeout(timer)
  }, [loadConversations])

  useEffect(() => {
    const pending = sessionStorage.getItem('ai-agent-pending-action')
    if (pending && token && role === 'customer') {
      sessionStorage.removeItem('ai-agent-pending-action')
      const timer = window.setTimeout(
        () =>
          setNotice(
            'Bạn đã đăng nhập. Chọn lại “Đặt yêu cầu” để Trợ lý tiếp tục hỏi thông tin còn thiếu.',
          ),
        0,
      )
      return () => window.clearTimeout(timer)
    }
  }, [role, token])

  useEffect(() => {
    if (accountIdRef.current === user?.id) return
    accountIdRef.current = user?.id
    const timer = window.setTimeout(() => {
      setSessionId(undefined)
      setMessages([])
      setCompared([])
      setMapOpen(false)
      setMapRecommendations([])
      setActiveMapIndex(0)
      setNotice('')
      setError('')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user?.id])

  function stopResponse() {
    if (!requestControllerRef.current) return
    requestControllerRef.current.abort()
    requestControllerRef.current = null
    setLoading(false)
    setNotice('Đã dừng phản hồi. Bạn có thể chỉnh câu hỏi hoặc gửi lại.')
  }

  function newChat() {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    presentationTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    presentationTimersRef.current = []
    setSessionId(undefined)
    setMessages([])
    setCompared([])
    setMapOpen(false)
    setMapRecommendations([])
    setActiveMapIndex(0)
    setInput('')
    setLoading(false)
    setElapsedMs(0)
    setError('')
    setNotice('')
    setSidebarOpen(false)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function openConversation(conversation: ConversationSummary) {
    if (conversation.sessionId === sessionId || conversationLoading) {
      setSidebarOpen(false)
      return
    }
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setLoading(false)
    setConversationLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await api.get(
        `/ai-agent/conversations/${encodeURIComponent(conversation.sessionId)}`,
      )
      const detail = response.data.data as ConversationDetail
      const restoredRecommendations =
        [...detail.messages]
          .reverse()
          .find((message) => message.response?.recommendations?.length)
          ?.response?.recommendations ?? []
      const restoredMap = getTourableRecommendations(restoredRecommendations)
      setSessionId(detail.sessionId)
      setMessages(
        detail.messages.map((message) => ({
          localId: `message-${message.messageId}`,
          messageId: message.messageId,
          role: message.role,
          content: message.content,
          createdAt: new Date(message.createdAt),
          response: message.response,
        })),
      )
      setCompared([])
      setMapRecommendations(restoredMap)
      setActiveMapIndex(0)
      setMapOpen(restoredMap.length > 0)
      setSidebarOpen(false)
    } catch {
      setError('Không thể mở cuộc trò chuyện này.')
    } finally {
      setConversationLoading(false)
    }
  }

  async function deleteConversation(
    event: MouseEvent,
    conversation: ConversationSummary,
  ) {
    event.stopPropagation()
    if (!window.confirm('Xóa cuộc trò chuyện này?')) return
    try {
      await api.delete(
        `/ai-agent/conversations/${encodeURIComponent(conversation.sessionId)}`,
      )
      if (conversation.sessionId === sessionId) newChat()
      await loadConversations()
    } catch {
      setError('Không thể xóa cuộc trò chuyện.')
    }
  }

  async function sendMessage(
    text = input,
    options: {
      startNewConversation?: boolean
      replaceMessages?: boolean
      clientAction?:
      | {
        type: 'START_PLOT_REQUEST'
        optionId: string
        plotIds: number[]
        plotCodes: string[]
      }
      | {
        type: 'START_SERVICE_ORDER'
        serviceTypeId: number
        serviceName: string
      }
    } = {},
  ) {
    const value = text.trim()
    if (!value || loading) return

    const controller = new AbortController()
    requestControllerRef.current?.abort()
    requestControllerRef.current = controller
    requestStartedAtRef.current = getTimestamp()
    setElapsedMs(0)

    const userMessage: ChatMessage = {
      localId: createLocalId(),
      role: 'user',
      content: value,
      createdAt: new Date(),
    }
    setMessages((current) =>
      options.replaceMessages ? [userMessage] : [...current, userMessage],
    )
    if (options.startNewConversation) {
      setSessionId(undefined)
      setCompared([])
      setMapOpen(false)
      setMapRecommendations([])
      setActiveMapIndex(0)
    }
    setInput('')
    setError('')
    setNotice(
      options.startNewConversation
        ? 'Đã tạo một nhánh trò chuyện mới từ câu hỏi đã chỉnh sửa.'
        : '',
    )
    setLoading(true)

    try {
      const response = await api.post(
        '/ai-agent/chat',
        {
          sessionId: options.startNewConversation ? undefined : sessionId,
          message: value,
          clientAction: options.clientAction,
        },
        { signal: controller.signal },
      )
      const data = response.data.data as AgentResponse
      const responseTimeMs = getTimestamp() - requestStartedAtRef.current
      if (
        !data.recommendations?.length &&
        data.intent !== 'recommend_plots'
      ) {
        presentationTimersRef.current.forEach((timer) =>
          window.clearTimeout(timer),
        )
        presentationTimersRef.current = []
        setMapOpen(false)
        setMapRecommendations([])
        setActiveMapIndex(0)
      }
      setSessionId(data.sessionId)
      setMessages((current) => [
        ...current,
        {
          localId: createLocalId(),
          messageId: data.messageId ?? undefined,
          role: 'assistant',
          content: data.assistantMessage,
          createdAt: new Date(),
          responseTimeMs,
          response: data,
          animatePresentation: true,
        },
      ])
      if (token && role === 'customer') {
        await loadConversations()
      }
    } catch (requestError: unknown) {
      if (controller.signal.aborted) return
      const apiError = requestError as {
        code?: string
        response?: { data?: { message?: string } }
      }
      if (apiError.code === 'ERR_CANCELED') return
      setError(
        apiError.response?.data?.message ??
        'Chưa thể kết nối với trợ lý. Vui lòng thử lại.',
      )
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null
        setLoading(false)
      }
    }
  }

  function editAndResend(_message: ChatMessage, content: string) {
    if (loading) return
    void sendMessage(content, {
      startNewConversation: true,
      replaceMessages: true,
    })
  }

  function resendMessage(message: ChatMessage) {
    if (loading) return
    void sendMessage(message.content)
  }

  function completeMessagePresentation(message: ChatMessage) {
    if (!message.animatePresentation) return
    setMessages((current) =>
      current.map((item) =>
        item.localId === message.localId
          ? { ...item, animatePresentation: false }
          : item,
      ),
    )
    const recommendations = getTourableRecommendations(
      message.response?.recommendations ?? [],
    )
    if (
      !recommendations.length ||
      message.response?.intent !== 'recommend_plots'
    )
      return
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(
      () => {
        setMapRecommendations(recommendations)
        setActiveMapIndex(0)
        setMapOpen(true)
        presentationTimersRef.current = presentationTimersRef.current.filter(
          (item) => item !== timer,
        )
      },
      reducedMotion ? 0 : 520,
    )
    presentationTimersRef.current.push(timer)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void sendMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  function toggleCompare(option: AgentRecommendation) {
    setCompared((current) => {
      if (current.some((item) => item.optionId === option.optionId)) {
        return current.filter((item) => item.optionId !== option.optionId)
      }
      if (current.length >= 3) {
        setNotice('Bạn có thể so sánh tối đa 3 phương án.')
        return current
      }
      return [...current, option]
    })
  }

  function focusOnMap(option: AgentRecommendation) {
    const source = messages.find((message) =>
      message.response?.recommendations.some(
        (item) => item.optionId === option.optionId,
      ),
    )?.response?.recommendations ?? [option]
    const valid = getTourableRecommendations(source)
    const nextIndex = valid.findIndex(
      (item) => item.optionId === option.optionId,
    )
    if (nextIndex < 0) {
      setError(
        'Phương án hiện tại chưa có mã lô hợp lệ để hiển thị trên bản đồ.',
      )
      return
    }
    setError('')
    setMapRecommendations(valid)
    setActiveMapIndex(nextIndex)
    setMapOpen(true)
  }

  function openFullMap(option: AgentRecommendation) {
    navigate(buildFullMapUrl(ROUTES.MAP, option))
  }

  function startPlotRequest(option: AgentRecommendation) {
    if (!token || role !== 'customer') {
      sessionStorage.setItem(
        'ai-agent-pending-action',
        JSON.stringify({
          sessionId,
          optionId: option.optionId,
          plotIds: option.plotIds,
          plotCodes: option.plotCodes,
        }),
      )
      navigate(ROUTES.LOGIN, { state: { from: ROUTES.AI_AGENT } })
      return
    }
    void sendMessage(
      `Mình muốn đặt yêu cầu cho phương án ${option.plotCodes.join(', ')}.`,
      {
        clientAction: {
          type: 'START_PLOT_REQUEST',
          optionId: option.optionId,
          plotIds: option.plotIds,
          plotCodes: option.plotCodes,
        },
      },
    )
  }

  function startServiceOrder(service: AgentService) {
    if (!token || role !== 'customer') {
      sessionStorage.setItem(
        'ai-agent-pending-action',
        JSON.stringify({
          sessionId,
          serviceTypeId: service.id,
          serviceName: service.name,
        }),
      )
      navigate(ROUTES.LOGIN, { state: { from: ROUTES.AI_AGENT } })
      return
    }
    void sendMessage(`Mình muốn đặt dịch vụ ${service.name}.`, {
      clientAction: {
        type: 'START_SERVICE_ORDER',
        serviceTypeId: service.id,
        serviceName: service.name,
      },
    })
  }

  async function submitFeedback(payload: {
    feedbackType: FeedbackType
    rating: number
    originalContent: string
    correctedContent?: string
    reason?: string
    evidenceUrl?: string
  }) {
    if (!feedbackTarget?.message.response || !sessionId) return
    const response = await api.post('/ai-agent/feedback', {
      sessionId,
      messageId: feedbackTarget.message.response.messageId ?? undefined,
      ...payload,
    })
    const feedback = response.data.data as {
      feedbackId: number
      status: string
    }
    setFeedbackTarget(null)
    setNotice(
      `Đã ghi nhận phản hồi F-${String(feedback.feedbackId).padStart(5, '0')}. Quản trị viên sẽ kiểm tra trước khi cập nhật dữ liệu.`,
    )
  }

  return (
    <div
      className={`agent-page ${sidebarOpen ? 'sidebar-open' : ''} ${mapOpen ? 'map-open' : ''}`}
    >
      <section className="agent-shell">
        <aside className="agent-sidebar" aria-label="Lịch sử trò chuyện">
          <div className="agent-sidebar-brand">
            <div className="agent-sidebar-brandmark">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>Trợ lý AI</strong>
              <span>Vĩnh Phúc Viên</span>
            </div>
            <button
              type="button"
              className="agent-sidebar-close"
              aria-label="Đóng lịch sử"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button type="button" className="agent-new-chat" onClick={newChat}>
            <Plus size={17} />
            Cuộc trò chuyện mới
          </button>

          <div className="agent-history">
            <div className="agent-history-label">
              <span>Gần đây</span>
              {historyLoading && <LoaderCircle size={13} className="spin" />}
            </div>

            {!token || role !== 'customer' ? (
              <div className="agent-history-empty">
                <MessageCircle size={19} />
                <p>Đăng nhập để lưu và xem lại các cuộc trò chuyện.</p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(ROUTES.LOGIN, {
                      state: { from: ROUTES.AI_AGENT },
                    })
                  }
                >
                  Đăng nhập
                </button>
              </div>
            ) : !historyLoading && conversations.length === 0 ? (
              <div className="agent-history-empty">
                <MessageCircle size={19} />
                <p>Chưa có cuộc trò chuyện nào.</p>
                <span>Nội dung bạn trao đổi sẽ xuất hiện tại đây.</span>
              </div>
            ) : (
              <div className="agent-history-list">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.sessionId}
                    className={
                      conversation.sessionId === sessionId ? 'is-active' : ''
                    }
                  >
                    <button
                      type="button"
                      className="agent-history-open"
                      onClick={() => void openConversation(conversation)}
                    >
                      <MessageCircle size={15} />
                      <span>
                        <strong>{conversation.title}</strong>
                        <small>
                          {formatHistoryDate(conversation.updatedAt)}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="agent-history-delete"
                      aria-label="Xóa cuộc trò chuyện"
                      onClick={(event) =>
                        void deleteConversation(event, conversation)
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="agent-sidebar-account">
            <span>{user?.initials ?? 'AI'}</span>
            <div>
              <strong>{user?.name ?? 'Khách'}</strong>
              <small>
                {token ? 'Lịch sử được lưu theo tài khoản' : 'Chưa đăng nhập'}
              </small>
            </div>
          </div>
        </aside>

        <button
          type="button"
          className="agent-sidebar-overlay"
          aria-label="Đóng lịch sử"
          onClick={() => setSidebarOpen(false)}
        />

        <div className={`agent-workspace ${mapOpen ? 'has-context-map' : ''}`}>
          <main className="agent-chat">
            <header className="agent-topbar">
              <button
                type="button"
                className="agent-menu-button"
                aria-label="Mở lịch sử"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={19} />
              </button>
              <div className="agent-identity">
                <div className="agent-avatar">
                  <Bot size={19} />
                  <span />
                </div>
                <div>
                  <h1>Trợ lý Vĩnh Phúc Viên</h1>
                  <p>Sẵn sàng hỗ trợ</p>
                </div>
              </div>
            </header>

            <div className="agent-messages">
              <div className="agent-message-column">
                {messages.length === 0 && !conversationLoading && (
                  <section className="agent-welcome">
                    <div className="agent-welcome-avatar">
                      <Sparkles size={25} />
                    </div>
                    <span>TRỢ LÝ VĨNH PHÚC VIÊN</span>
                    <h2>Tìm một nơi an yên, phù hợp với gia đình bạn</h2>
                    <div className="agent-welcome-copy">
                      <p>
                        Chia sẻ số lượng lô, ngân sách, khu vực hoặc hướng mong
                        muốn. Mình sẽ đối chiếu quỹ đất thực tế, chọn lọc phương
                        án phù hợp và trình bày chi phí dự kiến thật rõ ràng.
                      </p>
                      <p>
                        Bạn có thể bắt đầu bằng một gợi ý bên dưới hoặc mô tả tự
                        nhiên nhu cầu của gia đình—từ tham khảo vị trí, so sánh
                        các lô liền kề đến chuẩn bị yêu cầu cùng Trợ lý.
                      </p>
                    </div>
                    <div
                      className="agent-welcome-benefits"
                      aria-label="Lợi ích"
                    >
                      <span>Quỹ đất thực tế</span>
                      <span>Chi phí minh bạch</span>
                      <span>Tư vấn theo nhu cầu</span>
                    </div>
                    <div className="agent-starter-grid">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          type="button"
                          key={prompt.title}
                          onClick={() => void sendMessage(prompt.text)}
                        >
                          <span>{prompt.icon}</span>
                          <div>
                            <strong>{prompt.title}</strong>
                            <small>{prompt.text}</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {conversationLoading && (
                  <div className="agent-conversation-loading">
                    <LoaderCircle className="spin" size={22} />
                    Đang mở cuộc trò chuyện…
                  </div>
                )}

                {messages.map((message) => (
                  <AgentMessage
                    key={message.localId}
                    message={message}
                    comparedIds={compared.map((item) => item.optionId)}
                    busy={loading}
                    onToggleCompare={toggleCompare}
                    onViewMap={focusOnMap}
                    onStartRequest={startPlotRequest}
                    onStartServiceOrder={startServiceOrder}
                    onEditResend={editAndResend}
                    onResend={resendMessage}
                    onPresentationComplete={completeMessagePresentation}
                    onFeedback={(target, type) =>
                      setFeedbackTarget({ message: target, type })
                    }
                  />
                ))}

                {loading && (
                  <div className="agent-typing">
                    <div className="agent-message-avatar">
                      <Bot size={17} />
                    </div>
                    <div className="agent-thinking">
                      <div aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="agent-alert error">
                    <CircleAlert size={16} />
                    {error}
                  </div>
                )}
                {notice && <div className="agent-alert">{notice}</div>}

                <ComparisonPanel
                  options={compared}
                  onClose={() => setCompared([])}
                />
                <div ref={messageEndRef} />
              </div>
            </div>

            <form className="agent-composer" onSubmit={submit}>
              <div className="agent-composer-inner">
                <div className="agent-input-wrap">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhắn tin cho trợ lý…"
                    maxLength={2000}
                  />
                  {loading && (
                    <span className="agent-composer-timer">
                      {(elapsedMs / 1000).toLocaleString('vi-VN', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      s
                    </span>
                  )}
                  <button
                    type={loading ? 'button' : 'submit'}
                    onClick={loading ? stopResponse : undefined}
                    disabled={!loading && !input.trim()}
                    aria-label={loading ? 'Dừng phản hồi' : 'Gửi tin nhắn'}
                    title={loading ? 'Dừng phản hồi' : 'Gửi tin nhắn'}
                  >
                    {loading ? (
                      <Square size={16} fill="currentColor" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>
                <p>
                  Trợ lý có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng
                  trước khi xác nhận.
                </p>
              </div>
            </form>
          </main>

          {mapOpen && mapRecommendations.length > 0 && (
            <AgentContextMap
              recommendations={mapRecommendations}
              activeIndex={activeMapIndex}
              onSelect={setActiveMapIndex}
              onClose={() => setMapOpen(false)}
              onStartRequest={startPlotRequest}
              onOpenFullMap={openFullMap}
            />
          )}
        </div>
      </section>

      <FeedbackDialog
        key={
          feedbackTarget
            ? `${feedbackTarget.message.localId}-${feedbackTarget.type}`
            : 'closed'
        }
        open={!!feedbackTarget}
        initialType={feedbackTarget?.type ?? 'other'}
        originalContent={feedbackTarget?.message.content ?? ''}
        onClose={() => setFeedbackTarget(null)}
        onSubmit={submitFeedback}
      />

      {currentRecommendations.length > 0 && compared.length === 1 && (
        <button
          type="button"
          className="agent-compare-hint"
          onClick={() => {
            const next = currentRecommendations.find(
              (option) =>
                !compared.some(
                  (selected) => selected.optionId === option.optionId,
                ),
            )
            if (next) toggleCompare(next)
          }}
        >
          Chọn thêm một phương án để so sánh
        </button>
      )}
    </div>
  )
}
