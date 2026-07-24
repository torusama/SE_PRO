import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";

type Tab = "catalogue" | "book" | "track";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface ServiceType {
  id: number;
  name: string;
  description?: string;
  basePrice: number;
  unit: string;
  category: "burial" | "maintenance" | "memorial" | "other";
}

type OrderStatus =
  | "submitted"
  | "pending_confirm"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ServiceOrder {
  id: number;
  status: OrderStatus;
  amount: number;
  requestedDate?: string | null;
  createdAt?: string;
  serviceName: string;
  plotCode?: string | null;
  customerName?: string;
}

interface OwnedPlot {
  plotId: number;
  plotCode: string;
  zoneName?: string;
  status: string;
}

interface Contract {
  id: number;
  status: string;
  plotId: number;
  plotCode: string;
  zoneName?: string;
}

const CATEGORY_LABEL: Record<ServiceType["category"], string> = {
  burial: "An táng",
  maintenance: "Chăm sóc & vệ sinh",
  memorial: "Tưởng niệm & lễ nghi",
  other: "Khác",
};

const CATEGORY_ICON: Record<ServiceType["category"], string> = {
  burial: "⚱️",
  maintenance: "🧹",
  memorial: "🙏",
  other: "🌸",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "Đã gửi · chờ xác nhận",
  pending_confirm: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang thực hiện",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

const STATUS_COLOR: Record<OrderStatus, { color: string; bg: string }> = {
  submitted: { color: "#f5a623", bg: "rgba(245,166,35,0.14)" },
  pending_confirm: { color: "#f5a623", bg: "rgba(245,166,35,0.14)" },
  confirmed: { color: "#4da6ff", bg: "rgba(77,166,255,0.14)" },
  in_progress: { color: "#00c8a0", bg: "rgba(0,200,160,0.14)" },
  completed: { color: "#00c8a0", bg: "rgba(0,200,160,0.2)" },
  cancelled: { color: "#8da5c0", bg: "rgba(141,165,192,0.12)" },
};

const PROGRESS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "submitted", label: "Đặt dịch vụ" },
  { key: "confirmed", label: "Đã xác nhận" },
  { key: "in_progress", label: "Đang thực hiện" },
  { key: "completed", label: "Hoàn tất" },
];

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không thực hiện được yêu cầu. Vui lòng thử lại.";
}

export default function ServicePage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = Boolean(token);
  const [tab, setTab] = useState<Tab>("catalogue");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [ownedPlots, setOwnedPlots] = useState<OwnedPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Booking form state ---
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null,
  );
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [requestedDate, setRequestedDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");

  // --- Tracking filter ---
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      if (!isAuthenticated) {
        const typesRes =
          await api.get<ApiResponse<ServiceType[]>>("/service-types");
        setServiceTypes(typesRes.data.data ?? []);
        setOrders([]);
        setOwnedPlots([]);
        return;
      }
      const [typesRes, ordersRes, contractsRes] = await Promise.all([
        api.get<ApiResponse<ServiceType[]>>("/service-types"),
        api.get<ApiResponse<ServiceOrder[]>>("/my/service-orders"),
        api.get<ApiResponse<Contract[]>>("/my/contracts"),
      ]);
      setServiceTypes(typesRes.data.data ?? []);
      setOrders(ordersRes.data.data ?? []);
      const plots = (contractsRes.data.data ?? [])
        .filter((c) => ["active", "completed"].includes(c.status))
        .map((c) => ({
          plotId: c.plotId,
          plotCode: c.plotCode,
          zoneName: c.zoneName,
          status: c.status,
        }));
      setOwnedPlots(plots);
      if (plots.length && selectedPlotId === null)
        setSelectedPlotId(plots[0].plotId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const stats = useMemo(() => {
    const now = new Date();
    const inProgress = orders.filter((o) =>
      ["submitted", "pending_confirm", "confirmed", "in_progress"].includes(
        o.status,
      ),
    ).length;
    const pending = orders.filter((o) =>
      ["submitted", "pending_confirm"].includes(o.status),
    ).length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const spendThisMonth = orders
      .filter(
        (o) =>
          o.createdAt &&
          new Date(o.createdAt).getMonth() === now.getMonth() &&
          new Date(o.createdAt).getFullYear() === now.getFullYear(),
      )
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);
    return { inProgress, pending, completed, spendThisMonth };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const selectedServiceType =
    serviceTypes.find((s) => s.id === selectedServiceId) ?? null;
  const selectedPlot =
    ownedPlots.find((p) => p.plotId === selectedPlotId) ?? null;

  function goToLogin() {
    navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.SERVICES } } });
  }

  function openBooking(serviceId?: number) {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    if (serviceId) setSelectedServiceId(serviceId);
    setSubmitError("");
    setSubmitOk("");
    setTab("book");
  }

  function openTrack() {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    setTab("track");
  }

  async function submitBooking() {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    if (!selectedServiceId) {
      setSubmitError("Vui lòng chọn loại dịch vụ.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitOk("");
    try {
      await api.post("/service-orders", {
        serviceTypeId: selectedServiceId,
        plotId: selectedPlotId ?? undefined,
        requestedDate: requestedDate || undefined,
        note: note.trim() || undefined,
      });
      setSubmitOk(
        "Đã gửi yêu cầu đặt dịch vụ. Bạn sẽ nhận được thông báo khi được xác nhận.",
      );
      setNote("");
      setRequestedDate("");
      await loadAll();
      setTab("track");
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.breadcrumb}>
        <span>Trang chủ</span>
        <span style={styles.sep}>›</span>
        <span style={styles.current}>Dịch vụ</span>
      </div>

      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Customer Portal · Dịch vụ</p>
          <h1 style={styles.title}>Dịch Vụ Tưởng Niệm</h1>
          <p style={styles.subtitle}>
            Đặt và theo dõi các dịch vụ chăm sóc phần mộ, lễ tưởng niệm, hoa
            tươi và các dịch vụ tâm linh khác dành cho người thân đã khuất.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.outlineButton}
            onClick={openTrack}
          >
            Theo dõi đơn →
          </button>
          <button
            type="button"
            style={styles.goldButton}
            onClick={() => openBooking()}
          >
            ＋ Đặt dịch vụ mới
          </button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div style={styles.notice}>
          Đăng nhập để đặt dịch vụ mới và theo dõi các đơn dịch vụ đã đặt của
          bạn.
        </div>
      ) : null}

      {error ? <div style={styles.error}>{error}</div> : null}

      <section style={styles.statsGrid}>
        <StatCard
          icon="🌸"
          value={stats.inProgress}
          label="Đơn đang xử lý"
          sub={stats.pending ? `${stats.pending} chờ xác nhận` : undefined}
          color="#00c8a0"
        />
        <StatCard
          icon="✅"
          value={stats.completed}
          label="Đã hoàn thành"
          color="#c9a84c"
        />
        <StatCard
          icon="💰"
          value={money.format(stats.spendThisMonth)}
          label="Chi tiêu tháng này"
          color="#f0c060"
        />
        <StatCard
          icon="📋"
          value={orders.length}
          label="Tổng số đơn đã đặt"
          color="#4da6ff"
        />
      </section>

      <nav style={styles.tabBar}>
        <TabButton
          active={tab === "catalogue"}
          onClick={() => setTab("catalogue")}
          label="Danh mục dịch vụ"
        />
        <TabButton
          active={tab === "book"}
          onClick={() => openBooking()}
          label="Đặt dịch vụ mới"
        />
        <TabButton
          active={tab === "track"}
          onClick={openTrack}
          label="Theo dõi đơn"
        />
      </nav>

      {tab === "catalogue" && (
        <section>
          {loading ? (
            <div style={styles.empty}>Đang tải danh mục dịch vụ...</div>
          ) : serviceTypes.length === 0 ? (
            <div style={styles.empty}>Hiện chưa có dịch vụ nào khả dụng.</div>
          ) : (
            <div style={styles.catalogueGrid}>
              {serviceTypes.map((service) => (
                <article
                  key={service.id}
                  style={styles.catCard}
                  onClick={() => openBooking(service.id)}
                >
                  <div style={styles.catTop}>
                    <div style={styles.catIcon}>
                      {CATEGORY_ICON[service.category]}
                    </div>
                    <div style={styles.catPriceBadge}>
                      từ {money.format(service.basePrice)}
                    </div>
                  </div>
                  <div style={styles.catName}>{service.name}</div>
                  <div style={styles.catDesc}>
                    {service.description ||
                      "Dịch vụ chăm sóc, tưởng niệm dành cho phần mộ của gia đình bạn."}
                  </div>
                  <div style={styles.catFooter}>
                    <span style={styles.catTag}>
                      {CATEGORY_LABEL[service.category]}
                    </span>
                    <button type="button" style={styles.catAction}>
                      Đặt ngay →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "book" && (
        <section style={styles.bookGrid}>
          <div style={styles.bookLeft}>
            <div style={styles.formSection}>
              <div style={styles.sectionLabel}>Loại dịch vụ</div>
              {serviceTypes.length === 0 ? (
                <div style={styles.empty}>Đang tải danh sách dịch vụ...</div>
              ) : (
                <div style={styles.serviceGrid}>
                  {serviceTypes.map((service) => (
                    <div
                      key={service.id}
                      style={{
                        ...styles.serviceCard,
                        ...(selectedServiceId === service.id
                          ? styles.serviceCardSelected
                          : {}),
                      }}
                      onClick={() => setSelectedServiceId(service.id)}
                    >
                      <div style={styles.serviceIcon}>
                        {CATEGORY_ICON[service.category]}
                      </div>
                      <div style={styles.serviceName}>{service.name}</div>
                      <div style={styles.servicePrice}>
                        {money.format(service.basePrice)} / {service.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.formSection}>
              <div style={styles.sectionLabel}>Lô phần mộ áp dụng</div>
              {ownedPlots.length === 0 ? (
                <div style={styles.fieldHint}>
                  Bạn chưa có lô phần mộ nào được ghi nhận sở hữu. Có thể để
                  trống nếu dịch vụ không gắn với lô cụ thể.
                </div>
              ) : (
                <select
                  style={styles.select}
                  value={selectedPlotId ?? ""}
                  onChange={(e) =>
                    setSelectedPlotId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">— Không chọn lô cụ thể —</option>
                  {ownedPlots.map((plot) => (
                    <option key={plot.plotId} value={plot.plotId}>
                      {plot.plotCode}
                      {plot.zoneName ? ` · ${plot.zoneName}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={styles.formSection}>
              <div style={styles.sectionLabel}>Thời gian & ghi chú</div>
              <div style={styles.field}>
                <label style={styles.label}>Ngày mong muốn thực hiện</label>
                <input
                  type="date"
                  style={styles.input}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  Yêu cầu đặc biệt (không bắt buộc)
                </label>
                <textarea
                  style={styles.textarea}
                  placeholder="Ví dụ: sắp xếp hoa trắng, thêm lá cành xanh..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryTitle}>Xác nhận đặt dịch vụ</div>
              <SummaryRow
                label="Dịch vụ"
                value={selectedServiceType?.name ?? "Chưa chọn"}
              />
              <SummaryRow
                label="Lô phần mộ"
                value={
                  selectedPlot
                    ? `${selectedPlot.plotCode}${selectedPlot.zoneName ? ` · ${selectedPlot.zoneName}` : ""}`
                    : "Không chọn"
                }
              />
              <SummaryRow
                label="Ngày thực hiện"
                value={requestedDate ? formatDate(requestedDate) : "Chưa chọn"}
              />
              <SummaryRow
                label="Đơn giá"
                value={
                  selectedServiceType
                    ? money.format(selectedServiceType.basePrice)
                    : "-"
                }
                highlight
              />

              {submitError ? (
                <div style={styles.formError}>{submitError}</div>
              ) : null}
              {submitOk ? (
                <div style={styles.formSuccess}>{submitOk}</div>
              ) : null}

              <button
                type="button"
                style={styles.submitButton}
                onClick={() => void submitBooking()}
                disabled={submitting || !selectedServiceId}
              >
                {submitting ? "Đang gửi..." : "Xác nhận đặt dịch vụ"}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === "track" && (
        <section>
          <div style={styles.filterBar}>
            <FilterChip
              active={statusFilter === "all"}
              label="Tất cả"
              onClick={() => setStatusFilter("all")}
            />
            <FilterChip
              active={statusFilter === "in_progress"}
              label="Đang thực hiện"
              onClick={() => setStatusFilter("in_progress")}
            />
            <FilterChip
              active={statusFilter === "submitted"}
              label="Chờ xác nhận"
              onClick={() => setStatusFilter("submitted")}
            />
            <FilterChip
              active={statusFilter === "completed"}
              label="Hoàn tất"
              onClick={() => setStatusFilter("completed")}
            />
            <FilterChip
              active={statusFilter === "cancelled"}
              label="Đã huỷ"
              onClick={() => setStatusFilter("cancelled")}
            />
          </div>

          {loading ? (
            <div style={styles.empty}>Đang tải đơn dịch vụ...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={styles.empty}>Không có đơn dịch vụ nào phù hợp.</div>
          ) : (
            <div style={styles.list}>
              {filteredOrders.map((order) => {
                const meta = STATUS_COLOR[order.status];
                const stepIndex = PROGRESS_STEPS.findIndex(
                  (step) => step.key === order.status,
                );
                const isExpanded = expandedId === order.id;
                return (
                  <article
                    key={order.id}
                    style={styles.orderCard}
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div style={styles.orderTop}>
                      <div>
                        <strong style={styles.orderTitle}>
                          {order.serviceName}
                        </strong>
                        <div style={styles.muted}>
                          Mã: #DV-{String(order.id).padStart(4, "0")}
                          {order.plotCode ? ` · Lô ${order.plotCode}` : ""}
                          {order.requestedDate
                            ? ` · ${formatDate(order.requestedDate)}`
                            : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            color: meta.color,
                            background: meta.bg,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {STATUS_LABEL[order.status]}
                        </span>
                        <div style={styles.orderPrice}>
                          {money.format(order.amount)}
                        </div>
                      </div>
                    </div>

                    {order.status !== "cancelled" && (
                      <div style={styles.progressTrack}>
                        {PROGRESS_STEPS.map((step, idx) => (
                          <div key={step.key} style={styles.progressStep}>
                            <div
                              style={{
                                ...styles.progressDot,
                                ...(idx < stepIndex
                                  ? styles.progressDotDone
                                  : idx === stepIndex
                                    ? styles.progressDotActive
                                    : {}),
                              }}
                            >
                              {idx < stepIndex
                                ? "✓"
                                : idx === stepIndex
                                  ? "●"
                                  : "○"}
                            </div>
                            <div style={styles.progressLabel}>{step.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded ? (
                      <div style={styles.detailBox}>
                        <Info
                          label="Ngày gửi"
                          value={formatDate(order.createdAt)}
                        />
                        <Info
                          label="Trạng thái"
                          value={STATUS_LABEL[order.status]}
                        />
                      </div>
                    ) : (
                      <div style={styles.detailHint}>Chi tiết ↓</div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function StatCard({
  icon,
  value,
  label,
  sub,
  color,
}: {
  icon: string;
  value: number | string;
  label: string;
  sub?: string;
  color: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <div style={{ ...styles.statValue, color }}>{value}</div>
        <div style={styles.muted}>{label}</div>
        {sub ? <div style={styles.statSub}>{sub}</div> : null}
      </div>
    </div>
  );
}

function TabButton({
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
      style={{ ...styles.tabButton, ...(active ? styles.tabButtonActive : {}) }}
    >
      {label}
    </button>
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

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.muted}>{label}</span>
      <span
        style={{ color: highlight ? "#f0c060" : "#d4e8e0", fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 80px)",
    padding: "20px 20px 64px",
    background: "#04060e",
    color: "#d4e8e0",
    fontFamily: "Be Vietnam Pro, sans-serif",
    maxWidth: 1160,
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
    marginBottom: 24,
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
    fontSize: 32,
  },
  subtitle: { margin: 0, color: "#7a9a90", maxWidth: 620 },
  headerActions: { display: "flex", gap: 10, flexShrink: 0 },
  outlineButton: {
    border: "1px solid rgba(0,229,196,0.24)",
    borderRadius: 8,
    background: "transparent",
    color: "#bdfdf2",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },
  goldButton: {
    border: "1px solid rgba(201,168,76,0.4)",
    borderRadius: 8,
    background:
      "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(0,229,196,0.1))",
    color: "#f0c060",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid rgba(232,74,74,0.35)",
    borderRadius: 8,
    color: "#ffb3b3",
    background: "rgba(232,74,74,0.08)",
  },
  notice: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid rgba(201,168,76,0.3)",
    borderRadius: 8,
    color: "#f0c060",
    background: "rgba(201,168,76,0.08)",
    fontSize: 13,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 10,
    background: "rgba(8,13,26,0.76)",
    padding: 16,
  },
  statIcon: { fontSize: 24 },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    fontFamily: "Playfair Display, serif",
  },
  statSub: { fontSize: 11, color: "#c9a84c", marginTop: 2 },
  tabBar: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    borderBottom: "1px solid rgba(0,229,196,0.12)",
    paddingBottom: 4,
  },
  tabButton: {
    border: "none",
    background: "transparent",
    color: "#7a9a90",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    borderRadius: "8px 8px 0 0",
  },
  tabButtonActive: { color: "#00e5c4", background: "rgba(0,229,196,0.08)" },
  catalogueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
  catCard: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 12,
    background: "rgba(8,13,26,0.76)",
    padding: 18,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  catTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catIcon: { fontSize: 28 },
  catPriceBadge: {
    fontSize: 12,
    color: "#c9a84c",
    border: "1px solid rgba(201,168,76,0.3)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  catName: {
    fontFamily: "Playfair Display, serif",
    fontSize: 18,
    color: "#e8f4f0",
  },
  catDesc: { fontSize: 13, color: "#7a9a90", lineHeight: 1.6, flex: 1 },
  catFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  catTag: {
    fontSize: 11,
    color: "#00b89e",
    background: "rgba(0,229,196,0.08)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  catAction: {
    border: "none",
    background: "transparent",
    color: "#f0c060",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  bookGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 24,
    alignItems: "start",
  },
  bookLeft: { display: "flex", flexDirection: "column", gap: 20 },
  formSection: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 12,
    background: "rgba(8,13,26,0.5)",
    padding: 20,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#00b89e",
    marginBottom: 14,
  },
  serviceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
  },
  serviceCard: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 10,
    padding: 14,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  serviceCardSelected: {
    borderColor: "#c9a84c",
    background: "rgba(201,168,76,0.08)",
  },
  serviceIcon: { fontSize: 22, marginBottom: 6 },
  serviceName: {
    fontSize: 13,
    color: "#d4e8e0",
    fontWeight: 600,
    marginBottom: 4,
  },
  servicePrice: { fontSize: 12, color: "#c9a84c" },
  select: {
    width: "100%",
    background: "rgba(4,6,14,0.8)",
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 8,
    padding: "10px 13px",
    color: "#d4e8e0",
    fontSize: 13,
  },
  field: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#7a9a90", marginBottom: 7 },
  input: {
    width: "100%",
    background: "rgba(4,6,14,0.8)",
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 8,
    padding: "10px 13px",
    color: "#d4e8e0",
    fontSize: 13,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    background: "rgba(4,6,14,0.8)",
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 8,
    padding: "10px 13px",
    color: "#d4e8e0",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical",
  },
  fieldHint: { fontSize: 12, color: "#7a9a90" },
  summaryCard: {
    border: "1px solid rgba(201,168,76,0.25)",
    borderRadius: 12,
    background: "rgba(8,13,26,0.6)",
    padding: 22,
    position: "sticky",
    top: 20,
  },
  summaryTitle: {
    fontFamily: "Playfair Display, serif",
    fontSize: 17,
    color: "#c9a84c",
    marginBottom: 16,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  formError: {
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    border: "1px solid rgba(232,74,74,0.35)",
    borderRadius: 8,
    color: "#ffb3b3",
    background: "rgba(232,74,74,0.08)",
    fontSize: 12,
  },
  formSuccess: {
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    border: "1px solid rgba(0,200,160,0.35)",
    borderRadius: 8,
    color: "#9df0dd",
    background: "rgba(0,200,160,0.08)",
    fontSize: 12,
  },
  submitButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    background:
      "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(0,229,196,0.1))",
    border: "1px solid rgba(201,168,76,0.4)",
    color: "#f0c060",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  filterBar: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  filterChip: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 999,
    padding: "7px 16px",
    background: "transparent",
    color: "#7a9a90",
    fontSize: 13,
    cursor: "pointer",
  },
  filterChipActive: {
    borderColor: "#00b89e",
    color: "#00e5c4",
    background: "rgba(0,229,196,0.08)",
  },
  list: { display: "grid", gap: 12 },
  orderCard: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 10,
    background: "rgba(8,13,26,0.76)",
    padding: 18,
    cursor: "pointer",
  },
  orderTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  orderTitle: { color: "#e8f4f0", display: "block", marginBottom: 4 },
  orderPrice: { color: "#d4e8e0", fontWeight: 700, marginTop: 6 },
  muted: { color: "#7a9a90", fontSize: 13 },
  progressTrack: {
    display: "flex",
    alignItems: "center",
    marginTop: 18,
    gap: 4,
  },
  progressStep: { flex: 1, textAlign: "center" },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid rgba(122,154,144,0.3)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#7a9a90",
    margin: "0 auto 6px",
  },
  progressDotDone: {
    background: "#00b89e",
    borderColor: "#00b89e",
    color: "#04060e",
  },
  progressDotActive: {
    background: "rgba(201,168,76,0.2)",
    borderColor: "#c9a84c",
    color: "#c9a84c",
  },
  progressLabel: { fontSize: 11, color: "#7a9a90" },
  detailHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#00b89e",
    textAlign: "right",
  },
  detailBox: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    borderTop: "1px solid rgba(0,229,196,0.1)",
    paddingTop: 12,
  },
  infoLabel: { color: "#7a9a90", fontSize: 12, marginBottom: 4 },
  infoValue: { color: "#d4e8e0", fontWeight: 700 },
  empty: {
    border: "1px solid rgba(0,229,196,0.12)",
    borderRadius: 8,
    background: "rgba(8,13,26,0.76)",
    padding: 24,
    color: "#7a9a90",
    textAlign: "center",
  },
};
