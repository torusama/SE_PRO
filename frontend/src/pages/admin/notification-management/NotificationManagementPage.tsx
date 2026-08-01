import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import "../AdminCorePages.css";

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  broadcast: boolean;
  recipientName?: string;
  createdAt: string;
}

const TABS = [
  { value: "all", label: "Tất cả" },
  { value: "unread", label: "Chưa đọc" },
  { value: "broadcast", label: "Đã gửi chung" },
] as const;

export default function NotificationManagementPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [tab, setTab] =
    useState<(typeof TABS)[number]["value"]>("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/notifications", {
        params: { page: 1, pageSize: 100 },
      });
      setRows(response.data.data?.items ?? []);
      setMessage("");
    } catch {
      setMessage("Không thể tải danh sách thông báo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (tab === "unread") return !row.isRead;
        if (tab === "broadcast") return row.broadcast;
        return true;
      }),
    [rows, tab],
  );

  async function send() {
    if (!title.trim() || !content.trim()) {
      setMessage("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
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
      setMessage("Đã gửi thông báo trong ứng dụng.");
      await load();
    } catch {
      setMessage("Không thể gửi thông báo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-page admin-core-page admin-notification-page">
      <header className="admin-page-header">
        <div>
          <h1>Thông báo hệ thống</h1>
          <p className="admin-page-description">
            Quản lý nội dung đã gửi và soạn thông báo mới cho khách hàng.
          </p>
        </div>
      </header>

      <div className="admin-notification-layout">
        <section className="admin-core-panel">
          <div className="admin-core-tabs" role="tablist" aria-label="Bộ lọc thông báo">
            {TABS.map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                className={tab === item.value ? "is-active" : ""}
                key={item.value}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="admin-notification-list">
            {loading ? (
              <div className="admin-core-empty">Đang tải...</div>
            ) : visible.length === 0 ? (
              <div className="admin-core-empty">Không có thông báo.</div>
            ) : (
              visible.map((row) => (
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
            {message && <div className="admin-notification-message">{message}</div>}
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
    </div>
  );
}
