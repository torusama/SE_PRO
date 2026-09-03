import { CircleDollarSign, FileSignature, LandPlot, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./DashboardKpiCards.css";

type KpiTone = "default" | "warning" | "positive";

type DashboardKpiCardsProps = {
  totalPlots: number;
  pendingRequests: number;
  totalContracts: number;
  totalPaid: string;
};

type KpiCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: KpiTone;
};

function KpiCard({ icon: Icon, label, value, detail, tone = "default" }: KpiCardProps) {
  return (
    <article className={`dashboard-kpi-card dashboard-kpi-card--${tone}`}>
      <div className="dashboard-kpi-card__top">
        <span className="dashboard-kpi-card__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className="dashboard-kpi-card__label">{label}</span>
      </div>

      <div className="dashboard-kpi-card__value">{value}</div>

      <div className="dashboard-kpi-card__detail">
        <span className="dashboard-kpi-card__dot" aria-hidden="true" />
        {detail}
      </div>
    </article>
  );
}

export function DashboardKpiCards({
  totalPlots,
  pendingRequests,
  totalContracts,
  totalPaid,
}: DashboardKpiCardsProps) {
  return (
    <section className="dashboard-kpi-grid" aria-label="Chỉ số vận hành">
      <KpiCard
        icon={LandPlot}
        label="Tổng số lô đất"
        value={totalPlots}
        detail="Toàn bộ quỹ đất"
      />
      <KpiCard
        icon={ClipboardList}
        label="Yêu cầu chờ xử lý"
        value={pendingRequests}
        detail="Cần quản trị viên kiểm tra"
        tone="warning"
      />
      <KpiCard
        icon={FileSignature}
        label="Hợp đồng"
        value={totalContracts}
        detail="Đang được quản lý"
      />
      <KpiCard
        icon={CircleDollarSign}
        label="Đã thu"
        value={totalPaid}
        detail="Tổng thanh toán đã ghi nhận"
        tone="positive"
      />
    </section>
  );
}
