import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentAdminPage from "./AgentAdminPage";
import type { LearningAnalytics } from "./LearningAnalyticsPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
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
  },
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
    expect(screen.getByText("Ghi nhớ cá nhân đang dùng")).toBeInTheDocument();
    expect(
      screen.getByText("Tri thức dùng chung đã xác minh"),
    ).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("Vị trí lô ưu tiên")).toBeInTheDocument();
    expect(screen.getByText("Chủ đề tư vấn ưu tiên")).toBeInTheDocument();
    expect(screen.getByText("Khu vực ưu tiên")).toBeInTheDocument();
    expect(screen.getByText("Dịch vụ quan tâm")).toBeInTheDocument();
    expect(screen.queryByText("Mục hệ thống khác")).not.toBeInTheDocument();
    expect(screen.getByText("Lượt truy cập AI")).toBeInTheDocument();
    expect(screen.getAllByText("Truy cập AI")[0]).toBeInTheDocument();
    expect(screen.getByText("Đủ dữ liệu để đánh giá")).toBeInTheDocument();
    expect(screen.getByText("Bộ xếp hạng AI đang tắt")).toBeInTheDocument();
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
    await screen.findByText("Ghi nhớ cá nhân đang dùng");

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

  it("shows a server-wide learning journal instead of personal chat history", async () => {
    const { container } = render(<AgentAdminPage />);
    await screen.findByText("Ghi nhớ cá nhân đang dùng");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Nhật ký AI/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Trợ lý AI đã ghi nhận và thay đổi những gì?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/không phải lịch sử trò chuyện của từng người/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Quy trình mua lô")).toBeInTheDocument();
    expect(
      screen.getByText("Nội dung đã được quản trị viên xác minh."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ngữ cảnh đề xuất đã đầy đủ.")).toBeInTheDocument();
    expect(screen.getByText("Phản hồi đề xuất")).toBeInTheDocument();
    expect(
      screen.getByText("Dịch vụ xếp hạng AI không khả dụng"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Khách hàng")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("[class*='icon']")).toBeNull();
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
    await screen.findByText("Ghi nhớ cá nhân đang dùng");
    fireEvent.click(
      screen.getByRole("button", { name: "Kiểm duyệt tri thức" }),
    );

    expect(await screen.findByText(proposal.title)).toBeInTheDocument();
    expect(
      screen.getByText(/Các phần còn lại vẫn sử dụng bình thường/i),
    ).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("/admin/ai-agent/knowledge", {
      params: { status: "quarantined" },
    });

    fireEvent.change(screen.getByLabelText("Căn cứ kiểm duyệt"), {
      target: { value: "Đã đối chiếu với quy trình dịch vụ hiện hành" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/knowledge/73/approve",
        {
          reviewNote: "Đã đối chiếu với quy trình dịch vụ hiện hành",
        },
      ),
    );

    await screen.findByLabelText("Căn cứ kiểm duyệt");
    fireEvent.change(screen.getByLabelText("Căn cứ kiểm duyệt"), {
      target: { value: "Nguồn cung cấp chưa đủ căn cứ xác minh" },
    });
    fireEvent.click(screen.getByRole("button", { name: /chối/i }));
    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/admin/ai-agent/knowledge/73/reject",
        {
          reviewNote: "Nguồn cung cấp chưa đủ căn cứ xác minh",
        },
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
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AgentAdminPage />);
    await screen.findByText("Ghi nhớ cá nhân đang dùng");
    fireEvent.click(
      screen.getByRole("button", { name: "Kiểm duyệt tri thức" }),
    );
    fireEvent.change(await screen.findByLabelText("Căn cứ xử lý"), {
      target: { value: "Đã đối chiếu với tài liệu nghiệp vụ" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Duyệt và xác minh" }),
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
        if (
          url === "/admin/ai-agent/knowledge" &&
          config?.params?.status === "all"
        ) {
          return Promise.resolve({ data: { data: inventory } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<AgentAdminPage />);
    await screen.findByText("Ghi nhớ cá nhân đang dùng");
    fireEvent.click(screen.getByRole("button", { name: "Kho tri thức" }));

    expect(
      screen.getByRole("table", { name: "Kho tri thức dùng chung" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Đang được trợ lý sử dụng").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Ưu tiên khách VIP chọn lô đẹp nhất mà không cần thanh toán trước",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "VIP customer priority for best plot without prepayment",
      ),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Trạng thái"), {
      target: { value: "active" },
    });
    expect(screen.getByText("Quy trình mua lô")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Ưu tiên khách VIP chọn lô đẹp nhất mà không cần thanh toán trước",
      ),
    ).not.toBeInTheDocument();
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
