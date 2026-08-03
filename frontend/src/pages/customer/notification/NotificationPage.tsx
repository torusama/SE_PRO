// Chuyển thể 1:1 từ mockup fr09_thong_bao.html.
// Đã bỏ thanh nav riêng của mockup (CustomerLayout đã có Navbar dùng chung),
// bỏ nhãn "FR-xx", và bỏ bảng cài đặt kênh thông báo trùng lặp (đã có thật ở
// trang Hồ sơ > "Liên hệ & thông báo" — chỉ để 1 nút dẫn sang đó).
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { ROUTES } from "@/constants/routes";
import "./NotificationPage.css";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  createdAt: string;
}

type FilterKey =
  "all" | "unread" | "request" | "contract" | "service" | "reminder";

const TYPE_META: Record<
  string,
  { icon: string; iconClass: string; tagClass: string; group: FilterKey }
> = {
  request_submitted: {
    icon: "📝",
    iconClass: "type-info",
    tagClass: "tag-service",
    group: "request",
  },
  request_approved: {
    icon: "✅",
    iconClass: "type-service",
    tagClass: "tag-done",
    group: "request",
  },
  request_rejected: {
    icon: "⛔",
    iconClass: "type-alert",
    tagClass: "tag-urgent",
    group: "request",
  },
  request_cancelled: {
    icon: "🚫",
    iconClass: "type-alert",
    tagClass: "tag-urgent",
    group: "request",
  },
  contract_updated: {
    icon: "📄",
    iconClass: "type-payment",
    tagClass: "tag-payment",
    group: "contract",
  },
  contract_created: {
    icon: "📄",
    iconClass: "type-payment",
    tagClass: "tag-payment",
    group: "contract",
  },
  service_submitted: {
    icon: "🌸",
    iconClass: "type-service",
    tagClass: "tag-service",
    group: "service",
  },
  service_pending_confirm: {
    icon: "🌸",
    iconClass: "type-service",
    tagClass: "tag-service",
    group: "service",
  },
  service_confirmed: {
    icon: "🌸",
    iconClass: "type-service",
    tagClass: "tag-service",
    group: "service",
  },
  service_in_progress: {
    icon: "🌸",
    iconClass: "type-service",
    tagClass: "tag-service",
    group: "service",
  },
  service_completed: {
    icon: "🌸",
    iconClass: "type-service",
    tagClass: "tag-done",
    group: "service",
  },
  service_cancelled: {
    icon: "🌸",
    iconClass: "type-alert",
    tagClass: "tag-urgent",
    group: "service",
  },
  transfer_submitted: {
    icon: "🔄",
    iconClass: "type-info",
    tagClass: "tag-service",
    group: "request",
  },
  transfer_approved: {
    icon: "🔄",
    iconClass: "type-service",
    tagClass: "tag-done",
    group: "request",
  },
  transfer_rejected: {
    icon: "🔄",
    iconClass: "type-alert",
    tagClass: "tag-urgent",
    group: "request",
  },
  memorial_reminder: {
    icon: "🕯️",
    iconClass: "type-reminder",
    tagClass: "tag-payment",
    group: "reminder",
  },
  system_update: {
    icon: "ℹ️",
    iconClass: "type-info",
    tagClass: "tag-service",
    group: "all",
  },
};

function metaFor(type: string) {
  if (TYPE_META[type]) return TYPE_META[type];
  if (type.startsWith("service_")) return TYPE_META.service_submitted;
  if (type.startsWith("request_")) return TYPE_META.request_submitted;
  if (type.startsWith("contract_")) return TYPE_META.contract_updated;
  if (type.startsWith("transfer_")) return TYPE_META.transfer_submitted;
  return {
    icon: "🔔",
    iconClass: "type-info",
    tagClass: "tag-service",
    group: "all" as FilterKey,
  };
}

function formatRelative(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function dayGroupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Hôm nay";
  if (sameDay(date, yesterday)) return "Hôm qua";
  const diffDay = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDay <= 7) return "Tuần này";
  return "Trước đó";
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không tải được thông báo. Vui lòng thử lại.";
}

function targetRoute(item: NotificationItem): string | null {
  switch (item.relatedEntityType) {
    case "reservation_request":
      return ROUTES.MY_LOTS;
    case "contract":
      return ROUTES.MY_LOTS;
    case "service_order":
      return `${ROUTES.SERVICES}?tab=track${item.relatedEntityId ? `&order=${item.relatedEntityId}` : ""}`;
    case "reminder":
      return ROUTES.REMINDERS;
    default:
      return null;
  }
}

const PAGE_SIZE = 8;

export default function NotificationPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const requestInFlightRef = useRef(false);
  const mutationVersionRef = useRef(0);

  async function load(silent = false) {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const requestVersion = mutationVersionRef.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const res =
        await api.get<ApiResponse<NotificationItem[]>>("/notifications");
      if (requestVersion === mutationVersionRef.current) {
        setItems(res.data.data ?? []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void load(), 0);
    const refreshId = window.setInterval(() => void load(true), 1_000);
    const handleFocus = () => void load(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(refreshId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );
  const counts = useMemo(
    () => ({
      request: items.filter((n) => metaFor(n.type).group === "request").length,
      contract: items.filter((n) => metaFor(n.type).group === "contract")
        .length,
      service: items.filter((n) => metaFor(n.type).group === "service").length,
      reminder: items.filter((n) => metaFor(n.type).group === "reminder")
        .length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.isRead);
    return items.filter((n) => metaFor(n.type).group === filter);
  }, [items, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const item of paged) {
      const key = dayGroupLabel(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [paged]);

  function changeFilter(key: FilterKey) {
    setFilter(key);
    setPage(1);
  }

  async function markOneRead(item: NotificationItem) {
    if (item.isRead) return;
    mutationVersionRef.current += 1;
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
    );
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch {
      void load();
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    mutationVersionRef.current += 1;
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.patch("/notifications/read-all");
    } catch {
      setItems(previous);
    } finally {
      setMarkingAll(false);
    }
  }

  function handleClick(item: NotificationItem) {
    void markOneRead(item);
    const route = targetRoute(item);
    if (route) navigate(route);
  }

  return (
    <div className="notification-page">
      <div className="bg-canvas">
        <div
          className="glow-orb"
          style={{
            width: 500,
            height: 500,
            top: "-10%",
            left: "-10%",
            background: "radial-gradient(circle, #00e5c4, transparent 70%)",
          }}
        />
        <div
          className="glow-orb"
          style={{
            width: 420,
            height: 420,
            bottom: "-10%",
            right: "-5%",
            background: "radial-gradient(circle, #c9a84c, transparent 70%)",
            animationDelay: "3s",
          }}
        />
      </div>

      <div className="breadcrumb">
        <a onClick={() => navigate(ROUTES.HOME)}>Trang chủ</a>
        <span className="sep">›</span>
        <span className="current">Thông báo</span>
      </div>

      <div className="page-wrap">
        <header className="page-header">
          <h1 className="page-title">
            <small>Customer Portal</small>
            Trung Tâm Thông Báo
          </h1>
          <div className="header-actions">
            <button
              className="btn-outline"
              onClick={() => void markAllRead()}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? "Đang cập nhật..." : "Đánh dấu tất cả đã đọc"}
            </button>
            <button
              className="btn-outline"
              onClick={() =>
                navigate(ROUTES.PROFILE, { state: { tab: "contact" } })
              }
            >
              ⚙ Cài đặt
            </button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <nav className="filter-bar">
          <button
            className={`filter-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => changeFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`filter-tab ${filter === "unread" ? "active" : ""}`}
            onClick={() => changeFilter("unread")}
          >
            Chưa đọc
            {unreadCount > 0 && (
              <span className="tab-badge">{unreadCount}</span>
            )}
          </button>
          <button
            className={`filter-tab ${filter === "request" ? "active" : ""}`}
            onClick={() => changeFilter("request")}
          >
            Yêu cầu
            {counts.request > 0 && (
              <span className="tab-badge">{counts.request}</span>
            )}
          </button>
          <button
            className={`filter-tab ${filter === "contract" ? "active" : ""}`}
            onClick={() => changeFilter("contract")}
          >
            Hợp đồng
            {counts.contract > 0 && (
              <span className="tab-badge">{counts.contract}</span>
            )}
          </button>
          <button
            className={`filter-tab ${filter === "service" ? "active" : ""}`}
            onClick={() => changeFilter("service")}
          >
            Dịch vụ
            {counts.service > 0 && (
              <span className="tab-badge">{counts.service}</span>
            )}
          </button>
          <button
            className={`filter-tab ${filter === "reminder" ? "active" : ""}`}
            onClick={() => changeFilter("reminder")}
          >
            Nhắc lịch
            {counts.reminder > 0 && (
              <span className="tab-badge">{counts.reminder}</span>
            )}
          </button>
        </nav>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <p>Đang tải thông báo...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <p>Không có thông báo nào ở mục này.</p>
          </div>
        ) : (
          <>
            {grouped.map(([label, group]) => (
              <div key={label}>
                <div className="section-label">{label}</div>
                <div className="notif-list">
                  {group.map((item) => {
                    const meta = metaFor(item.type);
                    return (
                      <article
                        key={item.id}
                        className={`notif-item ${item.isRead ? "" : "unread"}`}
                        onClick={() => handleClick(item)}
                      >
                        <div className={`notif-icon ${meta.iconClass}`}>
                          {meta.icon}
                        </div>
                        <div className="notif-body">
                          <div className="notif-title">{item.title}</div>
                          <p className="notif-desc">{item.message}</p>
                          <div className="notif-tags">
                            <span className={`notif-tag ${meta.tagClass}`}>
                              {item.relatedEntityType ?? item.type}
                            </span>
                          </div>
                        </div>
                        <div className="notif-meta">
                          <div className="notif-time">
                            {formatRelative(item.createdAt)}
                          </div>
                          {!item.isRead && <div className="notif-dot" />}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}

            {pageCount > 1 && (
              <div className="pagination">
                <button
                  className="pg-btn"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`pg-btn ${p === page ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="pg-btn"
                  disabled={page >= pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
