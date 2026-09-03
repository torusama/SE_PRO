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
import "./TransferPage.css";

// ── Types ───────────────────────────────────────────────────────────────────

export type TransferWorkflowType = "sale" | "inheritance" | "gift";
export type TransferRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";

export type TransferView =
  | "sale"
  | "inheritance"
  | "gift"
  | "cancellations"
  | "direct";

interface PageData<T> {
  items: T[];
  total?: number;
}

interface TransferRequestItem {
  id: number;
  transferType: TransferWorkflowType;
  status: TransferRequestStatus;
  recipientName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  plotCodes?: string[];
  plotCount?: number;
  totalPrice?: number;
  createdAt: string;
  reviewedAt?: string | null;
}

interface TransferRequestDetail {
  id: number;
  transferType: TransferWorkflowType;
  status: TransferRequestStatus;
  recipientName: string;
  recipientIdCard: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  recipientDateOfBirth?: string | null;
  recipientRelationship?: string | null;
  transactionAmount?: number | null;
  paymentMethod?: string | null;
  agreementNote?: string | null;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerIdCard?: string | null;
  customerAddress?: string | null;
  plots?: Array<{
    id: number;
    code: string;
    zoneName?: string;
    areaSqm?: number | null;
    status?: string;
  }>;
  plotCodes?: string[];
  documents?: Array<{
    id: number;
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
    createdAt?: string;
  }>;
  appointment?: {
    id: number;
    rangeStart: string;
    rangeEnd: string;
    location: string;
    status: string;
    customerSelectedDate?: string | null;
    customerSelectedTime?: string | null;
    customerStatus?: "pending" | "confirmed" | "declined" | null;
    note?: string | null;
  } | null;
  contract?: {
    contractId: number;
    contractCode: string;
    status: string;
    paymentStatus: string;
    totalAmount?: number | null;
    paidAmount?: number | null;
    remainingAmount?: number | null;
    contractDate?: string | null;
    contractContent?: string | null;
    contractBaseContent?: string | null;
    inheritanceContent?: string | null;
    generatedPdfAt?: string | null;
    plots?: Array<{
      id: number;
      code: string;
      zoneName?: string;
      areaSqm?: number;
      agreedPrice: number;
    }>;
    signedEvidence?: Array<{
      id: number;
      filename: string;
      originalName: string;
      mimeType?: string;
    }>;
  } | null;
}

interface PlotResult {
  plotId: number;
  plotCode: string;
  plotStatus: string;
  areaSqm: number;
  plotType: string;
  zoneName: string;
  contractId: number;
  contractCode: string;
  ownershipId: number;
  holderId: number;
  holderName: string;
  holderEmail: string;
  holderPhone: string;
  holderIdCard: string;
  holderAddress: string;
}

interface RecentTransfer {
  id: string;
  batchCode: string;
  plotCount: number;
  previousHolderName: string;
  recipientName: string;
  createdAt: string;
  createdByName: string;
  plotCodes: string[];
}

// ── Formatters & Helpers ────────────────────────────────────────────────────

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateTime = (value?: string | null) =>
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

const dateOnly = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";

const statusLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  completed: "Hoàn tất",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  scheduled: "Đã gửi lịch",
  confirmed: "Khách đã xác nhận",
  declined: "Khách từ chối",
  paid: "Đã thanh toán",
};

const typeLabels: Record<TransferWorkflowType, string> = {
  sale: "Chuyển nhượng",
  inheritance: "Thừa kế",
  gift: "Tặng / Cho tặng",
};

const paymentMethods = [
  ["bank_transfer", "Chuyển khoản ngân hàng"],
  ["cash", "Tiền mặt"],
  ["card", "Thẻ"],
  ["other", "Khác"],
] as const;

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
    return "Không thể kết nối máy chủ backend. Vui lòng kiểm tra dịch vụ rồi thử lại.";
  }
  if (typeof error === "object" && error && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } })
      .response?.data?.message;
    if (message) return message;
  }
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

// ── Sub-components ──────────────────────────────────────────────────────────

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

function TransferReviewInfo({
  request,
  onDownloadDoc,
}: {
  request: TransferRequestDetail;
  onDownloadDoc: (docId: number, filename: string) => void;
}) {
  return (
    <div className="request-review-info">
      {/* Party A */}
      <section className="review-section">
        <h4>Bên chuyển nhượng / Chủ sở hữu hiện tại (Bên A)</h4>
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
          <span className="wide">
            <small>Địa chỉ</small>
            {request.customerAddress || "—"}
          </span>
        </div>
      </section>

      {/* Party B */}
      <section className="review-section">
        <h4>Bên nhận quyền / Thừa kế / Tặng cho (Bên B)</h4>
        <div className="review-info-grid">
          <span>
            <small>Họ và tên người nhận</small>
            {request.recipientName || "—"}
          </span>
          <span>
            <small>Số điện thoại</small>
            {request.recipientPhone || "—"}
          </span>
          <span>
            <small>Email</small>
            {request.recipientEmail || "—"}
          </span>
          <span>
            <small>CCCD/CMND</small>
            {request.recipientIdCard || "—"}
          </span>
          <span>
            <small>Ngày sinh</small>
            {dateOnly(request.recipientDateOfBirth)}
          </span>
          <span>
            <small>Quan hệ với chủ sở hữu</small>
            {request.recipientRelationship || "—"}
          </span>
          <span className="wide">
            <small>Địa chỉ liên hệ</small>
            {request.recipientAddress || "—"}
          </span>
        </div>
      </section>

      {/* Plots */}
      <section className="review-section">
        <div className="review-section-heading">
          <h4>Thông tin các lô đất nhượng quyền</h4>
          <b>
            {request.plots?.length ?? 0} lô
            {request.transferType === "sale" &&
            request.transactionAmount != null
              ? ` · ${money.format(Number(request.transactionAmount))}`
              : ` · ${typeLabels[request.transferType]}`}
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
                {plot.zoneName || "—"}
              </span>
              <span>
                <small>Diện tích</small>
                {plot.areaSqm != null ? `${plot.areaSqm} m²` : "—"}
              </span>
              <span>
                <small>Trạng thái</small>
                {plot.status || "Đã bán"}
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* Customer Documents */}
      {Boolean(request.documents?.length) && (
        <section className="review-section">
          <h4>
            Tài liệu khách hàng đính kèm ({request.documents?.length} tệp)
          </h4>
          <div className="customer-doc-list">
            {(request.documents ?? []).map((doc) => (
              <div key={doc.id} className="customer-doc-item">
                <div>
                  <span>📄</span>
                  <span>{doc.filename}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => onDownloadDoc(doc.id, doc.filename)}
                >
                  Tải xuống xem
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes & Agreement */}
      <section className="review-section request-notes">
        <div>
          <small>Ngày gửi yêu cầu</small>
          <strong>{dateTime(request.createdAt)}</strong>
        </div>
        <div>
          <small>Thỏa thuận / Ghi chú của khách hàng</small>
          <strong>{request.agreementNote || "Không có"}</strong>
        </div>
      </section>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function TransferPage() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedViewParam = searchParams.get("view") as TransferView | null;
  const requestedId = Number(searchParams.get("request")) || undefined;

  const validViews: TransferView[] = [
    "sale",
    "inheritance",
    "gift",
    "cancellations",
    "direct",
  ];
  const initialView: TransferView = validViews.includes(
    requestedViewParam as TransferView,
  )
    ? (requestedViewParam as TransferView)
    : "sale";

  const [view, setView] = useState<TransferView>(initialView);
  const [requests, setRequests] = useState<TransferRequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [detail, setDetail] = useState<TransferRequestDetail>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [adminNote, setAdminNote] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({
    rangeStart: "",
    rangeEnd: "",
    assignedStaffName: "",
    location: "Văn phòng Ban Quản lý Công viên Nghĩa trang",
    note: "",
  });
  const [inheritance, setInheritance] = useState("");
  const [contractPreviewUrl, setContractPreviewUrl] = useState("");
  const [payment, setPayment] = useState({
    amount: "",
    method: "bank_transfer",
    note: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [evidenceError, setEvidenceError] = useState("");

  // Direct transfer state (Tab 5)
  const [directQuery, setDirectQuery] = useState("");
  const [directMode, setDirectMode] = useState<"customer" | "plot">("customer");
  const [directResults, setDirectResults] = useState<PlotResult[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([]);

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api.get<{
        data: PageData<TransferRequestItem>;
      }>("/admin/transfer-requests", {
        // AdminListQueryDto giới hạn pageSize tối đa là 100.
        params: { page: 1, pageSize: 100 },
      });
      setRequests(response.data.data?.items ?? []);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const response = await api.get<{
        data: PageData<RecentTransfer>;
      }>("/admin/transfers", {
        params: { page: 1, pageSize: 50 },
      });
      setRecentTransfers(response.data.data?.items ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequests();
      void loadRecent();
    });
  }, [loadRecent, loadRequests]);

  // Tab Item Filtering
  const salesRequests = useMemo(
    () =>
      requests.filter(
        (item) => item.transferType === "sale" && item.status !== "cancelled",
      ),
    [requests],
  );
  const inheritanceRequests = useMemo(
    () =>
      requests.filter(
        (item) =>
          item.transferType === "inheritance" && item.status !== "cancelled",
      ),
    [requests],
  );
  const giftRequests = useMemo(
    () =>
      requests.filter(
        (item) => item.transferType === "gift" && item.status !== "cancelled",
      ),
    [requests],
  );
  const cancelledRequests = useMemo(
    () => requests.filter((item) => item.status === "cancelled"),
    [requests],
  );

  const currentList = useMemo(() => {
    switch (view) {
      case "sale":
        return salesRequests;
      case "inheritance":
        return inheritanceRequests;
      case "gift":
        return giftRequests;
      case "cancellations":
        return cancelledRequests;
      default:
        return [];
    }
  }, [
    cancelledRequests,
    giftRequests,
    inheritanceRequests,
    salesRequests,
    view,
  ]);

  // Ensure an item is selected when switching tabs or loading
  useEffect(() => {
    if (view === "direct") return;
    if (!currentList.some((item) => item.id === selectedId)) {
      queueMicrotask(() => setSelectedId(currentList[0]?.id));
    }
  }, [currentList, selectedId, view]);

  // URL Query parameter jump
  useEffect(() => {
    if (!requestedId) return;
    const target = requests.find((item) => item.id === requestedId);
    if (!target) return;

    if (target.status === "cancelled") {
      queueMicrotask(() => {
        setView("cancellations");
        setSelectedId(target.id);
      });
    } else {
      queueMicrotask(() => {
        setView(target.transferType);
        setSelectedId(target.id);
      });
    }
  }, [requestedId, requests]);

  // Load Detailed Request Data
  const loadDetail = useCallback(async (id: number) => {
    try {
      const response = await api.get<{ data: TransferRequestDetail }>(
        `/admin/transfer-requests/${id}`,
      );
      const reqData = response.data.data;

      // If contract exists, fetch full contract info (with signedEvidence and full balance)
      if (reqData.contract?.contractId) {
        try {
          const contractRes = await api.get<{
            data: NonNullable<TransferRequestDetail["contract"]>;
          }>(`/admin/contracts/${reqData.contract.contractId}`);
          reqData.contract = {
            ...reqData.contract,
            ...contractRes.data.data,
          };
        } catch {
          // keep existing contract summary
        }
      }

      setDetail(reqData);
      setAdminNote(reqData.adminNote ?? "");
    } catch (caught) {
      setError(getError(caught));
    }
  }, []);

  useEffect(() => {
    if (view !== "direct" && selectedId) {
      queueMicrotask(() => void loadDetail(selectedId));
    }
  }, [loadDetail, selectedId, view]);

  useRealtimeRefresh(
    ["transfers", "contracts", "ownership", "plots", "notifications"],
    async () => {
      await loadRequests(true);
      if (view !== "direct" && selectedId) await loadDetail(selectedId);
      if (view === "direct") await loadRecent();
    },
  );

  const current = detail?.id === selectedId ? detail : undefined;
  const appointment = current?.appointment;
  const contract = current?.contract;

  useEffect(() => {
    queueMicrotask(() => setInheritance(contract?.inheritanceContent ?? ""));
  }, [contract?.contractId, contract?.inheritanceContent]);

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

  // Stepper calculations
  const isSale = current?.transferType === "sale";
  const isFreeOrZero =
    !isSale ||
    Number(current?.transactionAmount ?? 0) === 0 ||
    Number(contract?.totalAmount ?? 0) === 0;

  const decisionDone = Boolean(
    current &&
    ["approved", "rejected", "cancelled", "completed"].includes(current.status),
  );
  const appointmentDone = appointment?.customerStatus === "confirmed";
  const pdfDone = Boolean(contract?.generatedPdfAt);
  const paymentDone = isFreeOrZero || contract?.paymentStatus === "paid";
  const ownershipDone =
    contract?.status === "active" ||
    contract?.status === "transferred" ||
    contract?.status === "completed" ||
    current?.status === "completed";

  const terminal =
    current?.status === "rejected" || current?.status === "cancelled";

  const workflowStages = isFreeOrZero
    ? [decisionDone, appointmentDone, pdfDone, ownershipDone]
    : [decisionDone, appointmentDone, pdfDone, paymentDone, ownershipDone];
  const firstIncompleteStage = workflowStages.findIndex((done) => !done);
  const completed = terminal
    ? 1
    : firstIncompleteStage === -1
      ? workflowStages.length
      : firstIncompleteStage;

  const labels = [
    "Duyệt yêu cầu",
    "Lịch hẹn",
    "Tạo PDF",
    ...(isFreeOrZero ? [] : ["Thanh toán"]),
    "Ký & sở hữu",
  ];

  function resetFeedback() {
    setError("");
    setMessage("");
  }

  function changeView(nextView: TransferView) {
    setView(nextView);
    setDetail(undefined);
    setContractPreviewUrl("");
    resetFeedback();
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete("request");
      nextParams.set("view", nextView);
      return nextParams;
    });
  }

  // ── Action Handlers ───────────────────────────────────────────────────────

  async function decide(action: "approve" | "reject") {
    if (!current) return;
    resetFeedback();
    setBusy(action);
    try {
      await api.post(`/admin/transfer-requests/${current.id}/${action}`, {
        adminNote: adminNote.trim() || undefined,
      });
      setMessage(
        action === "approve"
          ? "Đã duyệt yêu cầu nhượng quyền. Bây giờ có thể gửi khoảng ngày lịch hẹn cho khách hàng."
          : "Đã từ chối yêu cầu nhượng quyền.",
      );
      await loadRequests(true);
      await loadDetail(current.id);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }

  async function createAppointment() {
    if (!current) return;
    if (
      !appointmentForm.rangeStart ||
      !appointmentForm.rangeEnd ||
      !appointmentForm.location.trim()
    ) {
      setError("Vui lòng chọn đủ ngày bắt đầu, ngày kết thúc và địa điểm.");
      return;
    }
    if (
      !DATE_VALUE_PATTERN.test(appointmentForm.rangeStart) ||
      !DATE_VALUE_PATTERN.test(appointmentForm.rangeEnd)
    ) {
      setError("Năm của lịch hẹn phải gồm đúng 4 chữ số.");
      return;
    }
    if (
      appointmentForm.rangeStart < TODAY_IN_VIETNAM ||
      appointmentForm.rangeEnd < TODAY_IN_VIETNAM
    ) {
      setError("Lịch hẹn chỉ được chọn từ ngày hiện tại trở về sau.");
      return;
    }
    if (appointmentForm.rangeEnd < appointmentForm.rangeStart) {
      setError("Ngày kết thúc không được trước ngày bắt đầu.");
      return;
    }
    resetFeedback();
    setBusy("appointment");
    try {
      await api.post(`/admin/transfer-requests/${current.id}/appointment`, {
        rangeStart: `${appointmentForm.rangeStart}T00:00:00+07:00`,
        rangeEnd: `${appointmentForm.rangeEnd}T23:59:59+07:00`,
        location: appointmentForm.location.trim(),
        note: appointmentForm.note.trim() || undefined,
      });
      setMessage(
        "Đã gửi khoảng ngày lịch hẹn. Quy trình sẽ tiếp tục sau khi khách hàng xác nhận.",
      );
      setAppointmentForm((value) => ({
        ...value,
        rangeStart: "",
        rangeEnd: "",
        note: "",
      }));
      await loadRequests(true);
      await loadDetail(current.id);
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

  async function generatePdf() {
    if (!contract) return;
    resetFeedback();
    setBusy("pdf");
    try {
      let snapshot = contract;
      if (inheritance.trim() !== (contract.inheritanceContent ?? "")) {
        const response = await api.patch(
          `/admin/contracts/${contract.contractId}/inheritance`,
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
      await api.post(`/admin/contracts/${contract.contractId}/generated-pdf`);
      setMessage(
        "Đã tải PDF và ghi nhận hoàn tất bước tạo hợp đồng chuyển nhượng.",
      );
      await loadRequests(true);
      if (selectedId) await loadDetail(selectedId);
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
      await api.post(`/admin/contracts/${contract.contractId}/payments`, {
        amount: Number(payment.amount),
        paymentMethod: payment.method,
        note: payment.note.trim() || undefined,
      });
      setPayment((value) => ({ ...value, amount: "", note: "" }));
      setMessage("Đã ghi nhận khoản thanh toán thành công.");
      await loadRequests(true);
      if (selectedId) await loadDetail(selectedId);
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
      await api.post(
        `/admin/contracts/${contract.contractId}/signed-evidence`,
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setFiles([]);
      setMessage(
        "Đã lưu bản hợp đồng ký offline. Hãy kiểm tra tệp rồi xác nhận để kích hoạt quyền sở hữu.",
      );
      await loadRequests(true);
      if (selectedId) await loadDetail(selectedId);
    } catch (caught) {
      setEvidenceError(getError(caught));
    } finally {
      setBusy("");
    }
  }

  async function downloadEvidence(evidence: {
    id: number;
    filename: string;
    originalName: string;
    mimeType?: string;
  }) {
    if (!contract) return;
    resetFeedback();
    setBusy(`evidence-${evidence.id}`);
    try {
      const response = await api.get(
        `/admin/contracts/${contract.contractId}/signed-evidence/${encodeURIComponent(evidence.filename)}`,
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

  async function downloadCustomerDoc(docId: number, filename: string) {
    try {
      const response = await api.get(
        `/admin/transfer-requests/documents/${docId}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "tai-lieu-dinh-kem";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(getError(caught));
    }
  }

  async function activate() {
    if (
      !current ||
      !(await confirm({
        title: "Kích hoạt quyền sở hữu",
        message: `Xác minh tài liệu và chuyển giao quyền sở hữu ${current.plots?.length ?? 1} lô đất sang cho Bên nhận (${current.recipientName})? Thao tác này sẽ đóng quyền sở hữu cũ và tạo quyền sở hữu chính thức mới.`,
        confirmLabel: "Kích hoạt quyền sở hữu",
      }))
    )
      return;

    resetFeedback();
    setBusy("activate");
    try {
      await api.post(`/admin/transfer-requests/${current.id}/activate`);
      setMessage(
        "Đã kích hoạt hợp đồng và chuyển giao quyền sở hữu thành công!",
      );
      await loadRequests(true);
      if (selectedId) await loadDetail(selectedId);
    } catch (caught) {
      setError(getError(caught));
    } finally {
      setBusy("");
    }
  }

  // Appointment summary helper
  const appointmentSummary = appointment ? (
    <div className="request-summary-grid">
      <span>
        <small>Khoảng ngày hẹn</small>
        {dateOnly(appointment.rangeStart)} – {dateOnly(appointment.rangeEnd)}
      </span>
      <span>
        <small>Địa điểm</small>
        {appointment.location}
      </span>
      <span>
        <small>Phản hồi từ khách hàng</small>
        {statusLabels[appointment.customerStatus ?? "pending"] ||
          appointment.customerStatus}
      </span>
      {appointment.customerSelectedDate && (
        <span>
          <small>Ngày khách hàng chọn</small>
          {dateOnly(appointment.customerSelectedDate)}{" "}
          {appointment.customerSelectedTime
            ? `lúc ${appointment.customerSelectedTime}`
            : ""}
        </span>
      )}
      {appointment.note && (
        <span className="full-span">
          <small>Ghi chú lịch hẹn</small>
          {appointment.note}
        </span>
      )}
    </div>
  ) : null;

  return (
    <div className="request-workflow-page">
      {confirmDialog}

      <header>
        <div>
          <h1>Tiếp nhận & Xử lý Yêu cầu Nhượng quyền</h1>
          <p>
            Quy trình tuần tự từ duyệt hồ sơ, lịch hẹn, hợp đồng chuyển
            nhượng/thừa kế/tặng cho, thanh toán và chuyển giao quyền sở hữu.
          </p>
        </div>
      </header>

      {error && <div className="workflow-alert error">{error}</div>}
      {message && <div className="workflow-alert success">{message}</div>}

      {/* 4 Main View Tabs */}
      <nav
        className="request-view-tabs"
        aria-label="Phân loại yêu cầu nhượng quyền"
      >
        <button
          type="button"
          className={view === "sale" ? "active" : ""}
          onClick={() => changeView("sale")}
        >
          Chuyển nhượng
          <b>{salesRequests.length}</b>
        </button>

        <button
          type="button"
          className={view === "inheritance" ? "active" : ""}
          onClick={() => changeView("inheritance")}
        >
          Thừa kế
          <b>{inheritanceRequests.length}</b>
        </button>

        <button
          type="button"
          className={view === "gift" ? "active" : ""}
          onClick={() => changeView("gift")}
        >
          Tặng / Cho tặng
          <b>{giftRequests.length}</b>
        </button>

        <button
          type="button"
          className={view === "cancellations" ? "active" : ""}
          onClick={() => changeView("cancellations")}
        >
          Yêu cầu hủy
          <b>{cancelledRequests.length}</b>
        </button>

        <button
          type="button"
          className={`direct-tab ${view === "direct" ? "active" : ""}`}
          onClick={() => changeView("direct")}
        >
          Chuyển trực tiếp & Lịch sử
        </button>
      </nav>

      {/* Main Workflow (Tabs 1-4) */}
      {view !== "direct" ? (
        <div className="request-workspace">
          {/* Left Column: Request List */}
          <aside className="request-list">
            {loading ? (
              <p className="empty">Đang tải danh sách yêu cầu...</p>
            ) : currentList.length === 0 ? (
              <p className="empty">Không có yêu cầu nào trong mục này.</p>
            ) : (
              currentList.map((item) => (
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
                      {statusLabels[item.status] || item.status}
                    </em>
                  </span>

                  <div className="transfer-parties">
                    <div className="party-row">
                      <span className="party-tag">A</span>
                      <b>{item.customerName || "Bên chuyển"}</b>
                    </div>
                    <div className="party-row">
                      <span className="party-tag tag-b">B</span>
                      <b>{item.recipientName || "Bên nhận"}</b>
                    </div>
                  </div>

                  <small>
                    {(item.plotCodes ?? []).join(", ") || "Chưa có mã lô"} ·{" "}
                    {item.transferType === "sale" && item.totalPrice != null
                      ? money.format(Number(item.totalPrice))
                      : typeLabels[item.transferType] || "Nhượng quyền"}
                  </small>
                </button>
              ))
            )}
          </aside>

          {/* Right Column: Request Detail & Sequential Workflow */}
          <main className="request-detail">
            {!current ? (
              <p className="empty">
                {selectedId
                  ? "Đang tải đầy đủ thông tin yêu cầu..."
                  : "Chọn một yêu cầu để xử lý."}
              </p>
            ) : view === "cancellations" ? (
              /* Cancellation View */
              <>
                <section className="request-heading">
                  <div>
                    <span className="badge-header">
                      Yêu cầu #{String(current.id).padStart(4, "0")} · Đã hủy
                    </span>
                    <h2>
                      {current.customerName} ➔ {current.recipientName}
                    </h2>
                    <p>
                      {(
                        current.plots?.map((p) => p.code) ??
                        current.plotCodes ??
                        []
                      ).join(", ")}{" "}
                      · {typeLabels[current.transferType]}
                    </p>
                  </div>
                  <em className="status-cancelled">Đã hủy</em>
                </section>

                <TransferReviewInfo
                  request={current}
                  onDownloadDoc={downloadCustomerDoc}
                />

                <section className="request-step-completed">
                  <summary>
                    <span>!</span>
                    Trạng thái yêu cầu
                  </summary>
                  <div>
                    <div className="decision-result">
                      <span>
                        <small>Kết quả</small>
                        <strong>Đã hủy</strong>
                      </span>
                      <span>
                        <small>Ngày xử lý / hủy</small>
                        <strong>
                          {dateTime(current.reviewedAt ?? current.createdAt)}
                        </strong>
                      </span>
                      <span>
                        <small>Ghi chú</small>
                        <strong>
                          {current.adminNote ||
                            "Khách hàng đã hủy yêu cầu nhượng quyền."}
                        </strong>
                      </span>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              /* Active Workflow (sale, inheritance, gift) */
              <>
                <Stepper
                  labels={labels}
                  completed={completed}
                  terminal={terminal}
                />

                <section className="request-heading">
                  <div>
                    <span className="badge-header">
                      Yêu cầu #{String(current.id).padStart(4, "0")} ·{" "}
                      {typeLabels[current.transferType]}
                    </span>
                    <h2>
                      {current.customerName} ➔ {current.recipientName}
                    </h2>
                    <p>
                      {(
                        current.plots?.map((p) => p.code) ??
                        current.plotCodes ??
                        []
                      ).join(", ")}{" "}
                      ·{" "}
                      {current.transferType === "sale" &&
                      current.transactionAmount != null
                        ? money.format(Number(current.transactionAmount))
                        : typeLabels[current.transferType]}
                    </p>
                  </div>
                  <em className={`status-${current.status}`}>
                    {statusLabels[current.status] || current.status}
                  </em>
                </section>

                {/* STEP 1: DUYỆT YÊU CẦU */}
                {decisionDone ? (
                  <CompletedStep title="Duyệt yêu cầu">
                    <div className="decision-result">
                      <span>
                        <small>Kết quả xử lý</small>
                        <strong>
                          {statusLabels[current.status] || current.status}
                        </strong>
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
                    <TransferReviewInfo
                      request={current}
                      onDownloadDoc={downloadCustomerDoc}
                    />
                  </CompletedStep>
                ) : (
                  <section className="active-step decision-step">
                    <div className="step-title">
                      <span>1</span>
                      <div>
                        <h3>Duyệt yêu cầu</h3>
                        <p>
                          Kiểm tra thông tin Bên chuyển (A), Bên nhận (B), thông
                          tin các lô đất và tài liệu chứng minh trước khi quyết
                          định.
                        </p>
                      </div>
                    </div>

                    <TransferReviewInfo
                      request={current}
                      onDownloadDoc={downloadCustomerDoc}
                    />

                    <label>
                      Ghi chú xử lý của Ban quản lý
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
                        disabled={Boolean(busy)}
                        onClick={() => void decide("reject")}
                      >
                        Từ chối
                      </button>
                      <button
                        className="primary-button"
                        disabled={Boolean(busy)}
                        onClick={() => void decide("approve")}
                      >
                        {busy === "approve" ? "Đang duyệt..." : "Duyệt yêu cầu"}
                      </button>
                    </div>
                  </section>
                )}

                {/* STEP 2: LỊCH HẸN OFFLINE */}
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
                        <p>
                          Đề xuất khoảng ngày hẹn ký hợp đồng chuyển nhượng trực
                          tiếp.
                        </p>
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
                            Khách hàng đã từ chối lịch trước. Hãy đề xuất khoảng
                            thời gian mới.
                          </div>
                        )}
                        <div className="form-grid">
                          <CalendarDateInput
                            label="Từ ngày"
                            value={appointmentForm.rangeStart}
                            onChange={(value) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                rangeStart: value,
                                rangeEnd:
                                  appointmentForm.rangeEnd &&
                                  appointmentForm.rangeEnd < value
                                    ? ""
                                    : appointmentForm.rangeEnd,
                              })
                            }
                          />
                          <CalendarDateInput
                            label="Đến ngày"
                            value={appointmentForm.rangeEnd}
                            min={appointmentForm.rangeStart || undefined}
                            onChange={(value) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                rangeEnd: value,
                              })
                            }
                          />
                          <label className="full">
                            Địa điểm hẹn
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
                            Ghi chú gửi khách hàng
                            <textarea
                              rows={3}
                              value={appointmentForm.note}
                              placeholder="Ví dụ: Vui lòng mang theo bản gốc CCCD/CMND khi đến ký hợp đồng..."
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
                            disabled={Boolean(busy)}
                            onClick={() => void createAppointment()}
                          >
                            {busy === "appointment"
                              ? "Đang gửi..."
                              : "Gửi lịch hẹn"}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}

                {/* STEP 3: TẠO PDF HỢP ĐỒNG */}
                {appointmentDone && contract && (
                  <>
                    {pdfDone ? (
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
                        <div
                          className="step-actions"
                          style={{ marginTop: "12px" }}
                        >
                          <button
                            className="secondary-button"
                            disabled={Boolean(busy)}
                            onClick={() => void previewPdf()}
                          >
                            {busy === "pdf-preview"
                              ? "Đang tạo bản xem trước..."
                              : "Xem lại hợp đồng"}
                          </button>
                        </div>
                      </CompletedStep>
                    ) : (
                      <section className="active-step">
                        <div className="step-title">
                          <span>3</span>
                          <div>
                            <h3>Tạo PDF hợp đồng</h3>
                            <p>
                              Rà soát nội dung hợp đồng chuyển nhượng/thừa
                              kế/cho tặng và tải bản hợp đồng để ký offline.
                            </p>
                          </div>
                        </div>

                        <label>
                          Điều khoản thỏa thuận bổ sung / Thừa kế / Cho tặng
                          <textarea
                            rows={4}
                            value={inheritance}
                            placeholder="Nhập điều khoản bổ sung nếu có (không bắt buộc)..."
                            onChange={(event) =>
                              setInheritance(event.target.value)
                            }
                          />
                        </label>

                        <div className="step-actions">
                          <button
                            className="secondary-button"
                            disabled={Boolean(busy)}
                            onClick={() => void previewPdf()}
                          >
                            {busy === "pdf-preview"
                              ? "Đang tạo bản xem trước..."
                              : "Xem trước hợp đồng"}
                          </button>
                          <button
                            className="primary-button"
                            disabled={Boolean(busy)}
                            onClick={() => void generatePdf()}
                          >
                            {busy === "pdf"
                              ? "Đang tạo PDF..."
                              : "Tạo và tải PDF"}
                          </button>
                        </div>
                      </section>
                    )}

                    {/* STEP 4: XÁC NHẬN THANH TOÁN */}
                    {pdfDone && !isFreeOrZero && paymentDone && (
                      <CompletedStep title="Xác nhận thanh toán">
                        <div className="request-summary-grid">
                          <span>
                            <small>Đã nhận</small>
                            {money.format(contract.paidAmount ?? 0)}
                          </span>
                          <span>
                            <small>Trạng thái</small>
                            Đã thanh toán đủ
                          </span>
                        </div>
                      </CompletedStep>
                    )}

                    {pdfDone && !isFreeOrZero && !paymentDone && (
                      <section className="active-step">
                        <div className="step-title">
                          <span>4</span>
                          <div>
                            <h3>Xác nhận thanh toán</h3>
                            <p>
                              Đã nhận {money.format(contract.paidAmount ?? 0)} ·
                              Còn lại{" "}
                              {money.format(
                                Number(contract.totalAmount ?? 0) -
                                  Number(contract.paidAmount ?? 0),
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="form-grid">
                          <label>
                            Số tiền đã nhận (đ)
                            <input
                              type="number"
                              min="1"
                              max={
                                Number(contract.totalAmount ?? 0) -
                                Number(contract.paidAmount ?? 0)
                              }
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
                            Phương thức thanh toán
                            <select
                              value={payment.method}
                              onChange={(event) =>
                                setPayment({
                                  ...payment,
                                  method: event.target.value,
                                })
                              }
                            >
                              {paymentMethods.map(([val, label]) => (
                                <option key={val} value={val}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="full">
                            Ghi chú thanh toán
                            <textarea
                              rows={3}
                              value={payment.note}
                              placeholder="Mã tham chiếu ngân hàng, số phiếu thu..."
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
                            disabled={Boolean(busy)}
                            onClick={() => void recordPayment()}
                          >
                            {busy === "payment"
                              ? "Đang ghi nhận..."
                              : "Ghi nhận thanh toán"}
                          </button>
                        </div>
                      </section>
                    )}

                    {/* STEP 5: HỢP ĐỒNG KÝ & QUYỀN SỞ HỮU */}
                    {pdfDone && paymentDone && ownershipDone && (
                      <CompletedStep title="Hợp đồng ký & quyền sở hữu">
                        <div className="request-summary-grid">
                          <span>
                            <small>Hợp đồng chuyển nhượng</small>
                            {contract.contractCode}
                          </span>
                          <span>
                            <small>Kết quả</small>
                            Đã kích hoạt và chuyển giao quyền sở hữu cho Bên
                            nhận ({current.recipientName})
                          </span>
                        </div>
                      </CompletedStep>
                    )}

                    {pdfDone && paymentDone && !ownershipDone && (
                      <section className="active-step">
                        <div className="step-title">
                          <span>{isFreeOrZero ? 4 : 5}</span>
                          <div>
                            <h3>Hợp đồng ký & quyền sở hữu</h3>
                            <p>
                              Bước 1 tải bản đã ký lên hệ thống. Bước 2 kiểm tra
                              tài liệu và xác nhận kích hoạt chuyển quyền sở
                              hữu.
                            </p>
                          </div>
                        </div>

                        <label>
                          Bản hợp đồng đã ký (chỉ PDF, DOC, DOCX;
                          tối đa 10 tệp, 10 MB/tệp)
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(event) => {
                              const selectedFiles = Array.from(
                                event.target.files ?? [],
                              );
                              const invalidFile = selectedFiles.find(
                                (f) =>
                                  !/\.(pdf|doc|docx)$/i.test(
                                    f.name,
                                  ),
                              );
                              if (invalidFile) {
                                setFiles([]);
                                setEvidenceError(
                                  `Tệp “${invalidFile.name}” không hợp lệ.`,
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
                              const oversized = selectedFiles.find(
                                (f) => f.size > 10 * 1024 * 1024,
                              );
                              if (oversized) {
                                setFiles([]);
                                setEvidenceError(
                                  `Tệp “${oversized.name}” vượt quá giới hạn 10 MB.`,
                                );
                                event.currentTarget.value = "";
                                return;
                              }
                              setEvidenceError("");
                              setFiles(selectedFiles);
                            }}
                          />
                        </label>

                        <p
                          className="file-hint"
                          style={{
                            fontSize: "13px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {files.length
                            ? `Đã chọn ${files.length} tệp trên máy, chưa tải lên hệ thống.`
                            : `${contract.signedEvidence?.length ?? 0} tệp đã lưu trên hệ thống.`}
                        </p>

                        {evidenceError && (
                          <p className="workflow-alert error" role="alert">
                            {evidenceError}
                          </p>
                        )}

                        {Boolean(contract.signedEvidence?.length) && (
                          <div className="signed-evidence-list">
                            <strong>Tệp đã lưu — tải xuống để kiểm tra:</strong>
                            {contract.signedEvidence?.map((ev) => (
                              <button
                                type="button"
                                className="signed-evidence-item"
                                key={ev.id}
                                disabled={Boolean(busy)}
                                onClick={() => void downloadEvidence(ev)}
                              >
                                <span>📄 {ev.originalName}</span>
                                <b>
                                  {busy === `evidence-${ev.id}`
                                    ? "Đang tải..."
                                    : "Tải xuống"}
                                </b>
                              </button>
                            ))}
                          </div>
                        )}

                        <div
                          className="step-actions"
                          style={{ marginTop: "10px" }}
                        >
                          <button
                            className="secondary-button"
                            disabled={Boolean(busy) || !files.length}
                            onClick={() => void uploadEvidence()}
                          >
                            {busy === "upload"
                              ? "Đang tải lên..."
                              : "Tải lên hệ thống"}
                          </button>

                          <button
                            className="primary-button"
                            disabled={
                              Boolean(busy) || !contract.signedEvidence?.length
                            }
                            onClick={() => void activate()}
                          >
                            {busy === "activate"
                              ? "Đang kích hoạt..."
                              : "Xác nhận đã kiểm tra & kích hoạt sở hữu"}
                          </button>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      ) : (
        /* Tab 5: Direct Admin Transfer & Batch History */
        <div className="direct-transfer-container">
          <section className="review-section">
            <h4>Chuyển nhượng trực tiếp qua Ban Quản trị</h4>
            <div style={{ padding: "16px", display: "grid", gap: "14px" }}>
              <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
                Tìm kiếm lô đất theo khách hàng hiện tại hoặc mã lô để thực hiện
                chuyển quyền sở hữu trực tiếp.
              </p>
              <div className="direct-search-box">
                <select
                  value={directMode}
                  onChange={(e) => {
                    setDirectMode(e.target.value as "customer" | "plot");
                    setDirectResults([]);
                  }}
                  style={{ width: "200px" }}
                >
                  <option value="customer">Tìm theo khách hàng</option>
                  <option value="plot">Tìm theo mã lô</option>
                </select>
                <input
                  value={directQuery}
                  onChange={(e) => setDirectQuery(e.target.value)}
                  placeholder="Nhập tên, số điện thoại, CCCD hoặc mã lô..."
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && directQuery.trim().length >= 2) {
                      try {
                        const res = await api.get<{
                          data: PlotResult[] | { items: PlotResult[] };
                        }>("/admin/transfers/search", {
                          params: { mode: directMode, q: directQuery.trim() },
                        });
                        const data = res.data.data;
                        setDirectResults(
                          Array.isArray(data) ? data : (data.items ?? []),
                        );
                      } catch {
                        // handled
                      }
                    }
                  }}
                />
              </div>

              {Boolean(directResults.length) && (
                <div className="review-plot-list">
                  {directResults.map((plot) => (
                    <article key={plot.plotId}>
                      <div className="plot-code">
                        <small>Mã lô</small>
                        <strong>{plot.plotCode}</strong>
                      </div>
                      <span>
                        <small>Khu vực</small>
                        {plot.zoneName}
                      </span>
                      <span>
                        <small>Chủ hiện tại</small>
                        {plot.holderName} ({plot.holderPhone})
                      </span>
                      <span>
                        <small>Hợp đồng</small>
                        {plot.contractCode}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="review-section">
            <h4>Lịch sử chuyển nhượng gần đây</h4>
            <div style={{ padding: "16px" }}>
              {recentTransfers.length === 0 ? (
                <p className="empty">
                  Chưa có lịch sử giao dịch chuyển nhượng.
                </p>
              ) : (
                <div className="customer-doc-list">
                  {recentTransfers.map((item) => (
                    <div key={item.id} className="customer-doc-item">
                      <div>
                        <span>🔄</span>
                        <strong>{item.batchCode}</strong>
                        <span>
                          {item.previousHolderName} ➔ {item.recipientName} (
                          {item.plotCodes.join(", ")})
                        </span>
                      </div>
                      <small>{dateTime(item.createdAt)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Contract PDF Preview Modal */}
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
                  Xem trước hợp đồng chuyển nhượng{" "}
                  {contract?.contractCode ?? ""}
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
              Đây là nội dung hợp đồng chuyển nhượng/thừa kế/tặng cho. Đóng bản
              xem trước để tiếp tục chỉnh sửa hoặc tải PDF chính thức.
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
