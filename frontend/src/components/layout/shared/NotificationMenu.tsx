import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import {
  formatNotificationTime,
  notificationTypeLabel,
  type NotificationItem,
} from "./notification-menu-utils";
import "./notification-menu.css";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type NotificationMenuProps = {
  variant?: "dark" | "light";
};

export default function NotificationMenu({
  variant = "dark",
}: NotificationMenuProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const requestInFlightRef = useRef(false);
  const mutationVersionRef = useRef(0);

  async function load(silent = false) {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const requestVersion = mutationVersionRef.current;
    if (!silent) setLoading(true);
    setError("");

    try {
      const response =
        await api.get<ApiResponse<NotificationItem[]>>("/notifications");
      if (requestVersion === mutationVersionRef.current) {
        setItems(
          [...(response.data.data ?? [])].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      }
    } catch {
      setError("Không tải được thông báo.");
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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  async function toggleRead(item: NotificationItem) {
    const nextRead = !item.isRead;
    mutationVersionRef.current += 1;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, isRead: nextRead } : entry,
      ),
    );

    try {
      await api.patch(
        `/notifications/${item.id}/${nextRead ? "read" : "unread"}`,
      );
    } catch {
      void load(true);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    mutationVersionRef.current += 1;
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));

    try {
      await api.patch("/notifications/read-all");
    } catch {
      setItems(previous);
    } finally {
      setMarkingAll(false);
    }
  }

  async function clearAll() {
    if (items.length === 0) return;
    if (
      !window.confirm("Xóa toàn bộ thông báo? Thao tác này không thể hoàn tác.")
    ) {
      return;
    }

    setClearing(true);
    mutationVersionRef.current += 1;
    try {
      await api.delete("/notifications");
      setItems([]);
    } catch {
      setError("Không thể xóa thông báo. Vui lòng thử lại.");
    } finally {
      setClearing(false);
    }
  }

  function selectNotification(item: NotificationItem) {
    if (!item.isRead) void toggleRead(item);
  }

  function openAllNotifications() {
    setOpen(false);
    navigate(ROUTES.NOTIFICATION);
  }

  return (
    <div
      ref={rootRef}
      className={`notification-menu notification-menu--${variant}`}
    >
      <button
        type="button"
        className="notification-menu__trigger"
        aria-label={
          unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open && !loading && items.length === 0) void load();
        }}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="notification-menu__badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-menu__panel"
          role="dialog"
          aria-label="Thông báo gần đây"
        >
          <header className="notification-menu__header">
            <div>
              <strong>Thông báo</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} thông báo chưa đọc`
                  : "Bạn đã xem hết thông báo"}
              </span>
            </div>
            <div className="notification-menu__header-actions">
              <button
                type="button"
                className="notification-menu__mark-all"
                aria-label="Đánh dấu tất cả đã đọc"
                title="Đánh dấu tất cả đã đọc"
                disabled={markingAll || unreadCount === 0}
                onClick={() => void markAllRead()}
              >
                <CheckCheck size={16} />
              </button>
              <button
                type="button"
                className="notification-menu__clear"
                aria-label="Xóa tất cả thông báo"
                title={clearing ? "Đang xóa..." : "Xóa tất cả thông báo"}
                disabled={clearing || items.length === 0}
                onClick={() => void clearAll()}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </header>

          <div className="notification-menu__list">
            {loading ? (
              <p className="notification-menu__state">Đang tải thông báo...</p>
            ) : error && items.length === 0 ? (
              <button
                type="button"
                className="notification-menu__retry"
                onClick={() => void load()}
              >
                {error} Thử lại
              </button>
            ) : items.length === 0 ? (
              <p className="notification-menu__state">Chưa có thông báo nào.</p>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className={`notification-menu__item${
                    item.isRead ? "" : " is-unread"
                  }`}
                >
                  <button
                    type="button"
                    className="notification-menu__content"
                    onClick={() => selectNotification(item)}
                  >
                    <span className="notification-menu__item-head">
                      <span className="notification-menu__type">
                        {!item.isRead && (
                          <i
                            className="notification-menu__unread-dot"
                            aria-hidden="true"
                          />
                        )}
                        {notificationTypeLabel(item.type)}
                      </span>
                      <time>{formatNotificationTime(item.createdAt)}</time>
                    </span>
                    <strong>{item.title}</strong>
                    <span className="notification-menu__message">
                      {item.message}
                    </span>
                  </button>
                </article>
              ))
            )}
          </div>

          {error && items.length > 0 && (
            <p className="notification-menu__inline-error">{error}</p>
          )}

          <footer className="notification-menu__footer">
            <button
              type="button"
              className="notification-menu__details"
              onClick={openAllNotifications}
            >
              Xem tất cả thông báo
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
