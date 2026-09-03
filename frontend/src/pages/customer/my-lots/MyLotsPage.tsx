import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";

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
  type?: string;
  status: ReservationStatus;
  totalPrice?: number;
  plotCodes?: string[];
  plotCount?: number;
  createdAt?: string;
  reviewedAt?: string | null;
  canCancel?: boolean;
  cancellationMode?: "immediate" | "admin_review" | null;
  cancellationId?: number | null;
  cancellationStatus?: "pending" | "approved" | "rejected" | null;
  cancellationIsImmediate?: boolean | null;
  cancellation?: {
    id: number;
    status: "pending" | "approved" | "rejected";
    reason: string;
    isImmediate: boolean;
    adminNote?: string | null;
    requestedAt: string;
    reviewedAt?: string | null;
  } | null;
}

interface CancelReservationResult {
  resolution: "immediate" | "admin_review";
}

interface TransferRequestAppointment {
  id: number;
  rangeStart: string;
  rangeEnd: string;
  location: string;
  status: string;
  customerSelectedDate?: string | null;
  customerSelectedTime?: string | null;
  customerSelectedAt?: string | null;
  customerStatus: "pending" | "confirmed" | "declined";
  note?: string | null;
}

interface TransferRequestItem {
  id: number;
  transferType: "sale" | "inheritance" | "gift" | string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "completed"
    | string;
  recipientName: string;
  recipientIdCard?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAddress?: string;
  recipientRelationship?: string;
  transactionAmount?: number;
  paymentMethod?: string;
  agreementNote?: string;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  plotCodes?: string[];
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>;
  appointment?: TransferRequestAppointment | null;
}

const TRANSFER_TYPE_MAP: Record<string, string> = {
  sale: "Chuyển nhượng (Mua bán)",
  inheritance: "Thừa kế",
  gift: "Tặng cho",
};

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

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return DATE_TIME_FORMATTER.format(date);
}

function formatAppointmentDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return DATE_FORMATTER.format(date);
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKeyLabel(value: string) {
  return DATE_FORMATTER.format(parseDateKey(value));
}

function AppointmentDateTimePicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = value?.slice(0, 10) || "";
  const selectedTime = value?.slice(11, 16) || min.slice(11, 16) || "09:00";
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = parseDateKey(selectedDate || min.slice(0, 10));
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    const next = parseDateKey(selectedDate || min.slice(0, 10));
    setCalendarMonth((current) => {
      if (
        current.getFullYear() === next.getFullYear() &&
        current.getMonth() === next.getMonth()
      ) {
        return current;
      }
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  }, [selectedDate]);

  // Lịch được render qua portal + position:fixed để không bị khung cha
  // (overflow:hidden) cắt mất, tương tự cách làm ở trang Lịch rảnh.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 24);
    const gap = 9;
    const estimatedHeight = 380;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const placeAbove =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight + gap;
    const top = placeAbove
      ? Math.max(12, rect.top - estimatedHeight - gap)
      : rect.bottom + gap;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    setPopoverStyle({ position: "fixed", top, left, width, zIndex: 100000 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const minDate = min.slice(0, 10);
  const maxDate = max.slice(0, 10);
  const minTime = min.slice(11, 16);
  const maxTime = max.slice(11, 16);

  const firstDay = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  );
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarCells = Array.from(
    { length: Math.ceil((mondayIndex + daysInMonth) / 7) * 7 },
    (_, index) => {
      const dayNumber = index - mondayIndex + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        dayNumber,
      );
    },
  );

  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);

  function isDateDisabled(date: Date) {
    const key = formatDateKey(date);
    return key < minDate || key > maxDate;
  }

  function chooseDate(date: Date) {
    const nextDate = formatDateKey(date);
    if (isDateDisabled(date)) return;

    const lowerBound = nextDate === minDate ? minTime : "00:00";
    const upperBound = nextDate === maxDate ? maxTime : "23:59";
    let nextTime = selectedTime;
    if (nextTime < lowerBound) nextTime = lowerBound;
    if (nextTime > upperBound) nextTime = upperBound;

    onChange(`${nextDate}T${nextTime}`);
    setOpen(false);
  }

  function chooseTime(nextTime: string) {
    if (!selectedDate) return;
    const lowerBound = selectedDate === minDate ? minTime : "00:00";
    const upperBound = selectedDate === maxDate ? maxTime : "23:59";
    const safeTime =
      nextTime < lowerBound
        ? lowerBound
        : nextTime > upperBound
          ? upperBound
          : nextTime;
    onChange(`${selectedDate}T${safeTime}`);
  }

  function moveMonth(delta: number) {
    const next = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + delta,
      1,
    );
    const minMonth = new Date(
      Number(minDate.slice(0, 4)),
      Number(minDate.slice(5, 7)) - 1,
      1,
    );
    const maxMonth = new Date(
      Number(maxDate.slice(0, 4)),
      Number(maxDate.slice(5, 7)) - 1,
      1,
    );
    if (next < minMonth || next > maxMonth) return;
    setCalendarMonth(next);
  }

  const calendarPopover = open
    ? createPortal(
        <div
          ref={popoverRef}
          className="lots-calendar-popover"
          style={popoverStyle}
          role="dialog"
          aria-label="Chọn ngày gặp mặt"
        >
          <div className="lots-calendar-head">
            <strong>{monthLabel}</strong>
            <div>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Tháng trước"
                disabled={
                  calendarMonth.getTime() <=
                  new Date(
                    Number(minDate.slice(0, 4)),
                    Number(minDate.slice(5, 7)) - 1,
                    1,
                  ).getTime()
                }
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Tháng sau"
                disabled={
                  calendarMonth.getTime() >=
                  new Date(
                    Number(maxDate.slice(0, 4)),
                    Number(maxDate.slice(5, 7)) - 1,
                    1,
                  ).getTime()
                }
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div className="lots-calendar-weekdays">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="lots-calendar-grid">
            {calendarCells.map((date, index) =>
              date ? (
                <button
                  key={formatDateKey(date)}
                  type="button"
                  className={`${formatDateKey(date) === selectedDate ? "is-selected " : ""}${formatDateKey(date) === minDate || formatDateKey(date) === maxDate ? "is-bound " : ""}`.trim()}
                  disabled={isDateDisabled(date)}
                  onClick={() => chooseDate(date)}
                >
                  {date.getDate()}
                </button>
              ) : (
                <span key={`empty-${index}`} aria-hidden="true" />
              ),
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="lots-datetime-picker">
      <div className="lots-datetime-fields">
        <div className="lots-datetime-field-wrap">
          <span>Ngày gặp mặt</span>
          <button
            ref={triggerRef}
            type="button"
            className={`lots-date-trigger${open ? " is-open" : ""}`}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
            <strong>
              {selectedDate
                ? formatDateKeyLabel(selectedDate)
                : "Chọn ngày gặp mặt"}
            </strong>
          </button>
          {calendarPopover}
        </div>

        <div className="lots-datetime-field-wrap">
          <span>Giờ gặp mặt</span>
          <label className="lots-time-field">
            <Clock3 size={17} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="time"
              value={selectedDate ? selectedTime : ""}
              min={selectedDate === minDate ? minTime : undefined}
              max={selectedDate === maxDate ? maxTime : undefined}
              step="60"
              onChange={(event) => chooseTime(event.target.value)}
              aria-label="Giờ gặp mặt"
            />
          </label>
        </div>
      </div>
      <small className="lots-datetime-helper">
        Có thể chọn từ{" "}
        <strong>
          {formatDateKeyLabel(minDate)} {minTime}
        </strong>{" "}
        đến{" "}
        <strong>
          {formatDateKeyLabel(maxDate)} {maxTime}
        </strong>
        .
      </small>
    </div>
  );
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
  const targetRequestId = Number(searchParams.get("request")) || null;
  const targetTransferId = Number(searchParams.get("transfer")) || null;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [transferRequests, setTransferRequests] = useState<
    TransferRequestItem[]
  >([]);
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
  const [respondingTransferId, setRespondingTransferId] = useState<
    number | null
  >(null);
  const [
    selectedTransferAppointmentTimes,
    setSelectedTransferAppointmentTimes,
  ] = useState<Record<number, string>>({});
  const [cancellingTransferId, setCancellingTransferId] = useState<
    number | null
  >(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

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
    const pendingRequests =
      reservations.filter((item) =>
        ["pending", "submitted"].includes(item.status),
      ).length +
      transferRequests.filter((item) =>
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
  }, [contracts, reservations, serviceOrders, transferRequests]);

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
      const [
        reservationRes,
        transferRes,
        appointmentRes,
        contractRes,
        serviceRes,
      ] = await Promise.all([
        api.get<ApiResponse<Reservation[]>>("/my/reservations"),
        api.get<ApiResponse<TransferRequestItem[]>>("/my/transfer-requests"),
        api.get<ApiResponse<Appointment[]>>("/my/appointments"),
        api.get<ApiResponse<Contract[]>>("/my/contracts"),
        api.get<ApiResponse<ServiceOrder[]>>("/my/service-orders"),
      ]);

      const baseReservations = (reservationRes.data.data ?? []).filter(
        (request) => request.type === "purchase",
      );
      const hydratedReservations = await Promise.all(
        baseReservations.map(async (request) => {
          if (request.cancellation || !request.cancellationId) return request;
          try {
            const detailResponse = await api.get<ApiResponse<Reservation>>(
              `/my/reservations/${request.id}`,
            );
            return { ...request, ...detailResponse.data.data };
          } catch {
            return request;
          }
        }),
      );

      const rawTransfers = transferRes.data.data ?? [];
      const hydratedTransfers = await Promise.all(
        rawTransfers.map(async (item) => {
          try {
            const detailRes = await api.get<ApiResponse<TransferRequestItem>>(
              `/my/transfer-requests/${item.id}`,
            );
            return { ...item, ...detailRes.data.data };
          } catch {
            return item;
          }
        }),
      );

      setReservations(hydratedReservations);
      setTransferRequests(hydratedTransfers);
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
    if (!error) return;
    const retryInterval = window.setInterval(() => void loadData(true), 10_000);
    return () => window.clearInterval(retryInterval);
  }, [error]);

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
    if (loading || !targetRequestId) return;
    const scrollId = window.setTimeout(() => {
      const target = document.getElementById(`request-${targetRequestId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(scrollId);
  }, [loading, reservations.length, targetRequestId]);

  useEffect(() => {
    if (loading || !targetTransferId) return;
    const scrollId = window.setTimeout(() => {
      const target = document.getElementById(`transfer-${targetTransferId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(scrollId);
  }, [loading, targetTransferId, transferRequests.length]);

  useEffect(() => {
    if (!cancelTarget) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cancellingId === null) {
        setCancelTarget(null);
        setCancelReason("");
        setCancelError("");
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cancelTarget, cancellingId]);

  async function respondTransferAppointment(transfer: TransferRequestItem) {
    const appointment = transfer.appointment;
    if (!appointment) return;
    const selectedAt = selectedTransferAppointmentTimes[transfer.id];
    setRespondingTransferId(transfer.id);
    setError("");
    try {
      await api.post(
        `/my/transfer-requests/${transfer.id}/confirm-appointment`,
        {
          selectedAt: selectedAt
            ? new Date(selectedAt).toISOString()
            : undefined,
        },
      );
      setSuccessMessage(
        "Bạn đã xác nhận lịch hẹn ký hợp đồng chuyển nhượng thành công.",
      );
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRespondingTransferId(null);
    }
  }

  async function handleCancelTransferRequest(transferId: number) {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn hủy yêu cầu chuyển nhượng này không?",
      )
    )
      return;
    setCancellingTransferId(transferId);
    setError("");
    try {
      await api.delete(`/my/transfer-requests/${transferId}`);
      setSuccessMessage("Đã hủy yêu cầu chuyển nhượng thành công.");
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingTransferId(null);
    }
  }

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

  function openCancellation(request: Reservation) {
    setSuccessMessage("");
    setCancelError("");
    setCancelReason("");
    setCancelTarget(request);
  }

  function closeCancellation() {
    if (cancellingId !== null) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  }

  async function submitCancellation() {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 3 || reason.length > 1000) {
      setCancelError("Lý do hủy phải có từ 3 đến 1000 ký tự.");
      return;
    }

    setCancellingId(cancelTarget.id);
    setCancelError("");
    setError("");
    try {
      const response = await api.post<ApiResponse<CancelReservationResult>>(
        `/reservations/${cancelTarget.id}/cancel`,
        { reason },
      );
      setSuccessMessage(
        response.data.data?.resolution === "admin_review"
          ? "Đã gửi yêu cầu hủy. Admin sẽ xem xét trước khi cập nhật lô và hợp đồng."
          : "Yêu cầu mua lô đã được hủy thành công.",
      );
      setCancelTarget(null);
      setCancelReason("");
      setCancelError("");
      await loadData(true);
    } catch (err) {
      setCancelError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
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
              Quản lý yêu cầu mua lô, lịch hẹn, hợp đồng sở hữu và các dịch vụ
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
          </div>
        ) : null}
        {successMessage ? (
          <div className="lots-success" role="status" data-lots-reveal>
            <strong>{successMessage}</strong>
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
            title="Yêu cầu mua & chuyển nhượng"
            description="Theo dõi hồ sơ từ lúc gửi yêu cầu đến khi có lịch hẹn ký hợp đồng."
            count={reservations.length + transferRequests.length}
          />

          {loading ? (
            <LoadingList />
          ) : reservations.length === 0 && transferRequests.length === 0 ? (
            <EmptyState
              title="Chưa có yêu cầu nào"
              description="Yêu cầu mua lô hoặc chuyển nhượng mới sẽ được hiển thị tại đây."
            />
          ) : (
            <div className="lots-request-list">
              {reservations.map((request, index) => {
                const appointment = appointmentByRequest.get(request.id);
                const cancellation =
                  request.cancellation ??
                  (request.cancellationId && request.cancellationStatus
                    ? {
                        id: request.cancellationId,
                        status: request.cancellationStatus,
                        reason: "Thông tin chi tiết đang được đồng bộ.",
                        isImmediate: Boolean(request.cancellationIsImmediate),
                        requestedAt: "",
                      }
                    : null);
                const cancellationBlocksWorkflow =
                  cancellation?.status === "pending" ||
                  (cancellation?.status === "approved" &&
                    request.status === "cancelled");
                const cancellationMode =
                  request.cancellationMode ??
                  (request.status === "approved"
                    ? "admin_review"
                    : "immediate");
                const canCancel =
                  request.canCancel ??
                  (["draft", "submitted", "pending", "approved"].includes(
                    request.status,
                  ) &&
                    cancellation?.status !== "pending" &&
                    !(
                      cancellation?.status === "approved" &&
                      request.status === "cancelled"
                    ));
                const plotText =
                  (request.plotCodes ?? []).join(", ") ||
                  `${request.plotCount ?? 0} lô`;

                return (
                  <article
                    key={`purchase-${request.id}`}
                    id={
                      targetRequestId === request.id
                        ? `request-${request.id}`
                        : appointment
                          ? `appointment-${appointment.id}`
                          : `request-${request.id}`
                    }
                    className={`lots-request-card${appointment?.id === targetAppointmentId ? " is-target-appointment" : ""}${targetRequestId === request.id ? " is-target-request" : ""}`}
                    tabIndex={
                      appointment?.id === targetAppointmentId ||
                      targetRequestId === request.id
                        ? -1
                        : undefined
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
                            <h3>Mua lô</h3>
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
                        {canCancel && !cancellationBlocksWorkflow ? (
                          <div className="lots-request-actions">
                            <button
                              type="button"
                              onClick={() => openCancellation(request)}
                              disabled={cancellingId === request.id}
                            >
                              {cancellationMode === "admin_review"
                                ? "Gửi yêu cầu hủy mua lô"
                                : "Hủy yêu cầu mua lô"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {cancellation ? (
                      <CancellationSummary cancellation={cancellation} />
                    ) : null}

                    {appointment && !cancellationBlocksWorkflow ? (
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
                              <div className="lots-appointment-picker">
                                <AppointmentDateTimePicker
                                  value={
                                    selectedAppointmentTimes[appointment.id] ??
                                    ""
                                  }
                                  min={appointmentTimeBounds(appointment).min}
                                  max={appointmentTimeBounds(appointment).max}
                                  onChange={(nextValue) =>
                                    setSelectedAppointmentTimes((current) => ({
                                      ...current,
                                      [appointment.id]: nextValue,
                                    }))
                                  }
                                />
                              </div>
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
                    ) : request.status === "approved" &&
                      !cancellationBlocksWorkflow ? (
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

              {transferRequests.map((transfer, index) => {
                const plotText =
                  (transfer.plotCodes ?? []).join(", ") ||
                  (transfer.plots ?? []).map((p) => p.code).join(", ") ||
                  "-";
                const appointment = transfer.appointment;
                const transferTypeLabel =
                  TRANSFER_TYPE_MAP[transfer.transferType] ??
                  "Chuyển nhượng quyền sở hữu";
                const canCancel = transfer.status === "pending";

                const rangeStart = appointment?.rangeStart
                  ? toVietnamDateTimeInput(appointment.rangeStart)
                  : "";
                const rangeEnd = appointment?.rangeEnd
                  ? toVietnamDateTimeInput(appointment.rangeEnd)
                  : "";
                const nextMinute = new Date();
                nextMinute.setSeconds(0, 0);
                nextMinute.setMinutes(nextMinute.getMinutes() + 1);
                const currentMin = toVietnamDateTimeInput(
                  nextMinute.toISOString(),
                );
                const minTime =
                  rangeStart > currentMin ? rangeStart : currentMin;

                return (
                  <article
                    key={`transfer-${transfer.id}`}
                    id={`transfer-${transfer.id}`}
                    className={`lots-request-card${targetTransferId === transfer.id ? " is-target-request" : ""}`}
                    tabIndex={targetTransferId === transfer.id ? -1 : undefined}
                    data-lots-reveal
                    style={
                      {
                        "--reveal-delay": `${Math.min(reservations.length + index, 6) * 55}ms`,
                      } as CSSVariables
                    }
                  >
                    <div className="lots-request-main">
                      <div className="lots-record-code">
                        <span>Chuyển nhượng</span>
                        <strong>#{String(transfer.id).padStart(4, "0")}</strong>
                      </div>

                      <div className="lots-request-content">
                        <div className="lots-card-heading">
                          <div>
                            <h3>{transferTypeLabel}</h3>
                            <p>
                              Lô: {plotText} • Người nhận:{" "}
                              <strong>{transfer.recipientName}</strong>
                              {transfer.recipientPhone
                                ? ` (${transfer.recipientPhone})`
                                : ""}
                            </p>
                          </div>
                          <StatusPill status={transfer.status} />
                        </div>

                        <div className="lots-info-grid lots-info-grid-three">
                          <Info
                            label="Ngày gửi"
                            value={formatDate(transfer.createdAt)}
                          />
                          <Info
                            label="Ngày xử lý"
                            value={formatDate(transfer.reviewedAt)}
                          />
                          <Info
                            label="Giá trị giao dịch"
                            value={
                              transfer.transactionAmount
                                ? money.format(
                                    Number(transfer.transactionAmount),
                                  )
                                : "Không ghi nhận"
                            }
                            emphasize={Boolean(transfer.transactionAmount)}
                          />
                        </div>

                        {transfer.agreementNote ? (
                          <p
                            style={{
                              marginTop: 10,
                              fontSize: "0.85rem",
                              color: "var(--lots-text-muted, #7c93a0)",
                            }}
                          >
                            <span>Thỏa thuận:</span> {transfer.agreementNote}
                          </p>
                        ) : null}

                        {transfer.adminNote ? (
                          <p
                            style={{
                              marginTop: 6,
                              fontSize: "0.85rem",
                              color: "var(--lots-text-main, #333)",
                            }}
                          >
                            <span>Ghi chú từ admin:</span> {transfer.adminNote}
                          </p>
                        ) : null}

                        {canCancel ? (
                          <div className="lots-request-actions">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCancelTransferRequest(transfer.id)
                              }
                              disabled={cancellingTransferId === transfer.id}
                            >
                              {cancellingTransferId === transfer.id
                                ? "Đang hủy..."
                                : "Hủy yêu cầu chuyển nhượng"}
                            </button>
                          </div>
                        ) : null}
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
                            <span>Lịch hẹn chuyển nhượng</span>
                          </div>
                          <strong className="lots-appointment-range">
                            {formatAppointmentDate(appointment.rangeStart)} –{" "}
                            {formatAppointmentDate(appointment.rangeEnd)}
                          </strong>
                          <div className="lots-appointment-detail">
                            <MapPin
                              size={15}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>{appointment.location}</span>
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

                          {appointment.customerSelectedAt ||
                          appointment.customerSelectedDate ? (
                            <p className="lots-selected-time">
                              Thời gian đã chọn:{" "}
                              {formatDate(
                                appointment.customerSelectedAt ||
                                  appointment.customerSelectedDate,
                              )}
                              {appointment.customerSelectedTime
                                ? ` (${appointment.customerSelectedTime})`
                                : ""}
                            </p>
                          ) : null}

                          {appointment.customerStatus === "pending" ? (
                            <>
                              <div className="lots-appointment-picker">
                                <AppointmentDateTimePicker
                                  value={
                                    selectedTransferAppointmentTimes[
                                      transfer.id
                                    ] ?? ""
                                  }
                                  min={minTime}
                                  max={rangeEnd}
                                  onChange={(nextValue) =>
                                    setSelectedTransferAppointmentTimes(
                                      (current) => ({
                                        ...current,
                                        [transfer.id]: nextValue,
                                      }),
                                    )
                                  }
                                />
                              </div>
                              <div className="lots-appointment-actions">
                                <button
                                  type="button"
                                  className="confirm"
                                  onClick={() =>
                                    void respondTransferAppointment(transfer)
                                  }
                                  disabled={
                                    respondingTransferId === transfer.id ||
                                    !selectedTransferAppointmentTimes[
                                      transfer.id
                                    ]
                                  }
                                >
                                  {respondingTransferId === transfer.id
                                    ? "Đang lưu..."
                                    : "Xác nhận lịch hẹn"}
                                </button>
                              </div>
                            </>
                          ) : null}
                        </section>
                      </div>
                    ) : transfer.status === "approved" ? (
                      <div className="lots-next-step lots-next-step-muted">
                        <div className="lots-step-marker" aria-hidden="true" />
                        <div className="lots-step-copy">
                          <span>Bước tiếp theo</span>
                          <strong>Đang chờ tạo lịch hẹn chuyển nhượng</strong>
                          <p>
                            Nhân viên sẽ cập nhật khoảng ngày ký hợp đồng chuyển
                            nhượng cho yêu cầu này.
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
      {cancelTarget ? (
        <div
          className="lots-cancel-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancellation();
          }}
        >
          <section
            className="lots-cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lots-cancel-title"
          >
            <header>
              <div>
                <span>Yêu cầu #{String(cancelTarget.id).padStart(4, "0")}</span>
                <h2 id="lots-cancel-title">
                  {cancelTarget.cancellationMode === "admin_review" ||
                  cancelTarget.status === "approved"
                    ? "Gửi yêu cầu hủy mua lô"
                    : "Hủy yêu cầu mua lô"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={closeCancellation}
                disabled={cancellingId !== null}
              >
                ×
              </button>
            </header>
            <p className="lots-cancel-guidance">
              {cancelTarget.cancellationMode === "admin_review" ||
              cancelTarget.status === "approved"
                ? "Yêu cầu mua đã được duyệt. Nội dung hủy sẽ được gửi tới admin và quy trình mua sẽ tạm dừng trong thời gian chờ xem xét."
                : "Yêu cầu chưa được admin duyệt. Khi xác nhận hủy, yêu cầu sẽ được khóa ngay để admin không thể duyệt nhầm."}
            </p>
            <label>
              <span>Lý do hủy</span>
              <textarea
                autoFocus
                rows={5}
                minLength={3}
                maxLength={1000}
                value={cancelReason}
                onChange={(event) => {
                  setCancelReason(event.target.value);
                  if (cancelError) setCancelError("");
                }}
                placeholder="Nhập lý do bạn muốn hủy yêu cầu mua lô..."
                disabled={cancellingId !== null}
              />
              <small>{cancelReason.trim().length}/1000 ký tự</small>
            </label>
            {cancelError ? (
              <p className="lots-cancel-error" role="alert">
                {cancelError}
              </p>
            ) : null}
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={closeCancellation}
                disabled={cancellingId !== null}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void submitCancellation()}
                disabled={
                  cancellingId !== null ||
                  cancelReason.trim().length < 3 ||
                  cancelReason.trim().length > 1000
                }
              >
                {cancellingId !== null
                  ? "Đang gửi..."
                  : cancelTarget.cancellationMode === "admin_review" ||
                      cancelTarget.status === "approved"
                    ? "Gửi yêu cầu hủy"
                    : "Xác nhận hủy"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
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

function CancellationSummary({
  cancellation,
}: {
  cancellation: NonNullable<Reservation["cancellation"]>;
}) {
  return (
    <section
      className={`lots-cancellation-panel is-${cancellation.status}`}
      aria-label="Chi tiết yêu cầu hủy"
    >
      <div className="lots-cancellation-panel-accent" aria-hidden="true" />
      <div className="lots-cancellation-panel-content">
        <div className="lots-cancellation-panel-head">
          <div>
            <span className="lots-cancellation-panel-eyebrow">Yêu cầu hủy</span>
            <h4>Trạng thái yêu cầu hủy</h4>
          </div>
          <StatusPill status={cancellation.status} />
        </div>

        <div className="lots-cancellation-panel-grid">
          <div className="lots-cancellation-meta">
            <span>Gửi lúc</span>
            <strong>{formatDate(cancellation.requestedAt)}</strong>
          </div>
          <div className="lots-cancellation-reason">
            <span>Lý do</span>
            <p>{cancellation.reason}</p>
          </div>
          {cancellation.adminNote ? (
            <div className="lots-cancellation-reason">
              <span>Phản hồi từ admin</span>
              <p>{cancellation.adminNote}</p>
            </div>
          ) : null}
        </div>

        {cancellation.status === "pending" ? (
          <div className="lots-cancellation-panel-help">
            Admin đang xem xét yêu cầu hủy. Lịch hẹn và các bước tiếp theo tạm
            thời được khóa.
          </div>
        ) : null}
      </div>
    </section>
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
    margin-top: 20px;
  }

  .lots-datetime-picker {
    display: grid;
    gap: 12px;
  }

  .lots-datetime-fields {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(160px, 0.85fr);
    gap: 14px;
    align-items: start;
  }

  .lots-datetime-field-wrap {
    position: relative;
    display: grid;
    gap: 7px;
    min-width: 0;
  }

  .lots-datetime-field-wrap > span {
    color: #7f9890;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.075em;
    text-transform: uppercase;
  }

  .lots-date-trigger,
  .lots-time-field {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(105, 199, 173, 0.22);
    border-radius: 11px;
    outline: none;
    background: linear-gradient(145deg, rgba(74, 162, 141, 0.12), rgba(20, 48, 68, 0.22));
    color: #edf8f4;
    padding: 10px 13px;
    font-family: inherit;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .lots-date-trigger:hover,
  .lots-time-field:hover {
    transform: translateY(-1px);
    border-color: rgba(105, 224, 197, 0.48);
    background: linear-gradient(145deg, rgba(74, 162, 141, 0.18), rgba(20, 55, 75, 0.28));
  }

  .lots-date-trigger:focus-visible,
  .lots-time-field:focus-within,
  .lots-date-trigger.is-open {
    border-color: rgba(105, 224, 197, 0.62);
    box-shadow: 0 0 0 3px rgba(39, 202, 173, 0.1), 0 10px 26px rgba(0, 0, 0, 0.15);
  }

  .lots-date-trigger svg,
  .lots-time-field svg {
    flex: 0 0 auto;
    color: #59cbb2;
  }

  .lots-date-trigger strong {
    min-width: 0;
    color: #eff9f6;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.015em;
  }

  .lots-time-field input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #eff9f6;
    padding: 0;
    font: 700 14px/1.3 "Be Vietnam Pro", "Inter", system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.025em;
    color-scheme: dark;
  }

  .lots-time-field input::-webkit-calendar-picker-indicator {
    opacity: 0.7;
    filter: none;
  }

  .lots-calendar-popover {
    position: absolute;
    z-index: 30;
    top: calc(100% + 9px);
    left: 0;
    width: min(330px, 90vw);
    padding: 14px;
    border: 1px solid rgba(105, 199, 173, 0.22);
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(15, 38, 52, 0.98), rgba(5, 19, 31, 0.98));
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    animation: lots-calendar-pop 150ms ease-out;
  }

  @keyframes lots-calendar-pop {
    from { opacity: 0; transform: translateY(-4px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .lots-calendar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .lots-calendar-head > strong {
    color: #dff7f0;
    font-size: 13px;
    font-weight: 750;
    text-transform: capitalize;
  }

  .lots-calendar-head > div {
    display: flex;
    gap: 5px;
  }

  .lots-calendar-head button {
    width: 31px;
    height: 31px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(105, 199, 173, 0.15);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
    color: #9ec7bb;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
  }

  .lots-calendar-head button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(105, 199, 173, 0.38);
    background: rgba(105, 199, 173, 0.09);
    color: #e7fbf5;
  }

  .lots-calendar-head button:disabled {
    opacity: 0.28;
    cursor: default;
  }

  .lots-calendar-weekdays,
  .lots-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
  }

  .lots-calendar-weekdays {
    margin-bottom: 5px;
  }

  .lots-calendar-weekdays span {
    padding: 4px 0;
    color: #6f8b83;
    font-size: 9px;
    font-weight: 750;
    text-align: center;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .lots-calendar-grid button,
  .lots-calendar-grid > span {
    min-height: 35px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    font-family: "Be Vietnam Pro", "Inter", system-ui, sans-serif;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .lots-calendar-grid button {
    border: 1px solid transparent;
    background: transparent;
    color: #cfe4df;
    cursor: pointer;
    transition: background 130ms ease, color 130ms ease, transform 130ms ease, border-color 130ms ease;
  }

  .lots-calendar-grid button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(105, 224, 197, 0.24);
    background: rgba(105, 199, 173, 0.1);
    color: #f4fffc;
  }

  .lots-calendar-grid button.is-selected {
    border-color: rgba(95, 229, 199, 0.68);
    background: linear-gradient(145deg, rgba(61, 192, 164, 0.34), rgba(32, 114, 101, 0.36));
    color: #ffffff;
    box-shadow: 0 5px 15px rgba(28, 192, 164, 0.12);
  }

  .lots-calendar-grid button.is-bound:not(.is-selected) {
    border-color: rgba(105, 199, 173, 0.14);
    background: rgba(105, 199, 173, 0.04);
  }

  .lots-calendar-grid button:disabled {
    color: #50625e;
    cursor: default;
  }

  .lots-datetime-helper {
    display: block;
    color: #748c85;
    font-size: 11px;
    line-height: 1.55;
  }

  .lots-datetime-helper strong {
    color: #9ccdc0;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
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

  .lots-success {
    margin-top: 20px;
    padding: 14px 16px;
    border: 1px solid rgba(105, 199, 173, 0.28);
    border-radius: 10px;
    color: #a7ead7;
    background: rgba(24, 112, 89, 0.13);
    font-size: 13px;
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

  .lots-request-card.is-target-appointment,
  .lots-request-card.is-target-request {
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

  .lots-request-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .lots-request-actions button {
    min-height: 38px;
    padding: 8px 13px;
    border: 1px solid rgba(232, 136, 136, 0.34);
    border-radius: 8px;
    color: #efb0b0;
    background: rgba(133, 44, 44, 0.08);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
  }

  .lots-request-actions button:hover:not(:disabled) {
    border-color: rgba(232, 136, 136, 0.58);
    color: #ffd0d0;
    background: rgba(151, 48, 48, 0.16);
  }

  .lots-request-actions button:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .lots-cancellation-state {
    display: grid;
    gap: 8px;
    margin: 0 18px 18px;
    padding: 15px 17px;
    border: 1px solid rgba(230, 185, 92, 0.24);
    border-radius: 10px;
    color: #cdbb8c;
    background: rgba(145, 105, 31, 0.09);
  }

  .lots-cancellation-state > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .lots-cancellation-state span {
    color: #9f8d61;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .lots-cancellation-state strong {
    color: #ead49b;
    font-size: 12px;
  }

  .lots-cancellation-state p,
  .lots-cancellation-state small {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
  }

  .lots-cancellation-state small {
    color: #8d8060;
  }

  .lots-cancellation-state.is-approved {
    border-color: rgba(105, 199, 173, 0.22);
    color: #9fcfbe;
    background: rgba(37, 115, 93, 0.08);
  }

  .lots-cancellation-state.is-approved strong {
    color: #91dec8;
  }

  .lots-cancellation-state.is-rejected {
    border-color: rgba(232, 136, 136, 0.24);
    color: #c69c9c;
    background: rgba(133, 44, 44, 0.08);
  }

  .lots-cancellation-state.is-rejected strong {
    color: #ecb0b0;
  }

  .lots-cancel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1400;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(1, 5, 10, 0.76);
    backdrop-filter: blur(5px);
  }

  .lots-cancel-dialog {
    width: min(560px, 100%);
    overflow: hidden;
    border: 1px solid rgba(96, 130, 189, 0.24);
    border-radius: 14px;
    color: #dce9e5;
    background: #0a1019;
    box-shadow: 0 26px 80px rgba(0, 0, 0, 0.5);
  }

  .lots-cancel-dialog > header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px 15px;
    border-bottom: 1px solid rgba(96, 130, 189, 0.13);
  }

  .lots-cancel-dialog > header span {
    color: #7fcab7;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .lots-cancel-dialog h2 {
    margin: 5px 0 0;
    color: #f0f6f4;
    font-size: 21px;
  }

  .lots-cancel-dialog > header button {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid rgba(96, 130, 189, 0.2);
    border-radius: 50%;
    color: #a8bbb5;
    background: transparent;
    font-size: 22px;
    cursor: pointer;
  }

  .lots-cancel-guidance {
    margin: 0;
    padding: 14px 22px;
    color: #a99471;
    background: rgba(171, 120, 38, 0.08);
    font-size: 13px;
    line-height: 1.65;
  }

  .lots-cancel-dialog > label {
    display: grid;
    gap: 8px;
    padding: 19px 22px 10px;
  }

  .lots-cancel-dialog > label > span {
    color: #dbe6e3;
    font-size: 13px;
    font-weight: 700;
  }

  .lots-cancel-dialog textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    border: 1px solid rgba(105, 199, 173, 0.24);
    border-radius: 9px;
    outline: none;
    color: #eef6f4;
    background: rgba(255, 255, 255, 0.045);
    padding: 11px 12px;
    font: inherit;
    line-height: 1.55;
  }

  .lots-cancel-dialog textarea:focus {
    border-color: rgba(0, 229, 196, 0.52);
    box-shadow: 0 0 0 3px rgba(0, 229, 196, 0.08);
  }

  .lots-cancel-dialog label small {
    color: #70847e;
    font-size: 11px;
    text-align: right;
  }

  .lots-cancel-error {
    margin: 0 22px 4px;
    padding: 9px 11px;
    border-radius: 8px;
    color: #efb0b0;
    background: rgba(151, 48, 48, 0.13);
    font-size: 12px;
  }

  .lots-cancel-dialog > footer {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    padding: 14px 22px 20px;
  }

  .lots-cancel-dialog > footer button {
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .lots-cancel-dialog > footer .secondary {
    border: 1px solid rgba(96, 130, 189, 0.22);
    color: #b7c5c1;
    background: rgba(255, 255, 255, 0.035);
  }

  .lots-cancel-dialog > footer .danger {
    border: 1px solid rgba(232, 136, 136, 0.42);
    color: #fff;
    background: #9a3f3a;
  }

  .lots-cancel-dialog button:disabled,
  .lots-cancel-dialog textarea:disabled {
    opacity: 0.52;
    cursor: not-allowed;
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


  .lots-cancellation-panel {
    position: relative;
    display: block;
    margin: 0 18px 18px;
    overflow: hidden;
    border: 1px solid rgba(230, 185, 92, 0.18);
    border-radius: 13px;
    background: linear-gradient(150deg, rgba(35, 39, 49, 0.72), rgba(13, 24, 33, 0.82));
  }

  .lots-cancellation-panel-accent {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: linear-gradient(180deg, #d8b563, #9c7440);
  }

  .lots-cancellation-panel.is-approved {
    border-color: rgba(105, 199, 173, 0.2);
    background: linear-gradient(150deg, rgba(18, 46, 45, 0.54), rgba(10, 24, 30, 0.82));
  }

  .lots-cancellation-panel.is-approved .lots-cancellation-panel-accent {
    background: linear-gradient(180deg, #69c7ad, #2d8a78);
  }

  .lots-cancellation-panel.is-rejected {
    border-color: rgba(232, 136, 136, 0.2);
    background: linear-gradient(150deg, rgba(55, 27, 34, 0.5), rgba(22, 16, 23, 0.82));
  }

  .lots-cancellation-panel.is-rejected .lots-cancellation-panel-accent {
    background: linear-gradient(180deg, #e88888, #9f4f5e);
  }

  .lots-cancellation-panel-content {
    padding: 16px 18px 17px 21px;
    font-family: "Be Vietnam Pro", "Inter", system-ui, sans-serif;
  }

  .lots-cancellation-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .lots-cancellation-panel-head > div {
    display: grid;
    gap: 3px;
  }

  .lots-cancellation-panel-eyebrow,
  .lots-cancellation-meta > span,
  .lots-cancellation-reason > span {
    color: #84968f;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.075em;
    text-transform: uppercase;
  }

  .lots-cancellation-panel-head h4 {
    margin: 0;
    color: #edf5f2;
    font-size: 14px;
    font-weight: 700;
  }

  .lots-cancellation-panel-grid {
    display: grid;
    grid-template-columns: minmax(140px, 0.45fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    margin-top: 14px;
  }

  .lots-cancellation-meta,
  .lots-cancellation-reason {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid rgba(96, 130, 189, 0.11);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.025);
  }

  .lots-cancellation-meta {
    display: grid;
    align-content: start;
    gap: 5px;
  }

  .lots-cancellation-meta strong {
    color: #dbe8e4;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.45;
    font-variant-numeric: tabular-nums;
  }

  .lots-cancellation-reason p {
    margin: 5px 0 0;
    color: #cad8d4;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .lots-cancellation-panel-help {
    margin-top: 11px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(230, 185, 92, 0.06);
    color: #a89978;
    font-size: 11px;
    line-height: 1.55;
  }

  .lots-cancellation-panel.is-approved .lots-cancellation-panel-help {
    background: rgba(105, 199, 173, 0.05);
    color: #83b8aa;
  }

  @media (max-width: 900px) {
    .lots-appointment-card {
      grid-template-columns: 1fr;
    }

    .lots-appointment-booking {
      border-top: 1px solid rgba(96, 130, 189, 0.11);
      border-left: 0;
    }

    .lots-datetime-fields {
      grid-template-columns: 1fr;
    }

    .lots-cancellation-panel-grid {
      grid-template-columns: 1fr;
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
