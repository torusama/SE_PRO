import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";

type Summary = {
  totalPlots: number;
  availablePlots: number;
  pendingPlots: number;
  reservedPlots: number;
  soldPlots: number;
  lockedPlots: number;
  totalContracts: number;
  pendingRequests: number;
  totalPaid: number;
};
type Revenue = { period: string; collectedRevenue: number };
type AuditEvent = {
  id: number;
  actorName: string;
  action: string;
  entityType: string;
  createdAt: string;
};

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e2da",
  borderRadius: 10,
  color: "#1f2937",
};

function StatCard(props: { value: string; label: string; color: string }) {
  return (
    <div
      style={{
        ...panelStyle,
        padding: "18px 20px",
        borderTop: `3px solid ${props.color}`,
      }}
    >
      <div
        style={{
          fontSize: 24,
          lineHeight: 1.2,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {props.value}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#4b5563",
          fontWeight: 500,
          marginTop: 7,
        }}
      >
        {props.label}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: Summary }>("/admin/dashboard/summary"),
      api.get<{ data: Revenue[] }>("/admin/dashboard/revenue", {
        params: { period: "month" },
      }),
      api.get<{ data: { items: AuditEvent[] } }>("/admin/audit-logs", {
        params: { page: 1, pageSize: 5 },
      }),
    ])
      .then(([summaryResult, revenueResult, activityResult]) => {
        if (!active) return;
        setSummary(summaryResult.data.data);
        setRevenue(revenueResult.data.data ?? []);
        setActivity(activityResult.data.data?.items ?? []);
      })
      .catch(() => active && setError("Không thể tải dữ liệu tổng quan."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const statuses = useMemo(
    () => [
      { label: "Còn trống", value: summary?.availablePlots ?? 0, color: "#00a884" },
      { label: "Đang chờ", value: summary?.pendingPlots ?? 0, color: "#f5a623" },
      { label: "Đã giữ", value: summary?.reservedPlots ?? 0, color: "#818cf8" },
      { label: "Đã bán", value: summary?.soldPlots ?? 0, color: "#ef4444" },
      { label: "Đã khóa", value: summary?.lockedPlots ?? 0, color: "#9ca3af" },
    ],
    [summary],
  );

  if (loading) return <div>Đang tải dữ liệu tổng quan...</div>;

  return (
    <div style={{ display: "grid", gap: 24, color: "#1f2937" }}>
      {error && <div style={{ ...panelStyle, padding: 14, color: "#b91c1c" }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard value={money.format(summary?.totalPlots ?? 0)} label="Tổng lô đất" color="#00a884" />
        <StatCard value={money.format(summary?.totalContracts ?? 0)} label="Tổng hợp đồng" color="#d4a843" />
        <StatCard value={money.format(summary?.pendingRequests ?? 0)} label="Yêu cầu đang chờ" color="#ef4444" />
        <StatCard value={`${money.format(summary?.totalPaid ?? 0)} đ`} label="Khoản đã thanh toán" color="#4a9eff" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <section style={{ ...panelStyle, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#111827", fontWeight: 700 }}>Doanh thu đã thu theo tháng</h2>
          {!revenue.length ? (
            <p style={{ color: "#6b7280" }}>Chưa có dữ liệu doanh thu.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "end", gap: 8, height: 150, marginTop: 18 }}>
              {revenue.slice(-6).map((item) => {
                const max = Math.max(1, ...revenue.map((entry) => Number(entry.collectedRevenue)));
                return (
                  <div key={item.period} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#374151", fontWeight: 600 }}>
                    <div
                      title={`${money.format(item.collectedRevenue)} đ`}
                      style={{
                        height: `${Math.max(4, (item.collectedRevenue / max) * 110)}px`,
                        background: "#00a884",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <span style={{ display: "inline-block", marginTop: 7 }}>
                      {new Date(item.period).toLocaleDateString("vi-VN", { month: "2-digit", year: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, padding: 20 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, color: "#111827", fontWeight: 700 }}>Trạng thái lô đất</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {statuses.map((item) => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", color: "#374151", fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>
                  <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: item.color, marginRight: 8 }} />
                  {item.label}
                </span>
                <strong style={{ color: "#111827", fontSize: 15 }}>{money.format(item.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e5e2da" }}>
          <strong style={{ color: "#111827", fontSize: 16 }}>Hoạt động mới nhất</strong>
          <button style={{ color: "#006b5b", fontWeight: 700 }} onClick={() => navigate(ROUTES.ADMIN_ACTIVITY)}>Xem tất cả →</button>
        </div>
        {!activity.length ? (
          <div style={{ padding: 20, color: "#6b7280" }}>Chưa có hoạt động quản trị nào.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#374151", fontSize: 13 }}>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #f0eee8" }}>
                  <td style={{ padding: 12 }}>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: 12 }}>{item.action}</td>
                  <td style={{ padding: 12 }}>{item.entityType}</td>
                  <td style={{ padding: 12 }}>{item.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
