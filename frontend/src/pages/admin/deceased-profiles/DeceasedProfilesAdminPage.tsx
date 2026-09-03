import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import "../AdminCorePages.css";
import "./DeceasedProfilesAdminPage.css";

interface Profile {
  id: number;
  plotId: number | null;
  plotCode?: string;
  isExternalPlot?: boolean;
  externalPlotNote?: string;
  fullName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  burialDate?: string;
  dateCalendarType?: "solar" | "lunar";
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  anniversaryDay?: number;
  anniversaryMonth?: number;
  anniversaryYear?: number;
  hometown?: string;
  biography?: string;
  verificationStatus: string;
  rejectionReason?: string;
  deletionRequestedAt?: string;
  deletionReason?: string;
  deletionDeniedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";
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
function formatBirth(profile: Profile): string {
  if (profile.birthDay && profile.birthMonth) {
    const dmy = [profile.birthDay, profile.birthMonth, profile.birthYear]
      .filter(Boolean)
      .map((value, index) =>
        index < 2
          ? String(value).padStart(2, "0")
          : String(value).padStart(4, "0"),
      )
      .join("/");
    return `${dmy} (${profile.dateCalendarType === "lunar" ? "Âm lịch" : "Dương lịch"})`;
  }
  return date(profile.dateOfBirth);
}
function formatAnniversary(profile: Profile): string {
  if (profile.anniversaryDay && profile.anniversaryMonth) {
    const dmy = [
      profile.anniversaryDay,
      profile.anniversaryMonth,
      profile.anniversaryYear,
    ]
      .filter(Boolean)
      .join("/");
    return `${dmy} (${profile.dateCalendarType === "lunar" ? "Âm lịch" : "Dương lịch"})`;
  }
  return date(profile.dateOfDeath);
}
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
    const message = (error as { response?: { data?: { message?: string } } })
      .response?.data?.message;
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { promptFor, dialog: promptDialog } = usePromptDialog();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const response = await api.get("/admin/deceased", {
          params: { page: 1, pageSize: 100 },
        });
        const rows: Profile[] = response.data.data?.items ?? [];
        setProfiles(rows);
        setSelectedId((current) =>
          rows.some((item) => item.id === (requestedId ?? current))
            ? (requestedId ?? current)
            : rows[0]?.id,
        );
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [requestedId],
  );
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => setDetail(undefined));
      return;
    }
    queueMicrotask(() => {
      setBusy("detail");
      void api
        .get(`/deceased/${selectedId}`)
        .then((response) => setDetail(response.data.data))
        .catch((caught) => setError(errorMessage(caught)))
        .finally(() => setBusy(""));
    });
  }, [selectedId]);
  useRealtimeRefresh(["deceased", "plots"], async () => {
    await load(true);
    if (selectedId) {
      const response = await api.get(`/deceased/${selectedId}`);
      setDetail(response.data.data);
    }
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return profiles.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.fullName, item.plotCode].some((value) =>
          value?.toLocaleLowerCase("vi").includes(keyword),
        );
      const matchesStatus =
        statusFilter === "all" || item.verificationStatus === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [profiles, search, statusFilter]);
  const current =
    detail?.id === selectedId
      ? detail
      : profiles.find((item) => item.id === selectedId);

  async function verify() {
    if (!current) return;
    setBusy("verify");
    setError("");
    setMessage("");
    try {
      await api.patch(`/admin/deceased/${current.id}/verify`);
      setMessage("Đã xác minh hồ sơ.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function reject() {
    if (!current) return;
    const reason = await promptFor({
      title: "Từ chối hồ sơ",
      message: "Nhập lý do từ chối hồ sơ này:",
      placeholder: "Lý do từ chối...",
      confirmLabel: "Từ chối hồ sơ",
      variant: "danger",
      required: true,
    });
    if (!reason?.trim()) return;
    setBusy("reject");
    setError("");
    setMessage("");
    try {
      await api.patch(`/admin/deceased/${current.id}/reject`, { reason });
      setMessage("Đã từ chối hồ sơ.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function approveDeletion() {
    if (!current) return;
    const confirmed = await confirm({
      title: "Duyệt yêu cầu xoá hồ sơ",
      message: `Duyệt yêu cầu xoá hồ sơ "${current.fullName}"? Hành động này không thể hoàn tác.`,
      confirmLabel: "Duyệt & xoá hồ sơ",
      variant: "danger",
    });
    if (!confirmed) return;
    setBusy("approve-deletion");
    setError("");
    setMessage("");
    try {
      await api.post(`/admin/deceased/${current.id}/approve-deletion`);
      setMessage("Đã xoá hồ sơ theo yêu cầu.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function denyDeletion() {
    if (!current) return;
    const reason = await promptFor({
      title: "Từ chối yêu cầu xoá",
      message: "Lý do từ chối yêu cầu xoá? (sẽ hiển thị lại cho gia đình)",
      placeholder: "Lý do từ chối yêu cầu xoá...",
      confirmLabel: "Từ chối yêu cầu",
      variant: "danger",
      required: true,
    });
    if (!reason?.trim()) return;
    setBusy("deny-deletion");
    setError("");
    setMessage("");
    try {
      await api.post(`/admin/deceased/${current.id}/deny-deletion`, {
        reason: reason.trim(),
      });
      setMessage("Đã từ chối yêu cầu xoá.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  async function updateCapacity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = event.currentTarget;
    const capacity = Number(new FormData(form).get("capacity"));
    setBusy("capacity");
    setError("");
    setMessage("");
    try {
      await api.patch(`/admin/plots/${current.plotId}/deceased-capacity`, {
        capacity,
      });
      setMessage("Đã cập nhật sức chứa lô.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className="admin-page deceased-archive"
      style={{ display: "grid", gap: 18 }}
    >
      <header className="admin-page-header">
        <div>
          <h1>Hồ sơ người đã khuất</h1>
          <p>
            Kho lưu trữ và kiểm duyệt hồ sơ người đã khuất, tra cứu theo lô đất
            và trạng thái xác minh.
          </p>
        </div>
      </header>

      {error && <div className="admin-error-banner">{error}</div>}
      {message && <div className="admin-ok-banner">{message}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <aside
          className="admin-panel"
          style={{ padding: 12, alignSelf: "start" }}
        >
          <input
            className="admin-input"
            placeholder="Tìm họ tên, mã lô..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="admin-input"
            style={{ marginTop: 8 }}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending_verification">Chờ xác minh</option>
            <option value="verified">Đã xác minh</option>
            <option value="rejected">Đã từ chối</option>
          </select>
          <div
            style={{
              display: "grid",
              gap: 7,
              marginTop: 12,
              maxHeight: "65vh",
              overflow: "auto",
            }}
          >
            {loading ? (
              <p>Đang tải...</p>
            ) : filtered.length === 0 ? (
              <p>Không tìm thấy hồ sơ.</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`deceased-list-item${item.id === selectedId ? " is-active" : ""}`}
                >
                  <strong>{item.fullName}</strong>
                  <span>
                    {item.isExternalPlot
                      ? "Ngoài nghĩa trang"
                      : (item.plotCode ?? `Lô #${item.plotId}`)}
                  </span>
                  <small>
                    <span
                      className={`deceased-status deceased-status--${statusTone[item.verificationStatus] ?? "default"}`}
                    >
                      {statusLabel[item.verificationStatus] ??
                        item.verificationStatus}
                    </span>
                    {item.deletionRequestedAt && (
                      <span className="deceased-status deceased-status--pending deceased-status--gap">
                        Yêu cầu xoá
                      </span>
                    )}
                  </small>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="admin-panel" style={{ padding: 22 }}>
          {!current || busy === "detail" ? (
            <p>
              {busy === "detail"
                ? "Đang tải chi tiết..."
                : "Chọn một hồ sơ để xem."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 22 }}>
              <section className="admin-page-header">
                <div>
                  <small className="deceased-eyebrow">
                    HỒ SƠ NGƯỜI ĐÃ KHUẤT
                  </small>
                  <h2 style={{ margin: "5px 0" }}>{current.fullName}</h2>
                  <p>
                    <span
                      className={`deceased-status deceased-status--${statusTone[current.verificationStatus] ?? "default"}`}
                    >
                      {statusLabel[current.verificationStatus] ??
                        current.verificationStatus}
                    </span>
                  </p>
                </div>
                {current.verificationStatus === "pending_verification" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="admin-secondary-button"
                      onClick={() => void reject()}
                      disabled={busy === "reject"}
                    >
                      {busy === "reject" ? "Đang xử lý..." : "Từ chối"}
                    </button>
                    <button
                      className="admin-primary-button"
                      onClick={() => void verify()}
                      disabled={busy === "verify"}
                    >
                      {busy === "verify" ? "Đang xử lý..." : "Xác minh hồ sơ"}
                    </button>
                  </div>
                )}
              </section>

              {current.deletionRequestedAt && (
                <section
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: "#fdf1ef",
                    border: "1px solid #f0b8ad",
                  }}
                >
                  <h3 style={{ margin: "0 0 6px", color: "#8d3129" }}>
                    Gia đình đã gửi yêu cầu xoá hồ sơ này
                  </h3>
                  <p style={{ margin: "0 0 4px", color: "#6c4038" }}>
                    Gửi lúc: {dateTime(current.deletionRequestedAt)}
                  </p>
                  <p
                    style={{
                      margin: "0 0 12px",
                      color: "#6c4038",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    Lý do: {current.deletionReason || "Không nêu lý do."}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="admin-secondary-button"
                      onClick={() => void denyDeletion()}
                      disabled={busy === "deny-deletion"}
                    >
                      {busy === "deny-deletion"
                        ? "Đang xử lý..."
                        : "Từ chối yêu cầu"}
                    </button>
                    <button
                      className="admin-primary-button"
                      onClick={() => void approveDeletion()}
                      disabled={busy === "approve-deletion"}
                    >
                      {busy === "approve-deletion"
                        ? "Đang xử lý..."
                        : "Duyệt & xoá hồ sơ"}
                    </button>
                  </div>
                </section>
              )}

              {!current.deletionRequestedAt && current.deletionDeniedReason && (
                <section
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: "#f5f6f6",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <h3 style={{ margin: "0 0 6px" }}>
                    Yêu cầu xoá gần nhất đã bị từ chối
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Lý do: {current.deletionDeniedReason}
                  </p>
                </section>
              )}

              <section className="admin-detail-grid">
                <div>
                  <span>Mã lô</span>
                  <strong>
                    {current.isExternalPlot
                      ? current.externalPlotNote?.trim() || "Ngoài nghĩa trang"
                      : (current.plotCode ?? `#${current.plotId}`)}
                  </strong>
                </div>
                <div>
                  <span>Ngày sinh</span>
                  <strong>{formatBirth(current)}</strong>
                </div>
                <div>
                  <span>Ngày giỗ</span>
                  <strong>{formatAnniversary(current)}</strong>
                </div>
                <div>
                  <span>Quê quán</span>
                  <strong>{current.hometown || "—"}</strong>
                </div>
                <div>
                  <span>Ngày tạo hồ sơ</span>
                  <strong>{dateTime(current.createdAt)}</strong>
                </div>
              </section>

              <section>
                <h3>Tiểu sử</h3>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    padding: 14,
                    borderRadius: 8,
                    background: "var(--admin-soft, #f5f6f6)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {current.biography || "Chưa có tiểu sử."}
                </div>
              </section>

              {current.verificationStatus === "rejected" && (
                <section>
                  <h3>Lý do từ chối</h3>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      padding: 14,
                      borderRadius: 8,
                      background: "#f9e9e7",
                      color: "#8d3129",
                    }}
                  >
                    {current.rejectionReason || "Không có lý do."}
                  </div>
                </section>
              )}

              {!current.isExternalPlot && (
                <section className="deceased-capacity-card">
                  <h3>Cấu hình sức chứa lô</h3>
                  <p className="deceased-capacity-hint">
                    Một lô đất có thể an táng nhiều người (ví dụ mộ gia đình).
                    Thiết lập số hồ sơ tối đa được phép lưu trên lô{" "}
                    <strong>{current.plotCode ?? `#${current.plotId}`}</strong>{" "}
                    — hệ thống sẽ chặn thêm hồ sơ mới nếu lô đã đầy.
                  </p>
                  <form
                    className="deceased-capacity-form"
                    onSubmit={(event) => void updateCapacity(event)}
                  >
                    <label>
                      Sức chứa (số hồ sơ tối đa)
                      <input
                        className="admin-input"
                        name="capacity"
                        type="number"
                        min={1}
                        required
                      />
                    </label>
                    <button
                      className="admin-secondary-button"
                      disabled={busy === "capacity"}
                    >
                      {busy === "capacity"
                        ? "Đang lưu..."
                        : "Cập nhật sức chứa"}
                    </button>
                  </form>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
      {confirmDialog}
      {promptDialog}
    </div>
  );
}
