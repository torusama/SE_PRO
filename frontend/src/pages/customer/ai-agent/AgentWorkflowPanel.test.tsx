import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentWorkflowPanel from "./AgentWorkflowPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
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
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
  });


  it("shows payment in the right workflow panel and switches to calendar after payment", async () => {
    const requested = futureDate(8);
    const onDirectiveChange = vi.fn();
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Thắp hương",
          plotCode: "A-01-001",
          requestedDate: requested.iso,
          amount: 100_000,
          paymentStatus: "unpaid",
          paymentCode: "VPV00045",
        },
      },
    });
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          id: 45,
          requestedDate: requested.iso,
          amount: 100_000,
          paymentStatus: "awaiting_confirmation",
        },
        uiDirective: {
          type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
          orderId: 45,
          requestedDate: requested.iso,
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "SHOW_INLINE_SERVICE_PAYMENT",
            orderId: 45,
            amount: 100_000,
            paymentStatus: "unpaid",
          }}
          onClose={vi.fn()}
          onDirectiveChange={onDirectiveChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Thắp hương")).toBeInTheDocument());
    expect(screen.getByText("Đơn dịch vụ & thanh toán")).toBeInTheDocument();
    expect(screen.getByText("VPV00045")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tôi đã chuyển khoản" }));

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith("/service-orders/45/pay"),
    );
    expect(onDirectiveChange).toHaveBeenCalledWith({
      type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
      orderId: 45,
      requestedDate: requested.iso,
    });
  });

  it("auto-advances a restored payment panel when payment was already reported", async () => {
    const requested = futureDate(9);
    const onDirectiveChange = vi.fn();
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 46,
          serviceName: "Thay hoa tươi",
          plotCode: "A-01-002",
          requestedDate: requested.iso,
          amount: 250_000,
          paymentStatus: "awaiting_confirmation",
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "SHOW_INLINE_SERVICE_PAYMENT",
            orderId: 46,
            paymentStatus: "unpaid",
          }}
          onClose={vi.fn()}
          onDirectiveChange={onDirectiveChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(onDirectiveChange).toHaveBeenCalledWith({
        type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
        orderId: 46,
        requestedDate: requested.iso,
        scheduledDate: undefined,
      }),
    );
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

  it("lets the customer choose appointment date/time inside the AI panel", async () => {
    const selected = futureDate(14);
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    apiMock.get.mockResolvedValue({ data: { data: [] } });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "OPEN_APPOINTMENT_CALENDAR",
            mode: "collecting",
            appointmentDate: selected.iso,
            topic: "Tham quan lô A-01-001",
          }}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith("/schedule/appointments/me"),
    );
    fireEvent.change(screen.getByLabelText(/Bắt đầu/i), {
      target: { value: "14:30" },
    });
    fireEvent.change(screen.getByLabelText(/Kết thúc/i), {
      target: { value: "15:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục với lịch này" }));

    await waitFor(() =>
      expect(onSendMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          `ngày ${selected.iso}, từ 14:30 đến 15:30`,
        ),
      ),
    );
  });

  it("keeps explicit confirmation inside the appointment review panel", async () => {
    const selected = futureDate(15);
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    apiMock.get.mockResolvedValue({ data: { data: [] } });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "OPEN_APPOINTMENT_CALENDAR",
            mode: "review",
            appointmentDate: selected.iso,
            startTime: "09:00",
            endTime: "10:00",
            topic: "Trao đổi với ban quản lý",
          }}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Xác nhận đặt lịch" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" }));

    await waitFor(() =>
      expect(onSendMessage).toHaveBeenCalledWith("Mình xác nhận đặt lịch này."),
    );
  });
});
