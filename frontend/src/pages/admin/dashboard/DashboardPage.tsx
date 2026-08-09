import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import "../AdminCorePages.css";

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [summaryResult, revenueResult, activityResult] = await Promise.all([
        api.get<{ data: Summary }>("/admin/dashboard/summary"),
        api.get<{ data: Revenue[] }>("/admin/dashboard/revenue", {
          params: { period: "month" },
        }),
        api.get<{ data: { items: AuditEvent[] } }>("/admin/audit-logs", {
          params: { page: 1, pageSize: 5 },
        }),
      ]);
      setSummary(summaryResult.data.data);
      setRevenue(revenueResult.data.data ?? []);
      setActivity(activityResult.data.data?.items ?? []);
    } catch {
      setError("Không thể tải dữ liệu tổng quan.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useRealtimeRefresh(
    ["dashboard", "audit", "plots", "reservations", "contracts", "services", "transfers"],
    () => loadData(true),
  );

  const statuses = useMemo(
    () => [
      { label: "Còn trống", value: summary?.availablePlots ?? 0 },
      { label: "Đang chờ", value: summary?.pendingPlots ?? 0 },
      { label: "Đã giữ", value: summary?.reservedPlots ?? 0 },
      { label: "Đã bán", value: summary?.soldPlots ?? 0 },
      { label: "Đã khóa", value: summary?.lockedPlots ?? 0 },
    ],
    [summary],
  );

  if (loading) {
    return <div className="admin-core-state">Đang tải dữ liệu tổng quan...</div>;
  }

  const maxRevenue = Math.max(
    1,
    ...revenue.map((entry) => Number(entry.collectedRevenue)),
  );

  return (
    <div className="admin-page admin-core-page">
      <header className="admin-page-header">
        <div>
          <h1>Tổng quan vận hành</h1>
          <p className="admin-page-description">
            Theo dõi lô đất, hợp đồng, yêu cầu và khoản thanh toán trong hệ thống.
          </p>
        </div>
      </header>

      {error && <div className="admin-core-alert">{error}</div>}

      <div className="admin-core-split">
        <section className="admin-core-panel">
          <header className="admin-core-panel__header">
            <div>
              <h2>Doanh thu đã thu</h2>
              <p>Sáu tháng gần nhất</p>
            </div>
          </header>
          {!revenue.length ? (
            <p className="admin-core-empty">Chưa có dữ liệu doanh thu.</p>
          ) : (
            <div className="admin-revenue-chart" aria-label="Doanh thu theo tháng">
              {revenue.slice(-6).map((item) => (
                <div className="admin-revenue-chart__item" key={item.period}>
                  <div className="admin-revenue-chart__track">
                    <div
                      className="admin-revenue-chart__bar"
                      title={`${money.format(item.collectedRevenue)} đ`}
                      style={{
                        height: `${Math.max(
                          4,
                          (item.collectedRevenue / maxRevenue) * 112,
                        )}px`,
                      }}
                    />
                  </div>
                  <span>
                    {new Date(item.period).toLocaleDateString("vi-VN", {
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-core-panel">
          <header className="admin-core-panel__header">
            <div>
              <h2>Trạng thái lô đất</h2>
              <p>Phân bổ hiện tại</p>
            </div>
          </header>
          <div className="admin-status-list">
            {statuses.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{money.format(item.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-core-panel admin-activity-panel">
        <header className="admin-core-panel__header">
          <div>
            <h2>Hoạt động mới nhất</h2>
            <p>Các thay đổi vừa được ghi nhận</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.ADMIN_ACTIVITY)}>
            Xem tất cả
          </button>
        </header>
        {!activity.length ? (
          <p className="admin-core-empty">Chưa có hoạt động quản trị nào.</p>
        ) : (
          <div className="admin-core-table-wrap">
            <table>
              <tbody>
                {activity.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                    <td>{item.action}</td>
                    <td>{item.entityType}</td>
                    <td>{item.actorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
