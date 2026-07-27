import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  broadcast: boolean;
  recipientName?: string;
  createdAt: string;
}

const panel: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-secondary)",
  color: "var(--color-text-primary)",
};

export default function NotificationManagementPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<"all" | "unread" | "broadcast">("all");
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
    void load();
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
    <div style={{ display: "grid", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24 }}>Thông báo hệ thống</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
          Quản lý và gửi thông báo tới khách hàng
        </p>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        <section style={panel}>
          <div style={{ padding: 16, display: "flex", gap: 8, borderBottom: "1px solid var(--color-border)" }}>
            {(["all", "unread", "broadcast"] as const).map((value) => (
              <button key={value} onClick={() => setTab(value)}>
                {value === "all" ? "Tất cả" : value === "unread" ? "Chưa đọc" : "Broadcast"}
              </button>
            ))}
          </div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {loading ? <div>Đang tải...</div> : visible.length === 0 ? (
              <div>Không có thông báo.</div>
            ) : visible.map((row) => (
              <article key={row.id} style={{ padding: 12, border: "1px solid var(--color-border)", borderRadius: 9 }}>
                <strong>{row.title}</strong>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{row.message}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
                  {row.recipientName ?? "Khách hàng"} · {new Date(row.createdAt).toLocaleString("vi-VN")}
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside style={{ ...panel, padding: 20, alignSelf: "start", display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Soạn thông báo</h2>
          <label>Gửi đến<input value="Tất cả khách hàng" disabled style={input} /></label>
          <label>Tiêu đề<input value={title} onChange={(event) => setTitle(event.target.value)} style={input} /></label>
          <label>Nội dung<textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} style={input} /></label>
          <label><input type="checkbox" checked readOnly /> Trong ứng dụng</label>
          <label title="Chưa được backend hỗ trợ"><input type="checkbox" disabled /> Email (chưa hỗ trợ)</label>
          <label title="Chưa được backend hỗ trợ"><input type="checkbox" disabled /> SMS (chưa hỗ trợ)</label>
          {message && <div style={{ fontSize: 12 }}>{message}</div>}
          <button onClick={() => void send()} disabled={sending}>{sending ? "Đang gửi..." : "Gửi ngay"}</button>
          <button disabled title="Backend chưa hỗ trợ lên lịch">Lên lịch gửi (chưa hỗ trợ)</button>
        </aside>
      </div>
    </div>
  );
}
