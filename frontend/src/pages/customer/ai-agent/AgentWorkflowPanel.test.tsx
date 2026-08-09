import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentWorkflowPanel from "./AgentWorkflowPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

function futureDate(daysAhead: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return {
    iso: `${year}-${month}-${day}`,
    accessibleName: `Chọn ngày ${date.getDate()}/${date.getMonth() + 1}/${year}`,
  };
}

describe("AgentWorkflowPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.patch.mockReset();
  });

  it("opens the service scheduling calendar only after the payment step", async () => {
    const selected = futureDate(10);
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Chăm sóc mộ định kỳ",
          plotCode: "A-01-001",
          requestedDate: selected.iso,
          amount: 500_000,
          paymentStatus: "awaiting_confirmation",
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
            orderId: 45,
            requestedDate: selected.iso,
          }}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Chăm sóc mộ định kỳ")).toBeInTheDocument(),
    );
    expect(screen.getByText("Lịch thực hiện dịch vụ")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi nhận")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: selected.accessibleName })).toHaveClass("is-selected");
    expect(screen.queryByText("Dịch vụ và thanh toán")).not.toBeInTheDocument();
  });

  it("lets the customer select and save the requested service date", async () => {
    const selected = futureDate(12);
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Thắp hương",
          plotCode: "A-01-001",
          amount: 100_000,
          paymentStatus: "awaiting_confirmation",
        },
      },
    });
    apiMock.patch.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Thắp hương",
          plotCode: "A-01-001",
          requestedDate: selected.iso,
          amount: 100_000,
          paymentStatus: "awaiting_confirmation",
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{ type: "OPEN_SERVICE_SCHEDULE_CALENDAR", orderId: 45 }}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Thắp hương")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: selected.accessibleName }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ngày thực hiện" }));

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith(
        "/service-orders/45/requested-date",
        { requestedDate: selected.iso },
      ),
    );
    expect(screen.getByRole("button", { name: selected.accessibleName })).toHaveClass("is-selected");
  });
});
