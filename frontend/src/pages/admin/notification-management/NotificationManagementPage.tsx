import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { ROUTES } from "@/constants/routes";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import {
  isRequestCancellationType,
  notificationTargetRoute,
} from "@/components/layout/shared/notification-menu-utils";
import "../AdminCorePages.css";
import "./NotificationManagementPage.css";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// Thông báo cá nhân của admin đang đăng nhập (GET /notifications), tức các
// việc khách hàng vừa làm mà hệ thống đã báo lại cho admin xử lý.
interface FeedNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  createdAt: string;
}

interface BroadcastRow {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  broadcast: boolean;
  recipientName?: string;
  createdAt: string;
}

const FEED_TABS = [
  { value: "all", label: "Tất cả" },
  { value: "unread", label: "Chưa đọc" },
] as const;

type FeedSectionValue =
  | "all"
  | "requests"
  | "cancellations"
  | "services"
  | "appointments"
  | "reminders"
  | "other";

const FEED_SECTIONS: Array<{
  value: FeedSectionValue;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "Tổng quan",
    description: "Toàn bộ công việc mới",
  },
  {
    value: "requests",
    label: "Yêu cầu lô & hợp đồng",
    description: "Mua lô, thanh toán",
  },
  {
    value: "cancellations",
    label: "Hủy yêu cầu lô",
    description: "Yêu cầu hủy cần theo dõi",
  },
  {
    value: "services",
    label: "Dịch vụ",
    description: "Đơn mới và thanh toán",
  },
  {
    value: "appointments",
    label: "Lịch hẹn",
    description: "Phản hồi lịch ký, làm việc",
  },
  {
    value: "reminders",
    label: "Nhắc lịch",
    description: "Ngày giỗ, tưởng niệm, bảo trì",
  },
  {
    value: "other",
    label: "Khác",
    description: "Hồ sơ, tài khoản và hệ thống",
  },
];

const TYPE_LABELS: Record<string, string> = {
  request_submitted: "Yêu cầu duyệt lô",
  request_approved: "Yêu cầu đã duyệt",
  request_rejected: "Yêu cầu bị từ chối",
  request_cancelled: "Yêu cầu đã hủy",
  request_cancelled_by_customer: "Khách hàng đã hủy yêu cầu",
  request_cancellation_submitted: "Yêu cầu hủy mới",
  request_cancellation_approved: "Yêu cầu hủy đã được duyệt",
  request_cancellation_rejected: "Yêu cầu hủy bị từ chối",
  appointment_response: "Phản hồi lịch hẹn",
  service_submitted: "Đặt dịch vụ mới",
  service_payment_reported: "Khách báo đã thanh toán",
  reminder_created: "Nhắc lịch mới",
};

function notificationSection(item: FeedNotification): FeedSectionValue {
  const type = item.type.toLowerCase();
  const entity = item.relatedEntityType?.toLowerCase() ?? "";

  if (isRequestCancellationType(type)) {
    return "cancellations";
  }
  if (
    entity === "reservation_request" ||
    ["contract", "payment", "ownership", "transfer"].some((value) =>
      entity.includes(value),
    ) ||
    /^(request|reservation|contract|payment|ownership|transfer)_/.test(type)
  ) {
    return "requests";
  }
  if (entity === "service_order" || type.startsWith("service_")) {
    return "services";
  }
  if (entity.includes("appointment") || type.startsWith("appointment_")) {
    return "appointments";
  }
  if (entity === "reminder" || type.startsWith("reminder_")) {
    return "reminders";
  }
  return "other";
}

function typeLabel(type: string) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return (
    type
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ") || "Thông báo"
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.floor(
    Math.max(0, Date.now() - date.getTime()) / 60_000,
  );
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function money(value?: number) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

// --- Chi tiết thông báo: tải thêm thông tin thực thể liên quan tuỳ loại ---

interface ReservationDetail {
  id: number;
  type: "purchase";
  status: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  totalPrice?: number;
  note?: string;
  plots?: Array<{
    code: string;
    zoneName?: string;
    areaSqm?: number;
    price?: number;
  }>;
  createdAt?: string;
}

interface AppointmentDetail {
  id: number;
  reservationRequestId: number;
  scheduledAt: string;
  scheduledEndAt: string;
  location: string;
  status: string;
  customerStatus: string;
  statusNote?: string;
}

interface ServiceOrderDetail {
  id: number;
  status: string;
  amount: number;
  serviceName: string;
  customerName: string;
  customerPhone?: string | null;
  plotCode?: string | null;
  note?: string | null;
  requestedDate?: string | null;
}

type DetailState =
  | { kind: "reservation_request"; data: ReservationDetail }
  | {
      kind: "offline_appointment";
      data: AppointmentDetail;
      request?: ReservationDetail;
    }
  | { kind: "service_order"; data: ServiceOrderDetail }
  | { kind: "none" };

function actionRoute(
  detail: DetailState,
): { label: string; to: string } | null {
  switch (detail.kind) {
    case "reservation_request":
      return {
        label: "Đi tới Xử lý yêu cầu",
        to: `${ROUTES.ADMIN_REQUESTS}?request=${detail.data.id}`,
      };
    case "offline_appointment":
      return {
        label: "Đi tới Xử lý yêu cầu",
        to: `${ROUTES.ADMIN_REQUESTS}?appointment=${detail.data.id}`,
      };
    case "service_order":
      return {
        label: "Đi tới Quản lý dịch vụ",
        to: `${ROUTES.ADMIN_SERVICES}?order=${detail.data.id}`,
      };
    default:
      return null;
  }
}

function notificationActionRoute(
  item?: FeedNotification | null,
): { label: string; to: string } | null {
  if (item && isRequestCancellationType(item.type)) {
    return {
      label: "Đi tới Xử lý yêu cầu hủy",
      to: notificationTargetRoute(item, "admin")!,
    };
  }
  if (!item?.relatedEntityType) return null;
  const entity = item.relatedEntityType.toLowerCase();
  const id = item.relatedEntityId;

  if (entity === "reservation_request") {
    return {
      label: "Đi tới Xử lý yêu cầu",
      to: id ? `${ROUTES.ADMIN_REQUESTS}?request=${id}` : ROUTES.ADMIN_REQUESTS,
    };
  }
  if (entity === "service_order") {
    return {
      label: "Đi tới Quản lý dịch vụ",
      to: id ? `${ROUTES.ADMIN_SERVICES}?order=${id}` : ROUTES.ADMIN_SERVICES,
    };
  }
  if (entity.includes("appointment")) {
    return {
      label: "Đi tới Quản lý lịch hẹn",
      to:
        entity === "offline_appointment" && id
          ? `${ROUTES.ADMIN_REQUESTS}?appointment=${id}`
          : ROUTES.ADMIN_APPOINTMENTS,
    };
  }
  if (entity === "reminder") {
    return {
      label: "Đi tới Quản lý nhắc lịch",
      to: ROUTES.ADMIN_REMINDERS,
    };
  }
  if (entity.includes("contract")) {
    return {
      label: "Đi tới Hợp đồng",
      to: id
        ? `${ROUTES.ADMIN_CONTRACTS}?contractId=${id}`
        : ROUTES.ADMIN_CONTRACTS,
    };
  }
  if (entity.includes("transfer") || entity.includes("ownership")) {
    return { label: "Đi tới Chuyển nhượng", to: ROUTES.ADMIN_TRANSFER };
  }
  if (entity === "deceased_profile") {
    return {
      label: "Đi tới Hồ sơ người đã khuất",
      to: id
        ? `${ROUTES.ADMIN_DECEASED}?profileId=${id}`
        : ROUTES.ADMIN_DECEASED,
    };
  }
  return null;
}

function processingActionRoute(
  detail: DetailState,
  item?: FeedNotification | null,
) {
  const notificationRoute = notificationActionRoute(item);
  if (item && isRequestCancellationType(item.type)) {
    return notificationRoute;
  }
  return actionRoute(detail) ?? notificationRoute;
}

export default function NotificationManagementPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"feed" | "broadcast">("feed");

  // --- Feed thực (thông báo cá nhân của admin) ---
  const [items, setItems] = useState<FeedNotification[]>([]);
  const [feedSection, setFeedSection] =
    useState<FeedSectionValue>("all");
  const [feedTab, setFeedTab] =
    useState<(typeof FEED_TABS)[number]["value"]>("all");
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const requestInFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const mutationVersionRef = useRef(0);

  const [activeNotification, setActiveNotification] =
    useState<FeedNotification | null>(null);
  const [detail, setDetail] = useState<DetailState>({ kind: "none" });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadFeed = useCallback(async (silent = false) => {
    if (requestInFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }

    requestInFlightRef.current = true;
    if (!silent) setFeedLoading(true);

    try {
      do {
        pendingReloadRef.current = false;
        const requestVersion = mutationVersionRef.current;
        setFeedError("");

        try {
          const response =
            await api.get<ApiResponse<FeedNotification[]>>("/notifications");
          if (requestVersion === mutationVersionRef.current) {
            setItems(
              [...(response.data.data ?? [])].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              ),
            );
          } else {
            pendingReloadRef.current = true;
          }
        } catch {
          setFeedError("Không thể tải danh sách thông báo.");
        }
      } while (pendingReloadRef.current);
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadFeed());
  }, [loadFeed]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  const sectionStats = useMemo(() => {
    const stats = Object.fromEntries(
      FEED_SECTIONS.map((section) => [
        section.value,
        { total: 0, unread: 0 },
      ]),
    ) as Record<FeedSectionValue, { total: number; unread: number }>;

    for (const item of items) {
      const section = notificationSection(item);
      stats.all.total += 1;
      stats[section].total += 1;
      if (!item.isRead) {
        stats.all.unread += 1;
        stats[section].unread += 1;
      }
    }
    return stats;
  }, [items]);

  const selectedSection = useMemo(
    () =>
      FEED_SECTIONS.find((section) => section.value === feedSection) ??
      FEED_SECTIONS[0],
    [feedSection],
  );

  const sectionItems = useMemo(
    () =>
      feedSection === "all"
        ? items
        : items.filter((item) => notificationSection(item) === feedSection),
    [items, feedSection],
  );

  const visible = useMemo(
    () =>
      feedTab === "unread"
        ? sectionItems.filter((item) => !item.isRead)
        : sectionItems,
    [sectionItems, feedTab],
  );

  function selectFeedSection(section: FeedSectionValue) {
    setFeedSection(section);
    setActiveNotification(null);
    setDetail({ kind: "none" });
    setDetailError("");
  }

  async function markRead(item: FeedNotification) {
    if (item.isRead) return;
    mutationVersionRef.current += 1;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, isRead: true } : entry,
      ),
    );
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch {
      void loadFeed(true);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    mutationVersionRef.current += 1;
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    try {
      await api.patch("/notifications/read-all");
    } catch {
      setItems(previous);
    }
  }

  async function openDetail(item: FeedNotification) {
    setActiveNotification(item);
    setDetail({ kind: "none" });
    setDetailError("");
    void markRead(item);

    if (!item.relatedEntityType || !item.relatedEntityId) return;

    setDetailLoading(true);
    try {
      if (item.relatedEntityType === "reservation_request") {
        const response = await api.get<ApiResponse<ReservationDetail>>(
          `/admin/reservations/${item.relatedEntityId}`,
        );
        setDetail({ kind: "reservation_request", data: response.data.data });
      } else if (item.relatedEntityType === "offline_appointment") {
        const appointmentId = item.relatedEntityId;
        const listResponse = await api.get<
          ApiResponse<{ items: AppointmentDetail[] }>
        >("/admin/appointments", { params: { page: 1, pageSize: 200 } });
        const appointment = listResponse.data.data?.items?.find(
          (row) => row.id === appointmentId,
        );
        if (!appointment) {
          setDetailError("Lịch hẹn này không còn tồn tại.");
        } else {
          let request: ReservationDetail | undefined;
          try {
            const requestResponse = await api.get<
              ApiResponse<ReservationDetail>
            >(`/admin/reservations/${appointment.reservationRequestId}`);
            request = requestResponse.data.data;
          } catch {
            request = undefined;
          }
          setDetail({
            kind: "offline_appointment",
            data: appointment,
            request,
          });
        }
      } else if (item.relatedEntityType === "service_order") {
        const response = await api.get<ApiResponse<ServiceOrderDetail>>(
          `/admin/service-orders/${item.relatedEntityId}`,
        );
        setDetail({ kind: "service_order", data: response.data.data });
      }
    } catch {
      setDetailError("Không thể tải chi tiết thông báo này.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setActiveNotification(null);
    setDetail({ kind: "none" });
    setDetailError("");
  }

  function goToProcessing() {
    const target = processingActionRoute(detail, activeNotification);
    if (!target) return;
    closeDetail();
    navigate(target.to);
  }

  // --- Soạn / gửi thông báo hàng loạt (tính năng sẵn có, giữ nguyên) ---
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const loadBroadcastHistory = useCallback(async () => {
    setBroadcastLoading(true);
    try {
      const response = await api.get<ApiResponse<{ items: BroadcastRow[] }>>(
        "/admin/notifications",
        { params: { page: 1, pageSize: 100, broadcast: true } },
      );
      setRows(response.data.data?.items ?? []);
    } catch {
      setBroadcastMessage("Không thể tải lịch sử thông báo đã gửi.");
    } finally {
      setBroadcastLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "broadcast") queueMicrotask(() => void loadBroadcastHistory());
  }, [view, loadBroadcastHistory]);

  useRealtimeRefresh(["notifications"], async () => {
    await loadFeed(true);
    if (view === "broadcast") await loadBroadcastHistory();
  });

  async function send() {
    if (!title.trim() || !content.trim()) {
      setBroadcastMessage("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
      return;
    }
    setSending(true);
    try {
      await api.post("/admin/notifications/broadcast", {
        audience: "all_customers",
        type: "announcement",
        title: title.trim(),
        content: content.trim(),
        channel: "in_app",
      });
      setTitle("");
      setContent("");
      setBroadcastMessage("Đã gửi thông báo trong ứng dụng.");
      await loadBroadcastHistory();
    } catch {
      setBroadcastMessage("Không thể gửi thông báo.");
    } finally {
      setSending(false);
    }
  }

  const route = processingActionRoute(detail, activeNotification);

  return (
    <div className="admin-page admin-core-page admin-notification-page">
      <header className="admin-page-header">
        <div>
          <h1>Thông báo</h1>
          <p className="admin-page-description">
            Theo dõi các thao tác của khách hàng cần admin xử lý, và soạn thông
            báo gửi tới khách hàng.
          </p>
        </div>
      </header>

      <div className="admin-notification-view-tabs">
        <button
          type="button"
          className={view === "feed" ? "is-active" : ""}
          onClick={() => setView("feed")}
        >
          Việc cần xử lý
          {unreadCount > 0 && (
            <span className="admin-notification-view-tabs__badge">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={view === "broadcast" ? "is-active" : ""}
          onClick={() => setView("broadcast")}
        >
          Gửi tới khách hàng
        </button>
      </div>

      {view === "feed" && (
        <section
          className="admin-notification-section-grid"
          aria-label="Nhóm thông báo theo nghiệp vụ"
        >
          {FEED_SECTIONS.map((section) => {
            const stats = sectionStats[section.value];
            const isActive = feedSection === section.value;
            return (
              <button
                type="button"
                key={section.value}
                className={isActive ? "is-active" : ""}
                aria-pressed={isActive}
                onClick={() => selectFeedSection(section.value)}
              >
                <span className="admin-notification-section-card__head">
                  <strong>{section.label}</strong>
                  <b>{stats.total}</b>
                </span>
                <small>{section.description}</small>
                <span className="admin-notification-section-card__status">
                  {stats.unread > 0
                    ? `${stats.unread} chưa đọc`
                    : "Không có mục mới"}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {view === "feed" ? (
        <div className="admin-notification-feed-layout">
          <section className="admin-core-panel">
            <header className="admin-notification-section-heading">
              <div>
                <p>Nhóm đang xem</p>
                <h2>{selectedSection.label}</h2>
              </div>
              <span>
                {sectionStats[feedSection].total} thông báo ·{" "}
                {sectionStats[feedSection].unread} chưa đọc
              </span>
            </header>
            <div
              className="admin-core-tabs"
              role="tablist"
              aria-label="Bộ lọc thông báo"
            >
              {FEED_TABS.map((item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={feedTab === item.value}
                  className={feedTab === item.value ? "is-active" : ""}
                  key={item.value}
                  onClick={() => setFeedTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                className="admin-notification-mark-all"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>

            {feedError && <p className="admin-core-alert">{feedError}</p>}

            <div className="admin-notification-feed-list">
              {feedLoading ? (
                <div className="admin-core-empty">Đang tải...</div>
              ) : visible.length === 0 ? (
                <div className="admin-core-empty">
                  {feedTab === "unread"
                    ? `Không có thông báo chưa đọc trong nhóm ${selectedSection.label.toLowerCase()}.`
                    : `Chưa có thông báo trong nhóm ${selectedSection.label.toLowerCase()}.`}
                </div>
              ) : (
                visible.map((item) => (
                  <article
                    key={item.id}
                    className={`admin-notification-feed-item${
                      item.isRead ? "" : " is-unread"
                    }${activeNotification?.id === item.id ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="admin-notification-feed-item__content"
                      onClick={() => void openDetail(item)}
                    >
                      <span className="admin-notification-feed-item__head">
                        {!item.isRead && (
                          <i
                            className="admin-notification-feed-item__dot"
                            aria-hidden="true"
                          />
                        )}
                        <span className="admin-notification-feed-item__type">
                          {typeLabel(item.type)}
                        </span>
                        <time>{formatTime(item.createdAt)}</time>
                      </span>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </button>
                    <button
                      type="button"
                      className="admin-notification-feed-item__cta"
                      onClick={() => void openDetail(item)}
                    >
                      Xem chi tiết
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="admin-core-panel admin-notification-detail">
            <header className="admin-core-panel__header">
              <div>
                <h2>Chi tiết thông báo</h2>
                <p>Thông tin liên quan &amp; xử lý</p>
              </div>
            </header>

            {!activeNotification ? (
              <div className="admin-core-empty">
                Chọn một thông báo để xem chi tiết.
              </div>
            ) : (
              <div className="admin-notification-detail__body">
                <p className="admin-notification-detail__type">
                  {typeLabel(activeNotification.type)}
                </p>
                <h3>{activeNotification.title}</h3>
                <p className="admin-notification-detail__message">
                  {activeNotification.message}
                </p>
                <time>{formatTime(activeNotification.createdAt)}</time>

                {detailLoading && (
                  <p className="admin-notification-detail__state">
                    Đang tải thông tin liên quan...
                  </p>
                )}
                {detailError && (
                  <p className="admin-core-alert">{detailError}</p>
                )}

                {detail.kind === "reservation_request" && (
                  <dl className="admin-notification-detail__facts">
                    <div>
                      <dt>Khách hàng</dt>
                      <dd>{detail.data.customerName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Liên hệ</dt>
                      <dd>
                        {detail.data.customerPhone ?? "—"}
                        {detail.data.customerEmail
                          ? ` · ${detail.data.customerEmail}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Loại yêu cầu</dt>
                      <dd>
                        Mua lô
                      </dd>
                    </div>
                    <div>
                      <dt>Lô đất</dt>
                      <dd>
                        {detail.data.plots?.length
                          ? detail.data.plots
                              .map((plot) => plot.code)
                              .join(", ")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tổng giá trị</dt>
                      <dd>{money(detail.data.totalPrice)}</dd>
                    </div>
                  </dl>
                )}

                {detail.kind === "offline_appointment" && (
                  <dl className="admin-notification-detail__facts">
                    <div>
                      <dt>Khách hàng</dt>
                      <dd>{detail.request?.customerName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Lô đất</dt>
                      <dd>
                        {detail.request?.plots?.length
                          ? detail.request.plots
                              .map((plot) => plot.code)
                              .join(", ")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Thời gian hẹn</dt>
                      <dd>
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(detail.data.scheduledAt))}
                      </dd>
                    </div>
                    <div>
                      <dt>Địa điểm</dt>
                      <dd>{detail.data.location}</dd>
                    </div>
                    <div>
                      <dt>Phản hồi của khách</dt>
                      <dd>
                        {detail.data.customerStatus === "confirmed"
                          ? "Đã xác nhận"
                          : detail.data.customerStatus === "declined"
                            ? "Đã từ chối"
                            : "Chờ phản hồi"}
                        {detail.data.statusNote
                          ? ` — ${detail.data.statusNote}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                )}

                {detail.kind === "service_order" && (
                  <dl className="admin-notification-detail__facts">
                    <div>
                      <dt>Khách hàng</dt>
                      <dd>
                        {detail.data.customerName}
                        {detail.data.customerPhone
                          ? ` · ${detail.data.customerPhone}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Dịch vụ</dt>
                      <dd>{detail.data.serviceName}</dd>
                    </div>
                    <div>
                      <dt>Lô đất</dt>
                      <dd>{detail.data.plotCode ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Giá trị</dt>
                      <dd>{money(detail.data.amount)}</dd>
                    </div>
                    {detail.data.note && (
                      <div>
                        <dt>Ghi chú khách</dt>
                        <dd>{detail.data.note}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {route && (
                  <button
                    type="button"
                    className="admin-notification-submit"
                    onClick={goToProcessing}
                  >
                    {route.label}
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="admin-notification-layout">
          <section className="admin-core-panel">
            <div
              className="admin-core-tabs"
              role="tablist"
              aria-label="Lịch sử thông báo đã gửi"
            >
              <button
                type="button"
                role="tab"
                aria-selected
                className="is-active"
              >
                Đã gửi chung
              </button>
            </div>

            <div className="admin-notification-list">
              {broadcastLoading ? (
                <div className="admin-core-empty">Đang tải...</div>
              ) : rows.length === 0 ? (
                <div className="admin-core-empty">Chưa gửi thông báo nào.</div>
              ) : (
                rows.map((row) => (
                  <article key={row.id}>
                    <strong>{row.title}</strong>
                    <p>{row.message}</p>
                    <small>
                      {row.recipientName ?? "Khách hàng"} ·{" "}
                      {new Date(row.createdAt).toLocaleString("vi-VN")}
                    </small>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="admin-core-panel admin-notification-compose">
            <header className="admin-core-panel__header">
              <div>
                <h2>Soạn thông báo</h2>
                <p>Gửi trong ứng dụng</p>
              </div>
            </header>
            <div className="admin-notification-form">
              <label>
                <span>Gửi đến</span>
                <input value="Tất cả khách hàng" disabled />
              </label>
              <label>
                <span>Tiêu đề</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                <span>Nội dung</span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={6}
                />
              </label>
              <p className="admin-notification-channel">
                Kênh gửi: thông báo trong ứng dụng
              </p>
              {broadcastMessage && (
                <div className="admin-notification-message">
                  {broadcastMessage}
                </div>
              )}
              <button
                type="button"
                className="admin-notification-submit"
                onClick={() => void send()}
                disabled={sending}
              >
                {sending ? "Đang gửi..." : "Gửi ngay"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
