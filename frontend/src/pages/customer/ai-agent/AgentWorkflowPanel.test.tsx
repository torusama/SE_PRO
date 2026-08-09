import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentWorkflowPanel from "./AgentWorkflowPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

describe("AgentWorkflowPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
  });

  it("shows the service date in a calendar together with payment state", async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Chăm sóc mộ định kỳ",
          plotCode: "A-01-001",
          requestedDate: "2026-08-20",
          amount: 500_000,
          paymentStatus: "unpaid",
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{ type: "OPEN_SERVICE_PANEL", orderId: 45 }}
          services={[]}
          busy={false}
          onClose={vi.fn()}
          onStartServiceOrder={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Chăm sóc mộ định kỳ")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tháng 8/2026")).toBeInTheDocument();
    expect(screen.getByText("Chưa thanh toán")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tôi đã thanh toán" })).toBeInTheDocument();
  });

  it("shows suggested services before an order is created", () => {
    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{ type: "OPEN_SERVICE_PANEL" }}
          services={[
            {
              id: 3,
              name: "Dọn dẹp mộ",
              description: "Vệ sinh khu vực phần mộ",
              basePrice: 200_000,
              unit: "lần",
              category: "maintenance",
            },
          ]}
          busy={false}
          onClose={vi.fn()}
          onStartServiceOrder={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Dọn dẹp mộ/ })).toBeInTheDocument();
    expect(screen.getByText("200.000 VND")).toBeInTheDocument();
  });
});
