import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import "../AdminCorePages.css";
import "./DeceasedProfilesAdminPage.css";

interface Profile {
  id: number;
  plotId: number;
  plotCode?: string;
  fullName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  burialDate?: string;
  hometown?: string;
  biography?: string;
  verificationStatus: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

const date = (value?: string) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(value)) : "—";
const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const statusLabel: Record<string, string> = {
  pending_verification: "Chờ xác minh",
  verified: "Đã xác minh",
  rejected: "Đã từ chối",
};
const statusTone: Record<string, string> = {
  pending_verification: "pending",
  verified: "verified",
  rejected: "rejected",
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (message) return message;
  }
  return "Không thể tải dữ liệu hồ sơ.";
}

export default function DeceasedProfilesAdminPage() {
  const [searchParams] = useSearchParams();
  const requestedId = Number(searchParams.get("profileId")) || undefined;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [detail, setDetail] = useState<Profile>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get("/admin/deceased", { params: { page: 1, pageSize: 100 } });
      const rows: Profile[] = response.data.data?.items ?? [];
      setProfiles(rows);
      setSelectedId((current) => rows.some((item) => item.id === (requestedId ?? current)) ? (requestedId ?? current) : rows[0]?.id);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }, [requestedId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => {
    if (!selectedId) { queueMicrotask(() => setDetail(undefined)); return; }
    queueMicrotask(() => {
      setBusy("detail");
      void api.get(`/deceased/${selectedId}`)
        .then((response) => setDetail(response.data.data))
        .catch((caught) => setError(errorMessage(caught)))
        .finally(() => setBusy(""));
    });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return profiles.filter((item) => {
      const matchesKeyword = !keyword || [item.fullName, item.plotCode].some((value) => value?.toLocaleLowerCase("vi").includes(keyword));
      const matchesStatus = statusFilter === "all" || item.verificationStatus === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [profiles, search, statusFilter]);
  const current = detail?.id === selectedId ? detail : profiles.find((item) => item.id === selectedId);

  async function verify() {
    if (!current) return;
    setBusy("verify"); setError(""); setMessage("");
    try {
      await api.patch(`/admin/deceased/${current.id}/verify`);
      setMessage("Đã xác minh hồ sơ.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function reject() {
    if (!current) return;
    const reason = window.prompt("Lý do từ chối hồ sơ?");
    if (!reason) return;
    setBusy("reject"); setError(""); setMessage("");
    try {
      await api.patch(`/admin/deceased/${current.id}/reject`, { reason });
      setMessage("Đã từ chối hồ sơ.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function updateCapacity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = event.currentTarget;
    const capacity = Number(new FormData(form).get("capacity"));
    setBusy("capacity"); setError(""); setMessage("");
    try {
      await api.patch(`/admin/plots/${current.plotId}/deceased-capacity`, { capacity });
      setMessage("Đã cập nhật sức chứa lô.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }

  return <div className="admin-page deceased-archive" style={{ display: "grid", gap: 18 }}>
    <header className="admin-page-header">
      <div>
        <h1>Hồ sơ người đã khuất</h1>
        <p>Kho lưu trữ và kiểm duyệt hồ sơ người đã khuất, tra cứu theo lô đất và trạng thái xác minh.</p>
      </div>
      <button className="admin-secondary-button" onClick={() => void load()} disabled={loading}>Làm mới</button>
    </header>

    {error && <div className="admin-error-banner">{error}</div>}
    {message && <div className="admin-ok-banner">{message}</div>}

    <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
      <aside className="admin-panel" style={{ padding: 12, alignSelf: "start" }}>
        <input className="admin-input" placeholder="Tìm họ tên, mã lô..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="admin-input" style={{ marginTop: 8 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="pending_verification">Chờ xác minh</option>
          <option value="verified">Đã xác minh</option>
          <option value="rejected">Đã từ chối</option>
        </select>
        <div style={{ display: "grid", gap: 7, marginTop: 12, maxHeight: "65vh", overflow: "auto" }}>
          {loading ? <p>Đang tải...</p> : filtered.length === 0 ? <p>Không tìm thấy hồ sơ.</p> : filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              style={{
                textAlign: "left", padding: 12, borderRadius: 8,
                border: item.id === selectedId ? "1px solid #008573" : "1px solid var(--color-border)",
                background: item.id === selectedId ? "#eef8f6" : "#fff", color: "inherit",
              }}
            >
              <strong style={{ display: "block", color: "#008573" }}>{item.fullName}</strong>
              <span style={{ display: "block", margin: "5px 0" }}>{item.plotCode ?? `Lô #${item.plotId}`}</span>
              <small>
                <span className={`deceased-status deceased-status--${statusTone[item.verificationStatus] ?? "default"}`}>
                  {statusLabel[item.verificationStatus] ?? item.verificationStatus}
                </span>
              </small>
            </button>
          ))}
        </div>
      </aside>

      <main className="admin-panel" style={{ padding: 22 }}>
        {!current || busy === "detail" ? <p>{busy === "detail" ? "Đang tải chi tiết..." : "Chọn một hồ sơ để xem."}</p> : <div style={{ display: "grid", gap: 22 }}>
          <section className="admin-page-header">
            <div>
              <small style={{ color: "#008573", fontWeight: 800 }}>HỒ SƠ NGƯỜI ĐÃ KHUẤT</small>
              <h2 style={{ margin: "5px 0" }}>{current.fullName}</h2>
              <p>
                <span className={`deceased-status deceased-status--${statusTone[current.verificationStatus] ?? "default"}`}>
                  {statusLabel[current.verificationStatus] ?? current.verificationStatus}
                </span>
              </p>
            </div>
            {current.verificationStatus === "pending_verification" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="admin-secondary-button" onClick={() => void reject()} disabled={busy === "reject"}>
                  {busy === "reject" ? "Đang xử lý..." : "Từ chối"}
                </button>
                <button className="admin-primary-button" onClick={() => void verify()} disabled={busy === "verify"}>
                  {busy === "verify" ? "Đang xử lý..." : "Xác minh hồ sơ"}
                </button>
              </div>
            )}
          </section>

          <section className="admin-detail-grid">
            <div><span>Mã lô</span><strong>{current.plotCode ?? `#${current.plotId}`}</strong></div>
            <div><span>Ngày sinh</span><strong>{date(current.dateOfBirth)}</strong></div>
            <div><span>Ngày mất</span><strong>{date(current.dateOfDeath)}</strong></div>
            <div><span>Ngày an táng</span><strong>{date(current.burialDate)}</strong></div>
            <div><span>Quê quán</span><strong>{current.hometown || "—"}</strong></div>
            <div><span>Ngày tạo hồ sơ</span><strong>{dateTime(current.createdAt)}</strong></div>
          </section>

          <section>
            <h3>Tiểu sử</h3>
            <div style={{ whiteSpace: "pre-wrap", padding: 14, borderRadius: 8, background: "var(--admin-soft, #f5f6f6)", color: "var(--color-text-secondary)" }}>
              {current.biography || "Chưa có tiểu sử."}
            </div>
          </section>

          {current.verificationStatus === "rejected" && (
            <section>
              <h3>Lý do từ chối</h3>
              <div style={{ whiteSpace: "pre-wrap", padding: 14, borderRadius: 8, background: "#f9e9e7", color: "#8d3129" }}>
                {current.rejectionReason || "Không có lý do."}
              </div>
            </section>
          )}

          <section>
            <h3>Cấu hình sức chứa lô</h3>
            <form className="deceased-capacity-form" onSubmit={(event) => void updateCapacity(event)}>
              <label>
                Sức chứa (số hồ sơ tối đa trên lô {current.plotCode ?? `#${current.plotId}`})
                <input className="admin-input" name="capacity" type="number" min={1} required />
              </label>
              <button className="admin-secondary-button" disabled={busy === "capacity"}>
                {busy === "capacity" ? "Đang lưu..." : "Cập nhật sức chứa"}
              </button>
            </form>
          </section>
        </div>}
      </main>
    </div>
  </div>;
}