import {
  Bot,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import AgentMessage from "./AgentMessage";
import AgentContextMap from "./AgentContextMap";
import ComparisonPanel from "./ComparisonPanel";
import ComparisonAssessmentMessage from "./ComparisonAssessmentMessage";
import AgentWorkflowPanel from "./AgentWorkflowPanel";
import { buildFullMapUrl, getTourableRecommendations } from "./guidedTour";
import { getRecommendationCompareKey } from "./agentDisplay";
import type {
  AgentRecommendation,
  AgentResponse,
  AgentService,
  ChatMessage,
  ComparisonFollowUpAction,
  ConversationDetail,
  ConversationSummary,
} from "./agent.types";
import "./AgentPage.css";

type WorkflowDirective = NonNullable<AgentResponse["uiDirective"]>;

function asWorkflowDirective(
  directive: AgentResponse["uiDirective"],
): WorkflowDirective | undefined {
  if (!directive) return undefined;
  if (
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
    directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR" ||
    directive.type === "OPEN_APPOINTMENT_CALENDAR" ||
    directive.type === "OPEN_REMINDER_CALENDAR"
  ) {
    return directive;
  }
  // Legacy/unknown directives (including the removed OPEN_SERVICE_PANEL stored
  // in older conversations) are ignored.
  return undefined;
}

export interface SuggestedPrompt {
  category: string;
  text: string;
}

export function getContextualPrompts(
  source?: ChatMessage | ChatMessage[],
): SuggestedPrompt[] {
  const conversation = Array.isArray(source) ? source : source ? [source] : [];
  const lastMessage = [...conversation]
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastMessage || lastMessage.role !== "assistant") {
    return [
      {
        category: "Tìm lô đất",
        text: "Mình cần tìm 1 lô ở Khu A với ngân sách dưới 150 triệu.",
      },
      {
        category: "So sánh phương án",
        text: "So sánh 2 phương án đất nghĩa trang phù hợp ngân sách 300 triệu.",
      },
      {
        category: "Dịch vụ chăm sóc",
        text: "Gợi ý gói chăm sóc phần mộ và thay hoa tươi định kỳ hàng tháng.",
      },
    ];
  }

  const isAllowedPrompt = (item: SuggestedPrompt) =>
    item.category &&
    item.text &&
    !/(?:tham|thăm)\s*quan|xem\s+thực\s+tế|(?:đến|tới)\s+hoa\s+viên/i.test(
      `${item.category} ${item.text}`,
    );
  // The backend quick replies are built from the authoritative current state
  // (including exact plot codes, pending workflows and missing intake data).
  // They are therefore a better source for the floating prompt tray than a
  // generic local catalogue or an optional free-form LLM suggestion.
  const mappedQuickReplies = (lastMessage.response?.quickReplies ?? [])
    .map((item) => ({
      id: String(item?.id ?? ""),
      category: String(item?.label ?? "").trim(),
      text: String(item?.message ?? "").trim(),
    }))
    .filter(isAllowedPrompt);
  const contextualQuickReplies = mappedQuickReplies
    .filter((item) => !item.id.startsWith("help-"))
    .map(({ category, text }) => ({ category, text }))
    .slice(0, 3);
  const genericHelpReplies = mappedQuickReplies
    .filter((item) => item.id.startsWith("help-"))
    .map(({ category, text }) => ({ category, text }))
    .slice(0, 3);
  const backendFollowUps = (lastMessage.response?.suggestedFollowUps ?? [])
    .map((item) => ({
      category: String(item?.category ?? "").trim(),
      text: String(item?.text ?? "").trim(),
    }))
    .filter(isAllowedPrompt)
    .slice(0, 3);

  const response = lastMessage.response;
  const content = lastMessage.content || "";
  const prompts: SuggestedPrompt[] = [];
  const isGreetingTurn =
    response?.intent === "general_question" &&
    /(?:xin\s+)?chào|trợ\s+lý.*hỗ\s+trợ|mình\s+có\s+thể\s+hỗ\s+trợ/iu.test(
      content,
    );

  if (response?.recommendations && response.recommendations.length > 0) {
    const codes = response.recommendations
      .flatMap((option) => option.plotCodes)
      .filter(Boolean)
      .slice(0, 4);
    const codeList = codes.join(", ");
    prompts.push({
      category: "So sánh chi tiết",
      text: codeList
        ? `So sánh điểm khác biệt giữa các lô ${codeList} theo tiêu chí hiện tại của mình.`
        : "So sánh điểm khác biệt giữa các lô vừa gợi ý theo tiêu chí hiện tại của mình.",
    });
    prompts.push({
      category: "Phân tích lô ưu tiên",
      text: codes[0]
        ? `Phân tích kỹ vì sao lô ${codes[0]} được xếp trước các lô còn lại.`
        : "Phân tích kỹ vì sao phương án đầu được ưu tiên.",
    });
    prompts.push({
      category: "Phương án khác",
      text: codeList
        ? `Tìm các lô khác theo tiêu chí hiện tại và không lặp lại ${codeList}.`
        : "Tìm các lô khác theo tiêu chí hiện tại và không lặp lại các lô vừa xem.",
    });
  } else if (response?.baziSuggestion) {
    prompts.push({
      category: "Hướng phong thủy",
      text: "Giải thích chi tiết các hướng hợp tuổi cho gia đình.",
    });
    prompts.push({
      category: "Chọn lô theo tuổi",
      text: "Tìm lô có hướng phù hợp nhất với kết quả phong thủy trên.",
    });
    prompts.push({
      category: "Phương án thay thế",
      text: "Gợi ý thêm hướng dự phòng nếu khu vực này hết lô.",
    });
  } else if (
    response?.suggestedServices &&
    response.suggestedServices.length > 0
  ) {
    prompts.push({
      category: "Đặt dịch vụ",
      text: "Hướng dẫn cách đăng ký dịch vụ và hình thức thanh toán.",
    });
    prompts.push({
      category: "Lịch định kỳ",
      text: "Tư vấn tần suất và quy trình thực hiện dịch vụ chăm sóc.",
    });
    prompts.push({
      category: "Báo giá dịch vụ",
      text: "Chi tiết các gói dịch vụ và bảng giá kèm theo.",
    });
  } else {
    if (content.includes("lô") || content.includes("khu")) {
      prompts.push({
        category: "Chi phí hoàn thiện",
        text: "Chi phí xây dựng và hoàn thiện phần mộ khoảng bao nhiêu?",
      });
      prompts.push({
        category: "Hồ sơ pháp lý",
        text: "Quy trình ký hợp đồng và giấy tờ gồm những gì?",
      });
      prompts.push({
        category: "Phương án khác",
        text: "Có phương án nào ở khu vực lân cận không?",
      });
    } else {
      prompts.push({
        category: "Tư vấn chi tiết",
        text: "Tư vấn giúp mình các bước tiếp theo cần chuẩn bị.",
      });
      prompts.push({
        category: "Tình trạng yêu cầu",
        text: "Làm sao kiểm tra yêu cầu lô của mình đã được duyệt hay chưa?",
      });
      prompts.push({
        category: "Liên hệ tư vấn",
        text: "Cần chuẩn bị thông tin gì trước khi ký hợp đồng?",
      });
    }
  }

  const unique = new Map<string, SuggestedPrompt>();
  for (const item of [
    ...contextualQuickReplies,
    ...backendFollowUps,
    ...(isGreetingTurn ? genericHelpReplies : []),
    ...prompts,
    ...genericHelpReplies,
  ]) {
    const key = item.text.toLocaleLowerCase("vi");
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 3);
}

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getTimestamp = () => Date.now();

function AgentElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const updateElapsed = () => setElapsedMs(Date.now() - startedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <span className="agent-composer-timer">
      {(elapsedMs / 1000).toLocaleString("vi-VN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}
      s
    </span>
  );
}

const comparisonText = (value: unknown, maxLength: number) =>
  String(value ?? "")
    .trim()
    .slice(0, maxLength);

export function toComparisonAssessmentOption(option: AgentRecommendation) {
  const plotIds = (Array.isArray(option.plotIds) ? option.plotIds : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 10);
  const plotCodes = (Array.isArray(option.plotCodes) ? option.plotCodes : [])
    .map((value) => comparisonText(value, 50))
    .filter(Boolean)
    .slice(0, 10);
  const score = Number(option.score);
  const estimatedTotal = Number(option.estimatedTotal);
  const totalAreaSqm = Number(option.totalAreaSqm);

  return {
    plotIds,
    plotCodes,
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
    estimatedTotal: Number.isFinite(estimatedTotal)
      ? Math.max(0, estimatedTotal)
      : 0,
    zoneName: comparisonText(option.zoneName, 120),
    directions: (Array.isArray(option.directions) ? option.directions : [])
      .map((value) => comparisonText(value, 50))
      .filter(Boolean)
      .slice(0, 4),
    totalAreaSqm: Number.isFinite(totalAreaSqm) ? Math.max(0, totalAreaSqm) : 0,
    isAdjacent: Boolean(option.isAdjacent),
  };
}

export function toComparisonDecisionContext(
  messages: ChatMessage[],
  compared: AgentRecommendation[],
) {
  const selectedKeys = new Set(compared.map(getRecommendationCompareKey));
  const requirements = messages
    .filter((message) => {
      if (message.role !== "assistant") return false;
      return message.response?.recommendations.some((option) =>
        selectedKeys.has(getRecommendationCompareKey(option)),
      );
    })
    .map((message) => message.response?.requirements ?? {})
    .reduce<Record<string, unknown>>(
      (merged, current) => ({ ...merged, ...current }),
      {},
    );
  const context: Record<string, string | number | boolean> = {};
  const assignNumber = (
    key: string,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
  ) => {
    const value = Number(requirements[key]);
    if (Number.isFinite(value) && value >= min && value <= max) {
      context[key] = value;
    }
  };
  const assignText = (key: string, maxLength: number) => {
    const value = comparisonText(requirements[key], maxLength);
    if (value) context[key] = value;
  };
  const assignBoolean = (key: string) => {
    if (typeof requirements[key] === "boolean") {
      context[key] = requirements[key] as boolean;
    }
  };

  assignNumber("budgetMin");
  assignNumber("budgetMax");
  assignNumber("numberOfPlots", 1, 10);
  assignNumber("minAreaSqm");
  assignNumber("maxAreaSqm");
  assignText("preferredZone", 120);
  assignText("preferredDirection", 50);
  assignText("plotType", 20);
  assignBoolean("needAdjacent");
  assignBoolean("preferNearEntrance");

  return Object.keys(context).length ? context : undefined;
}

const formatHistoryDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
};

export default function AgentPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const isPacing = messages.some(
    (message) => message.role === "assistant" && message.animatePresentation,
  );
  const isBusy = loading || isPacing;
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [compared, setCompared] = useState<AgentRecommendation[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonAssessment, setComparisonAssessment] = useState("");
  const [comparisonFollowUpPrompt, setComparisonFollowUpPrompt] = useState("");
  const [comparisonActions, setComparisonActions] = useState<
    ComparisonFollowUpAction[]
  >([]);
  const [comparisonAssessmentLoading, setComparisonAssessmentLoading] =
    useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [workflowDirective, setWorkflowDirective] =
    useState<WorkflowDirective>();
  const [mapRecommendations, setMapRecommendations] = useState<
    AgentRecommendation[]
  >([]);
  const [activeMapIndex, setActiveMapIndex] = useState(0);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const accountIdRef = useRef(user?.id);
  const knownApprovedRequestNotificationsRef = useRef<Set<number> | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const sendLockRef = useRef(false);
  const comparisonAssessmentControllerRef = useRef<AbortController | null>(
    null,
  );
  const requestStartedAtRef = useRef(0);
  const presentationTimersRef = useRef<number[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isInputHovered, setIsInputHovered] = useState(false);
  const [isIdleAfterOneMin, setIsIdleAfterOneMin] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (isBusy || input.trim() !== "") {
      setIsIdleAfterOneMin(false);
      return;
    }

    if (messages.length === 0) {
      setIsIdleAfterOneMin(true);
      return;
    }

    setIsIdleAfterOneMin(false);
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      idleTimerRef.current = setTimeout(() => {
        setIsIdleAfterOneMin(true);
      }, 60000);
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [messages, isBusy, input]);

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const suggestedPrompts = getContextualPrompts(messages);

  const canPersistConversations = Boolean(
    token && (role === "customer" || role === "admin"),
  );

  const loadConversations = useCallback(async () => {
    if (!canPersistConversations) {
      setConversations([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const response = await api.get("/ai-agent/conversations");
      setConversations((response.data.data ?? []) as ConversationSummary[]);
    } catch {
      setConversations([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [canPersistConversations]);

  useRealtimeRefresh(["ai"], loadConversations);

  const syncApprovedPlotNotifications = useCallback(async () => {
    if (role !== "customer") return;
    try {
      const response = await api.get("/notifications");
      const notifications = (response.data?.data ?? []) as Array<{
        id?: number;
        type?: string;
        isRead?: boolean;
      }>;
      const approved = notifications.filter(
        (item) =>
          item.type === "request_approved" && typeof item.id === "number",
      );
      const known = knownApprovedRequestNotificationsRef.current;
      let newlyApproved: typeof approved;
      if (known === null) {
        knownApprovedRequestNotificationsRef.current = new Set(
          approved.map((item) => item.id!),
        );
        // If approval happened while the customer was away from the AI page,
        // announce the still-unread approval the first time they come back.
        // Read historical notifications are intentionally not replayed.
        newlyApproved = approved.filter((item) => !item.isRead);
      } else {
        newlyApproved = approved.filter((item) => !known.has(item.id!));
        knownApprovedRequestNotificationsRef.current = new Set(
          approved.map((item) => item.id!),
        );
      }
      if (!newlyApproved.length) return;
      setMessages((current) => [
        ...current,
        {
          localId: createLocalId(),
          role: "assistant",
          content:
            newlyApproved.length === 1
              ? "Ban quản lý đã duyệt yêu cầu mua lô của bạn. Khi bạn muốn đặt lịch, cứ nhắn “đặt lịch”; mình sẽ kiểm tra đúng các lô đã duyệt trong tài khoản rồi mới hỏi ngày/giờ, không tự tạo lịch trước."
              : `Ban quản lý đã duyệt ${newlyApproved.length} yêu cầu mua lô của bạn. Khi bạn muốn đặt lịch, cứ nhắn “đặt lịch”; mình sẽ kiểm tra từng lô đủ điều kiện và hỏi lại ngày/giờ cần thiết trước khi gửi lịch.`,
          createdAt: new Date(),
        },
      ]);
    } catch {
      // Notification bell remains the fallback when this passive chat update
      // cannot be loaded; never interrupt the active conversation.
    }
  }, [role, user?.id]);

  useEffect(() => {
    knownApprovedRequestNotificationsRef.current = null;
    void syncApprovedPlotNotifications();
  }, [syncApprovedPlotNotifications, user?.id]);

  useRealtimeRefresh(["notifications"], syncApprovedPlotNotifications);

  const restoreConversation = useCallback((detail: ConversationDetail) => {
    const restoredRecommendations =
      [...detail.messages]
        .reverse()
        .find((message) => message.response?.recommendations?.length)?.response
        ?.recommendations ?? [];
    const restoredMap = getTourableRecommendations(restoredRecommendations);
    const restoredWorkflow = [...detail.messages]
      .reverse()
      .find((message) => message.response?.uiDirective)?.response;
    setSessionId(detail.sessionId);
    setMessages(
      detail.messages.map((message) => ({
        localId: `message-${message.messageId}`,
        messageId: message.messageId,
        role: message.role,
        content: message.content,
        createdAt: new Date(message.createdAt),
        response: message.response,
      })),
    );
    setCompared([]);
    setComparisonOpen(false);
    setMapRecommendations(restoredMap);
    setActiveMapIndex(0);
    setMapOpen(restoredMap.length > 0);
    setWorkflowDirective(asWorkflowDirective(restoredWorkflow?.uiDirective));
    setSidebarOpen(false);
    stickToBottomRef.current = true;
  }, []);

  useEffect(() => {
    const container = messageScrollRef.current;
    if (!container || !stickToBottomRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, isBusy]);

  const trackMessageScroll = useCallback(() => {
    const container = messageScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= 96;
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
      comparisonAssessmentControllerRef.current?.abort();
      presentationTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
    },
    [],
  );

  useEffect(() => {
    comparisonAssessmentControllerRef.current?.abort();
    comparisonAssessmentControllerRef.current = null;

    if (!comparisonOpen || compared.length < 2) {
      setComparisonAssessment("");
      setComparisonFollowUpPrompt("");
      setComparisonActions([]);
      setComparisonAssessmentLoading(false);
      return;
    }

    const controller = new AbortController();
    comparisonAssessmentControllerRef.current = controller;
    setComparisonAssessment("");
    setComparisonFollowUpPrompt("");
    setComparisonActions([]);
    setComparisonAssessmentLoading(true);

    void api
      .post(
        "/ai-agent/comparison-assessment",
        {
          options: compared.map(toComparisonAssessmentOption),
          context: toComparisonDecisionContext(messages, compared),
        },
        { signal: controller.signal },
      )
      .then((response) => {
        if (controller.signal.aborted) return;
        const assessment = response.data?.data?.assessment;
        setComparisonAssessment(
          typeof assessment === "string" ? assessment.trim() : "",
        );
        const followUpPrompt = response.data?.data?.followUpPrompt;
        setComparisonFollowUpPrompt(
          typeof followUpPrompt === "string" ? followUpPrompt.trim() : "",
        );
        const actions = response.data?.data?.actions;
        setComparisonActions(
          Array.isArray(actions)
            ? actions
                .filter(
                  (action: unknown): action is ComparisonFollowUpAction => {
                    if (!action || typeof action !== "object") return false;
                    const candidate = action as Record<string, unknown>;
                    return (
                      (candidate.id === "analyze_selected_plots" ||
                        candidate.id === "find_other_plots") &&
                      typeof candidate.label === "string" &&
                      typeof candidate.message === "string"
                    );
                  },
                )
                .slice(0, 2)
            : [],
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setComparisonAssessment("");
          setComparisonFollowUpPrompt("");
          setComparisonActions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setComparisonAssessmentLoading(false);
        }
      });

    return () => controller.abort();
  }, [compared, comparisonOpen, messages]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    const pending = sessionStorage.getItem("ai-agent-pending-action");
    if (pending && token && role === "customer") {
      sessionStorage.removeItem("ai-agent-pending-action");
      const timer = window.setTimeout(
        () =>
          setNotice(
            "Bạn đã đăng nhập. Chọn lại “Đặt yêu cầu” để Trợ lý tiếp tục hỏi thông tin còn thiếu.",
          ),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [role, token]);

  useEffect(() => {
    if (accountIdRef.current === user?.id) return;
    accountIdRef.current = user?.id;
    const timer = window.setTimeout(() => {
      setSessionId(undefined);
      setMessages([]);
      setCompared([]);
      setComparisonOpen(false);
      setMapOpen(false);
      setMapRecommendations([]);
      setActiveMapIndex(0);
      setWorkflowDirective(undefined);
      setNotice("");
      setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  function stopResponse() {
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }
    presentationTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    presentationTimersRef.current = [];
    setMessages((current) =>
      current.map((item) =>
        item.animatePresentation
          ? { ...item, animatePresentation: false }
          : item,
      ),
    );
    sendLockRef.current = false;
    setLoading(false);
    setNotice("Đã dừng phản hồi. Bạn có thể chỉnh câu hỏi hoặc gửi lại.");
  }

  function newChat() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    sendLockRef.current = false;
    presentationTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    presentationTimersRef.current = [];
    setSessionId(undefined);
    setMessages([]);
    setCompared([]);
    setComparisonOpen(false);
    setMapOpen(false);
    setMapRecommendations([]);
    setActiveMapIndex(0);
    setWorkflowDirective(undefined);
    setInput("");
    setLoading(false);
    stickToBottomRef.current = true;
    setError("");
    setNotice("");
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function openConversation(conversation: ConversationSummary) {
    if (conversation.sessionId === sessionId || conversationLoading) {
      setSidebarOpen(false);
      return;
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setLoading(false);
    setConversationLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await api.get(
        `/ai-agent/conversations/${encodeURIComponent(conversation.sessionId)}`,
      );
      const detail = response.data.data as ConversationDetail;
      restoreConversation(detail);
    } catch {
      setError("Không thể mở cuộc trò chuyện này.");
    } finally {
      setConversationLoading(false);
    }
  }

  async function deleteConversation(
    event: MouseEvent,
    conversation: ConversationSummary,
  ) {
    event.stopPropagation();
    if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
    try {
      await api.delete(
        `/ai-agent/conversations/${encodeURIComponent(conversation.sessionId)}`,
      );
      if (conversation.sessionId === sessionId) newChat();
      await loadConversations();
    } catch {
      setError("Không thể xóa cuộc trò chuyện.");
    }
  }

  async function sendMessage(
    text = input,
    options: {
      startNewConversation?: boolean;
      replaceMessages?: boolean;
      clientAction?:
        | {
            type: "START_PLOT_REQUEST";
            optionId: string;
            recommendationRunId?: string;
            plotIds: number[];
            plotCodes: string[];
          }
        | {
            type: "START_SERVICE_ORDER";
            serviceTypeId: number;
            serviceName: string;
          };
    } = {},
  ) {
    const value = text.trim();
    if (!value || loading || sendLockRef.current) return;

    if (isPacing) {
      presentationTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      presentationTimersRef.current = [];
      setMessages((current) =>
        current.map((item) =>
          item.animatePresentation
            ? { ...item, animatePresentation: false }
            : item,
        ),
      );
    }
    sendLockRef.current = true;

    // A comparison is contextual to the current pause in the conversation.
    // Hide it as soon as the customer sends a new message, while preserving
    // selected plots so old and new recommendations can be compared later.
    setComparisonOpen(false);

    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    requestStartedAtRef.current = getTimestamp();
    stickToBottomRef.current = true;
    const clientRequestId = createLocalId();

    const userMessage: ChatMessage = {
      localId: createLocalId(),
      role: "user",
      content: value,
      createdAt: new Date(),
    };
    setMessages((current) =>
      options.replaceMessages ? [userMessage] : [...current, userMessage],
    );
    if (options.startNewConversation) {
      setSessionId(undefined);
      setCompared([]);
      setComparisonOpen(false);
      setMapOpen(false);
      setMapRecommendations([]);
      setActiveMapIndex(0);
    }
    setInput("");
    setError("");
    setNotice(
      options.startNewConversation
        ? "Đã tạo một nhánh trò chuyện mới từ câu hỏi đã chỉnh sửa."
        : "",
    );
    setLoading(true);

    try {
      const response = await api.post(
        "/ai-agent/chat",
        {
          sessionId: options.startNewConversation ? undefined : sessionId,
          clientRequestId,
          message: value,
          clientAction: options.clientAction,
        },
        { signal: controller.signal },
      );
      const data = response.data.data as AgentResponse;
      const responseTimeMs = getTimestamp() - requestStartedAtRef.current;
      if (!data.recommendations?.length && data.intent !== "recommend_plots") {
        presentationTimersRef.current.forEach((timer) =>
          window.clearTimeout(timer),
        );
        presentationTimersRef.current = [];
        setMapOpen(false);
        setMapRecommendations([]);
        setActiveMapIndex(0);
      }
      setSessionId(data.sessionId);
      const nextWorkflowDirective = asWorkflowDirective(data.uiDirective);
      setWorkflowDirective(nextWorkflowDirective);
      if (nextWorkflowDirective) setMapOpen(false);
      setMessages((current) => [
        ...current,
        {
          localId: createLocalId(),
          messageId: data.messageId ?? undefined,
          role: "assistant",
          content: data.assistantMessage,
          createdAt: new Date(),
          responseTimeMs,
          response: data,
          animatePresentation: true,
        },
      ]);
      if (canPersistConversations) {
        await loadConversations();
      }
    } catch (requestError: unknown) {
      if (controller.signal.aborted) return;
      const apiError = requestError as {
        code?: string;
        response?: { data?: { message?: string } };
      };
      if (apiError.code === "ERR_CANCELED") return;
      setError(
        apiError.response?.data?.message ??
          "Chưa thể kết nối với trợ lý. Vui lòng thử lại.",
      );
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        sendLockRef.current = false;
        setLoading(false);
      }
    }
  }

  function editAndResend(_message: ChatMessage, content: string) {
    if (isBusy) return;
    void sendMessage(content, {
      startNewConversation: true,
      replaceMessages: true,
    });
  }

  function resendMessage(message: ChatMessage) {
    if (isBusy) return;
    void sendMessage(message.content);
  }

  function completeMessagePresentation(message: ChatMessage) {
    if (!message.animatePresentation) return;
    setMessages((current) =>
      current.map((item) =>
        item.localId === message.localId
          ? { ...item, animatePresentation: false }
          : item,
      ),
    );
    const recommendations = getTourableRecommendations(
      message.response?.recommendations ?? [],
    );
    if (!recommendations.length) return;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        setMapRecommendations(recommendations);
        setActiveMapIndex(0);
        setMapOpen(true);
        presentationTimersRef.current = presentationTimersRef.current.filter(
          (item) => item !== timer,
        );
      },
      reducedMotion ? 0 : 520,
    );
    presentationTimersRef.current.push(timer);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function toggleCompare(option: AgentRecommendation) {
    setCompared((current) => {
      const key = getRecommendationCompareKey(option);
      const exists = current.some(
        (item) => getRecommendationCompareKey(item) === key,
      );
      const next = exists
        ? current.filter((item) => getRecommendationCompareKey(item) !== key)
        : [...current, option];
      setComparisonOpen(next.length >= 2);
      return next;
    });
  }

  function focusOnMap(option: AgentRecommendation) {
    const optionKey = getRecommendationCompareKey(option);
    const source = messages.find((message) =>
      message.response?.recommendations.some(
        (item) => getRecommendationCompareKey(item) === optionKey,
      ),
    )?.response?.recommendations ?? [option];
    const valid = getTourableRecommendations(source);
    const nextIndex = valid.findIndex(
      (item) => getRecommendationCompareKey(item) === optionKey,
    );
    if (nextIndex < 0) {
      setError(
        "Phương án hiện tại chưa có mã lô hợp lệ để hiển thị trên bản đồ.",
      );
      return;
    }
    setError("");
    setMapRecommendations(valid);
    setActiveMapIndex(nextIndex);
    setMapOpen(true);
  }

  function openFullMap(option: AgentRecommendation) {
    navigate(buildFullMapUrl(ROUTES.MAP, option));
  }

  function startPlotRequest(
    option: AgentRecommendation,
    recommendationRunId?: string,
  ) {
    if (!token || role !== "customer") {
      sessionStorage.setItem(
        "ai-agent-pending-action",
        JSON.stringify({
          sessionId,
          optionId: option.optionId,
          plotIds: option.plotIds,
          plotCodes: option.plotCodes,
        }),
      );
      navigate(ROUTES.LOGIN, { state: { from: ROUTES.AI_AGENT } });
      return;
    }
    void sendMessage(
      `Mình muốn đặt yêu cầu cho phương án ${option.plotCodes.join(", ")}.`,
      {
        clientAction: {
          type: "START_PLOT_REQUEST",
          optionId: option.optionId,
          recommendationRunId,
          plotIds: option.plotIds,
          plotCodes: option.plotCodes,
        },
      },
    );
  }

  function startServiceOrder(service: AgentService) {
    if (!token || role !== "customer") {
      sessionStorage.setItem(
        "ai-agent-pending-action",
        JSON.stringify({
          sessionId,
          serviceTypeId: service.id,
          serviceName: service.name,
        }),
      );
      navigate(ROUTES.LOGIN, { state: { from: ROUTES.AI_AGENT } });
      return;
    }
    void sendMessage(`Mình muốn đặt dịch vụ ${service.name}.`, {
      clientAction: {
        type: "START_SERVICE_ORDER",
        serviceTypeId: service.id,
        serviceName: service.name,
      },
    });
  }

  const comparedIds = useMemo(
    () => compared.map(getRecommendationCompareKey),
    [compared],
  );

  return (
    <div
      className={`agent-page ${sidebarOpen ? "sidebar-open" : ""} ${mapOpen ? "map-open" : ""} ${workflowDirective ? "workflow-open" : ""}`}
    >
      <section className="agent-shell">
        <aside
          id="agent-conversation-panel"
          className="agent-sidebar"
          aria-label="Lịch sử trò chuyện"
        >
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
              <X size={18} />
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

            {!canPersistConversations ? (
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
                      conversation.sessionId === sessionId ? "is-active" : ""
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
            <span>{user?.initials ?? "AI"}</span>
            <div>
              <strong>{user?.name ?? "Khách"}</strong>
              <small>
                {token ? "Lịch sử được lưu theo tài khoản" : "Chưa đăng nhập"}
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

        <div
          className={`agent-workspace ${mapOpen ? "has-context-map" : ""} ${workflowDirective ? "has-workflow-panel" : ""} ${workflowDirective?.type === "OPEN_APPOINTMENT_CALENDAR" ? "has-appointment-panel" : ""}`}
        >
          <main className="agent-chat">
            <header className="agent-topbar">
              <button
                type="button"
                className="agent-menu-button"
                aria-label="Mở lịch sử"
                aria-controls="agent-conversation-panel"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
              >
                <MessageCircle size={18} />
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

            <div
              className="agent-messages"
              ref={messageScrollRef}
              onScroll={trackMessageScroll}
            >
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
                    comparedIds={comparedIds}
                    busy={isBusy}
                    onToggleCompare={toggleCompare}
                    onViewMap={focusOnMap}
                    onStartRequest={startPlotRequest}
                    onStartServiceOrder={startServiceOrder}
                    onEditResend={editAndResend}
                    onResend={resendMessage}
                    onPresentationComplete={completeMessagePresentation}
                    showFollowUps={
                      message.role === "assistant" &&
                      message.localId === lastAssistantMessage?.localId &&
                      !comparisonOpen
                    }
                    onQuickReply={(reply) => void sendMessage(reply)}
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

                {comparisonOpen && (
                  <>
                    <ComparisonPanel
                      options={compared}
                      onClose={() => setComparisonOpen(false)}
                    />
                    <ComparisonAssessmentMessage
                      assessment={comparisonAssessment}
                      followUpPrompt={comparisonFollowUpPrompt}
                      actions={comparisonActions}
                      loading={comparisonAssessmentLoading}
                      disabled={isBusy}
                      onAction={(message) => void sendMessage(message)}
                    />
                  </>
                )}
              </div>
            </div>

            <form
              className="agent-composer"
              onSubmit={submit}
              onMouseEnter={() => setIsInputHovered(true)}
              onMouseLeave={() => setIsInputHovered(false)}
            >
              <div className="agent-composer-inner">
                {!isBusy &&
                  !input.trim() &&
                  isIdleAfterOneMin &&
                  (isInputFocused || isInputHovered) && (
                    <div className="agent-floating-suggestions">
                      <div className="agent-floating-header">
                        <div className="agent-floating-label">
                          <Sparkles size={13} className="agent-sparkle-icon" />
                          <span>Gợi ý câu hỏi AI</span>
                        </div>
                      </div>

                      <div className="agent-prompt-pills-row">
                        {suggestedPrompts.map((prompt, idx) => (
                          <button
                            key={`${prompt.category}-${idx}`}
                            type="button"
                            className="agent-prompt-pill"
                            onClick={() => void sendMessage(prompt.text)}
                            title={prompt.text}
                          >
                            <div className="agent-prompt-pill-content">
                              <span className="agent-prompt-pill-category">
                                {prompt.category}
                              </span>
                              <span className="agent-prompt-pill-text">
                                {prompt.text}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="agent-input-wrap">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setIsInputFocused(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhắn tin cho trợ lý…"
                    maxLength={2000}
                  />
                  {isBusy && (
                    <AgentElapsedTimer
                      startedAt={requestStartedAtRef.current}
                    />
                  )}
                  <button
                    type={isBusy ? "button" : "submit"}
                    onClick={isBusy ? stopResponse : undefined}
                    disabled={!isBusy && !input.trim()}
                    aria-label={isBusy ? "Dừng phản hồi" : "Gửi tin nhắn"}
                    title={isBusy ? "Dừng phản hồi" : "Gửi tin nhắn"}
                  >
                    {isBusy ? (
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
          {workflowDirective && (
            <AgentWorkflowPanel
              directive={workflowDirective}
              onSendMessage={(message) => sendMessage(message)}
              onDirectiveChange={(directive) => {
                setWorkflowDirective(directive);
                setMapOpen(false);
              }}
              onAssistantNotice={(content) => {
                setMessages((current) => {
                  const last = current[current.length - 1];
                  if (last?.role === "assistant" && last.content === content) {
                    return current;
                  }
                  return [
                    ...current,
                    {
                      localId: createLocalId(),
                      role: "assistant",
                      content,
                      createdAt: new Date(),
                    },
                  ];
                });
              }}
              onClose={() => setWorkflowDirective(undefined)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
