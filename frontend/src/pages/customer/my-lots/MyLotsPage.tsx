import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";

type ReservationType = "reserve" | "purchase";
type ReservationStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";
type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

type CSSVariables = CSSProperties & Record<`--${string}`, string | number>;

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface Reservation {
  id: number;
  type: ReservationType;
  status: ReservationStatus;
  totalPrice?: number;
  plotCodes?: string[];
  plotCount?: number;
  createdAt?: string;
  reviewedAt?: string | null;
}

interface Appointment {
  id: number;
  reservationRequestId: number;
  scheduledAt: string;
  scheduledEndAt: string;
  location: string;
  assignedStaffName?: string | null;
  status: AppointmentStatus;
  customerStatus: "pending" | "confirmed" | "declined";
  customerSelectedAt?: string | null;
  note?: string | null;
  statusNote?: string | null;
}

interface Contract {
  id: number;
  contractCode: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  contractDate?: string | null;
  customerName?: string;
  plotId?: number;
  plotCode?: string;
  plotCodes?: string[];
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>;
  zoneName?: string;
  deceasedName?: string | null;
}

type ServiceOrderStatus =
  | "submitted"
  | "pending_confirm"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ServiceOrder {
  id: number;
  status: ServiceOrderStatus;
  amount: number;
  requestedDate?: string | null;
  createdAt?: string;
  serviceName: string;
  plotCode?: string | null;
}

const typeLabel: Record<ReservationType, string> = {
  reserve: "Giữ chỗ",
  purchase: "Mua lô",
};

const statusLabel: Record<string, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  scheduled: "Đã hẹn",
  completed: "Hoàn tất",
  no_show: "Vắng mặt",
  active: "Hiệu lực",
  signed: "Đã ký",
  paid: "Đã thanh toán",
  partial: "Thanh toán một phần",
  unpaid: "Chưa thanh toán",
  pending_confirm: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang thực hiện",
};

const statusColor: Record<string, { color: string; bg: string }> = {
  draft: { color: "#9aacb4", bg: "rgba(154, 172, 180, 0.11)" },
  pending: { color: "#e6b95c", bg: "rgba(230, 185, 92, 0.12)" },
  submitted: { color: "#e6b95c", bg: "rgba(230, 185, 92, 0.12)" },
  approved: { color: "#69c7ad", bg: "rgba(105, 199, 173, 0.12)" },
  rejected: { color: "#e88888", bg: "rgba(232, 136, 136, 0.12)" },
  cancelled: { color: "#9aacb4", bg: "rgba(154, 172, 180, 0.11)" },
  scheduled: { color: "#8eb8db", bg: "rgba(142, 184, 219, 0.12)" },
  completed: { color: "#69c7ad", bg: "rgba(105, 199, 173, 0.12)" },
  no_show: { color: "#e88888", bg: "rgba(232, 136, 136, 0.12)" },
  active: { color: "#69c7ad", bg: "rgba(105, 199, 173, 0.12)" },
  signed: { color: "#8eb8db", bg: "rgba(142, 184, 219, 0.12)" },
  paid: { color: "#69c7ad", bg: "rgba(105, 199, 173, 0.12)" },
  partial: { color: "#e6b95c", bg: "rgba(230, 185, 92, 0.12)" },
  unpaid: { color: "#e88888", bg: "rgba(232, 136, 136, 0.12)" },
  pending_confirm: { color: "#e6b95c", bg: "rgba(230, 185, 92, 0.12)" },
  confirmed: { color: "#8eb8db", bg: "rgba(142, 184, 219, 0.12)" },
  in_progress: { color: "#69c7ad", bg: "rgba(105, 199, 173, 0.12)" },
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatAppointmentDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(date);
}

function toVietnamDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

function appointmentTimeBounds(appointment: Appointment) {
  const rangeStart = toVietnamDateTimeInput(appointment.scheduledAt);
  const rangeEnd = toVietnamDateTimeInput(appointment.scheduledEndAt);
  const nextMinute = new Date();
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  const current = toVietnamDateTimeInput(nextMinute.toISOString());

  return {
    min: rangeStart > current ? rangeStart : current,
    max: rangeEnd,
  };
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không tải được dữ liệu. Vui lòng thử lại.";
}

function getPlotCodes(contract: Contract) {
  if (contract.plotCodes?.length) return contract.plotCodes;
  if (contract.plots?.length) return contract.plots.map((plot) => plot.code);
  return [contract.plotCode || "-"];
}

function getZoneNames(contract: Contract) {
  const plotZones = contract.plots
    ?.map((plot) => plot.zoneName)
    .filter((zone): zone is string => Boolean(zone));

  if (plotZones?.length) return [...new Set(plotZones)].join(", ");
  return contract.zoneName || "Chưa cập nhật";
}

function StatusPill({ status }: { status: string }) {
  const meta = statusColor[status] ?? {
    color: "#9aacb4",
    bg: "rgba(154, 172, 180, 0.11)",
  };

  return (
    <span
      className="lots-status-pill"
      style={
        {
          "--status-color": meta.color,
          "--status-bg": meta.bg,
        } as CSSVariables
      }
    >
      {statusLabel[status] ?? status}
    </span>
  );
}

export default function MyLotsPage() {
  const [searchParams] = useSearchParams();
  const targetAppointmentId = Number(searchParams.get("appointment")) || null;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [respondingAppointmentId, setRespondingAppointmentId] = useState<
    number | null
  >(null);
  const [selectedAppointmentTimes, setSelectedAppointmentTimes] = useState<
    Record<number, string>
  >({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const appointmentByRequest = useMemo(() => {
    const latest = new Map<number, Appointment>();
    appointments.forEach((appointment) => {
      if (!latest.has(appointment.reservationRequestId)) {
        latest.set(appointment.reservationRequestId, appointment);
      }
    });
    return latest;
  }, [appointments]);

  const overview = useMemo(() => {
    const pendingRequests = reservations.filter((item) =>
      ["pending", "submitted"].includes(item.status),
    ).length;

    const ownedPlots = contracts
      .filter((item) => ["active", "completed", "signed"].includes(item.status))
      .reduce(
        (total, item) =>
          total + (item.plots?.length ?? item.plotCodes?.length ?? 1),
        0,
      );

    const outstandingBalance = contracts.reduce(
      (total, item) =>
        total +
        Math.max(
          Number(item.totalAmount ?? 0) - Number(item.paidAmount ?? 0),
          0,
        ),
      0,
    );

    const activeServices = serviceOrders.filter((item) =>
      ["submitted", "pending_confirm", "confirmed", "in_progress"].includes(
        item.status,
      ),
    ).length;

    return {
      pendingRequests,
      ownedPlots,
      outstandingBalance,
      activeServices,
    };
  }, [contracts, reservations, serviceOrders]);

  const nextAppointment = useMemo(() => {
    const now = lastUpdated?.getTime() ?? 0;
    return [...appointments]
      .filter(
        (appointment) =>
          appointment.status === "scheduled" &&
          new Date(appointment.scheduledAt).getTime() >= now,
      )
      .sort(
        (first, second) =>
          new Date(first.scheduledAt).getTime() -
          new Date(second.scheduledAt).getTime(),
      )[0];
  }, [appointments, lastUpdated]);

  const attentionItem = useMemo(() => {
    if (nextAppointment) {
      return {
        eyebrow: "Lịch hẹn sắp tới",
        title: `${formatAppointmentDate(nextAppointment.scheduledAt)} – ${formatAppointmentDate(nextAppointment.scheduledEndAt)}`,
        description: nextAppointment.location,
        meta: `Phụ trách: ${nextAppointment.assignedStaffName || "Chưa phân công"}`,
      };
    }

    if (overview.pendingRequests > 0) {
      return {
        eyebrow: "Đang xử lý",
        title: `${overview.pendingRequests} yêu cầu đang chờ duyệt`,
        description:
          "Bạn có thể theo dõi trạng thái và lịch hẹn ngay trong mục yêu cầu bên dưới.",
        meta: "Dữ liệu sẽ tự cập nhật khi hồ sơ được xử lý",
      };
    }

    if (overview.outstandingBalance > 0) {
      return {
        eyebrow: "Thanh toán",
        title: `Còn lại ${money.format(overview.outstandingBalance)}`,
        description:
          "Kiểm tra chi tiết từng hợp đồng để theo dõi số tiền đã thanh toán.",
        meta: "Số liệu được tổng hợp từ các hợp đồng hiện có",
      };
    }

    if (overview.activeServices > 0) {
      return {
        eyebrow: "Dịch vụ đang hoạt động",
        title: `${overview.activeServices} dịch vụ đang được xử lý`,
        description:
          "Trạng thái mới nhất của từng dịch vụ được hiển thị trong danh sách bên dưới.",
        meta: "Theo dõi theo mã dịch vụ",
      };
    }

    return {
      eyebrow: "Tổng quan hồ sơ",
      title: "Hiện không có việc cần xử lý",
      description:
        "Các yêu cầu, hợp đồng và dịch vụ mới sẽ xuất hiện tại đây khi được ghi nhận.",
      meta: "Hồ sơ của bạn đang ở trạng thái ổn định",
    };
  }, [nextAppointment, overview]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [reservationRes, appointmentRes, contractRes, serviceRes] =
        await Promise.all([
          api.get<ApiResponse<Reservation[]>>("/my/reservations"),
          api.get<ApiResponse<Appointment[]>>("/my/appointments"),
          api.get<ApiResponse<Contract[]>>("/my/contracts"),
          api.get<ApiResponse<ServiceOrder[]>>("/my/service-orders"),
        ]);

      setReservations(reservationRes.data.data ?? []);
      setAppointments(appointmentRes.data.data ?? []);
      setContracts(contractRes.data.data ?? []);
      setServiceOrders(serviceRes.data.data ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, []);

  useRealtimeRefresh(
    [
      "reservations",
      "appointments",
      "contracts",
      "ownership",
      "services",
      "transfers",
    ],
    () => loadData(true),
  );

  useEffect(() => {
    if (loading || !targetAppointmentId) return;
    const scrollId = window.setTimeout(() => {
      const target = document.getElementById(
        `appointment-${targetAppointmentId}`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(scrollId);
  }, [appointments.length, loading, targetAppointmentId]);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-lots-reveal]");

    if (!nodes.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -28px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [loading, reservations.length, contracts.length, serviceOrders.length]);

  async function downloadContractPdf(contract: Contract) {
    setDownloadingId(contract.id);

    try {
      const response = await api.get(`/my/contracts/${contract.id}/pdf`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${contract.contractCode || "hop-dong"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  async function respondAppointment(
    appointment: Appointment,
    status: "confirmed" | "declined",
  ) {
    if (
      status === "declined" &&
      !window.confirm("Bạn muốn từ chối khoảng ngày lịch hẹn này?")
    )
      return;
    let selectedAt: string | undefined;
    if (status === "confirmed") {
      const selectedValue = selectedAppointmentTimes[appointment.id];
      const bounds = appointmentTimeBounds(appointment);
      if (
        !selectedValue ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(selectedValue) ||
        selectedValue < bounds.min ||
        selectedValue > bounds.max
      ) {
        setError(
          "Vui lòng chọn ngày và giờ gặp mặt hợp lệ trong khoảng admin đã gửi.",
        );
        return;
      }
      selectedAt = `${selectedValue}:00+07:00`;
    }

    setRespondingAppointmentId(appointment.id);
    setError("");
    try {
      await api.patch(`/my/appointments/${appointment.id}/response`, {
        status,
        selectedAt,
      });
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRespondingAppointmentId(null);
    }
  }

  return (
    <main className="lots-page">
      <style>{pageStyles}</style>
      <NavyStarfield />

      <div className="lots-shell">
        <header className="lots-hero" data-lots-reveal>
          <div className="lots-hero-copy">
            <p className="lots-eyebrow">Khu vực khách hàng</p>
            <h1>Hồ sơ lô đất của tôi</h1>
            <p>
              Quản lý yêu cầu giữ chỗ, lịch hẹn, hợp đồng sở hữu và các dịch vụ
              đã đặt trong cùng một nơi.
            </p>
          </div>

          <div className="lots-sync-status" aria-live="polite">
            <span>
              {lastUpdated
                ? `Tự động đồng bộ lúc ${new Intl.DateTimeFormat("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(lastUpdated)}`
                : "Đang đồng bộ dữ liệu"}
            </span>
          </div>
        </header>

        {error ? (
          <div className="lots-error" role="alert" data-lots-reveal>
            <div>
              <strong>Không thể cập nhật hồ sơ</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void loadData()}>
              Thử lại
            </button>
          </div>
        ) : null}

        <nav
          className="lots-tabs"
          aria-label="Điều hướng hồ sơ"
          data-lots-reveal
        >
          <a href="#overview">Tổng quan</a>
          <a href="#requests">Yêu cầu</a>
          <a href="#contracts">Hợp đồng và lô đất</a>
          <a href="#services">Dịch vụ</a>
        </nav>

        <section id="overview" className="lots-overview" data-lots-reveal>
          <div className="lots-summary-grid">
            <SummaryCard
              label="Yêu cầu chờ duyệt"
              value={overview.pendingRequests}
              note={`${reservations.length} yêu cầu đã gửi`}
              index={0}
            />
            <SummaryCard
              label="Lô đang sở hữu"
              value={overview.ownedPlots}
              note={`${contracts.length} hợp đồng được ghi nhận`}
              index={1}
            />
            <SummaryCard
              label="Dịch vụ đang xử lý"
              value={overview.activeServices}
              note={`${serviceOrders.length} dịch vụ đã đặt`}
              index={2}
            />
            <SummaryCard
              label="Còn phải thanh toán"
              value={money.format(overview.outstandingBalance)}
              note="Tổng hợp từ hợp đồng"
              compact
              index={3}
            />
          </div>

          <aside className="lots-attention-card">
            <div>
              <p>{attentionItem.eyebrow}</p>
              <h2>{attentionItem.title}</h2>
              <span>{attentionItem.description}</span>
            </div>
            <small>{attentionItem.meta}</small>
          </aside>
        </section>

        <section id="requests" className="lots-section" data-lots-reveal>
          <SectionHeader
            eyebrow="Yêu cầu của tôi"
            title="Giữ chỗ và mua lô"
            description="Theo dõi hồ sơ từ lúc gửi yêu cầu đến khi có lịch hẹn ký hợp đồng."
            count={reservations.length}
          />

          {loading ? (
            <LoadingList />
          ) : reservations.length === 0 ? (
            <EmptyState
              title="Chưa có yêu cầu nào"
              description="Yêu cầu giữ chỗ hoặc mua lô mới sẽ được hiển thị tại đây."
            />
          ) : (
            <div className="lots-request-list">
              {reservations.map((request, index) => {
                const appointment = appointmentByRequest.get(request.id);
                const plotText =
                  (request.plotCodes ?? []).join(", ") ||
                  `${request.plotCount ?? 0} lô`;

                return (
                  <article
                    key={request.id}
                    id={
                      appointment ? `appointment-${appointment.id}` : undefined
                    }
                    className={`lots-request-card${appointment?.id === targetAppointmentId ? " is-target-appointment" : ""}`}
                    tabIndex={
                      appointment?.id === targetAppointmentId ? -1 : undefined
                    }
                    data-lots-reveal
                    style={
                      {
                        "--reveal-delay": `${Math.min(index, 6) * 55}ms`,
                      } as CSSVariables
                    }
                  >
                    <div className="lots-request-main">
                      <div className="lots-record-code">
                        <span>Yêu cầu</span>
                        <strong>#{String(request.id).padStart(4, "0")}</strong>
                      </div>

                      <div className="lots-request-content">
                        <div className="lots-card-heading">
                          <div>
                            <h3>{typeLabel[request.type]}</h3>
                            <p>Lô: {plotText}</p>
                          </div>
                          <StatusPill status={request.status} />
                        </div>

                        <div className="lots-info-grid lots-info-grid-three">
                          <Info
                            label="Ngày gửi"
                            value={formatDate(request.createdAt)}
                          />
                          <Info
                            label="Ngày xử lý"
                            value={formatDate(request.reviewedAt)}
                          />
                          <Info
                            label="Giá trị dự kiến"
                            value={money.format(
                              Number(request.totalPrice ?? 0),
                            )}
                            emphasize
                          />
                        </div>
                      </div>
                    </div>

                    {appointment ? (
                      <div className="lots-next-step lots-appointment-card">
                        <section className="lots-appointment-summary">
                          <div className="lots-appointment-kicker">
                            <CalendarDays
                              size={16}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>Lịch hẹn ký hợp đồng</span>
                          </div>
                          <strong className="lots-appointment-range">
                            {formatAppointmentDate(appointment.scheduledAt)} –{" "}
                            {formatAppointmentDate(appointment.scheduledEndAt)}
                          </strong>
                          <div className="lots-appointment-detail">
                            <MapPin
                              size={15}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>{appointment.location}</span>
                          </div>
                          <div className="lots-appointment-detail">
                            <UserRound
                              size={15}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>
                              Phụ trách:{" "}
                              {appointment.assignedStaffName ||
                                "Chưa phân công"}
                            </span>
                          </div>
                          <div
                            className={`lots-appointment-state is-${appointment.customerStatus}`}
                          >
                            {appointment.customerStatus === "pending"
                              ? "Đang chờ bạn chọn lịch"
                              : appointment.customerStatus === "confirmed"
                                ? "Lịch đã được bạn xác nhận"
                                : "Bạn đã từ chối lịch hẹn"}
                          </div>
                        </section>

                        <section className="lots-appointment-booking">
                          <div className="lots-appointment-booking-head">
                            <div>
                              <span>Thời gian gặp mặt</span>
                              <strong>
                                {appointment.customerStatus === "pending"
                                  ? "Chọn ngày và giờ phù hợp"
                                  : "Thông tin lịch của bạn"}
                              </strong>
                            </div>
                            <Clock3
                              size={18}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                          </div>

                          {appointment.customerSelectedAt ? (
                            <p className="lots-selected-time">
                              Thời gian đã chọn:{" "}
                              {formatDate(appointment.customerSelectedAt)}
                            </p>
                          ) : null}

                          {appointment.customerStatus === "pending" ? (
                            <>
                              <label className="lots-appointment-picker">
                                <span>Ngày và giờ</span>
                                <input
                                  type="datetime-local"
                                  step="60"
                                  min={appointmentTimeBounds(appointment).min}
                                  max={appointmentTimeBounds(appointment).max}
                                  value={
                                    selectedAppointmentTimes[appointment.id] ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    setSelectedAppointmentTimes((current) => ({
                                      ...current,
                                      [appointment.id]: event.target.value,
                                    }))
                                  }
                                />
                                <small>
                                  Có thể chọn trong khoảng{" "}
                                  {formatAppointmentDate(
                                    appointment.scheduledAt,
                                  )}{" "}
                                  –{" "}
                                  {formatAppointmentDate(
                                    appointment.scheduledEndAt,
                                  )}
                                  .
                                </small>
                              </label>
                              <div className="lots-appointment-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void respondAppointment(
                                      appointment,
                                      "declined",
                                    )
                                  }
                                  disabled={
                                    respondingAppointmentId === appointment.id
                                  }
                                >
                                  Từ chối lịch
                                </button>
                                <button
                                  type="button"
                                  className="confirm"
                                  onClick={() =>
                                    void respondAppointment(
                                      appointment,
                                      "confirmed",
                                    )
                                  }
                                  disabled={
                                    respondingAppointmentId ===
                                      appointment.id ||
                                    !selectedAppointmentTimes[appointment.id]
                                  }
                                >
                                  Xác nhận lịch hẹn
                                </button>
                              </div>
                            </>
                          ) : null}
                        </section>
                      </div>
                    ) : request.status === "approved" ? (
                      <div className="lots-next-step lots-next-step-muted">
                        <div className="lots-step-marker" aria-hidden="true" />
                        <div className="lots-step-copy">
                          <span>Bước tiếp theo</span>
                          <strong>Đang chờ tạo lịch hẹn</strong>
                          <p>
                            Nhân viên sẽ cập nhật ngày ký hợp đồng cho yêu cầu
                            này.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section id="contracts" className="lots-section" data-lots-reveal>
          <SectionHeader
            eyebrow="Tài sản và giấy tờ"
            title="Hợp đồng và lô đất sở hữu"
            description="Kiểm tra lô đất, khu vực, tình trạng hợp đồng và tiến độ thanh toán."
            count={contracts.length}
          />

          {loading ? (
            <LoadingList columns={2} />
          ) : contracts.length === 0 ? (
            <EmptyState
              title="Chưa có hợp đồng được ghi nhận"
              description="Hợp đồng và giấy xác nhận sở hữu sẽ xuất hiện sau khi hồ sơ được hoàn tất."
            />
          ) : (
            <div className="lots-contract-grid">
              {contracts.map((contract, index) => {
                const totalAmount = Number(contract.totalAmount ?? 0);
                const paidAmount = Number(contract.paidAmount ?? 0);
                const paymentPercent =
                  totalAmount > 0
                    ? Math.min(
                        Math.max((paidAmount / totalAmount) * 100, 0),
                        100,
                      )
                    : 0;

                return (
                  <article
                    key={contract.id}
                    className="lots-contract-card"
                    data-lots-reveal
                    style={
                      {
                        "--reveal-delay": `${Math.min(index, 6) * 55}ms`,
                      } as CSSVariables
                    }
                  >
                    <div className="lots-card-heading">
                      <div>
                        <span className="lots-card-label">Mã hợp đồng</span>
                        <h3>{contract.contractCode}</h3>
                      </div>
                      <StatusPill status={contract.status} />
                    </div>

                    <div className="lots-plot-panel">
                      <div>
                        <span>Lô đất</span>
                        <strong>{getPlotCodes(contract).join(", ")}</strong>
                      </div>
                      <div>
                        <span>Khu vực</span>
                        <strong>{getZoneNames(contract)}</strong>
                      </div>
                      {contract.deceasedName ? (
                        <div>
                          <span>Thông tin an táng</span>
                          <strong>{contract.deceasedName}</strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="lots-payment-block">
                      <div className="lots-payment-heading">
                        <div>
                          <span>Tiến độ thanh toán</span>
                          <strong>{Math.round(paymentPercent)}%</strong>
                        </div>
                        <StatusPill status={contract.paymentStatus} />
                      </div>

                      <div
                        className="lots-progress-track"
                        aria-label={`Đã thanh toán ${Math.round(paymentPercent)}%`}
                      >
                        <span style={{ width: `${paymentPercent}%` }} />
                      </div>

                      <div className="lots-payment-values">
                        <Info
                          label="Đã thanh toán"
                          value={money.format(paidAmount)}
                        />
                        <Info
                          label="Tổng giá trị"
                          value={money.format(totalAmount)}
                          emphasize
                          align="right"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="lots-document-button"
                      onClick={() => void downloadContractPdf(contract)}
                      disabled={downloadingId === contract.id}
                    >
                      <span>
                        {downloadingId === contract.id
                          ? "Đang chuẩn bị tài liệu"
                          : "Tải hợp đồng và giấy xác nhận"}
                      </span>
                      <small>Định dạng PDF</small>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section id="services" className="lots-section" data-lots-reveal>
          <SectionHeader
            eyebrow="Dịch vụ đã đặt"
            title="Chăm sóc và tưởng niệm"
            description="Theo dõi lịch yêu cầu, lô áp dụng, chi phí và trạng thái thực hiện."
            count={serviceOrders.length}
          />

          {loading ? (
            <LoadingList columns={2} />
          ) : serviceOrders.length === 0 ? (
            <EmptyState
              title="Bạn chưa đặt dịch vụ nào"
              description="Các dịch vụ chăm sóc mộ, thay hoa hoặc cúng giỗ sẽ được lưu tại đây."
            />
          ) : (
            <div className="lots-service-grid">
              {serviceOrders.map((order, index) => (
                <article
                  key={order.id}
                  className="lots-service-card"
                  data-lots-reveal
                  style={
                    {
                      "--reveal-delay": `${Math.min(index, 6) * 55}ms`,
                    } as CSSVariables
                  }
                >
                  <div className="lots-service-topline">
                    <span>DV-{String(order.id).padStart(4, "0")}</span>
                    <StatusPill status={order.status} />
                  </div>

                  <h3>{order.serviceName}</h3>
                  <p>
                    {order.plotCode
                      ? `Áp dụng cho lô ${order.plotCode}`
                      : "Chưa gắn với lô cụ thể"}
                  </p>

                  <div className="lots-service-details">
                    <Info
                      label="Ngày yêu cầu"
                      value={formatDate(order.requestedDate ?? order.createdAt)}
                    />
                    <Info
                      label="Chi phí"
                      value={money.format(Number(order.amount ?? 0))}
                      emphasize
                      align="right"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
  compact = false,
  index,
}: {
  label: string;
  value: number | string;
  note: string;
  compact?: boolean;
  index: number;
}) {
  return (
    <article
      className="lots-summary-card"
      data-lots-reveal
      style={
        {
          "--reveal-delay": `${index * 55}ms`,
        } as CSSVariables
      }
    >
      <span>{label}</span>
      <strong className={compact ? "is-compact" : undefined}>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  count,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="lots-section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      <strong>{String(count).padStart(2, "0")}</strong>
    </div>
  );
}

function Info({
  label,
  value,
  emphasize = false,
  align = "left",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={`lots-info ${align === "right" ? "is-right" : ""}`}>
      <span>{label}</span>
      <strong className={emphasize ? "is-emphasized" : undefined}>
        {value}
      </strong>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="lots-empty" data-lots-reveal>
      <div className="lots-empty-line" aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function LoadingList({ columns = 1 }: { columns?: 1 | 2 }) {
  return (
    <div className={columns === 2 ? "lots-loading-grid" : "lots-loading-list"}>
      {[0, 1, 2].map((item) => (
        <div key={item} className="lots-loading-card" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

const pageStyles = `
  .lots-appointment-card {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(330px, 0.95fr);
    gap: 0;
    align-items: stretch;
    margin: 0 18px 18px;
    padding: 0;
    overflow: hidden;
    border: 1px solid rgba(104, 215, 189, 0.16);
    border-radius: 12px;
    background: linear-gradient(160deg, rgba(13, 27, 56, 0.62) 0%, rgba(5, 7, 26, 0.68) 100%);
  }

  .lots-appointment-summary,
  .lots-appointment-booking {
    min-width: 0;
    padding: 22px 24px;
  }

  .lots-appointment-summary {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .lots-appointment-booking {
    border-left: 1px solid rgba(96, 130, 189, 0.11);
    background: rgba(7, 15, 24, 0.48);
  }

  .lots-appointment-kicker,
  .lots-appointment-booking-head {
    display: flex;
    align-items: center;
  }

  .lots-appointment-kicker {
    gap: 8px;
    color: #52bfa6;
  }

  .lots-appointment-kicker span,
  .lots-appointment-booking-head span,
  .lots-appointment-picker > span {
    color: #79918a;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .lots-appointment-range {
    display: block;
    margin-top: 13px;
    color: #c6f4e9;
    font-size: 18px;
    font-weight: 720;
    letter-spacing: -0.01em;
  }

  .lots-appointment-detail {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 11px;
    color: #8ea29c;
    font-size: 12px;
    line-height: 1.5;
  }

  .lots-appointment-detail svg {
    flex: 0 0 auto;
    color: #69867d;
  }

  .lots-appointment-state {
    align-self: flex-start;
    margin-top: 18px;
    padding: 7px 10px;
    border: 1px solid rgba(105, 199, 173, 0.17);
    border-radius: 999px;
    color: #86d6bf;
    background: rgba(105, 199, 173, 0.07);
    font-size: 10px;
    font-weight: 700;
  }

  .lots-appointment-state.is-declined {
    border-color: rgba(190, 111, 111, 0.2);
    color: #d39595;
    background: rgba(190, 111, 111, 0.06);
  }

  .lots-appointment-booking-head {
    justify-content: space-between;
    gap: 18px;
  }

  .lots-appointment-booking-head > div {
    display: grid;
    gap: 6px;
  }

  .lots-appointment-booking-head strong {
    color: #e8f0ed;
    font-size: 14px;
    font-weight: 700;
  }

  .lots-appointment-booking-head svg {
    color: #4aa18c;
  }

  .lots-appointment-picker {
    display: grid;
    gap: 8px;
    margin-top: 18px;
  }

  .lots-appointment-picker input {
    width: 100%;
    min-height: 44px;
    border: 1px solid rgba(105, 199, 173, 0.24);
    border-radius: 9px;
    outline: none;
    background: rgba(255, 255, 255, 0.045);
    color: #f0f7f5;
    padding: 10px 12px;
    font: inherit;
    color-scheme: dark;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .lots-appointment-picker input:hover {
    border-color: rgba(105, 199, 173, 0.42);
    background: rgba(255, 255, 255, 0.06);
  }

  .lots-appointment-picker input:focus {
    border-color: rgba(0, 229, 196, 0.52);
    box-shadow: 0 0 0 3px rgba(0, 229, 196, 0.08);
  }

  .lots-appointment-picker small {
    color: #758b84;
    font-size: 11px;
    line-height: 1.5;
  }

  .lots-selected-time {
    margin: 17px 0 0;
    padding: 10px 12px;
    border: 1px solid rgba(105, 199, 173, 0.14);
    border-radius: 8px;
    color: #8bd8c2;
    background: rgba(105, 199, 173, 0.045);
    font-size: 12px;
    font-weight: 650;
  }

  .lots-appointment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 16px;
  }

  .lots-appointment-actions button {
    min-height: 39px;
    border: 1px solid rgba(96, 130, 189, 0.17);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
    color: #bac8c4;
    padding: 8px 13px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease;
  }

  .lots-appointment-actions button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(96, 130, 189, 0.32);
    color: #eef5f2;
    background: rgba(255, 255, 255, 0.06);
  }

  .lots-appointment-actions button.confirm {
    border-color: rgba(0, 178, 153, 0.5);
    background: #008b78;
    color: #fff;
  }

  .lots-appointment-actions button.confirm:hover:not(:disabled) {
    border-color: rgba(0, 229, 196, 0.7);
    background: #009c87;
  }

  .lots-appointment-actions button:disabled {
    opacity: 0.46;
    cursor: not-allowed;
  }

  .lots-page {
    min-height: calc(100vh - 80px);
    padding: 44px 20px 88px;
    color: #dce9e5;
    background:
      linear-gradient(180deg, rgba(7, 14, 22, 0.2), rgba(4, 8, 14, 0) 280px),
      #05090f;
    font-family: "Be Vietnam Pro", sans-serif;
  }

  .lots-page *,
  .lots-page *::before,
  .lots-page *::after {
    box-sizing: border-box;
  }

  .lots-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  .lots-hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    padding: 0 0 30px;
    border-bottom: 1px solid rgba(96, 130, 189, 0.14);
  }

  .lots-hero-copy {
    max-width: 760px;
  }

  .lots-eyebrow,
  .lots-section-header p,
  .lots-attention-card p {
    margin: 0 0 10px;
    color: #5cd2b6;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .lots-hero h1 {
    margin: 0;
    color: #f2f7f5;
    font-family: "Playfair Display", serif;
    font-size: clamp(36px, 5vw, 58px);
    font-weight: 600;
    letter-spacing: -0.035em;
    line-height: 1.06;
  }

  .lots-hero-copy > p:last-child {
    max-width: 700px;
    margin: 18px 0 0;
    color: #8da39d;
    font-size: 15px;
    line-height: 1.75;
  }

  .lots-sync-status {
    display: flex;
    min-width: 192px;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  .lots-sync-status > span {
    color: #6f8580;
    font-size: 12px;
  }

  .lots-error button,
  .lots-document-button {
    font: inherit;
  }

  .lots-document-button:disabled {
    opacity: 0.58;
    cursor: wait;
  }

  .lots-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-top: 20px;
    padding: 15px 16px;
    border: 1px solid rgba(213, 113, 113, 0.28);
    border-radius: 10px;
    background: rgba(116, 39, 39, 0.12);
  }

  .lots-error > div {
    display: grid;
    gap: 4px;
  }

  .lots-error strong {
    color: #f1b5b5;
    font-size: 13px;
  }

  .lots-error span {
    color: #b58d8d;
    font-size: 12px;
  }

  .lots-error button {
    padding: 8px 12px;
    border: 1px solid rgba(232, 136, 136, 0.3);
    border-radius: 8px;
    color: #efb6b6;
    background: transparent;
    cursor: pointer;
  }

  .lots-tabs {
    display: flex;
    gap: 6px;
    margin: 22px 0 24px;
    padding: 6px;
    overflow-x: auto;
    border: 1px solid rgba(96, 130, 189, 0.12);
    border-radius: 11px;
    background: rgba(11, 18, 27, 0.76);
    scrollbar-width: none;
  }

  .lots-tabs::-webkit-scrollbar {
    display: none;
  }

  .lots-tabs a {
    flex: 1 0 auto;
    padding: 10px 14px;
    border-radius: 7px;
    color: #829791;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    transition:
      color 180ms ease,
      background-color 180ms ease;
  }

  .lots-tabs a:first-child {
    color: #dce9e5;
    background: rgba(125, 164, 152, 0.1);
  }

  .lots-tabs a:hover {
    color: #e7efed;
    background: rgba(125, 164, 152, 0.08);
  }

  .lots-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.72fr);
    gap: 14px;
    scroll-margin-top: 28px;
  }

  .lots-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .lots-summary-card,
  .lots-attention-card,
  .lots-request-card,
  .lots-contract-card,
  .lots-service-card,
  .lots-empty,
  .lots-loading-card {
    border: 1px solid rgba(96, 130, 189, 0.16);
    background: linear-gradient(160deg, rgba(13, 27, 56, 0.6) 0%, rgba(5, 7, 26, 0.66) 100%);
  }

  .lots-summary-card {
    min-height: 140px;
    padding: 20px;
    border-radius: 11px;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      background-color 200ms ease;
  }

  .lots-summary-card:hover {
    transform: translateY(-2px);
    border-color: rgba(96, 130, 189, 0.3);
    background: linear-gradient(160deg, rgba(18, 34, 68, 0.66) 0%, rgba(7, 10, 30, 0.72) 100%);
  }

  .lots-summary-card > span {
    display: block;
    color: #78908a;
    font-size: 12px;
    font-weight: 600;
  }

  .lots-summary-card > strong {
    display: block;
    margin: 15px 0 8px;
    color: #73f9da;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .lots-summary-card > strong.is-compact {
    font-size: clamp(19px, 2.5vw, 27px);
    line-height: 1.18;
  }

  .lots-summary-card > small {
    color: #647a74;
    font-size: 11px;
  }

  .lots-attention-card {
    display: flex;
    min-height: 294px;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px;
    overflow: hidden;
    border-color: rgba(92, 210, 182, 0.22);
    border-radius: 11px;
    background:
      linear-gradient(145deg, rgba(92, 210, 182, 0.08), transparent 58%),
      linear-gradient(160deg, rgba(13, 27, 56, 0.6) 0%, rgba(5, 7, 26, 0.66) 100%);
  }

  .lots-attention-card h2 {
    max-width: 320px;
    margin: 0 0 14px;
    color: #dff2ee;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    font-size: clamp(24px, 3vw, 32px);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.18;
  }

  .lots-attention-card span {
    display: block;
    color: #8d9994;
    font-size: 13px;
    line-height: 1.65;
  }

  .lots-attention-card small {
    padding-top: 18px;
    border-top: 1px solid rgba(92, 210, 182, 0.14);
    color: #5e897f;
    font-size: 11px;
    line-height: 1.5;
  }

  .lots-section {
    margin-top: 56px;
    scroll-margin-top: 28px;
  }

  .lots-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 28px;
    margin-bottom: 18px;
  }

  .lots-section-header > div {
    max-width: 760px;
  }

  .lots-section-header h2 {
    margin: 0;
    color: #edf4f2;
    font-family: "Playfair Display", serif;
    font-size: clamp(25px, 3.5vw, 34px);
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .lots-section-header span {
    display: block;
    margin-top: 9px;
    color: #788d87;
    font-size: 13px;
    line-height: 1.6;
  }

  .lots-section-header > strong {
    color: rgba(92, 210, 182, 0.34);
    font-family: "Playfair Display", serif;
    font-size: 44px;
    font-weight: 500;
    line-height: 0.9;
  }

  .lots-status-pill {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: 999px;
    color: var(--status-color);
    background: var(--status-bg);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .lots-status-pill::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    content: "";
  }

  .lots-request-list,
  .lots-loading-list {
    display: grid;
    gap: 18px;
  }

  .lots-request-card {
    border-radius: 11px;
    overflow: hidden;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      background-color 200ms ease;
  }

  .lots-request-card.is-target-appointment {
    border-color: rgba(0, 229, 196, 0.72);
    box-shadow: 0 0 0 2px rgba(0, 229, 196, 0.16), 0 16px 42px rgba(0, 229, 196, 0.12);
  }

  .lots-request-card:hover,
  .lots-contract-card:hover,
  .lots-service-card:hover {
    transform: translateY(-2px);
    border-color: rgba(96, 130, 189, 0.3);
    background: linear-gradient(160deg, rgba(18, 34, 68, 0.66) 0%, rgba(7, 10, 30, 0.72) 100%);
  }

  .lots-request-main {
    display: grid;
    grid-template-columns: 118px minmax(0, 1fr);
  }

  .lots-record-code {
    display: flex;
    min-height: 154px;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px;
    border-right: 1px solid rgba(96, 130, 189, 0.1);
    background: rgba(14, 24, 34, 0.52);
  }

  .lots-record-code span,
  .lots-card-label,
  .lots-plot-panel span,
  .lots-info span,
  .lots-step-copy > span,
  .lots-step-meta span,
  .lots-payment-heading span,
  .lots-service-topline > span {
    color: #718680;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .lots-record-code strong {
    color: #88dbc8;
    font-size: 17px;
    font-weight: 700;
  }

  .lots-request-content {
    padding: 20px 22px;
  }

  .lots-card-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .lots-card-heading h3,
  .lots-service-card h3 {
    margin: 0;
    color: #e8f0ed;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.35;
  }

  .lots-card-heading p,
  .lots-service-card > p {
    margin: 7px 0 0;
    color: #788d87;
    font-size: 12px;
    line-height: 1.55;
  }

  .lots-info-grid {
    display: grid;
    gap: 18px;
    margin-top: 24px;
  }

  .lots-info-grid-three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lots-info {
    min-width: 0;
  }

  .lots-info.is-right {
    text-align: right;
  }

  .lots-info strong {
    display: block;
    margin-top: 6px;
    overflow-wrap: anywhere;
    color: #cedbd7;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.45;
  }

  .lots-info strong.is-emphasized {
    color: #71eccf;
  }

  .lots-next-step:not(.lots-appointment-card) {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    margin: 0 18px 18px;
    padding: 16px 18px;
    border: 1px solid rgba(96, 130, 189, 0.1);
    border-radius: 10px;
    background: rgba(125, 164, 152, 0.035);
  }

  .lots-next-step-muted {
    border-color: rgba(96, 130, 189, 0.11);
    background: rgba(125, 164, 152, 0.035);
  }

  .lots-step-marker {
    width: 8px;
    height: 8px;
    border: 2px solid #68d7bd;
    border-radius: 50%;
    box-shadow: 0 0 0 5px rgba(104, 215, 189, 0.08);
  }

  .lots-step-copy,
  .lots-step-meta {
    display: grid;
    gap: 4px;
  }

  .lots-step-copy strong,
  .lots-step-meta strong {
    color: #bfeae0;
    font-size: 13px;
  }

  .lots-step-copy p {
    margin: 0;
    color: #7f8e89;
    font-size: 11px;
    line-height: 1.45;
  }

  .lots-step-meta {
    padding-left: 18px;
    border-left: 1px solid rgba(92, 210, 182, 0.14);
  }

  .lots-contract-grid,
  .lots-service-grid,
  .lots-loading-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .lots-contract-card,
  .lots-service-card {
    border-radius: 11px;
    padding: 22px;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      background-color 200ms ease;
  }

  .lots-card-label {
    display: block;
    margin-bottom: 7px;
  }

  .lots-plot-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
    margin: 22px 0;
    padding: 16px;
    border: 1px solid rgba(96, 130, 189, 0.09);
    border-radius: 9px;
    background: rgba(16, 26, 36, 0.54);
  }

  .lots-plot-panel > div:last-child:nth-child(3) {
    grid-column: 1 / -1;
    padding-top: 14px;
    border-top: 1px solid rgba(96, 130, 189, 0.08);
  }

  .lots-plot-panel strong {
    display: block;
    margin-top: 6px;
    color: #d5e0dc;
    font-size: 13px;
    line-height: 1.45;
  }

  .lots-payment-block {
    padding-top: 2px;
  }

  .lots-payment-heading,
  .lots-payment-values,
  .lots-service-details,
  .lots-service-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .lots-payment-heading > div {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }

  .lots-payment-heading strong {
    color: #6be7ca;
    font-size: 14px;
  }

  .lots-progress-track {
    height: 5px;
    margin: 15px 0;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(145, 169, 162, 0.1);
  }

  .lots-progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #5fcfb5;
    transition: width 500ms ease;
  }

  .lots-payment-values .lots-info,
  .lots-service-details .lots-info {
    flex: 1;
  }

  .lots-document-button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 22px;
    padding: 13px 14px;
    border: 1px solid rgba(92, 210, 182, 0.24);
    border-radius: 9px;
    color: #97edd9;
    background: rgba(92, 210, 182, 0.055);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 180ms ease,
      background-color 180ms ease;
  }

  .lots-document-button:hover:not(:disabled) {
    border-color: rgba(92, 210, 182, 0.46);
    background: rgba(92, 210, 182, 0.09);
  }

  .lots-document-button span {
    font-size: 12px;
    font-weight: 700;
  }

  .lots-document-button small {
    color: #5b9285;
    font-size: 10px;
    white-space: nowrap;
  }

  .lots-service-card {
    min-height: 208px;
  }

  .lots-service-card h3 {
    margin-top: 26px;
  }

  .lots-service-card > p {
    min-height: 38px;
  }

  .lots-service-details {
    margin-top: 26px;
    padding-top: 17px;
    border-top: 1px solid rgba(96, 130, 189, 0.1);
  }

  .lots-empty {
    display: grid;
    justify-items: center;
    min-height: 190px;
    place-content: center;
    padding: 32px;
    border-radius: 11px;
    text-align: center;
  }

  .lots-empty-line {
    width: 44px;
    height: 1px;
    margin-bottom: 18px;
    background: #52bfa6;
  }

  .lots-empty strong {
    color: #dce7e3;
    font-size: 15px;
  }

  .lots-empty span {
    max-width: 480px;
    margin-top: 8px;
    color: #718680;
    font-size: 12px;
    line-height: 1.6;
  }

  .lots-loading-card {
    min-height: 160px;
    padding: 22px;
    border-radius: 11px;
  }

  .lots-loading-card span {
    display: block;
    height: 12px;
    margin-bottom: 16px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      rgba(132, 157, 149, 0.06),
      rgba(132, 157, 149, 0.14),
      rgba(132, 157, 149, 0.06)
    );
    background-size: 220% 100%;
    animation: lots-shimmer 1.4s ease-in-out infinite;
  }

  .lots-loading-card span:nth-child(1) {
    width: 38%;
  }

  .lots-loading-card span:nth-child(2) {
    width: 72%;
  }

  .lots-loading-card span:nth-child(3) {
    width: 54%;
  }

  [data-lots-reveal] {
    opacity: 0;
    transform: translateY(13px);
    transition:
      opacity 560ms cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0ms),
      transform 560ms cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0ms);
  }

  [data-lots-reveal].is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes lots-shimmer {
    from {
      background-position: 120% 0;
    }
    to {
      background-position: -120% 0;
    }
  }

  @media (max-width: 920px) {
    .lots-overview {
      grid-template-columns: 1fr;
    }

    .lots-attention-card {
      min-height: 220px;
    }

    .lots-contract-grid,
    .lots-service-grid,
    .lots-loading-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .lots-page {
      padding: 30px 14px 64px;
    }

    .lots-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .lots-sync-status {
      width: 100%;
      align-items: stretch;
    }

    .lots-sync-status > span {
      text-align: left;
    }

    .lots-tabs {
      margin-top: 18px;
    }

    .lots-summary-grid {
      grid-template-columns: 1fr 1fr;
    }

    .lots-summary-card {
      min-height: 126px;
      padding: 17px;
    }

    .lots-section {
      margin-top: 44px;
    }

    .lots-request-main {
      grid-template-columns: 1fr;
    }

    .lots-record-code {
      min-height: auto;
      flex-direction: row;
      padding: 13px 17px;
      border-right: 0;
      border-bottom: 1px solid rgba(96, 130, 189, 0.1);
    }

    .lots-request-content,
    .lots-contract-card,
    .lots-service-card {
      padding: 18px;
    }

    .lots-info-grid-three {
      grid-template-columns: 1fr 1fr;
    }

    .lots-info-grid-three .lots-info:last-child {
      grid-column: 1 / -1;
    }

    .lots-next-step {
      grid-template-columns: 16px minmax(0, 1fr);
    }

    .lots-step-meta {
      grid-column: 2;
      padding: 12px 0 0;
      border-top: 1px solid rgba(92, 210, 182, 0.12);
      border-left: 0;
    }
  }

  @media (max-width: 500px) {
    .lots-summary-grid {
      grid-template-columns: 1fr;
    }

    .lots-summary-card {
      min-height: 116px;
    }

    .lots-section-header {
      align-items: flex-start;
    }

    .lots-section-header > strong {
      font-size: 34px;
    }

    .lots-card-heading,
    .lots-payment-heading,
    .lots-payment-values,
    .lots-service-details {
      align-items: flex-start;
    }

    .lots-card-heading {
      flex-direction: column;
    }

    .lots-plot-panel {
      grid-template-columns: 1fr;
    }

    .lots-plot-panel > div + div {
      padding-top: 12px;
      border-top: 1px solid rgba(96, 130, 189, 0.08);
    }

    .lots-plot-panel > div:last-child:nth-child(3) {
      grid-column: auto;
    }

    .lots-payment-values,
    .lots-service-details {
      align-items: stretch;
      flex-direction: column;
    }

    .lots-info.is-right {
      text-align: left;
    }

    .lots-document-button {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lots-page *,
    .lots-page *::before,
    .lots-page *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }

    [data-lots-reveal] {
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 900px) {
    .lots-appointment-card {
      grid-template-columns: 1fr;
    }

    .lots-appointment-booking {
      border-top: 1px solid rgba(96, 130, 189, 0.11);
      border-left: 0;
    }
  }

  @media (max-width: 620px) {
    .lots-appointment-card,
    .lots-next-step:not(.lots-appointment-card) {
      margin-right: 12px;
      margin-left: 12px;
    }

    .lots-appointment-summary,
    .lots-appointment-booking {
      padding: 18px;
    }

    .lots-appointment-actions {
      flex-direction: column-reverse;
    }

    .lots-appointment-actions button {
      width: 100%;
    }
  }
`;
