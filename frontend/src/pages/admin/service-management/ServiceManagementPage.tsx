import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import DemoPaymentPanel from "@/components/payment/DemoPaymentPanel";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import "./ServiceManagementPage.css";

type OrderStatus =
  | "submitted"
  | "pending_confirm"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface Assignee {
  id: number;
  name: string;
}

interface OrderHistory {
  id: number;
  action: string;
  previousStatus?: OrderStatus | null;
  newStatus?: OrderStatus | null;
  note?: string | null;
  createdAt: string;
  changedByName?: string | null;
  assignedToName?: string | null;
}

interface ServiceOrder {
  id: number;
  status: OrderStatus;
  amount: number;
  requestedDate?: string | null;
  scheduledDate?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceName: string;
  category: string;
  plotCode?: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string | null;
  note?: string | null;
  adminNote?: string | null;
  assignedTo?: number | null;
  assignedToName?: string | null;
  adminName?: string | null;
  completionNote?: string | null;
  completionImages?: string[] | null;
  completedAt?: string | null;
  paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
  paymentCode?: string | null;
  paidAt?: string | null;
  paymentConfirmedAt?: string | null;
  history?: OrderHistory[];
}

const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  submitted: { label: "Mới gửi", tone: "amber" },
  pending_confirm: { label: "Chờ xác nhận", tone: "amber" },
  confirmed: { label: "Đã xác nhận", tone: "teal" },
  in_progress: { label: "Đang thực hiện", tone: "blue" },
  completed: { label: "Hoàn thành", tone: "green" },
  cancelled: { label: "Đã huỷ", tone: "red" },
};

const STATUS_FILTERS: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "submitted", label: "Mới gửi" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã huỷ" },
];

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(
    "vi-VN",
    withTime
      ? {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(new Date(value));
}

function orderCode(id: number) {
  return `DV-${String(id).padStart(5, "0")}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không thể thực hiện yêu cầu. Vui lòng thử lại.";
}

export default function ServiceManagementPage() {
  const [searchParams] = useSearchParams();
  const requestedOrderId = Number(searchParams.get("order")) || undefined;
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [ordersResponse, assigneesResponse] = await Promise.all([
        api.get<ApiResponse<{ items: ServiceOrder[] }>>(
          "/admin/service-orders",
          {
            params: { page: 1, pageSize: 100 },
          },
        ),
        api.get<ApiResponse<Assignee[]>>("/admin/service-order-assignees"),
      ]);
      setOrders(ordersResponse.data.data?.items ?? []);
      setAssignees(assigneesResponse.data.data ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Nạp dữ liệu từ API khi route admin được mở.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, []);

  useEffect(() => {
    // Đến từ thông báo "Đơn dịch vụ mới": mở sẵn chi tiết đơn liên quan.
    if (!requestedOrderId) return;
    void openDetail(requestedOrderId);
  }, [requestedOrderId]);

  useEffect(() => {
    // Khoá cuộn trang nền khi popup chi tiết đang mở, để lớp mờ (backdrop-filter)
    // của service-drawer-layer luôn phủ đúng toàn bộ khung nhìn, không bị lệch
    // do trang phía sau cuộn ngang/dọc hoặc đổi kích thước thanh cuộn.
    if (!selected && !detailLoading) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [selected, detailLoading]);

  const [headerHeight, setHeaderHeight] = useState(78);

  useEffect(() => {
    // Đo chiều cao thật của topbar thay vì đóng cứng 78px: topbar có thể
    // cao hơn 78px tuỳ độ phân giải/zoom (vd. xuống dòng ở màn hình hẹp),
    // nếu không đo lại sẽ để lộ khe hở chưa được làm mờ ngay dưới topbar.
    if (!selected && !detailLoading) return;
    const headerEl = document.querySelector(".admin-header");
    if (!headerEl) return;
    const update = () =>
      setHeaderHeight(headerEl.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(headerEl);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [selected, detailLoading]);

  async function openDetail(orderId: number) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await api.get<ApiResponse<ServiceOrder>>(
        `/admin/service-orders/${orderId}`,
      );
      setSelected(response.data.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatches =
        statusFilter === "all" ||
        order.status === statusFilter ||
        (statusFilter === "submitted" && order.status === "pending_confirm");
      const searchMatches =
        !query ||
        orderCode(order.id).toLowerCase().includes(query) ||
        order.serviceName.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.plotCode?.toLowerCase().includes(query);
      return statusMatches && searchMatches;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      waiting: orders.filter((order) =>
        ["submitted", "pending_confirm"].includes(order.status),
      ).length,
      processing: orders.filter((order) =>
        ["confirmed", "in_progress"].includes(order.status),
      ).length,
      completed: orders.filter((order) => order.status === "completed").length,
    }),
    [orders],
  );

  async function refreshSelected(message: string) {
    if (!selected) return;
    await Promise.all([loadOrders(true), openDetail(selected.id)]);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  useRealtimeRefresh(["services", "users"], async () => {
    await loadOrders(true);
    if (selected) await openDetail(selected.id);
  });

  return (
    <div className="service-admin">
      <header className="service-admin__header">
        <div>
          <p className="service-admin__eyebrow">Vận hành dịch vụ</p>
          <h1>Quản lý đơn dịch vụ</h1>
          <p>
            Theo dõi, phân công và lưu lại toàn bộ quá trình phục vụ khách hàng.
          </p>
        </div>
      </header>

      {notice && (
        <div className="service-alert service-alert--success">{notice}</div>
      )}
      {error && (
        <div className="service-alert service-alert--error">{error}</div>
      )}

      <section className="service-stats" aria-label="Tổng quan đơn dịch vụ">
        <Stat label="Tổng đơn" value={stats.total} tone="teal" />
        <Stat label="Chờ xác nhận" value={stats.waiting} tone="amber" />
        <Stat label="Đang xử lý" value={stats.processing} tone="blue" />
        <Stat label="Đã hoàn thành" value={stats.completed} tone="green" />
      </section>

      <section className="service-panel">
        <div className="service-toolbar">
          <label className="service-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng, dịch vụ hoặc mã lô"
            />
          </label>
          <div className="service-filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={statusFilter === filter.value ? "active" : ""}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="service-empty">Đang tải đơn dịch vụ...</div>
        ) : filtered.length === 0 ? (
          <div className="service-empty">
            <strong>Không có đơn phù hợp</strong>
            <span>Thử thay đổi từ khoá hoặc bộ lọc trạng thái.</span>
          </div>
        ) : (
          <div className="service-table-wrap">
            <table className="service-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Dịch vụ & khách hàng</th>
                  <th>Lịch thực hiện</th>
                  <th>Người xử lý</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <button
                        className="service-code"
                        onClick={() => void openDetail(order.id)}
                      >
                        {orderCode(order.id)}
                      </button>
                      <small>Tạo {formatDate(order.createdAt)}</small>
                    </td>
                    <td>
                      <strong>{order.serviceName}</strong>
                      <small>
                        {order.customerName}
                        {order.plotCode ? ` · Lô ${order.plotCode}` : ""}
                      </small>
                    </td>
                    <td>
                      <span>
                        {formatDate(order.scheduledDate || order.requestedDate)}
                      </span>
                      <small>
                        {order.scheduledDate
                          ? "Lịch đã xác nhận"
                          : "Ngày khách yêu cầu"}
                      </small>
                    </td>
                    <td>
                      <span>{order.assignedToName || "Chưa phân công"}</span>
                    </td>
                    <td>
                      <StatusBadge
                        status={order.status}
                        paymentStatus={order.paymentStatus}
                      />
                    </td>
                    <td>
                      <button
                        className="service-row-action"
                        aria-label={`Xem ${orderCode(order.id)}`}
                        onClick={() => void openDetail(order.id)}
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(selected || detailLoading) &&
        createPortal(
          <div
            className="admin-theme service-drawer-layer"
            role="presentation"
            style={
              {
                "--service-header-height": `${headerHeight}px`,
              } as CSSProperties
            }
            onMouseDown={() => !detailLoading && setSelected(null)}
          >
            <aside
              key={selected ? `${selected.id}-${selected.status}` : "loading"}
              className="service-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Chi tiết đơn dịch vụ"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {detailLoading && !selected ? (
                <div className="service-empty">Đang tải chi tiết...</div>
              ) : selected ? (
                <OrderDetail
                  order={selected}
                  assignees={assignees}
                  onClose={() => setSelected(null)}
                  onSaved={(message) => void refreshSelected(message)}
                />
              ) : null}
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={`service-stat service-stat--${tone}`}>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  paymentStatus,
}: {
  status: OrderStatus;
  paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
}) {
  const meta = STATUS_META[status];
  if (status === "confirmed" && paymentStatus === "awaiting_confirmation") {
    return (
      <span className="service-status service-status--amber">
        Đã thanh toán - chờ duyệt
      </span>
    );
  }
  if (status === "in_progress" && paymentStatus === "paid") {
    return (
      <span className="service-status service-status--blue">
        Đã thanh toán - đang thực hiện
      </span>
    );
  }
  return (
    <span className={`service-status service-status--${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function OrderDetail({
  order,
  assignees,
  onClose,
  onSaved,
}: {
  order: ServiceOrder;
  assignees: Assignee[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [assignedTo, setAssignedTo] = useState(
    order.assignedTo ? String(order.assignedTo) : "",
  );
  const [scheduledDate, setScheduledDate] = useState(
    order.scheduledDate?.slice(0, 10) ?? "",
  );
  const [adminNote, setAdminNote] = useState(order.adminNote ?? "");
  const [completionNote, setCompletionNote] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "processing">(
    "overview",
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      assignedTo: order.assignedTo ? String(order.assignedTo) : "",
      scheduledDate: order.scheduledDate?.slice(0, 10) ?? "",
      adminNote: order.adminNote ?? "",
    }),
  );

  const currentSnapshot = JSON.stringify({
    assignedTo,
    scheduledDate,
    adminNote,
  });
  const isDirty = currentSnapshot !== savedSnapshot;

  async function save() {
    const validation = validateProcessing({
      currentStatus: order.status,
      nextStatus: order.status,
      assignedTo,
      scheduledDate,
      adminNote,
      requireNextStep: false,
    });
    if (!validation.ok) {
      setError(validation.message);
      setActiveTab("processing");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.patch(`/admin/service-orders/${order.id}`, {
        status: order.status,
        ...(assignedTo ? { assignedTo: Number(assignedTo) } : {}),
        adminNote,
        ...(scheduledDate ? { scheduledDate } : {}),
      });
      setSavedSnapshot(currentSnapshot);
      setSuccess(
        "Đã lưu thay đổi. Hệ thống đã ghi lịch sử thao tác và gửi thông báo khi trạng thái thay đổi.",
      );
      onSaved(
        "Đã lưu cập nhật đơn dịch vụ và gửi thông báo cho khách hàng khi cần.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function advanceStep() {
    if (order.status === "in_progress") {
      setActiveTab("processing");
      setError(
        "Bước tiếp theo là hoàn thành dịch vụ. Hãy dùng khu vực Xác nhận hoàn thành và gửi bằng chứng.",
      );
      return;
    }
    if (order.status === "completed" || order.status === "cancelled") return;

    const nextStatus = getNextStep(order.status);
    if (!nextStatus) return;

    if (order.status === "confirmed" && order.paymentStatus !== "paid") {
      setError(
        "Chưa thể chuyển sang Đang thực hiện: giao dịch cần được xác nhận đã thanh toán.",
      );
      setActiveTab("overview");
      return;
    }

    const validation = validateProcessing({
      currentStatus: order.status,
      nextStatus,
      assignedTo,
      scheduledDate,
      adminNote,
      requireNextStep: true,
    });
    if (!validation.ok) {
      setError(validation.message);
      setActiveTab("processing");
      return;
    }

    if (isDirty) {
      setError(
        "Bạn đã thay đổi thông tin nhưng chưa lưu. Hãy ấn “Lưu thay đổi” trước khi chuyển bước.",
      );
      setActiveTab("processing");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.patch(`/admin/service-orders/${order.id}`, {
        status: nextStatus,
        ...(assignedTo ? { assignedTo: Number(assignedTo) } : {}),
        adminNote,
        ...(scheduledDate ? { scheduledDate } : {}),
      });
      setSuccess(`Đã chuyển đơn sang bước “${STATUS_META[nextStatus].label}”.`);
      onSaved(`Đã chuyển đơn sang bước “${STATUS_META[nextStatus].label}”.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    if (order.status !== "in_progress") {
      setError(
        "Chỉ có thể xác nhận hoàn thành khi đơn đang ở bước Đang thực hiện.",
      );
      return;
    }
    if (isDirty) {
      setError(
        "Bạn đã thay đổi thông tin xử lý nhưng chưa lưu. Hãy lưu thay đổi trước khi xác nhận hoàn thành.",
      );
      setActiveTab("processing");
      return;
    }
    if (!completionNote.trim()) {
      setError("Vui lòng nhập Ghi chú kết quả trước khi xác nhận hoàn thành.");
      setActiveTab("processing");
      return;
    }
    if (evidence.length === 0) {
      setError("Vui lòng chọn ít nhất một ảnh bằng chứng hoàn thành.");
      setActiveTab("processing");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("completionNote", completionNote);
      evidence.forEach((file) => form.append("evidence", file));
      await api.post(`/admin/service-orders/${order.id}/completion`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(
        "Đã xác nhận hoàn thành, lưu bằng chứng và gửi thông báo cho khách hàng.",
      );
      onSaved(
        "Dịch vụ đã được xác nhận hoàn thành và khách hàng đã nhận thông báo.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function selectEvidence(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (files.length > 10) {
      setError("Chỉ được tải lên tối đa 10 ảnh bằng chứng.");
      return;
    }
    if (files.some((file) => !allowedTypes.includes(file.type))) {
      setError("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setError("Mỗi ảnh bằng chứng không được vượt quá 10 MB.");
      return;
    }
    setError("");
    setEvidence(files);
  }

  const canComplete = order.status === "in_progress";
  const terminal = ["completed", "cancelled"].includes(order.status);
  const nextStatus = getNextStep(order.status);
  const stepIndex = STATUS_STEPS.findIndex(
    (step) => step.status === order.status,
  );
  const processingValidation = getProcessingRequirement(order.status);

  return (
    <>
      <div className="service-drawer__header">
        <div className="service-detail-heading">
          <div>
            <span>{orderCode(order.id)}</span>
            <h2>{order.serviceName}</h2>
            <StatusBadge
              status={order.status}
              paymentStatus={order.paymentStatus}
            />
          </div>
        </div>
        <button onClick={onClose} aria-label="Đóng chi tiết">
          ×
        </button>
      </div>

      <div className="service-drawer__body">
        {error && (
          <div className="service-alert service-alert--error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="service-detail-success" role="status">
            <span>✓</span>
            {success}
          </div>
        )}

        <section
          className="service-progress-card"
          aria-label="Tiến trình xử lý đơn"
        >
          <div className="service-progress-card__top">
            <div>
              <span>TIẾN TRÌNH XỬ LÝ</span>
              <strong>
                Bước {Math.max(stepIndex + 1, 1)} / {STATUS_STEPS.length}
              </strong>
            </div>
            <StatusBadge
              status={order.status}
              paymentStatus={order.paymentStatus}
            />
          </div>
          <div className="service-stepper">
            {STATUS_STEPS.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <div
                  key={step.status}
                  className={`service-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
                >
                  <div className="service-step__node">{index + 1}</div>
                  <strong>{step.label}</strong>
                  <span>{step.caption}</span>
                </div>
              );
            })}
          </div>
          {!terminal && (
            <div className="service-progress-action">
              <div>
                <strong>{processingValidation.title}</strong>
                <span>{processingValidation.description}</span>
              </div>
              <button
                className="service-primary"
                onClick={() => void advanceStep()}
                disabled={
                  saving || !nextStatus || order.status === "in_progress"
                }
              >
                {saving ? "Đang cập nhật…" : processingValidation.buttonLabel}
              </button>
            </div>
          )}
        </section>

        <div
          className="service-detail-tabs"
          role="tablist"
          aria-label="Nội dung đơn dịch vụ"
        >
          <button
            role="tab"
            aria-selected={activeTab === "overview"}
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            <span>01</span>
            Thông tin cơ bản
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "processing"}
            className={activeTab === "processing" ? "active" : ""}
            onClick={() => setActiveTab("processing")}
          >
            <span>02</span>
            Xử lý đơn & lịch sử
            {isDirty && <em>Chưa lưu</em>}
          </button>
        </div>

        {activeTab === "overview" ? (
          <div className="service-tab-panel">
            <section className="detail-card detail-customer">
              <div className="detail-card__heading">
                <div>
                  <span>THÔNG TIN</span>
                  <h3>Thông tin khách hàng</h3>
                </div>
              </div>
              <div className="detail-grid">
                <Detail label="Họ tên" value={order.customerName} />
                <Detail
                  label="Mã lô"
                  value={order.plotCode || "Không gắn lô"}
                />
                <Detail label="Email" value={order.customerEmail || "—"} />
                <Detail
                  label="Số điện thoại"
                  value={order.customerPhone || "—"}
                />
              </div>
            </section>

            <section className="detail-card">
              <div className="detail-card__heading">
                <div>
                  <span>YÊU CẦU</span>
                  <h3>Thông tin yêu cầu</h3>
                </div>
              </div>
              <div className="detail-grid">
                <Detail
                  label="Ngày gửi"
                  value={formatDate(order.createdAt, true)}
                />
                <Detail
                  label="Ngày khách yêu cầu"
                  value={formatDate(order.requestedDate)}
                />
                <Detail label="Chi phí" value={money.format(order.amount)} />
                <Detail
                  label="Ghi chú khách hàng"
                  value={order.note || "Không có ghi chú"}
                  wide
                />
              </div>
            </section>

            {(order.status === "confirmed" ||
              order.paymentStatus === "awaiting_confirmation" ||
              order.paymentStatus === "paid") && (
              <DemoPaymentPanel
                orderId={order.id}
                amount={order.amount}
                paymentStatus={order.paymentStatus ?? "unpaid"}
                paymentCode={order.paymentCode}
                paidAt={order.paidAt}
                paymentConfirmedAt={order.paymentConfirmedAt}
                variant="admin"
                onChanged={() => {
                  onSaved(
                    "Đã cập nhật giao dịch thanh toán và gửi thông báo cho khách hàng.",
                  );
                }}
              />
            )}
          </div>
        ) : (
          <div className="service-tab-panel">
            {!terminal && (
              <section className="detail-card detail-editor">
                <div className="detail-card__heading">
                  <div>
                    <span>CẬP NHẬT</span>
                    <h3>Xử lý đơn</h3>
                  </div>
                  <span
                    className={`save-state ${isDirty ? "is-dirty" : "is-saved"}`}
                  >
                    {isDirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
                  </span>
                </div>

                <div className="detail-form-grid">
                  <div className="processing-status-field">
                    <span className="form-label">Trạng thái hiện tại</span>
                    <strong>{STATUS_META[order.status].label}</strong>
                    <small>
                      Bước tiếp theo chỉ được cập nhật bằng nút trên thanh tiến
                      trình.
                    </small>
                  </div>
                  <label>
                    <span className="form-label">
                      Người xử lý <em>*</em>
                    </span>
                    <select
                      required
                      value={assignedTo}
                      onChange={(event) => setAssignedTo(event.target.value)}
                    >
                      <option value="">Chưa phân công</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">
                      Lịch thực hiện <em>*</em>
                    </span>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(event) => setScheduledDate(event.target.value)}
                    />
                  </label>
                  <label className="wide">
                    <span className="form-label">
                      Ghi chú nội bộ <em>*</em>
                    </span>
                    <textarea
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      rows={3}
                      required
                      maxLength={2000}
                      placeholder="Ghi chú để đội ngũ quản trị theo dõi…"
                    />
                  </label>
                </div>

                <button
                  className="service-primary"
                  onClick={() => void save()}
                  disabled={saving || !isDirty}
                >
                  {saving ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </section>
            )}

            {canComplete && (
              <section className="detail-card detail-completion">
                <div className="detail-card__heading">
                  <div>
                    <span>HOÀN TẤT</span>
                    <h3>Xác nhận hoàn thành</h3>
                  </div>
                </div>
                <label>
                  <span className="form-label">
                    Ghi chú kết quả <em>*</em>
                  </span>
                  <textarea
                    value={completionNote}
                    onChange={(event) => setCompletionNote(event.target.value)}
                    rows={3}
                    required
                    maxLength={2000}
                    placeholder="Mô tả công việc đã thực hiện…"
                  />
                </label>
                <label className="evidence-picker">
                  <span>
                    <strong>
                      Chọn ảnh bằng chứng <em>*</em>
                    </strong>
                    Tối đa 10 ảnh JPG, PNG hoặc WEBP · 10 MB/ảnh
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={(event) => selectEvidence(event.target.files)}
                  />
                </label>
                {evidence.length > 0 && (
                  <p className="file-summary">
                    Đã chọn {evidence.length} ảnh:{" "}
                    {evidence.map((file) => file.name).join(", ")}
                  </p>
                )}
                <button
                  className="service-primary"
                  onClick={() => void complete()}
                  disabled={
                    saving ||
                    isDirty ||
                    evidence.length === 0 ||
                    !completionNote.trim()
                  }
                >
                  {saving ? "Đang xác nhận…" : "Xác nhận dịch vụ hoàn thành"}
                </button>
              </section>
            )}

            {order.status === "completed" && (
              <section className="detail-card">
                <div className="detail-card__heading">
                  <div>
                    <span>KẾT QUẢ</span>
                    <h3>Kết quả hoàn thành</h3>
                  </div>
                </div>
                <p className="completion-note">
                  {order.completionNote || "Không có ghi chú hoàn thành."}
                </p>
                <div className="evidence-grid">
                  {(order.completionImages ?? []).map((filename) => (
                    <EvidenceImage
                      key={filename}
                      orderId={order.id}
                      filename={filename}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="detail-card">
              <div className="detail-card__heading">
                <div>
                  <span>LỊCH SỬ</span>
                  <h3>Lịch sử xử lý đơn</h3>
                </div>
              </div>
              <div className="history-list">
                {(order.history ?? []).map((item) => (
                  <article key={item.id}>
                    <div className="history-dot" />
                    <div>
                      <strong>{historyLabel(item)}</strong>
                      <span>
                        {item.changedByName || "Hệ thống"} ·{" "}
                        {formatDate(item.createdAt, true)}
                      </span>
                      {item.assignedToName && (
                        <p>Người xử lý: {item.assignedToName}</p>
                      )}
                      {item.note && <p>{item.note}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

const STATUS_STEPS: Array<{
  status: OrderStatus;
  label: string;
  caption: string;
}> = [
  { status: "submitted", label: "Đã gửi", caption: "Tiếp nhận" },
  { status: "pending_confirm", label: "Chờ xác nhận", caption: "Xác nhận" },
  { status: "confirmed", label: "Đã xác nhận", caption: "Thanh toán" },
  { status: "in_progress", label: "Đang thực hiện", caption: "Thực hiện" },
  { status: "completed", label: "Hoàn thành", caption: "Hoàn tất" },
];

function getNextStep(status: OrderStatus): OrderStatus | null {
  const index = STATUS_STEPS.findIndex((step) => step.status === status);
  if (index < 0 || index >= STATUS_STEPS.length - 1) return null;
  return STATUS_STEPS[index + 1].status;
}

function getProcessingRequirement(status: OrderStatus) {
  if (status === "submitted") {
    return {
      title: "Kiểm tra yêu cầu trước khi tiếp nhận",
      description:
        "Có thể chuyển sang Chờ xác nhận sau khi thông tin xử lý đã được lưu.",
      buttonLabel: "Tiếp nhận & chuyển bước",
    };
  }
  if (status === "pending_confirm") {
    return {
      title: "Cần phân công và chốt lịch",
      description:
        "Để chuyển sang Đã xác nhận, hãy chọn người xử lý và nhập lịch thực hiện.",
      buttonLabel: "Xác nhận & chuyển bước",
    };
  }
  if (status === "confirmed") {
    return {
      title: "Cần xác nhận thanh toán",
      description:
        "Đơn phải có giao dịch đã thanh toán trước khi chuyển sang Đang thực hiện.",
      buttonLabel: "Bắt đầu thực hiện",
    };
  }
  if (status === "in_progress") {
    return {
      title: "Đơn đang được thực hiện",
      description:
        "Khi hoàn tất, chuyển sang tab Xử lý đơn để nhập kết quả và tải bằng chứng.",
      buttonLabel: "Đang thực hiện",
    };
  }
  if (status === "completed") {
    return {
      title: "Đơn đã hoàn thành",
      description: "Không còn bước xử lý tiếp theo.",
      buttonLabel: "Đã hoàn thành",
    };
  }
  return {
    title: "Đơn đã huỷ",
    description: "Đơn đã kết thúc và không thể chuyển bước.",
    buttonLabel: "Đã huỷ",
  };
}

function validateProcessing({
  currentStatus,
  nextStatus,
  assignedTo,
  scheduledDate,
  adminNote,
  requireNextStep,
}: {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  assignedTo: string;
  scheduledDate: string;
  adminNote: string;
  requireNextStep: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!requireNextStep) return { ok: true };
  const missing: string[] = [];
  if (!assignedTo) missing.push("Người xử lý");
  if (!scheduledDate) missing.push("Lịch thực hiện");
  // Ghi chú nội bộ là thông tin bắt buộc để bàn giao/ghi nhận xử lý ở mỗi bước.
  // Không đổi API: chỉ chặn chuyển bước ở giao diện nếu admin chưa nhập.
  if (!adminNote.trim()) missing.push("Ghi chú nội bộ");
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Chưa thể chuyển sang bước tiếp theo. Vui lòng điền đủ: ${missing.join(", ")}.`,
    };
  }
  if (currentStatus === "confirmed" && nextStatus === "in_progress") {
    return { ok: true };
  }
  return { ok: true };
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "wide" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function historyLabel(item: OrderHistory) {
  if (item.action === "submitted") return "Khách hàng gửi yêu cầu";
  if (item.action === "assigned") return "Phân công người xử lý";
  if (item.action === "completed") return "Xác nhận hoàn thành";
  if (item.newStatus)
    return `Cập nhật trạng thái: ${STATUS_META[item.newStatus]?.label ?? item.newStatus}`;
  return "Cập nhật thông tin đơn";
}

function EvidenceImage({
  orderId,
  filename,
}: {
  orderId: number;
  filename: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    void api
      .get(
        `/service-orders/${orderId}/evidence/${encodeURIComponent(filename)}`,
        { responseType: "blob" },
      )
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename, orderId]);

  return failed ? (
    <div className="evidence-loading">Không tải được ảnh</div>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Bằng chứng hoàn thành dịch vụ" />
    </a>
  ) : (
    <div className="evidence-loading">Đang tải ảnh…</div>
  );
}
