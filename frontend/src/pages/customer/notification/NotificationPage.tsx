import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { ROUTES } from "@/constants/routes";

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
  | "all"
  | "unread"
  | "request"
  | "contract"
  | "service"
  | "reminder";

const TYPE_META: Record<
  string,
  { icon: string; color: string; bg: string; group: FilterKey }
> = {
  request_submitted: {
    icon: "📝",
    color: "#4da6ff",
    bg: "rgba(77,166,255,0.14)",
    group: "request",
  },
  request_approved: {
    icon: "✅",
    color: "#00c8a0",
    bg: "rgba(0,200,160,0.14)",
    group: "request",
  },
  request_rejected: {
    icon: "⛔",
    color: "#ff5c5c",
    bg: "rgba(255,92,92,0.14)",
    group: "request",
  },
  request_cancelled: {
    icon: "🚫",
    color: "#8da5c0",
    bg: "rgba(141,165,192,0.14)",
    group: "request",
  },
  contract_updated: {
    icon: "📄",
    color: "#c9a84c",
    bg: "rgba(201,168,76,0.14)",
    group: "contract",
  },
  contract_created: {
    icon: "📄",
    color: "#c9a84c",
    bg: "rgba(201,168,76,0.14)",
    group: "contract",
  },
  contract_pdf_ready: {
    icon: "📥",
    color: "#c9a84c",
    bg: "rgba(201,168,76,0.14)",
    group: "contract",
  },
  service_submitted: {
    icon: "🌸",
    color: "#4da6ff",
    bg: "rgba(77,166,255,0.14)",
    group: "service",
  },
  service_confirmed: {
    icon: "🌸",
    color: "#4da6ff",
    bg: "rgba(77,166,255,0.14)",
    group: "service",
  },
  service_in_progress: {
    icon: "🌸",
    color: "#00c8a0",
    bg: "rgba(0,200,160,0.14)",
    group: "service",
  },
  service_completed: {
    icon: "🌸",
    color: "#00c8a0",
    bg: "rgba(0,200,160,0.2)",
    group: "service",
  },
  service_cancelled: {
    icon: "🌸",
    color: "#8da5c0",
    bg: "rgba(141,165,192,0.14)",
    group: "service",
  },
  transfer_submitted: {
    icon: "🔄",
    color: "#7b6bcc",
    bg: "rgba(123,107,204,0.14)",
    group: "request",
  },
  transfer_approved: {
    icon: "🔄",
    color: "#00c8a0",
    bg: "rgba(0,200,160,0.14)",
    group: "request",
  },
  transfer_rejected: {
    icon: "🔄",
    color: "#ff5c5c",
    bg: "rgba(255,92,92,0.14)",
    group: "request",
  },
  memorial_reminder: {
    icon: "🕯️",
    color: "#c9a84c",
    bg: "rgba(201,168,76,0.14)",
    group: "reminder",
  },
  system_update: {
    icon: "ℹ️",
    color: "#7a9a90",
    bg: "rgba(122,154,144,0.14)",
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
    color: "#7a9a90",
    bg: "rgba(122,154,144,0.14)",
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
      return ROUTES.SERVICES;
    default:
      return null;
  }
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res =
        await api.get<ApiResponse<NotificationItem[]>>("/notifications");
      setItems(res.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.isRead);
    return items.filter((n) => metaFor(n.type).group === filter);
  }, [items, filter]);

  async function markOneRead(item: NotificationItem) {
    if (item.isRead) return;
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
    );
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch {
      // rollback lặng lẽ nếu request lỗi
      void load();
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
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
    <main style={styles.page}>
      <div style={styles.breadcrumb}>
        <span>Trang chủ</span>
        <span style={styles.sep}>›</span>
        <span style={styles.current}>Thông báo</span>
      </div>

      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Customer Portal · Thông báo</p>
          <h1 style={styles.title}>Trung Tâm Thông Báo</h1>
          <p style={styles.subtitle}>
            Cập nhật về yêu cầu giữ chỗ/mua lô, hợp đồng, dịch vụ đã đặt và các
            nhắc lịch quan trọng.
          </p>
        </div>
        <button
          type="button"
          style={styles.markAllButton}
          onClick={() => void markAllRead()}
          disabled={markingAll || unreadCount === 0}
        >
          {markingAll
            ? "Đang cập nhật..."
            : `Đánh dấu tất cả đã đọc${unreadCount ? ` (${unreadCount})` : ""}`}
        </button>
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}

      <nav style={styles.filterBar}>
        <FilterChip
          active={filter === "all"}
          label={`Tất cả (${items.length})`}
          onClick={() => setFilter("all")}
        />
        <FilterChip
          active={filter === "unread"}
          label={`Chưa đọc (${unreadCount})`}
          onClick={() => setFilter("unread")}
        />
        <FilterChip
          active={filter === "request"}
          label="Yêu cầu giữ chỗ/mua lô"
          onClick={() => setFilter("request")}
        />
        <FilterChip
          active={filter === "contract"}
          label="Hợp đồng"
          onClick={() => setFilter("contract")}
        />
        <FilterChip
          active={filter === "service"}
          label="Dịch vụ"
          onClick={() => setFilter("service")}
        />
        <FilterChip
          active={filter === "reminder"}
          label="Nhắc lịch"
          onClick={() => setFilter("reminder")}
        />
      </nav>

      {loading ? (
        <div style={styles.empty}>Đang tải thông báo...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>Không có thông báo nào ở mục này.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map((item) => {
            const meta = metaFor(item.type);
            return (
              <article
                key={item.id}
                style={{
                  ...styles.card,
                  ...(item.isRead ? {} : styles.cardUnread),
                }}
                onClick={() => handleClick(item)}
              >
                <div
                  style={{
                    ...styles.iconWrap,
                    color: meta.color,
                    background: meta.bg,
                  }}
                >
                  {meta.icon}
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.cardTop}>
                    <strong style={styles.cardTitle}>{item.title}</strong>
                    <span style={styles.cardTime}>
                      {formatRelative(item.createdAt)}
                    </span>
                  </div>
                  <p style={styles.cardMessage}>{item.message}</p>
                </div>
                {!item.isRead ? <span style={styles.unreadDot} /> : null}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.filterChip,
        ...(active ? styles.filterChipActive : {}),
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 80px)",
    padding: "20px 20px 64px",
    background: "#04060e",
    color: "#d4e8e0",
    fontFamily: "Be Vietnam Pro, sans-serif",
    maxWidth: 900,
    margin: "0 auto",
  },
  breadcrumb: {
    fontSize: 12,
    color: "#7a9a90",
    marginBottom: 18,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  sep: { opacity: 0.4 },
  current: { color: "#00b89e" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    color: "#c9a84c",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontSize: 12,
  },
  title: {
    margin: "6px 0",
    color: "#e8f4f0",
    fontFamily: "Playfair Display, serif",
    fontSize: 30,
  },
  subtitle: { margin: 0, color: "#7a9a90", maxWidth: 560 },
  markAllButton: {
    border: "1px solid rgba(0,229,196,0.24)",
    borderRadius: 8,
    background: "rgba(0,229,196,0.06)",
    color: "#bdfdf2",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
  },
  error: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid rgba(232,74,74,0.35)",
    borderRadius: 8,
    color: "#ffb3b3",
    background: "rgba(232,74,74,0.08)",
  },
  filterBar: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  filterChip: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 999,
    padding: "7px 16px",
    background: "transparent",
    color: "#7a9a90",
    fontSize: 12,
    cursor: "pointer",
  },
  filterChipActive: {
    borderColor: "#00b89e",
    color: "#00e5c4",
    background: "rgba(0,229,196,0.08)",
  },
  list: { display: "grid", gap: 10 },
  card: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 10,
    background: "rgba(8,13,26,0.76)",
    padding: 16,
    cursor: "pointer",
    position: "relative",
  },
  cardUnread: {
    borderColor: "rgba(201,168,76,0.3)",
    background: "rgba(201,168,76,0.04)",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: { color: "#e8f4f0", fontSize: 14 },
  cardTime: { color: "#7a9a90", fontSize: 12, flexShrink: 0 },
  cardMessage: { margin: 0, color: "#9fb8ae", fontSize: 13, lineHeight: 1.6 },
  unreadDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#c9a84c",
  },
  empty: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 8,
    background: "rgba(8,13,26,0.76)",
    padding: 24,
    color: "#7a9a90",
    textAlign: "center",
  },
};
