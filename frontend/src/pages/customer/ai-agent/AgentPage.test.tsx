import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentResponse } from "./agent.types";
import AgentPage from "./AgentPage";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  token: null as string | null,
  role: null as string | null,
  user: null as { id: number; name: string; initials: string } | null,
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));

vi.mock("./AgentContextMap", () => ({
  default: ({
    recommendations,
    activeIndex,
  }: {
    recommendations: Array<{ optionId: string }>;
    activeIndex: number;
  }) => (
    <div data-testid="agent-context-map">
      {activeIndex}:{recommendations.map((option) => option.optionId).join(",")}
    </div>
  ),
}));

const response: AgentResponse = {
  sessionId: "auto-map-session",
  messageId: 10,
  assistantMessage: "Mình đã tìm được phương án phù hợp.",
  intent: "recommend_plots",
  requirements: { numberOfPlots: 1 },
  recommendations: [
    {
      optionId: "OPT-001",
      plotIds: [71],
      plotCodes: ["A-01-007"],
      score: 0.9,
      plotCost: 80_000_000,
      serviceCost: 0,
      estimatedTotal: 80_000_000,
      currency: "VND",
      zoneName: "Khu A",
      directions: ["Đông"],
      totalAreaSqm: 4.5,
      isAdjacent: false,
      reasons: ["Phù hợp nhu cầu"],
      tradeOffs: [],
      highlightPlotIds: [71],
    },
  ],
  suggestedServices: [],
  actions: [{ type: "VIEW_ON_MAP", plotIds: [71] }],
  metadata: {
    llmModel: "test-model",
    rankerVersion: "test-ranker",
    knowledgeVersion: "test-knowledge",
    fallbackUsed: false,
    traceId: "test-trace",
  },
};

describe("AgentPage automatic map presentation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.delete.mockReset();
    authState.token = null;
    authState.role = null;
    authState.user = null;
  });

  it("shows the default welcome immediately without calling the LLM", async () => {
    authState.token = "customer-token";
    authState.role = "customer";
    authState.user = { id: 7, name: "An Võ", initials: "AV" };
    apiMock.get.mockResolvedValue({ data: { data: [] } });

    render(
      <MemoryRouter>
        <AgentPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Tìm một nơi an yên, phù hợp với gia đình bạn"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Đang mở cuộc trò chuyện…")).not.toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("opens the contextual map after an AI plot recommendation", async () => {
    apiMock.post.mockResolvedValue({ data: { data: response } });

    render(
      <MemoryRouter>
        <AgentPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Nhắn tin cho trợ lý…"), {
      target: { value: "Giới thiệu một lô đất đang trống" },
    });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));

    await waitFor(() =>
      expect(screen.getByTestId("agent-context-map")).toHaveTextContent(
        "0:OPT-001",
      ),
    );
  });

  it("does not open the map when the response has no valid plot IDs", async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          ...response,
          recommendations: [
            {
              ...response.recommendations[0],
              plotIds: [],
              highlightPlotIds: [],
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Nhắn tin cho trợ lý…"), {
      target: { value: "Có lô nào không?" },
    });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("agent-context-map")).not.toBeInTheDocument();
  });

  it("closes the current map when the conversation moves away from plot advice", async () => {
    apiMock.post
      .mockResolvedValueOnce({ data: { data: response } })
      .mockResolvedValueOnce({
        data: {
          data: {
            ...response,
            messageId: 11,
            intent: "general_question",
            assistantMessage: "Lô này có hướng Nam và diện tích 3 m².",
            recommendations: [],
            actions: [],
          },
        },
      });

    render(
      <MemoryRouter>
        <AgentPage />
      </MemoryRouter>,
    );

    const composer = screen.getByPlaceholderText("Nhắn tin cho trợ lý…");
    fireEvent.change(composer, {
      target: { value: "Giới thiệu một lô đang trống" },
    });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));
    await screen.findByTestId("agent-context-map");

    fireEvent.change(composer, {
      target: { value: "Lô này hướng nào?" },
    });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("agent-context-map")).not.toBeInTheDocument();
  });

  it("updates the map when the agent recommends a different plot", async () => {
    const nextResponse: AgentResponse = {
      ...response,
      messageId: 12,
      recommendations: [
        {
          ...response.recommendations[0],
          optionId: "OPT-NEW",
          plotIds: [82],
          highlightPlotIds: [82],
          plotCodes: ["B-02-002"],
        },
      ],
    };
    apiMock.post
      .mockResolvedValueOnce({ data: { data: response } })
      .mockResolvedValueOnce({ data: { data: nextResponse } });

    render(
      <MemoryRouter>
        <AgentPage />
      </MemoryRouter>,
    );

    const composer = screen.getByPlaceholderText("Nhắn tin cho trợ lý…");
    fireEvent.change(composer, { target: { value: "Giới thiệu một lô" } });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));
    await screen.findByTestId("agent-context-map");

    fireEvent.change(composer, {
      target: { value: "Chuyển sang phương án khác đi" },
    });
    fireEvent.click(screen.getByTitle("Gửi tin nhắn"));

    await waitFor(() =>
      expect(screen.getByTestId("agent-context-map")).toHaveTextContent(
        "0:OPT-NEW",
      ),
    );
  });
});
