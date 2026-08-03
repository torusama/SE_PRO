import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";

type ReservationType = "reserve" | "purchase";
type ReservationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "draft";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ReservationSummary {
  id: number;
  type: ReservationType;
  status: ReservationStatus;
  customerName?: string;
  customerEmail?: string;
  totalPrice?: number;
  plotCodes?: string[];
  plotCount?: number;
  createdAt?: string;
  reviewedAt?: string | null;
}

interface ReservationPlot {
  id: number;
  code: string;
  status: string;
  price: number;
}

interface ReservationDetail extends ReservationSummary {
  note?: string | null;
  adminNote?: string | null;
  customerPhone?: string | null;
  customerNotes?: string | null;
  adminName?: string | null;
  plots?: ReservationPlot[];
}

type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

interface Appointment {
  id: number;
  reservationRequestId: number;
  customerName?: string | null;
  scheduledAt: string;
  location: string;
  assignedStaffName?: string | null;
  status: AppointmentStatus;
  note?: string | null;
  statusNote?: string | null;
}

type DecisionAction = "approve" | "reject";

const statusMeta: Record<string, { label: string; color: string; bg: string }> =
  {
    pending: {
      label: "Chờ duyệt",
      color: "var(--admin-warning)",
      bg: "#f6efe5",
    },
    submitted: {
      label: "Chờ duyệt",
      color: "var(--admin-warning)",
      bg: "#f6efe5",
    },
    approved: {
      label: "Đã duyệt",
      color: "var(--admin-positive)",
      bg: "#e9f0ec",
    },
    rejected: {
      label: "Đã từ chối",
      color: "var(--admin-danger)",
      bg: "#f7e9e6",
    },
    cancelled: {
      label: "Đã hủy",
      color: "var(--admin-muted)",
      bg: "var(--admin-soft)",
    },
    draft: { label: "Nháp", color: "var(--admin-muted)", bg: "var(--admin-soft)" },
  };

const typeLabel: Record<ReservationType, string> = {
  reserve: "Giữ chỗ",
  purchase: "Mua lô",
};

const plotStatusLabel: Record<string, string> = {
  available: "Còn trống",
  pending: "Chờ duyệt",
  reserved: "Đã giữ chỗ",
  sold: "Đã bán",
  locked: "Đã khóa",
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const pageStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1fr) minmax(420px, 0.9fr)",
  gap: 18,
  minHeight: "100%",
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
};

const labelStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0,
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta[status] ?? {
    label: status,
    color: "var(--admin-muted)",
    bg: "var(--admin-soft)",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "3px 10px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function isVisibleRequest(request: ReservationSummary) {
  return !["rejected", "cancelled"].includes(request.status);
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ReservationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createdContract, setCreatedContract] = useState<{
    id: number;
    contractCode: string;
  } | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<DecisionAction | null>(
    null,
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    scheduledAt: "",
    location: "Văn phòng nghĩa trang Vĩnh Phúc Viên",
    assignedStaffName: "",
    note: "",
  });

  // Giữ selectedId mới nhất trong ref để loadRequests không cần phụ thuộc vào nó
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const visibleRequests = useMemo(
    () => requests.filter(isVisibleRequest),
    [requests],
  );

  const selectedSummary = useMemo(
    () => visibleRequests.find((request) => request.id === selectedId) ?? null,
    [visibleRequests, selectedId],
  );

  // Derive thay vì lưu "không có gì được chọn" bằng setState riêng
  const current = selectedId ? (detail ?? selectedSummary) : null;

  const canDecide = current
    ? ["pending", "submitted"].includes(current.status)
    : false;
  const currentAppointment = current
    ? (appointments.find(
        (appointment) =>
          appointment.reservationRequestId === current.id &&
          appointment.status === "scheduled",
      ) ?? null)
    : null;
  const canScheduleAppointment =
    current?.status === "approved" && !currentAppointment;

  const loadRequests = useCallback(async (nextSelectedId?: number) => {
    setLoadingList(true);
    setError("");
    try {
      const response = await api.get<
        ApiResponse<PaginatedResponse<ReservationSummary>>
      >("/admin/reservations", {
        params: { page: 1, pageSize: 100 },
      });
      const rows = response.data.data?.items ?? [];
      const visibleRows = rows.filter(isVisibleRequest);
      setRequests(rows);
      const preferredId = nextSelectedId ?? selectedIdRef.current;
      const nextId = visibleRows.some((row) => row.id === preferredId)
        ? (preferredId ?? null)
        : (visibleRows[0]?.id ?? null);
      setSelectedId(nextId);
      return nextId;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setError("");
    try {
      const response = await api.get<ApiResponse<ReservationDetail>>(
        `/admin/reservations/${id}`,
      );
      setDetail(response.data.data);
      setAdminNote(response.data.data.adminNote ?? "");
    } catch (err) {
      setError(getErrorMessage(err));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      const response = await api.get<
        ApiResponse<PaginatedResponse<Appointment>>
      >("/admin/appointments", { params: { page: 1, pageSize: 100 } });
      setAppointments(response.data.data?.items ?? []);
    } catch {
      setAppointments([]);
    }
  }, []);

  async function decide(action: DecisionAction) {
    if (!current || !canDecide) return;
    const isReject = action === "reject";
    const ok = window.confirm(
      isReject
        ? `Từ chối yêu cầu #${current.id}? Lô pending sẽ được mở lại nếu không còn yêu cầu hợp lệ khác.`
        : `Duyệt yêu cầu #${current.id}? Lô sẽ chuyển sang trạng thái đã giữ; quyền sở hữu chỉ được kích hoạt sau khi xác minh hợp đồng ký offline.`,
    );
    if (!ok) return;

    setDecisionLoading(action);
    setError("");
    setSuccessMessage("");
    setCreatedContract(null);
    try {
      const response = await api.patch(`/admin/reservations/${current.id}/${action}`, {
        adminNote: adminNote.trim() || undefined,
      });
      const contract = response.data.data?.contracts?.[0] ?? null;
      setCreatedContract(contract);
      setSuccessMessage(
        isReject
          ? `Đã từ chối yêu cầu #${current.id}.`
          : contract
            ? `Đã duyệt yêu cầu #${current.id} và tự động tạo hợp đồng ${contract.contractCode}.`
            : `Đã duyệt yêu cầu #${current.id}.`,
      );
      const nextId = await loadRequests(current.id);
      if (nextId) await loadDetail(nextId);
      await loadAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDecisionLoading(null);
    }
  }

  async function createAppointment() {
    if (!current || !canScheduleAppointment) return;
    if (
      !appointmentForm.scheduledAt ||
      !appointmentForm.location.trim() ||
      !appointmentForm.assignedStaffName.trim()
    ) {
      setError(
        "Vui lòng nhập đủ thời gian, địa điểm và nhân viên phụ trách lịch hẹn.",
      );
      return;
    }

    setAppointmentLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      await api.post("/admin/appointments", {
        reservationRequestId: current.id,
        scheduledAt: new Date(appointmentForm.scheduledAt).toISOString(),
        location: appointmentForm.location.trim(),
        assignedStaffName: appointmentForm.assignedStaffName.trim(),
        note: appointmentForm.note.trim() || undefined,
      });
      setSuccessMessage(
        `Đã tạo lịch hẹn ký hợp đồng cho yêu cầu #${current.id}.`,
      );
      setAppointmentForm({
        scheduledAt: "",
        location: "Văn phòng nghĩa trang Vĩnh Phúc Viên",
        assignedStaffName: "",
        note: "",
      });
      await loadAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAppointmentLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequests();
      void loadAppointments();
    });
  }, [loadRequests, loadAppointments]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <div className="admin-page admin-requests-page" style={{ display: "grid", gap: 18 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              color: "var(--color-text-primary)",
            }}
          >
            Xử lý yêu cầu
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            Duyệt hoặc từ chối các yêu cầu giữ chỗ và mua lô đang chờ xử lý.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void loadRequests(selectedId ?? undefined)}
          loading={loadingList}
        >
          Làm mới
        </Button>
      </header>

      {error ? (
        <div
          style={{
            ...panelStyle,
            padding: 14,
            borderColor: "#e4c8bf",
            color: "var(--admin-danger)",
          }}
        >
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div
          style={{
            ...panelStyle,
            padding: 14,
            borderColor: "#bfd1c8",
            color: "var(--admin-positive)",
          }}
        >
          <span>{successMessage}</span>
          {createdContract ? (
            <Button
              style={{ marginLeft: 12 }}
              onClick={() => navigate(`${ROUTES.ADMIN_CONTRACTS}?contractId=${createdContract.id}`)}
            >
              Mở hợp đồng
            </Button>
          ) : null}
        </div>
      ) : null}

      <section style={pageStyle}>
        <div style={{ ...panelStyle, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Danh sách yêu cầu</h2>
            <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              {visibleRequests.length} yêu cầu
            </span>
          </div>

          {loadingList ? (
            <div style={{ padding: 18, color: "var(--color-text-secondary)" }}>
              Đang tải yêu cầu...
            </div>
          ) : visibleRequests.length === 0 ? (
            <div style={{ padding: 18, color: "var(--color-text-secondary)" }}>
              Chưa có yêu cầu nào.
            </div>
          ) : (
            <div style={{ display: "grid" }}>
              {visibleRequests.map((request) => {
                const active = request.id === selectedId;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    style={{
                      display: "grid",
                      gap: 10,
                      textAlign: "left",
                      padding: 16,
                      border: "none",
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft: active
                        ? "3px solid var(--color-accent-teal)"
                        : "3px solid transparent",
                      background: active
                        ? "var(--admin-soft)"
                        : "transparent",
                      color: "var(--color-text-primary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong>
                        #{request.id} - {typeLabel[request.type]}
                      </strong>
                      <StatusPill status={request.status} />
                    </div>
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      {request.customerName ||
                        request.customerEmail ||
                        "Khách hàng"}
                    </div>
                    <div
                      style={{ color: "var(--color-text-muted)", fontSize: 12 }}
                    >
                      {(request.plotCodes ?? []).join(", ") ||
                        `${request.plotCount ?? 0} lô`}{" "}
                      · {formatDate(request.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside style={{ ...panelStyle, padding: 18, alignSelf: "start" }}>
          {!current ? (
            <div style={{ color: "var(--color-text-secondary)" }}>
              Chọn một yêu cầu để xem chi tiết.
            </div>
          ) : loadingDetail ? (
            <div style={{ color: "var(--color-text-secondary)" }}>
              Đang tải chi tiết...
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    Yêu cầu #{current.id}
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {typeLabel[current.type]}
                  </p>
                </div>
                <StatusPill status={current.status} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                <InfoRow
                  label="Khách hàng"
                  value={current.customerName || "-"}
                />
                <InfoRow label="Email" value={current.customerEmail || "-"} />
                <InfoRow
                  label="Số điện thoại"
                  value={detail?.customerPhone || "-"}
                />
                <InfoRow
                  label="Tổng tiền"
                  value={money.format(Number(current.totalPrice ?? 0))}
                />
                <InfoRow
                  label="Ngày gửi"
                  value={formatDate(current.createdAt)}
                />
                <InfoRow
                  label="Ngày xử lý"
                  value={formatDate(current.reviewedAt)}
                />
              </div>

              {detail?.customerNotes && (
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: "10px 12px",
                    border: "1px solid #dfcfb8",
                    borderRadius: 8,
                    background: "#f8f3ea",
                  }}
                >
                  <span style={{ ...labelStyle, color: "var(--admin-warning)" }}>
                    Ghi chú đặc biệt của khách (từ hồ sơ cá nhân)
                  </span>
                  <span style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                    {detail.customerNotes}
                  </span>
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                <span style={labelStyle}>Danh sách lô</span>
                <div style={{ display: "grid", gap: 8 }}>
                  {(detail?.plots ?? []).length > 0 ? (
                    detail?.plots?.map((plot) => (
                      <div
                        key={plot.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          background: "var(--admin-soft)",
                        }}
                      >
                        <strong>{plot.code}</strong>
                        <span style={{ color: "var(--color-text-secondary)" }}>
                          {plotStatusLabel[plot.status] ?? plot.status} ·{" "}
                          {money.format(Number(plot.price ?? 0))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {(current.plotCodes ?? []).join(", ") ||
                        "Không có dữ liệu lô"}
                    </div>
                  )}
                </div>
              </div>

              <InfoRow label="Ghi chú khách hàng" value={detail?.note || "-"} />

              <label style={{ display: "grid", gap: 8 }}>
                <span style={labelStyle}>Ghi chú quản trị viên</span>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  disabled={!canDecide}
                  placeholder="Nhập lý do hoặc ghi chú xử lý..."
                  style={{
                    width: "100%",
                    resize: "vertical",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    background: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    padding: 12,
                    fontFamily: "var(--font-body)",
                    outline: "none",
                  }}
                />
              </label>

              {current?.status === "approved" ? (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 14,
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    background: "var(--admin-soft)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 4 }}>
                        Lịch hẹn ký hợp đồng
                      </div>
                      {currentAppointment ? (
                        <div
                          style={{
                            color: "var(--color-text-primary)",
                            fontWeight: 700,
                          }}
                        >
                          {formatDate(currentAppointment.scheduledAt)} ·{" "}
                          {currentAppointment.location}
                        </div>
                      ) : (
                        <div
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: 13,
                          }}
                        >
                          Tạo lịch hẹn offline để khách hoàn tất ký hợp đồng.
                        </div>
                      )}
                    </div>
                    {currentAppointment ? (
                      <StatusPill status={currentAppointment.status} />
                    ) : null}
                  </div>

                  {currentAppointment ? (
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      Phụ trách: {currentAppointment.assignedStaffName || "-"}
                      {currentAppointment.note
                        ? ` · ${currentAppointment.note}`
                        : ""}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                        }}
                      >
                        <input
                          type="datetime-local"
                          value={appointmentForm.scheduledAt}
                          onChange={(event) =>
                            setAppointmentForm((form) => ({
                              ...form,
                              scheduledAt: event.target.value,
                            }))
                          }
                          style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            background: "var(--color-bg-secondary)",
                            color: "var(--color-text-primary)",
                            padding: 10,
                            fontFamily: "var(--font-body)",
                          }}
                        />
                        <input
                          value={appointmentForm.assignedStaffName}
                          onChange={(event) =>
                            setAppointmentForm((form) => ({
                              ...form,
                              assignedStaffName: event.target.value,
                            }))
                          }
                          placeholder="Nhân viên phụ trách"
                          style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            background: "var(--color-bg-secondary)",
                            color: "var(--color-text-primary)",
                            padding: 10,
                            fontFamily: "var(--font-body)",
                          }}
                        />
                      </div>
                      <input
                        value={appointmentForm.location}
                        onChange={(event) =>
                          setAppointmentForm((form) => ({
                            ...form,
                            location: event.target.value,
                          }))
                        }
                        placeholder="Địa điểm ký hợp đồng"
                        style={{
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          background: "var(--color-bg-secondary)",
                          color: "var(--color-text-primary)",
                          padding: 10,
                          fontFamily: "var(--font-body)",
                        }}
                      />
                      <textarea
                        value={appointmentForm.note}
                        onChange={(event) =>
                          setAppointmentForm((form) => ({
                            ...form,
                            note: event.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Ghi chú lịch hẹn"
                        style={{
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          background: "var(--color-bg-secondary)",
                          color: "var(--color-text-primary)",
                          padding: 10,
                          fontFamily: "var(--font-body)",
                          resize: "vertical",
                        }}
                      />
                      <Button
                        onClick={() => void createAppointment()}
                        loading={appointmentLoading}
                        disabled={!canScheduleAppointment}
                      >
                        Tạo lịch hẹn
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="danger"
                  style={{
                    background: canDecide ? "var(--admin-danger)" : "#d8c0bc",
                    color: "#fff",
                    border: "1px solid #dc3545",
                    minWidth: 110,
                  }}
                  onClick={() => void decide("reject")}
                  loading={decisionLoading === "reject"}
                  disabled={!canDecide || decisionLoading !== null}
                >
                  Từ chối
                </Button>
                <Button
                  style={{
                    background: canDecide
                      ? "var(--color-accent-teal)"
                      : "#c9c5bd",
                    color: "var(--admin-paper)",
                    border: "1px solid var(--color-accent-teal)",
                    minWidth: 110,
                  }}
                  onClick={() => void decide("approve")}
                  loading={decisionLoading === "approve"}
                  disabled={!canDecide || decisionLoading !== null}
                >
                  Duyệt
                </Button>
              </div>

              {!canDecide ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                  Yêu cầu này đã được xử lý nên không thể duyệt hoặc từ chối
                  lại.
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
