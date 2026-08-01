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
    },
    {
      date: "2026-07-29",
      memoryUpdates: 5,
      knowledgeUpdates: 3,
      signals: 3,
      recommendations: 16,
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
    expect(screen.getByText("Memory đang hoạt động")).toBeInTheDocument();
    expect(screen.getByText("Tri thức global đã xác minh")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("Vị trí lô ưu tiên")).toBeInTheDocument();
    expect(screen.getByText("Đủ dữ liệu đánh giá offline")).toBeInTheDocument();
    expect(screen.getByText("PlotRanker đang tắt")).toBeInTheDocument();
    expect(
      screen.getByText(/foundation model không thay đổi/i),
    ).toBeInTheDocument();
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
      container.querySelector(".learning-analytics__timeline-scroll"),
    ).toBeNull();
  });

  it("reloads only with a bounded seminar reporting option selected by the admin", async () => {
    render(<AgentAdminPage />);
    await screen.findByText("Memory đang hoạt động");

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
    await screen.findByText("Memory đang hoạt động");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Nhật ký AI/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "AI Agent đã ghi nhận và thay đổi những gì?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/không phải lịch sử chat của từng người/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Purchase Process")).toBeInTheDocument();
    expect(screen.getByText("Phản hồi đề xuất")).toBeInTheDocument();
    expect(screen.getByText("Dịch vụ ML không khả dụng")).toBeInTheDocument();
    expect(screen.queryByText("Khách hàng")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("[class*='icon']")).toBeNull();
  });

  it("shows a calm empty state instead of zero-height chart noise", async () => {
    const zeroActivity = analytics(30);
    zeroActivity.timeline = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      memoryUpdates: 0,
      knowledgeUpdates: 0,
      signals: 0,
      recommendations: 0,
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
