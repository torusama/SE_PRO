import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentWorkflowPanel from "./AgentWorkflowPanel";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));
const realtimeMock = vi.hoisted(() => ({
  refresh: undefined as undefined | (() => void | Promise<void>),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/hooks/useRealtimeRefresh", () => ({
  useRealtimeRefresh: (
    _topics: readonly string[],
    refresh: () => void | Promise<void>,
  ) => {
    realtimeMock.refresh = refresh;
  },
}));

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
    realtimeMock.refresh = undefined;
  });

  it("reuses the service-page payment panel and waits for admin approval", async () => {
    const requested = futureDate(8);
    const onDirectiveChange = vi.fn();
    apiMock.get.mockImplementation(() =>
      Promise.resolve({
        data: {
          data: {
            id: 45,
            serviceName: "Thắp hương",
            plotCode: "A-01-001",
            requestedDate: requested.iso,
            amount: 100_000,
            paymentStatus:
              apiMock.post.mock.calls.length > 0
                ? "awaiting_confirmation"
                : "unpaid",
            paymentCode: "VPV00045",
          },
        },
      }),
    );
    apiMock.post.mockResolvedValue({ data: { success: true } });

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

    await waitFor(() =>
      expect(screen.getByText("Thắp hương")).toBeInTheDocument(),
    );
    expect(screen.getByText("Đơn dịch vụ & thanh toán")).toBeInTheDocument();
    expect(screen.getByText("VPV00045")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tôi đã thanh toán" }));

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith("/service-orders/45/pay"),
    );
    await waitFor(() =>
      expect(screen.getByText(/Đã thanh toán - đang chờ duyệt/)).toBeInTheDocument(),
    );
    expect(onDirectiveChange).not.toHaveBeenCalled();
  });

  it("keeps a restored reported payment waiting for admin approval", async () => {
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
      expect(screen.getByText(/Đã thanh toán - đang chờ duyệt/)).toBeInTheDocument(),
    );
    expect(onDirectiveChange).not.toHaveBeenCalled();
  });

  it("opens the shared read-only service calendar after admin approval", async () => {
    const selected = futureDate(10);
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Chăm sóc mộ định kỳ",
          plotCode: "A-01-001",
          requestedDate: selected.iso,
          amount: 500_000,
          paymentStatus: "paid",
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
      expect(screen.getAllByText("Chăm sóc mộ định kỳ").length).toBeGreaterThan(0),
    );
    expect(screen.getByText("Lịch thực hiện dịch vụ")).toBeInTheDocument();
    expect(screen.getByText("Đã xác nhận")).toBeInTheDocument();
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent(
      String(new Date(`${selected.iso}T00:00:00`).getDate()),
    );
    expect(
      screen.queryByRole("button", { name: /Xác nhận ngày thực hiện/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Dịch vụ và thanh toán")).not.toBeInTheDocument();
  });

  it("tracks several service payments independently and announces each admin approval", async () => {
    const firstDate = futureDate(16);
    const secondDate = futureDate(17);
    const statuses = new Map<number, "unpaid" | "awaiting_confirmation" | "paid">([
      [101, "unpaid"],
      [102, "unpaid"],
    ]);
    const onAssistantNotice = vi.fn();
    const onDirectiveChange = vi.fn();
    apiMock.get.mockImplementation((url: string) => {
      const id = Number(url.split("/").pop());
      return Promise.resolve({
        data: {
          data: {
            id,
            serviceName: id === 101 ? "Dọn dẹp mộ" : "Thắp hương",
            plotCode: "A-01-001",
            requestedDate: id === 101 ? firstDate.iso : secondDate.iso,
            amount: id === 101 ? 200_000 : 100_000,
            paymentStatus: statuses.get(id),
          },
        },
      });
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{
            type: "SHOW_INLINE_SERVICE_PAYMENT",
            orderId: 101,
            orderIds: [101, 102],
            paymentStatus: "unpaid",
          }}
          onClose={vi.fn()}
          onDirectiveChange={onDirectiveChange}
          onAssistantNotice={onAssistantNotice}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dọn dẹp mộ")).toBeInTheDocument();
      expect(screen.getByText("Thắp hương")).toBeInTheDocument();
    });

    statuses.set(101, "awaiting_confirmation");
    await act(async () => {
      await realtimeMock.refresh?.();
    });
    statuses.set(101, "paid");
    await act(async () => {
      await realtimeMock.refresh?.();
    });

    await waitFor(() =>
      expect(onAssistantNotice).toHaveBeenCalledWith(
        expect.stringContaining("#101 – Dọn dẹp mộ"),
      ),
    );
    expect(onDirectiveChange).not.toHaveBeenCalled();
    expect(screen.getAllByText("Thắp hương").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Tôi đã thanh toán" })).toBeInTheDocument();
  });

  it("redirects a legacy calendar directive back to payment while approval is pending", async () => {
    const selected = futureDate(12);
    const onDirectiveChange = vi.fn();
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          id: 45,
          serviceName: "Thắp hương",
          plotCode: "A-01-001",
          amount: 100_000,
          requestedDate: selected.iso,
          paymentStatus: "awaiting_confirmation",
        },
      },
    });

    render(
      <MemoryRouter>
        <AgentWorkflowPanel
          directive={{ type: "OPEN_SERVICE_SCHEDULE_CALENDAR", orderId: 45 }}
          onClose={vi.fn()}
          onDirectiveChange={onDirectiveChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getAllByText("Thắp hương").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(onDirectiveChange).toHaveBeenCalledWith({
        type: "SHOW_INLINE_SERVICE_PAYMENT",
        orderId: 45,
        orderIds: [45],
        amount: 100_000,
        paymentStatus: "awaiting_confirmation",
      }),
    );
    expect(apiMock.patch).not.toHaveBeenCalled();
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
            topic: "Trao đổi hồ sơ lô A-01-001",
            plotCode: "A-01-001",
          }}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith("/schedule/appointments/me"),
    );
    expect(
      screen.getByText("Lô đã được duyệt và do bạn chọn"),
    ).toBeInTheDocument();
    expect(screen.getByText("A-01-001")).toBeInTheDocument();
    expect(screen.queryByText("Chủ đề chính")).not.toBeInTheDocument();
    expect(screen.queryByText("Thông tin chi tiết")).not.toBeInTheDocument();
    expect(screen.getByText("Hẹn xem lô đất A-01-001")).toBeInTheDocument();
    expect(
      document.querySelector(
        ".appointment-booking-panel .appointment-booking-form",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mở trang Lịch hẹn của tôi" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Bắt đầu/i), {
      target: { value: "14:30" },
    });
    fireEvent.change(screen.getByLabelText(/Kết thúc/i), {
      target: { value: "15:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Tiếp tục với lịch này" }),
    );

    await waitFor(() =>
      expect(onSendMessage).toHaveBeenCalledWith(
        `Mình muốn đặt lịch hẹn xem lô A-01-001 vào ngày ${selected.iso}, từ 14:30 đến 15:30.`,
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
            topic: "Hẹn xem lô đất A-01-001",
            plotCode: "A-01-001",
          }}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Xác nhận đặt lịch" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" }));

    await waitFor(() =>
      expect(onSendMessage).toHaveBeenCalledWith("Mình xác nhận đặt lịch này."),
    );
  });
});
