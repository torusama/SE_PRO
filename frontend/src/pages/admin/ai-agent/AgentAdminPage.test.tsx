import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentAdminPage from "./AgentAdminPage";
import type { LearningAnalytics } from "./LearningAnalyticsPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../../lib/api", () => ({
  api: apiMock,
}));

const analytics = (days: number): LearningAnalytics => ({
  generatedAt: "2026-07-29T08:00:00.000Z",
  period: {
    days,
    from: "2026-07-01",
    to: "2026-07-29",
  },
  currentState: {
    activeUserMemories: 12,
    usersWithMemory: 5,
    activeGlobalKnowledge: 8,
    quarantinedKnowledge: 3,
    pendingCustomerProposals: 2,
  },
  runtime: {
    totalCalls: 40,
    successfulCalls: 36,
    failedCalls: 4,
    fallbackResponses: 2,
    failureRate: 10,
    promptTokens: 12000,
    completionTokens: 6000,
    totalTokens: 18000,
    averageLatencyMs: 820,
    p95LatencyMs: 1400,
    estimatedCostUsd: 0.0325,
    unpricedCalls: 0,
    unmeteredCalls: 0,
  },
  runtimeByModel: [
    {
      key: "test-model",
      providerId: "openai-primary",
      calls: 40,
      failedCalls: 4,
      totalTokens: 18000,
      averageLatencyMs: 820,
      estimatedCostUsd: 0.0325,
    },
  ],
  runtimeTimeline: [
    {
      date: "2026-07-28",
      calls: 18,
      failedCalls: 1,
      totalTokens: 8000,
      averageLatencyMs: 760,
      estimatedCostUsd: 0.014,
    },
    {
      date: "2026-07-29",
      calls: 22,
      failedCalls: 3,
      totalTokens: 10000,
      averageLatencyMs: 870,
      estimatedCostUsd: 0.0185,
    },
  ],
  periodActivity: {
    memoryUpdates: 7,
    globalKnowledgeUpdates: 4,
    recommendationSignals: 6,
    trainingReadySignals: 2,
    recommendationRuns: 20,
    rankerEnabledRuns: 10,
    mlRankedRuns: 12,
    fallbackRuns: 5,
    fallbackRate: 25,
  },
  knowledgeByStatus: [
    { key: "active", count: 20 },
    { key: "quarantined", count: 3 },
  ],
  memoryByKey: [
    { key: "preferred_plot_location", count: 8 },
    { key: "maximum_budget", count: 4 },
    { key: "consultation_topic_preference", count: 3 },
    { key: "preferred_zone", count: 2 },
    { key: "service_interest", count: 1 },
  ],
  signalReadiness: [
    { key: "training_ready", count: 2 },
    { key: "analytics_only", count: 4 },
  ],
  fallbackReasons: [{ key: "disabled", count: 5 }],
  timeline: [
    {
      date: "2026-07-28",
      memoryUpdates: 2,
      knowledgeUpdates: 1,
      signals: 3,
      recommendations: 4,
      aiAccesses: 6,
    },
    {
      date: "2026-07-29",
      memoryUpdates: 5,
      knowledgeUpdates: 3,
      signals: 3,
      recommendations: 16,
      aiAccesses: 9,
    },
  ],
  recentUpdates: [
    {
      versionId: 91,
      actionType: "activated",
      actorRole: "admin",
      validationReason: "Verified admin update.",
      createdAt: "2026-07-29T08:00:00.000Z",
      knowledgeType: "faq",
      scope: "global",
      memoryKey: "faq:purchase_process",
      title: "Purchase process",
      validationStatus: "active",
    },
  ],
  recentEvents: [
    {
      eventId: "knowledge-91",
      eventType: "global_knowledge",
      actionType: "activated",
      subject: "Purchase process",
      status: "active",
      source: "admin",
      detail: "Verified admin update.",
      modelVersion: null,
      createdAt: "2026-07-29T08:00:00.000Z",
    },
    {
      eventId: "signal-17",
      eventType: "recommendation_signal",
      actionType: "signal_recorded",
      subject: "recommendation_feedback",
      status: "training_ready",
      source: "system",
      detail: "Complete recommendation context.",
      modelVersion: "plot-ranker-v2",
      createdAt: "2026-07-29T07:00:00.000Z",
    },
    {
      eventId: "ranking-run-20",
      eventType: "ranking_run",
      actionType: "fallback",
      subject: "plot_recommendation",
      status: "fallback",
      source: "system",
      detail: "service_unavailable",
      modelVersion: "rule-based-v1",
      createdAt: "2026-07-29T06:00:00.000Z",
    },
  ],
});

describe("AgentAdminPage learning analytics", () => {
  beforeEach(() => {
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          const days = config?.params?.days ?? 30;
          return Promise.resolve({ data: { data: analytics(days) } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens on the seminar dashboard and renders trusted aggregate metrics", async () => {
    const { container } = render(<AgentAdminPage />);

    expect(
      await screen.findByRole("heading", {
        name: "Tổng quan học tập",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ghi nhớ cá nhân đang dùng")).not.toBeInTheDocument();
    expect(
      screen.getByText("Tri thức dùng chung đã xác minh"),
    ).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getAllByText("Lượt gọi mô hình AI").length).toBeGreaterThan(0);
    expect(screen.getByText("Lượt AI dùng phương án dự phòng")).toBeInTheDocument();
    expect(screen.getAllByText("18.000")[0]).toBeInTheDocument();
    expect(screen.getByText("test-model")).toBeInTheDocument();
    expect(screen.queryByText("Vị trí lô ưu tiên")).not.toBeInTheDocument();
    expect(screen.queryByText("Chủ đề tư vấn ưu tiên")).not.toBeInTheDocument();
    expect(screen.queryByText("Khu vực ưu tiên")).not.toBeInTheDocument();
    expect(screen.queryByText("Dịch vụ quan tâm")).not.toBeInTheDocument();
    expect(screen.queryByText("Mục hệ thống khác")).not.toBeInTheDocument();
    expect(screen.getByText("Lượt truy cập AI")).toBeInTheDocument();
    expect(screen.getAllByText("Truy cập AI")[0]).toBeInTheDocument();
    expect(screen.getByText("Đủ dữ liệu để đánh giá")).toBeInTheDocument();
    expect(screen.getByText(/phạm vi quản trị/i)).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith(
      "/admin/ai-agent/learning-analytics",
      { params: { days: 30 } },
    );
    expect(
      apiMock.get.mock.calls.some(
        ([url]) => url === "/admin/ai-agent/conversations",
      ),
    ).toBe(false);
    expect(
      container.querySelector(".learning-analytics__timeline-body"),
    ).not.toBeNull();
    expect(
      container.querySelector(".learning-analytics__access-line"),
    ).not.toBeNull();
    expect(
      container.querySelector(".learning-analytics__timeline-scroll"),
    ).toBeNull();
  });

  it("reloads only with a bounded seminar reporting option selected by the admin", async () => {
    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");

    fireEvent.click(screen.getByRole("button", { name: "7 ngày" }));

    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        "/admin/ai-agent/learning-analytics",
        { params: { days: 7 } },
      ),
    );
    expect(screen.getByRole("button", { name: "7 ngày" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows only the privacy-safe AI self-learning journal", async () => {
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: { data: analytics(config?.params?.days ?? 30) },
          });
        }
        if (url === "/admin/ai-agent/learning-journal") {
          return Promise.resolve({
            data: {
              data: [
                {
                  learningJournalId: 11,
                  lessonKey: "intent-feedback",
                  title: "Nhận đúng ý định góp ý",
                  summary: "AI từng xem một lời mở đầu góp ý như câu mơ hồ.",
                  preventionRule:
                    "Khi người dùng nói muốn góp ý nhưng chưa nêu nội dung, hãy hỏi họ muốn góp ý điều gì và chỉ xác nhận chuyển quản trị sau khi lưu thành công.",
                  category: "intent",
                  status: "active",
                  autoGenerated: true,
                  timesObserved: 2,
                  reviewStatus: "pending",
                  knowledgeEntryId: null,
                  isPromptActive: false,
                  lastObservedAt: "2026-08-19T04:00:00.000Z",
                  createdAt: "2026-08-19T03:00:00.000Z",
                  updatedAt: "2026-08-19T04:00:00.000Z",
                },
                {
                  learningJournalId: 12,
                  lessonKey: "tone-safe",
                  title: "Giữ bình tĩnh khi khách bực bội",
                  summary: "AI cần ghi nhận cảm xúc trước khi hướng dẫn.",
                  preventionRule:
                    "Xin lỗi ngắn gọn và đưa ra bước tiếp theo cụ thể.",
                  category: "tone",
                  status: "active",
                  autoGenerated: true,
                  timesObserved: 1,
                  reviewStatus: "auto_approved",
                  knowledgeEntryId: 88,
                  evaluatorModel: "openai/gpt-oss-20b@nvidia",
                  evaluationReason:
                    "Đây là bài học giao tiếp an toàn và có thể tái sử dụng.",
                  isPromptActive: true,
                  lastObservedAt: "2026-08-20T04:00:00.000Z",
                  createdAt: "2026-08-20T03:00:00.000Z",
                  updatedAt: "2026-08-20T04:00:00.000Z",
                },
              ],
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Nhật ký AI/i,
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Nhật ký AI tự học" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nhận đúng ý định góp ý")).toBeInTheDocument();
    expect(screen.getByText("Đang được sử dụng")).toBeInTheDocument();
    expect(screen.getByText("AI duyệt")).toBeInTheDocument();
    expect(screen.getByText(/không hiển thị hồ sơ, bộ nhớ cá nhân/i)).toBeInTheDocument();
    const card = screen.getByText("Nhận đúng ý định góp ý").closest("article");
    expect(card).not.toBeNull();
    expect(within(card!).getByRole("button", { name: "Duyệt" })).toBeInTheDocument();
    expect(within(card!).getByRole("button", { name: "Sửa" })).toBeInTheDocument();
    expect(within(card!).getByRole("button", { name: "Xóa bài học" })).toBeInTheDocument();
    fireEvent.click(within(card!).getByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/learning-journal/11/approve",
      ),
    );
    expect(screen.queryByText(/ID người dùng/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Không có email hiển thị/i)).not.toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("/admin/ai-agent/learning-journal", {
      params: { limit: 100 },
    });
  });

  it("loads a quarantined FAQ proposal and sends both admin review actions", async () => {
    const proposal = {
      knowledgeEntryId: 73,
      category: "Dịch vụ chăm sóc mộ",
      title: "Khách có thể yêu cầu dịch vụ chăm sóc mộ từ xa không?",
      content:
        "Khách có thể gửi yêu cầu dịch vụ trên hệ thống và theo dõi trạng thái.",
      knowledgeType: "faq",
      status: "quarantined",
      validationReason: "Customer-provided business knowledge is unverified.",
      sourceRole: "customer",
      createdAt: "2026-07-29T09:00:00.000Z",
    };
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: { data: analytics(config?.params?.days ?? 30) },
          });
        }
        if (url === "/admin/ai-agent/knowledge") {
          return Promise.resolve({ data: { data: [proposal] } });
        }
        if (url === "/admin/ai-agent/feedback") {
          return Promise.reject(new Error("feedback endpoint unavailable"));
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");
    fireEvent.click(
      screen.getByRole("button", { name: "Đề xuất người dùng" }),
    );

    expect(await screen.findByText(proposal.title)).toBeInTheDocument();
    expect(
      screen.getByText(/Các phần còn lại vẫn sử dụng bình thường/i),
    ).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("/admin/ai-agent/knowledge", {
      params: { status: "quarantined" },
    });

    fireEvent.change(screen.getByPlaceholderText("Ghi nguồn hoặc lý do để người kiểm tra sau có thể đối chiếu"), {
      target: { value: "Đã đối chiếu với quy trình dịch vụ hiện hành" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Duyệt" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận" }),
    );
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/knowledge/73/approve",
        {
          reviewNote: "Đã đối chiếu với quy trình dịch vụ hiện hành",
        },
      ),
    );

    await screen.findByPlaceholderText("Ghi nguồn hoặc lý do để người kiểm tra sau có thể đối chiếu");
    fireEvent.click(screen.getByRole("button", { name: /từ chối/i }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/knowledge/73/reject",
        {},
      ),
    );
  });

  it("keeps customer business proposals separate from RAG and sends admin review", async () => {
    const customerProposal = {
      proposalId: 91,
      userId: 7,
      proposalType: "price_negotiation",
      subject: "Đề xuất thương lượng giá lô A-02-005",
      content: "Khách hàng đề xuất mức giá 5.000.000 VNĐ cho lô A-02-005.",
      selectedPlotCode: "A-02-005",
      proposedAmountVnd: 5000000,
      status: "pending",
      sourceMessage: "Lô A-02-005 bán 5 triệu được không?",
      createdAt: "2026-08-18T10:00:00.000Z",
    };
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: { data: analytics(config?.params?.days ?? 30) },
          });
        }
        if (url === "/admin/ai-agent/customer-proposals") {
          return Promise.resolve({ data: { data: [customerProposal] } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");
    fireEvent.click(
      screen.getByRole("button", { name: "Đề xuất người dùng" }),
    );

    expect(await screen.findByText(customerProposal.subject)).toBeInTheDocument();
    expect(screen.getByText("Thương lượng giá")).toBeInTheDocument();
    expect(
      screen.getByText(/quyền quyết định vẫn thuộc quản trị viên/i),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("Ví dụ: chuyển bộ phận kinh doanh xem xét mức giá; ghi nhận cho backlog UI"),
      { target: { value: "Chuyển bộ phận kinh doanh xem xét" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Tiếp nhận" }));
    const modalDialog = await screen.findByRole("dialog");
    fireEvent.click(within(modalDialog).getByRole("button", { name: "Tiếp nhận" }));

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/customer-proposals/91/accept",
        { reviewNote: "Chuyển bộ phận kinh doanh xem xét" },
      ),
    );
  });

  it("sends the backend reviewNote contract when approving feedback", async () => {
    const pendingFeedback = {
      feedbackId: 81,
      feedbackType: "correction",
      correctedContent: "Nội dung đã được kiểm chứng",
      reason: "Câu trả lời cũ chưa chính xác",
      status: "pending",
      createdAt: "2026-08-08T10:00:00.000Z",
    };
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: { data: analytics(config?.params?.days ?? 30) },
          });
        }
        if (url === "/admin/ai-agent/feedback") {
          return Promise.resolve({ data: { data: [pendingFeedback] } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");
    fireEvent.click(
      screen.getByRole("button", { name: "Đề xuất người dùng" }),
    );
    fireEvent.change(await screen.findByPlaceholderText("Ghi kết quả đối chiếu trước khi duyệt hoặc từ chối"), {
      target: { value: "Đã đối chiếu với tài liệu nghiệp vụ" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Duyệt và xác minh" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận" }),
    );

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/feedback/81/approve",
        {
          reviewNote: "Đã đối chiếu với tài liệu nghiệp vụ",
          applyCorrection: true,
        },
      ),
    );
  });

  it("shows the global knowledge inventory with clear retrieval status and filtering", async () => {
    const inventory = [
      {
        knowledgeEntryId: 13,
        category: "ai_customer_communication",
        title: "Giữ bình tĩnh khi khách bực bội",
        content: "Quy tắc giao tiếp đã được AI thẩm định.",
        knowledgeType: "assistant_instruction",
        status: "active",
        sourceType: "ai_learning_journal",
        sourceRole: "system",
        validationEvidence: { autonomousReview: true },
        createdAt: "2026-08-03T10:00:00.000Z",
      },
      {
        knowledgeEntryId: 11,
        category: "Quy trình",
        title: "quy trình mua lô",
        content: "Nội dung đang được sử dụng.",
        knowledgeType: "faq",
        status: "active",
        sourceRole: "admin",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
      {
        knowledgeEntryId: 12,
        category: "Dịch vụ",
        title: "VIP customer priority for best plot without prepayment",
        content: "Nội dung khách hàng gửi.",
        knowledgeType: "business_rule",
        status: "quarantined",
        sourceRole: "customer",
        createdAt: "2026-08-02T10:00:00.000Z",
      },
    ];
    apiMock.get.mockImplementation(
      (
        url: string,
        config?: { params?: { days?: number; status?: string } },
      ) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: { data: analytics(config?.params?.days ?? 30) },
          });
        }
        if (url === "/admin/ai-agent/knowledge") {
          return Promise.resolve({ data: { data: inventory } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<AgentAdminPage />);
    await screen.findByText("Tri thức dùng chung đã xác minh");
    fireEvent.click(screen.getByRole("button", { name: "Kho tri thức" }));

    expect(
      screen.getByRole("table", { name: "Kho tri thức dùng chung" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Đang sử dụng").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Quy trình mua lô")).toBeInTheDocument();
    expect(
      screen.getByText("Nhật ký AI tự học"),
    ).toBeInTheDocument();
    expect(screen.getByText("AI duyệt")).toBeInTheDocument();
    const firstKnowledgeRow = screen
      .getByRole("table", { name: "Kho tri thức dùng chung" })
      .querySelector("tbody tr");
    expect(firstKnowledgeRow).toHaveTextContent(
      "Giữ bình tĩnh khi khách bực bội",
    );
    expect(
      screen.getByText(
        "Ưu tiên khách VIP chọn lô đẹp nhất mà không cần thanh toán trước",
      ),
    ).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("/admin/ai-agent/knowledge", {
      params: { status: "all" },
    });
  });

  it("shows a calm empty state instead of zero-height chart noise", async () => {
    const zeroActivity = analytics(30);
    zeroActivity.timeline = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      memoryUpdates: 0,
      knowledgeUpdates: 0,
      signals: 0,
      recommendations: 0,
      aiAccesses: 0,
    }));
    zeroActivity.runtimeByModel = [];
    zeroActivity.runtime = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackResponses: 0,
      failureRate: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      estimatedCostUsd: 0,
      unpricedCalls: 0,
      unmeteredCalls: 0,
    };
    zeroActivity.runtimeTimeline = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      calls: 0,
      failedCalls: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      estimatedCostUsd: 0,
    }));
    apiMock.get.mockImplementation(
      (url: string, config?: { params?: { days?: number } }) => {
        if (url === "/admin/ai-agent/learning-analytics") {
          return Promise.resolve({
            data: {
              data: {
                ...zeroActivity,
                period: {
                  ...zeroActivity.period,
                  days: config?.params?.days ?? 30,
                },
              },
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    const { container } = render(<AgentAdminPage />);

    expect(
      await screen.findByText(
        "Chưa có hoạt động học tập trong 30 ngày gần nhất",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".learning-analytics__timeline-chart"),
    ).toBeNull();
    expect(
      container.querySelector(".learning-analytics__timeline-scroll"),
    ).toBeNull();
  });
});
