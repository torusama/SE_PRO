import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  composeContractDocument,
  createContractPdfBlob,
  downloadContractPdf,
} from "@/lib/contractPdf";
import "./RequestsPage.css";

type RequestStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";
type CancellationStatus = "pending" | "approved" | "rejected";
type RequestView = "purchases" | "cancellations";

interface PageData<T> {
  items: T[];
}
interface RequestItem {
  id: number;
  status: RequestStatus;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerIdCard?: string;
  customerDateOfBirth?: string;
  customerGender?: string;
  customerNationality?: string;
  customerAddress?: string;
  customerWard?: string;
  customerCity?: string;
  customerNotes?: string;
  note?: string;
  adminNote?: string;
  totalPrice?: number;
  plotCodes?: string[];
  plots?: Array<{
    id: number;
    code: string;
    status: string;
    price: number;
    zoneCode?: string;
    zoneName?: string;
    rowNumber?: string;
    columnNumber?: string;
    areaSqm?: number;
    direction?: string;
    plotType?: string;
  }>;
  createdAt?: string;
  reviewedAt?: string;
  canCancel?: boolean;
  cancellationMode?: "immediate" | "admin_review" | null;
  cancellation?: {
    id: number;
    status: CancellationStatus;
    reason: string;
    isImmediate: boolean;
    adminNote?: string | null;
    requestedAt: string;
    reviewedAt?: string | null;
  } | null;
}
interface CancellationItem {
  id: number;
  requestId: number;
  status: CancellationStatus;
  isImmediate: boolean;
  reason: string;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  purchaseRequestStatus?: RequestStatus;
  plotCodes?: string[];
  plotCount?: number;
  totalPrice?: number;
}
interface Appointment {
  id: number;
  reservationRequestId: number;
  scheduledAt: string;
  scheduledEndAt: string;
  location: string;
  assignedStaffName?: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  customerStatus: "pending" | "confirmed" | "declined";
  customerSelectedAt?: string | null;
  note?: string;
  statusNote?: string;
}
interface ContractPlot {
  id: number;
  code: string;
  zoneName?: string;
  areaSqm?: number;
  agreedPrice: number;
}
interface Evidence {
  id: number;
  filename: string;
  originalName: string;
  mimeType?: string;
}
interface Contract {
  id: number;
  requestId: number;
  contractCode: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  contractDate?: string;
  contractContent?: string;
  contractBaseContent?: string;
  inheritanceContent?: string;
  generatedPdfAt?: string;
  plots?: ContractPlot[];
  signedEvidence?: Evidence[];
}

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "—";
const dateOnly = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const statusLabels: Record<string, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  scheduled: "Đã gửi lịch",
  confirmed: "Khách đã xác nhận",
  declined: "Khách từ chối",
  paid: "Đã thanh toán",
};
const cancellationStatusLabels: Record<CancellationStatus, string> = {
  pending: "Chờ duyệt hủy",
  approved: "Đã chấp thuận",
  rejected: "Đã từ chối",
};
const paymentMethods = [
  ["cash", "Tiền mặt"],
  ["bank_transfer", "Chuyển khoản ngân hàng"],
  ["card", "Thẻ"],
  ["other", "Khác"],
] as const;
const genderLabels: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};
const plotTypeLabels: Record<string, string> = {
  single: "Lô đơn",
  double: "Lô đôi",
  family: "Lô gia đình",
};
const plotStatusLabels: Record<string, string> = {
  available: "Còn trống",
  pending: "Chờ duyệt",
  reserved: "Chờ hoàn tất mua",
  sold: "Đã bán",
  locked: "Đã khóa",
};
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_APPOINTMENT_DATE = "9999-12-31";
const TODAY_IN_VIETNAM = new Date(Date.now() + 7 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

function getError(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_NETWORK"
  ) {
    return "Không thể kết nối máy chủ backend tại cổng 3001. Vui lòng kiểm tra dịch vụ rồi thử lại.";
  }
  if (typeof error === "object" && error && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } })
      .response?.data?.message;
    if (message) return message;
  }
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

function Stepper({
  labels,
  completed,
  terminal,
}: {
  labels: string[];
  completed: number;
  terminal?: boolean;
}) {
  return (
    <ol className={`request-stepper${terminal ? " is-terminal" : ""}`}>
      {labels.map((label, index) => {
        const state =
          index < completed
            ? "done"
            : index === completed && !terminal
              ? "current"
              : "future";
        return (
          <li key={label} className={`is-${state}`}>
            <span>{index < completed ? "✓" : index + 1}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function CompletedStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="request-step-completed">
      <summary>
        <span>✓</span>
        {title}
      </summary>
      <div>{children}</div>
    </details>
  );
}

function CalendarDateInput({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const minimumDate = min && min > TODAY_IN_VIETNAM ? min : TODAY_IN_VIETNAM;
  function openCalendar() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }
  return (
    <label>
      {label}
      <div className="date-input-control">
        <input
          ref={inputRef}
          type="date"
          min={minimumDate}
          max={MAX_APPOINTMENT_DATE}
          inputMode="numeric"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (
              nextValue === "" ||
              (DATE_VALUE_PATTERN.test(nextValue) &&
                nextValue <= MAX_APPOINTMENT_DATE)
            ) {
              onChange(nextValue);
            }
          }}
        />
        <button
          type="button"
          className="date-picker-button"
          aria-label={`Mở lịch chọn ${label.toLocaleLowerCase("vi")}`}
          onClick={openCalendar}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </button>
      </div>
    </label>
  );
}

function RequestReviewInfo({ request }: { request: RequestItem }) {
  const address =
    [request.customerAddress, request.customerWard, request.customerCity]
      .filter(Boolean)
      .join(", ") || "—";
  return (
    <div className="request-review-info">
      <section className="review-section">
        <h4>Thông tin khách hàng</h4>
        <div className="review-info-grid">
          <span>
            <small>Họ và tên</small>
            {request.customerName || "—"}
          </span>
          <span>
            <small>Số điện thoại</small>
            {request.customerPhone || "—"}
          </span>
          <span>
            <small>Email</small>
            {request.customerEmail || "—"}
          </span>
          <span>
            <small>CCCD/CMND</small>
            {request.customerIdCard || "—"}
          </span>
          <span>
            <small>Ngày sinh</small>
            {dateOnly(request.customerDateOfBirth)}
          </span>
          <span>
            <small>Giới tính</small>
            {genderLabels[request.customerGender ?? ""] ||
              request.customerGender ||
              "—"}
          </span>
          <span>
            <small>Quốc tịch</small>
            {request.customerNationality || "—"}
          </span>
          <span className="wide">
            <small>Địa chỉ</small>
            {address}
          </span>
        </div>
      </section>
      <section className="review-section">
        <div className="review-section-heading">
          <h4>Thông tin lô</h4>
          <b>
            {request.plots?.length ?? 0} lô ·{" "}
            {money.format(Number(request.totalPrice ?? 0))}
          </b>
        </div>
        <div className="review-plot-list">
          {(request.plots ?? []).map((plot) => (
            <article key={plot.id}>
              <div className="plot-code">
                <small>Mã lô</small>
                <strong>{plot.code}</strong>
              </div>
              <span>
                <small>Khu vực</small>
                {plot.zoneName || plot.zoneCode || "—"}
              </span>
              <span>
                <small>Hàng / Số ô</small>
                {plot.rowNumber || "—"} / {plot.columnNumber || "—"}
              </span>
              <span>
                <small>Diện tích</small>
                {plot.areaSqm != null ? `${plot.areaSqm} m²` : "—"}
              </span>
              <span>
                <small>Hướng</small>
                {plot.direction || "—"}
              </span>
              <span>
                <small>Loại lô</small>
                {plotTypeLabels[plot.plotType ?? ""] || plot.plotType || "—"}
              </span>
              <span>
                <small>Trạng thái</small>
                {plotStatusLabels[plot.status] || plot.status}
              </span>
              <span className="plot-price">
                <small>Giá tại yêu cầu</small>
                {money.format(Number(plot.price ?? 0))}
              </span>
            </article>
          ))}
        </div>
      </section>
      <section className="review-section request-notes">
        <div>
          <small>Ngày gửi yêu cầu</small>
          <strong>{dateTime(request.createdAt)}</strong>
        </div>
        <div>
          <small>Ghi chú của khách hàng</small>
          <strong>{request.note || "Không có"}</strong>
        </div>
        {request.customerNotes && (
          <div className="wide-note">
            <small>Ghi chú hồ sơ khách hàng</small>
            <strong>{request.customerNotes}</strong>
          </div>
        )}
      </section>
    </div>
  );
}

export default function RequestsPage() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAppointmentId =
    Number(searchParams.get("appointment")) || undefined;
  const requestedRequestId = Number(searchParams.get("request")) || undefined;
  const requestedView: RequestView =
    searchParams.get("view") === "cancellations"
      ? "cancellations"
      : "purchases";
  const [view, setView] = useState<RequestView>(requestedView);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [cancellations, setCancellations] = useState<CancellationItem[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [selectedCancellationId, setSelectedCancellationId] =
    useState<number>();
  const [detail, setDetail] = useState<RequestItem>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [cancellationAdminNote, setCancellationAdminNote] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({
    scheduledAt: "",
    scheduledEndAt: "",
    assignedStaffName: "",
    location: "Văn phòng nghĩa trang Vĩnh Phúc Viên",
    note: "",
  });
  const [inheritance, setInheritance] = useState("");
  const [contractPreviewUrl, setContractPreviewUrl] = useState("");
  const [payment, setPayment] = useState({
    amount: "",
    method: "cash",
    note: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [evidenceError, setEvidenceError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [
        requestResponse,
        appointmentResponse,
        contractResponse,
        cancellationResponse,
      ] = await Promise.all([
        api.get<{ data: PageData<RequestItem> }>("/admin/reservations", {
          params: { page: 1, pageSize: 100 },
        }),
        api.get<{ data: PageData<Appointment> }>("/admin/appointments", {
          params: { page: 1, pageSize: 100 },
        }),
        api.get<{ data: PageData<Contract> }>("/admin/contracts", {
          params: { page: 1, pageSize: 100 },
        }),
        api.get<{ data: PageData<CancellationItem> }>(
          "/admin/reservation-cancellations",
          { params: { page: 1, pageSize: 100 } },
        ),
      ]);
      setRequests(requestResponse.data.data?.items ?? []);
      setAppointments(appointmentResponse.data.data?.items ?? []);
      setContracts(contractResponse.data.data?.items ?? []);
      setCancellations(cancellationResponse.data.data?.items ?? []);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const visibleRequests = useMemo(
    () => requests.filter((item) => item.status !== "draft"),
    [requests],
  );
  const visibleCancellations = useMemo(
    () =>
      [...cancellations].sort((first, second) => {
        if (first.status === "pending" && second.status !== "pending")
          return -1;
        if (first.status !== "pending" && second.status === "pending") return 1;
        return (
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
        );
      }),
    [cancellations],
  );
  useEffect(() => {
    if (view !== "purchases") return;
    if (!visibleRequests.some((item) => item.id === selectedId)) {
      queueMicrotask(() => setSelectedId(visibleRequests[0]?.id));
    }
  }, [selectedId, view, visibleRequests]);
  useEffect(() => {
    if (view !== "cancellations") return;
    if (
      !visibleCancellations.some((item) => item.id === selectedCancellationId)
    ) {
      queueMicrotask(() =>
        setSelectedCancellationId(visibleCancellations[0]?.id),
      );
    }
  }, [selectedCancellationId, view, visibleCancellations]);
  useEffect(() => {
    if (!requestedAppointmentId) return;

    const requestedAppointment = appointments.find(
      (item) => item.id === requestedAppointmentId,
    );
    const requestedRequest = requests.find(
      (item) => item.id === requestedAppointment?.reservationRequestId,
    );
    if (!requestedRequest) return;

    queueMicrotask(() => {
      setView("purchases");
      setSelectedId(requestedRequest.id);
    });
  }, [appointments, requestedAppointmentId, requests]);
  // Đến từ thông báo "Yêu cầu duyệt lô": nhảy thẳng tới yêu cầu tương ứng.
  useEffect(() => {
    if (!requestedRequestId) return;
    if (requestedView === "cancellations") {
      const cancellation = cancellations.find(
        (item) => item.requestId === requestedRequestId,
      );
      if (!cancellation) return;
      queueMicrotask(() => {
        setView("cancellations");
        setSelectedCancellationId(cancellation.id);
      });
      return;
    }
    const target = requests.find((item) => item.id === requestedRequestId);
    if (!target) return;

    queueMicrotask(() => {
      setView("purchases");
      setSelectedId(target.id);
    });
  }, [cancellations, requestedRequestId, requestedView, requests]);
  const loadDetail = useCallback(async (id: number) => {
    try {
      const response = await api.get<{ data: RequestItem }>(
        `/admin/reservations/${id}`,
      );
      setDetail(response.data.data);
      setAdminNote(response.data.data.adminNote ?? "");
    } catch (caught) {
      setError(getError(caught));
    }
  }, []);
  useEffect(() => {
    if (view === "purchases" && selectedId) {
      queueMicrotask(() => void loadDetail(selectedId));
    }
  }, [loadDetail, selectedId, view]);

  useRealtimeRefresh(
    ["reservations", "appointments", "contracts", "ownership", "plots"],
    async () => {
      await load(true);
      if (view === "purchases" && selectedId) await loadDetail(selectedId);
    },
  );

  const current = detail?.id === selectedId ? detail : undefined;
  const currentCancellation = visibleCancellations.find(
    (item) => item.id === selectedCancellationId,
  );
  const currentCancellationRequest = requests.find(
    (item) => item.id === currentCancellation?.requestId,
  );
  useEffect(() => {
    queueMicrotask(() =>
      setCancellationAdminNote(currentCancellation?.adminNote ?? ""),
    );
  }, [currentCancellation?.adminNote, currentCancellation?.id]);
  const requestAppointments = appointments
    .filter((item) => item.reservationRequestId === current?.id)
    .sort((a, b) => b.id - a.id);
  const appointment = requestAppointments[0];
  const contract = contracts.find((item) => item.requestId === current?.id);
  useEffect(() => {
    queueMicrotask(() => setInheritance(contract?.inheritanceContent ?? ""));
  }, [contract?.id, contract?.inheritanceContent]);
  useEffect(() => {
    if (!contractPreviewUrl) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContractPreviewUrl("");
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      URL.revokeObjectURL(contractPreviewUrl);
    };
  }, [contractPreviewUrl]);
  const decisionDone = Boolean(
    current && ["approved", "rejected", "cancelled"].includes(current.status),
  );
  const appointmentDone = appointment?.customerStatus === "confirmed";
  const pdfDone = Boolean(contract?.generatedPdfAt);
  const paymentDone = contract?.paymentStatus === "paid";
  const ownershipDone =
    contract?.status === "active" || contract?.status === "completed";
  const pendingCancellationForCurrent = cancellations.find(
    (item) => item.requestId === current?.id && item.status === "pending",
  );
  const cancellationPending = Boolean(
    current?.cancellation?.status === "pending" ||
    pendingCancellationForCurrent,
  );
  const terminal =
    current?.status === "rejected" ||
    current?.status === "cancelled" ||
    cancellationPending;
  const completed = terminal
    ? 1
    : [
        decisionDone,
        appointmentDone,
        pdfDone,
        paymentDone,
        ownershipDone,
      ].filter(Boolean).length;
  const labels = [
    "Duyệt yêu cầu",
    "Lịch hẹn",
    "Tạo PDF",
    "Thanh toán",
    "Ký & sở hữu",
  ];

  function resetFeedback() {
    setError("");
    setMessage("");
  }
  function changeView(nextView: RequestView) {
    setView(nextView);
    setDetail(undefined);
    setContractPreviewUrl("");
    resetFeedback();
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete("appointment");
      nextParams.delete("request");
      if (nextView === "cancellations") {
        nextParams.set("view", "cancellations");
      } else {
        nextParams.delete("view");
      }
      return nextParams;
    });
  }
  async function reviewCancellation(action: "approve" | "reject") {
    if (!currentCancellation || currentCancellation.status !== "pending")
      return;
    resetFeedback();
    setBusy(`cancellation-${action}`);
    try {
      await api.patch(
        `/admin/reservation-cancellations/${currentCancellation.id}/${action}`,
        { adminNote: cancellationAdminNote.trim() || undefined },
      );
      setMessage(
        action === "approve"
          ? "Đã chấp thuận yêu cầu hủy và dừng quy trình mua lô."
          : "Đã từ chối yêu cầu hủy. Quy trình mua có thể tiếp tục.",
      );
      await load(true);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function decide(action: "approve" | "reject") {
    if (!current) return;
    resetFeedback();
    setBusy(action);
    try {
      await api.patch(`/admin/reservations/${current.id}/${action}`, {
        adminNote: adminNote.trim() || undefined,
      });
      setMessage(
        action === "approve"
          ? "Đã duyệt yêu cầu. Bây giờ có thể gửi lịch hẹn cho khách hàng."
          : "Đã từ chối yêu cầu.",
      );
      await load();
      const response = await api.get<{ data: RequestItem }>(
        `/admin/reservations/${current.id}`,
      );
      setDetail(response.data.data);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function createAppointment() {
    if (!current) return;
    if (
      !appointmentForm.scheduledAt ||
      !appointmentForm.scheduledEndAt ||
      !appointmentForm.assignedStaffName.trim() ||
      !appointmentForm.location.trim()
    ) {
      setError(
        "Vui lòng chọn đủ ngày bắt đầu, ngày kết thúc, nhân viên và địa điểm.",
      );
      return;
    }
    if (
      !DATE_VALUE_PATTERN.test(appointmentForm.scheduledAt) ||
      !DATE_VALUE_PATTERN.test(appointmentForm.scheduledEndAt)
    ) {
      setError("Năm của lịch hẹn phải gồm đúng 4 chữ số.");
      return;
    }
    if (
      appointmentForm.scheduledAt < TODAY_IN_VIETNAM ||
      appointmentForm.scheduledEndAt < TODAY_IN_VIETNAM
    ) {
      setError("Lịch hẹn chỉ được chọn từ ngày hiện tại trở về sau.");
      return;
    }
    if (appointmentForm.scheduledEndAt < appointmentForm.scheduledAt) {
      setError("Ngày kết thúc không được trước ngày bắt đầu.");
      return;
    }
    resetFeedback();
    setBusy("appointment");
    try {
      await api.post("/admin/appointments", {
        reservationRequestId: current.id,
        scheduledAt: `${appointmentForm.scheduledAt}T00:00:00+07:00`,
        scheduledEndAt: `${appointmentForm.scheduledEndAt}T23:59:59+07:00`,
        assignedStaffName: appointmentForm.assignedStaffName.trim(),
        location: appointmentForm.location.trim(),
        note: appointmentForm.note.trim() || undefined,
      });
      setMessage(
        "Đã gửi lịch hẹn. Quy trình sẽ tiếp tục sau khi khách hàng xác nhận.",
      );
      setAppointmentForm((value) => ({
        ...value,
        scheduledAt: "",
        scheduledEndAt: "",
        note: "",
      }));
      await load();
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function generatePdf() {
    if (!contract) return;
    resetFeedback();
    setBusy("pdf");
    try {
      let snapshot = contract;
      if (inheritance.trim() !== (contract.inheritanceContent ?? "")) {
        const response = await api.patch(
          `/admin/contracts/${contract.id}/inheritance`,
          { content: inheritance.trim() },
        );
        snapshot = { ...contract, ...response.data.data };
      }
      const content = composeContractDocument(
        snapshot.contractBaseContent ?? snapshot.contractContent ?? "",
        inheritance,
        snapshot.plots ?? [],
      );
      await downloadContractPdf({
        contractCode: snapshot.contractCode,
        contractContent: content,
        contractDate: snapshot.contractDate,
      });
      await api.post(`/admin/contracts/${contract.id}/generated-pdf`);
      setMessage("Đã tải PDF và ghi nhận hoàn tất bước tạo hợp đồng.");
      await load();
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function previewPdf() {
    if (!contract) return;
    resetFeedback();
    setBusy("pdf-preview");
    try {
      const content = composeContractDocument(
        contract.contractBaseContent ?? contract.contractContent ?? "",
        inheritance,
        contract.plots ?? [],
      );
      const blob = await createContractPdfBlob({
        contractCode: contract.contractCode,
        contractContent: content,
        contractDate: contract.contractDate,
      });
      setContractPreviewUrl(URL.createObjectURL(blob));
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function recordPayment() {
    if (!contract || Number(payment.amount) <= 0) {
      setError("Số tiền đã nhận phải lớn hơn 0.");
      return;
    }
    resetFeedback();
    setBusy("payment");
    try {
      await api.post(`/admin/contracts/${contract.id}/payments`, {
        amount: Number(payment.amount),
        paymentMethod: payment.method,
        note: payment.note.trim() || undefined,
      });
      setPayment((value) => ({ ...value, amount: "", note: "" }));
      setMessage("Đã ghi nhận khoản thanh toán.");
      await load();
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function uploadEvidence() {
    if (!contract || !files.length) {
      setEvidenceError("Vui lòng chọn ít nhất một bản hợp đồng đã ký.");
      return;
    }
    resetFeedback();
    setEvidenceError("");
    setBusy("upload");
    try {
      const data = new FormData();
      files.forEach((file) => data.append("evidence", file));
      await api.post(`/admin/contracts/${contract.id}/signed-evidence`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFiles([]);
      setMessage(
        "Đã lưu bản hợp đồng ký offline. Hãy kiểm tra tệp rồi xác nhận để kích hoạt quyền sở hữu.",
      );
      await load();
    } catch (caught) {
      setEvidenceError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function downloadEvidence(evidence: Evidence) {
    if (!contract) return;
    resetFeedback();
    setBusy(`evidence-${evidence.id}`);
    try {
      const response = await api.get(
        `/admin/contracts/${contract.id}/signed-evidence/${encodeURIComponent(evidence.filename)}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([response.data], {
          type: evidence.mimeType || response.data.type,
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = evidence.originalName || "hop-dong-da-ky";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }
  async function activate() {
    if (
      !contract ||
      !(await confirm({
        title: "Kích hoạt quyền sở hữu",
        message:
          "Xác minh tài liệu và kích hoạt quyền sở hữu cho toàn bộ lô trong hợp đồng?",
        confirmLabel: "Kích hoạt",
      }))
    )
      return;
    resetFeedback();
    setBusy("activate");
    try {
      await api.post(`/admin/contracts/${contract.id}/activate-ownership`);
      setMessage("Đã kích hoạt hợp đồng và quyền sở hữu.");
      await load();
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }

  const appointmentSummary = appointment ? (
    <div className="request-summary-grid">
      <span>
        <small>Khoảng ngày</small>
        {dateOnly(appointment.scheduledAt)} –{" "}
        {dateOnly(appointment.scheduledEndAt)}
      </span>
      <span>
        <small>Phụ trách</small>
        {appointment.assignedStaffName || "—"}
      </span>
      <span>
        <small>Địa điểm</small>
        {appointment.location}
      </span>
      <span>
        <small>Khách hàng</small>
        {statusLabels[appointment.customerStatus]}
      </span>
      {appointment.customerSelectedAt && (
        <span>
          <small>Ngày giờ khách đã chọn</small>
          {dateTime(appointment.customerSelectedAt)}
        </span>
      )}
    </div>
  ) : null;

  return (
    <div className="request-workflow-page">
      {confirmDialog}
      <header>
        <div>
          <h1>Xử lý yêu cầu</h1>
          <p>
            Quy trình tuần tự từ duyệt hồ sơ đến lịch hẹn, hợp đồng, thanh toán
            và quyền sở hữu.
          </p>
        </div>
      </header>
      {error && <div className="workflow-alert error">{error}</div>}
      {message && <div className="workflow-alert success">{message}</div>}
      <nav className="request-view-tabs" aria-label="Loại yêu cầu cần xử lý">
        <button
          type="button"
          className={view === "purchases" ? "active" : ""}
          onClick={() => changeView("purchases")}
        >
          Yêu cầu mua
          <b>{visibleRequests.length}</b>
        </button>
        <button
          type="button"
          className={view === "cancellations" ? "active" : ""}
          onClick={() => changeView("cancellations")}
        >
          Yêu cầu hủy
          <b>
            {
              visibleCancellations.filter((item) => item.status === "pending")
                .length
            }
          </b>
        </button>
      </nav>
      {view === "purchases" ? (
        <div className="request-workspace">
          <aside className="request-list">
            <div className="request-list__header">
              <div>
                <strong>Danh sách yêu cầu</strong>
                <span>{visibleRequests.length} yêu cầu</span>
              </div>
            </div>
            <div className="request-list__items">
              {loading ? (
                <p className="empty">Đang tải...</p>
              ) : visibleRequests.length === 0 ? (
                <p className="empty">Chưa có yêu cầu.</p>
              ) : (
                visibleRequests.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === selectedId ? "selected" : ""}
                    onClick={() => {
                      setSelectedId(item.id);
                      setDetail(undefined);
                      setEvidenceError("");
                      resetFeedback();
                    }}
                  >
                    <span>
                      <strong>#{String(item.id).padStart(4, "0")}</strong>
                      <em className={`status-${item.status}`}>
                        {statusLabels[item.status]}
                      </em>
                    </span>
                    <b>{item.customerName || "Khách hàng"}</b>
                    <small>
                      {(item.plotCodes ?? []).join(", ") || "Chưa có mã lô"} ·{" "}
                      {money.format(Number(item.totalPrice ?? 0))}
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>
          <main className="request-detail">
            {!current ? (
              <p className="empty">
                {selectedId
                  ? "Đang tải đầy đủ thông tin yêu cầu..."
                  : "Chọn một yêu cầu để xử lý."}
              </p>
            ) : (
              <>
                <section className="request-heading">
                  <div>
                    <span>Yêu cầu #{String(current.id).padStart(4, "0")}</span>
                    <h2>{current.customerName}</h2>
                    <p>
                      {(
                        current.plotCodes ??
                        current.plots?.map((plot) => plot.code) ??
                        []
                      ).join(", ")}{" "}
                      · {money.format(Number(current.totalPrice ?? 0))}
                    </p>
                  </div>
                  <em className={`status-${current.status}`}>
                    {statusLabels[current.status]}
                  </em>
                </section>
                <div className="request-progress-card">
                  <div className="request-progress-card__head">
                    <div>
                      <span>TIẾN TRÌNH XỬ LÝ</span>
                      <strong>
                        Bước {Math.min(completed + 1, labels.length)} /{" "}
                        {labels.length}
                      </strong>
                    </div>
                    <em className={`status-${current.status}`}>
                      {statusLabels[current.status]}
                    </em>
                  </div>
                  <Stepper
                    labels={labels}
                    completed={completed}
                    terminal={terminal}
                  />
                </div>
                {cancellationPending && (
                  <div className="workflow-alert cancellation-lock">
                    <div>
                      <strong>Quy trình mua đang tạm khóa</strong>
                      <span>
                        Khách hàng đã gửi yêu cầu hủy. Không thể tiếp tục lịch
                        hẹn, hợp đồng, thanh toán hoặc kích hoạt sở hữu trước
                        khi xử lý yêu cầu này.
                      </span>
                    </div>
                    {pendingCancellationForCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          changeView("cancellations");
                          setSelectedCancellationId(
                            pendingCancellationForCurrent.id,
                          );
                        }}
                      >
                        Xem yêu cầu hủy
                      </button>
                    )}
                  </div>
                )}
                {decisionDone && (
                  <CompletedStep title="Duyệt yêu cầu">
                    <div className="decision-result">
                      <span>
                        <small>Kết quả xử lý</small>
                        <strong>{statusLabels[current.status]}</strong>
                      </span>
                      <span>
                        <small>Ngày xử lý</small>
                        <strong>{dateTime(current.reviewedAt)}</strong>
                      </span>
                      <span>
                        <small>Ghi chú xử lý</small>
                        <strong>{current.adminNote || "Không có"}</strong>
                      </span>
                    </div>
                    <RequestReviewInfo request={current} />
                  </CompletedStep>
                )}
                {!decisionDone && (
                  <section className="active-step decision-step">
                    <div className="step-title">
                      <span>1</span>
                      <div>
                        <h3>Duyệt yêu cầu</h3>
                        <p>
                          Kiểm tra đầy đủ thông tin khách hàng và từng lô trước
                          khi quyết định.
                        </p>
                      </div>
                    </div>
                    <RequestReviewInfo request={current} />
                    <label>
                      Ghi chú xử lý
                      <textarea
                        value={adminNote}
                        onChange={(event) => setAdminNote(event.target.value)}
                        rows={3}
                        placeholder="Nhập lý do hoặc ghi chú cho quyết định duyệt..."
                      />
                    </label>
                    <div className="step-actions">
                      <button
                        className="danger-button"
                        disabled={!!busy}
                        onClick={() => void decide("reject")}
                      >
                        Từ chối
                      </button>
                      <button
                        className="primary-button"
                        disabled={!!busy}
                        onClick={() => void decide("approve")}
                      >
                        {busy === "approve" ? "Đang duyệt..." : "Duyệt yêu cầu"}
                      </button>
                    </div>
                  </section>
                )}
                {!terminal && decisionDone && appointmentDone && (
                  <CompletedStep title="Lịch hẹn offline">
                    {appointmentSummary}
                  </CompletedStep>
                )}
                {!terminal && decisionDone && !appointmentDone && (
                  <section className="active-step">
                    <div className="step-title">
                      <span>2</span>
                      <div>
                        <h3>Lịch hẹn offline</h3>
                      </div>
                    </div>
                    {appointment && appointment.customerStatus === "pending" ? (
                      <>
                        <div className="waiting-banner">
                          Đang chờ khách hàng xác nhận lịch hẹn
                        </div>
                        {appointmentSummary}
                      </>
                    ) : (
                      <>
                        {appointment?.customerStatus === "declined" && (
                          <div className="workflow-alert error">
                            Khách hàng đã từ chối lịch trước. Hãy đề xuất lịch
                            mới.
                          </div>
                        )}
                        <div className="form-grid">
                          <CalendarDateInput
                            label="Từ ngày"
                            value={appointmentForm.scheduledAt}
                            onChange={(value) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                scheduledAt: value,
                                scheduledEndAt:
                                  appointmentForm.scheduledEndAt &&
                                  appointmentForm.scheduledEndAt < value
                                    ? ""
                                    : appointmentForm.scheduledEndAt,
                              })
                            }
                          />
                          <CalendarDateInput
                            label="Đến ngày"
                            value={appointmentForm.scheduledEndAt}
                            min={appointmentForm.scheduledAt || undefined}
                            onChange={(value) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                scheduledEndAt: value,
                              })
                            }
                          />
                          <label>
                            Nhân viên phụ trách
                            <input
                              value={appointmentForm.assignedStaffName}
                              onChange={(event) =>
                                setAppointmentForm({
                                  ...appointmentForm,
                                  assignedStaffName: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Địa điểm
                            <input
                              value={appointmentForm.location}
                              onChange={(event) =>
                                setAppointmentForm({
                                  ...appointmentForm,
                                  location: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="full">
                            Ghi chú
                            <textarea
                              rows={3}
                              value={appointmentForm.note}
                              onChange={(event) =>
                                setAppointmentForm({
                                  ...appointmentForm,
                                  note: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="step-actions">
                          <button
                            className="primary-button"
                            disabled={!!busy}
                            onClick={() => void createAppointment()}
                          >
                            Gửi lịch hẹn
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
                {appointmentDone && contract && (
                  <>
                    {pdfDone && (
                      <CompletedStep title="Tạo PDF hợp đồng">
                        <div className="request-summary-grid">
                          <span>
                            <small>Mã hợp đồng</small>
                            {contract.contractCode}
                          </span>
                          <span>
                            <small>Đã tạo lúc</small>
                            {dateTime(contract.generatedPdfAt)}
                          </span>
                        </div>
                        <div className="step-actions contract-completed-actions">
                          <button
                            className="secondary-button"
                            disabled={!!busy}
                            onClick={() => void previewPdf()}
                          >
                            {busy === "pdf-preview"
                              ? "Đang tạo bản xem trước..."
                              : "Xem lại hợp đồng"}
                          </button>
                        </div>
                      </CompletedStep>
                    )}
                    {!pdfDone && (
                      <section className="active-step">
                        <div className="step-title">
                          <span>3</span>
                          <div>
                            <h3>Tạo PDF hợp đồng</h3>
                            <p>
                              Rà soát nội dung thừa kế nếu có, sau đó tải bản
                              hợp đồng để ký offline.
                            </p>
                          </div>
                        </div>
                        <label>
                          Thông tin/nguyện vọng thừa kế
                          <textarea
                            rows={5}
                            value={inheritance}
                            placeholder="Không bắt buộc"
                            onChange={(event) =>
                              setInheritance(event.target.value)
                            }
                          />
                        </label>
                        <div className="step-actions">
                          <button
                            className="secondary-button"
                            disabled={!!busy}
                            onClick={() => void previewPdf()}
                          >
                            {busy === "pdf-preview"
                              ? "Đang tạo bản xem trước..."
                              : "Xem trước hợp đồng"}
                          </button>
                          <button
                            className="primary-button"
                            disabled={!!busy}
                            onClick={() => void generatePdf()}
                          >
                            {busy === "pdf"
                              ? "Đang tạo PDF..."
                              : "Tạo và tải PDF"}
                          </button>
                        </div>
                      </section>
                    )}
                    {pdfDone && paymentDone && (
                      <CompletedStep title="Xác nhận thanh toán">
                        <div className="request-summary-grid">
                          <span>
                            <small>Đã nhận</small>
                            {money.format(contract.paidAmount)}
                          </span>
                          <span>
                            <small>Trạng thái</small>Đã thanh toán đủ
                          </span>
                        </div>
                      </CompletedStep>
                    )}
                    {pdfDone && !paymentDone && (
                      <section className="active-step">
                        <div className="step-title">
                          <span>4</span>
                          <div>
                            <h3>Xác nhận thanh toán</h3>
                            <p>
                              Đã nhận {money.format(contract.paidAmount)} · Còn
                              lại {money.format(contract.remainingAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="form-grid">
                          <label>
                            Số tiền đã nhận (đ)
                            <input
                              type="number"
                              min="1"
                              max={contract.remainingAmount}
                              value={payment.amount}
                              onChange={(event) =>
                                setPayment({
                                  ...payment,
                                  amount: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Phương thức
                            <select
                              value={payment.method}
                              onChange={(event) =>
                                setPayment({
                                  ...payment,
                                  method: event.target.value,
                                })
                              }
                            >
                              {paymentMethods.map(([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="full">
                            Ghi chú
                            <textarea
                              rows={3}
                              value={payment.note}
                              onChange={(event) =>
                                setPayment({
                                  ...payment,
                                  note: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="step-actions">
                          <button
                            className="primary-button"
                            disabled={!!busy}
                            onClick={() => void recordPayment()}
                          >
                            Ghi nhận thanh toán
                          </button>
                        </div>
                      </section>
                    )}
                    {paymentDone && ownershipDone && (
                      <CompletedStep title="Hợp đồng ký & quyền sở hữu">
                        <div className="request-summary-grid">
                          <span>
                            <small>Hợp đồng</small>
                            {contract.contractCode}
                          </span>
                          <span>
                            <small>Kết quả</small>Đã kích hoạt quyền sở hữu
                          </span>
                        </div>
                      </CompletedStep>
                    )}
                    {paymentDone && !ownershipDone && (
                      <section className="active-step">
                        <div className="step-title">
                          <span>5</span>
                          <div>
                            <h3>Hợp đồng ký & quyền sở hữu</h3>
                            <p>
                              Bước 1 tải bản đã ký lên hệ thống. Bước 2 kiểm tra
                              tài liệu và xác nhận kích hoạt quyền sở hữu.
                            </p>
                          </div>
                        </div>
                        <label>
                          Bản hợp đồng đã ký (chỉ PDF, DOC hoặc DOCX; tối đa 10
                          tệp, 10 MB/tệp)
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(event) => {
                              const selectedFiles = Array.from(
                                event.target.files ?? [],
                              );
                              const invalidFile = selectedFiles.find(
                                (file) => !/\.(pdf|doc|docx)$/i.test(file.name),
                              );
                              if (invalidFile) {
                                setFiles([]);
                                setEvidenceError(
                                  `Tệp “${invalidFile.name}” không hợp lệ. Chỉ chấp nhận PDF, DOC hoặc DOCX.`,
                                );
                                event.currentTarget.value = "";
                                return;
                              }
                              if (selectedFiles.length > 10) {
                                setFiles([]);
                                setEvidenceError(
                                  "Chỉ được tải lên tối đa 10 tệp.",
                                );
                                event.currentTarget.value = "";
                                return;
                              }
                              const oversizedFile = selectedFiles.find(
                                (file) => file.size > 10 * 1024 * 1024,
                              );
                              if (oversizedFile) {
                                setFiles([]);
                                setEvidenceError(
                                  `Tệp “${oversizedFile.name}” vượt quá giới hạn 10 MB.`,
                                );
                                event.currentTarget.value = "";
                                return;
                              }
                              setEvidenceError("");
                              setFiles(selectedFiles);
                            }}
                          />
                        </label>
                        <p className="file-hint">
                          {files.length
                            ? `Đã chọn ${files.length} tệp trên máy, chưa tải lên hệ thống.`
                            : `${contract.signedEvidence?.length ?? 0} tệp đã lưu trên hệ thống`}
                        </p>
                        {evidenceError && (
                          <p className="evidence-upload-error" role="alert">
                            {evidenceError}
                          </p>
                        )}
                        {!!contract.signedEvidence?.length && (
                          <div className="signed-evidence-list">
                            <strong>Tệp đã lưu — tải xuống để kiểm tra</strong>
                            {contract.signedEvidence.map((evidence) => (
                              <button
                                type="button"
                                className="signed-evidence-item"
                                key={evidence.id}
                                disabled={!!busy}
                                onClick={() => void downloadEvidence(evidence)}
                              >
                                <span>{evidence.originalName}</span>
                                <b>
                                  {busy === `evidence-${evidence.id}`
                                    ? "Đang tải..."
                                    : "Tải xuống"}
                                </b>
                              </button>
                            ))}
                          </div>
                        )}
                        <p
                          id="ownership-verification-help"
                          className={`ownership-verification-help${
                            contract.signedEvidence?.length ? " ready" : ""
                          }`}
                        >
                          {contract.signedEvidence?.length
                            ? "Đã có bản hợp đồng trên hệ thống. Sau khi kiểm tra nội dung, bạn có thể xác nhận và kích hoạt sở hữu."
                            : files.length
                              ? "Hãy nhấn “Tải lên hệ thống” trước. Nút xác nhận sẽ được mở sau khi tải thành công."
                              : "Chọn và tải lên ít nhất một bản hợp đồng đã ký để mở bước xác nhận."}
                        </p>
                        <div className="step-actions">
                          <button
                            className="secondary-button"
                            disabled={!!busy || !files.length}
                            onClick={() => void uploadEvidence()}
                          >
                            {busy === "upload"
                              ? "Đang tải lên..."
                              : "Tải lên hệ thống"}
                          </button>
                          <button
                            className="primary-button"
                            disabled={
                              !!busy || !contract.signedEvidence?.length
                            }
                            aria-describedby="ownership-verification-help"
                            onClick={() => void activate()}
                          >
                            Xác nhận đã kiểm tra & kích hoạt sở hữu
                          </button>
                        </div>
                      </section>
                    )}
                  </>
                )}
                {current.status === "approved" &&
                  !contract &&
                  !cancellationPending && (
                    <div className="workflow-alert error">
                      Không tìm thấy hợp đồng được tạo tự động cho yêu cầu này.
                    </div>
                  )}
              </>
            )}
          </main>
        </div>
      ) : (
        <div className="request-workspace cancellation-workspace">
          <aside className="request-list cancellation-list">
            {loading ? (
              <p className="empty">Đang tải...</p>
            ) : visibleCancellations.length === 0 ? (
              <p className="empty">Chưa có yêu cầu hủy nào.</p>
            ) : (
              visibleCancellations.map((item) => (
                <button
                  key={item.id}
                  className={
                    item.id === selectedCancellationId ? "selected" : ""
                  }
                  onClick={() => {
                    setSelectedCancellationId(item.id);
                    resetFeedback();
                  }}
                >
                  <span>
                    <strong>Hủy #{String(item.id).padStart(4, "0")}</strong>
                    <em className={`status-${item.status}`}>
                      {cancellationStatusLabels[item.status]}
                    </em>
                  </span>
                  <b>{item.customerName || "Khách hàng"}</b>
                  <small>
                    {(item.plotCodes ?? []).join(", ") || "Chưa có mã lô"} · Yêu
                    cầu #{String(item.requestId).padStart(4, "0")}
                  </small>
                </button>
              ))
            )}
          </aside>
          <main className="request-detail cancellation-detail">
            {!currentCancellation ? (
              <p className="empty">
                {selectedCancellationId
                  ? "Đang tải thông tin yêu cầu hủy..."
                  : "Chọn một yêu cầu hủy để xử lý."}
              </p>
            ) : (
              <>
                <section className="request-heading">
                  <div>
                    <span>
                      Yêu cầu hủy #
                      {String(currentCancellation.id).padStart(4, "0")}
                    </span>
                    <h2>
                      {currentCancellation.customerName ||
                        currentCancellationRequest?.customerName ||
                        "Khách hàng"}
                    </h2>
                    <p>
                      {(
                        currentCancellation.plotCodes ??
                        currentCancellationRequest?.plotCodes ??
                        []
                      ).join(", ") || "Chưa có mã lô"}{" "}
                      · Yêu cầu mua #
                      {String(currentCancellation.requestId).padStart(4, "0")}
                    </p>
                  </div>
                  <em className={`status-${currentCancellation.status}`}>
                    {cancellationStatusLabels[currentCancellation.status]}
                  </em>
                </section>

                <section className="review-section cancellation-summary">
                  <div className="review-section-heading">
                    <h4>Thông tin yêu cầu hủy</h4>
                    <b>
                      {currentCancellation.isImmediate
                        ? "Hủy ngay trước khi duyệt"
                        : "Cần admin xem xét"}
                    </b>
                  </div>
                  <div className="review-info-grid">
                    <span>
                      <small>Ngày gửi</small>
                      <strong>{dateTime(currentCancellation.createdAt)}</strong>
                    </span>
                    <span>
                      <small>Ngày xử lý</small>
                      <strong>
                        {dateTime(currentCancellation.reviewedAt ?? undefined)}
                      </strong>
                    </span>
                    <span>
                      <small>Trạng thái yêu cầu mua</small>
                      <strong>
                        {
                          statusLabels[
                            currentCancellation.purchaseRequestStatus ??
                              currentCancellationRequest?.status ??
                              "approved"
                          ]
                        }
                      </strong>
                    </span>
                    <span>
                      <small>Email</small>
                      <strong>
                        {currentCancellation.customerEmail ||
                          currentCancellationRequest?.customerEmail ||
                          "—"}
                      </strong>
                    </span>
                    <span>
                      <small>Điện thoại</small>
                      <strong>
                        {currentCancellation.customerPhone ||
                          currentCancellationRequest?.customerPhone ||
                          "—"}
                      </strong>
                    </span>
                    <span>
                      <small>Tổng giá trị</small>
                      <strong>
                        {money.format(
                          Number(
                            currentCancellation.totalPrice ??
                              currentCancellationRequest?.totalPrice ??
                              0,
                          ),
                        )}
                      </strong>
                    </span>
                  </div>
                  <div className="cancellation-reason">
                    <small>Lý do khách hàng yêu cầu hủy</small>
                    <p>{currentCancellation.reason}</p>
                  </div>
                </section>

                {currentCancellation.status === "pending" ? (
                  <section className="active-step cancellation-decision-step">
                    <div className="step-title">
                      <span>!</span>
                      <div>
                        <h3>Xem xét yêu cầu hủy</h3>
                        <p>
                          Chấp thuận sẽ dừng quy trình mua và giải phóng dữ liệu
                          liên quan theo quy tắc của hệ thống.
                        </p>
                      </div>
                    </div>
                    <label>
                      Ghi chú phản hồi khách hàng
                      <textarea
                        rows={4}
                        value={cancellationAdminNote}
                        onChange={(event) =>
                          setCancellationAdminNote(event.target.value)
                        }
                        placeholder="Nhập lý do chấp thuận hoặc từ chối hủy..."
                      />
                    </label>
                    <div className="step-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!!busy}
                        onClick={() => void reviewCancellation("reject")}
                      >
                        {busy === "cancellation-reject"
                          ? "Đang từ chối..."
                          : "Từ chối hủy"}
                      </button>
                      <button
                        type="button"
                        className="danger-button solid"
                        disabled={!!busy}
                        onClick={() => void reviewCancellation("approve")}
                      >
                        {busy === "cancellation-approve"
                          ? "Đang duyệt..."
                          : "Chấp thuận hủy"}
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="request-step-completed cancellation-result">
                    <div className="decision-result">
                      <span>
                        <small>Kết quả xử lý</small>
                        <strong>
                          {cancellationStatusLabels[currentCancellation.status]}
                        </strong>
                      </span>
                      <span>
                        <small>Ngày xử lý</small>
                        <strong>
                          {dateTime(
                            currentCancellation.reviewedAt ?? undefined,
                          )}
                        </strong>
                      </span>
                      <span>
                        <small>Ghi chú admin</small>
                        <strong>
                          {currentCancellation.adminNote || "Không có"}
                        </strong>
                      </span>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      )}
      {contractPreviewUrl && (
        <div
          className="contract-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setContractPreviewUrl("");
            }
          }}
        >
          <section
            className="contract-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contract-preview-title"
          >
            <header>
              <div>
                <span>Bản PDF được tạo tự động</span>
                <h2 id="contract-preview-title">
                  Xem trước hợp đồng {contract?.contractCode ?? ""}
                </h2>
              </div>
              <button
                type="button"
                className="contract-preview-close"
                aria-label="Đóng bản xem trước"
                onClick={() => setContractPreviewUrl("")}
              >
                ×
              </button>
            </header>
            <p>
              Đây là nội dung hiện tại của hợp đồng. Đóng bản xem trước để tiếp
              tục chỉnh sửa hoặc tạo và tải PDF chính thức.
            </p>
            <iframe
              src={contractPreviewUrl}
              title={`Bản xem trước hợp đồng ${contract?.contractCode ?? ""}`}
            />
            <footer>
              <a
                className="secondary-button"
                href={contractPreviewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Mở trong tab mới
              </a>
              <button
                type="button"
                className="primary-button"
                onClick={() => setContractPreviewUrl("")}
              >
                Đóng
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
