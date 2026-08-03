import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import "../AdminCorePages.css";

type EventType = "Hợp đồng" | "Dịch vụ" | "Thanh toán" | "Hệ thống";

interface AuditRow {
  id: number;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityKey?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface Page<T> {
  items: T[];
  total: number;
}

const TYPE_OPTIONS: (EventType | "Tất cả")[] = [
  "Tất cả",
  "Hợp đồng",
  "Dịch vụ",
  "Thanh toán",
  "Hệ thống",
];
const RANGE_OPTIONS = ["Hôm nay", "7 ngày", "30 ngày", "Tất cả"] as const;

const ACTION_LABELS: Record<string, string> = {
  "appointment.create": "Tạo lịch hẹn",
  "appointment.update": "Cập nhật lịch hẹn",
  "appointment.status.update": "Cập nhật trạng thái lịch hẹn",
  "contract.payment.record": "Ghi nhận thanh toán hợp đồng",
  "contract.sale.complete": "Xác nhận quyền sở hữu lô đất",
  "notification.broadcast": "Gửi thông báo hàng loạt",
  "plot.create": "Tạo lô đất",
  "plot.update": "Cập nhật lô đất",
  "plot.status.update": "Cập nhật trạng thái lô đất",
  "plot.price.update": "Cập nhật giá lô đất",
  "plot.lock": "Khóa lô đất",
  "plot.unlock": "Mở khóa lô đất",
  "plot.delete": "Xóa lô đất",
  "plot.restore": "Khôi phục lô đất",
  "reservation.approve": "Duyệt yêu cầu đặt chỗ",
  "reservation.reject": "Từ chối yêu cầu đặt chỗ",
  "user.locked": "Khóa tài khoản",
  "user.unlocked": "Mở khóa tài khoản",
  "admin_plot_transfer_completed": "Hoàn tất chuyển nhượng lô đất",
  "ai_knowledge_correction_activated": "Áp dụng hiệu chỉnh tri thức AI",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

function eventType(row: AuditRow): EventType {
  const value = `${row.action} ${row.entityType}`.toLowerCase();
  if (value.includes("payment")) return "Thanh toán";
  if (
    value.includes("contract") ||
    value.includes("ownership") ||
    value.includes("transfer")
  ) {
    return "Hợp đồng";
  }
  if (value.includes("service") || value.includes("appointment")) {
    return "Dịch vụ";
  }
  return "Hệ thống";
}

function fromDate(range: (typeof RANGE_OPTIONS)[number]) {
  if (range === "Tất cả") return undefined;
  const date = new Date();
  if (range === "Hôm nay") date.setHours(0, 0, 0, 0);
  else date.setDate(date.getDate() - (range === "7 ngày" ? 7 : 30));
  return date.toISOString();
}

function exportToCsv(rows: AuditRow[]) {
  const header = [
    "Thời gian",
    "Loại",
    "Người thực hiện",
    "Hành động",
    "Đối tượng",
  ];
  const body = rows.map((row) => [
    new Date(row.createdAt).toLocaleString("vi-VN"),
    eventType(row),
    row.actorName ?? "Admin",
    row.action,
    `${row.entityType} #${row.entityKey ?? row.entityId ?? "-"}`,
  ]);
  const csv = [header, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_OPTIONS)[number]>("Tất cả");
  const [range, setRange] =
    useState<(typeof RANGE_OPTIONS)[number]>("Hôm nay");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      api
        .get<ApiResponse<Page<AuditRow>>>("/admin/audit-logs", {
          params: { page: 1, pageSize: 100, from: fromDate(range) },
        })
        .then((response) => {
          if (active) setRows(response.data.data?.items ?? []);
        })
        .catch(() => {
          if (active) setError("Không thể tải lịch sử hoạt động.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [range]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) => typeFilter === "Tất cả" || eventType(row) === typeFilter,
      ),
    [rows, typeFilter],
  );

  return (
    <div className="admin-page admin-core-page">
      <header className="admin-page-header">
        <div>
          <h1>Hoạt động gần đây</h1>
          <p className="admin-page-description">
            Lịch sử thao tác quản trị được ghi nhận từ hệ thống.
          </p>
        </div>
        <div className="admin-core-actions">
          <label>
            <span className="sr-only">Loại hoạt động</span>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as typeof typeFilter)
              }
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => exportToCsv(filtered)}>
            Xuất CSV
          </button>
        </div>
      </header>

      <section className="admin-core-panel">
        <div className="admin-core-tabs" role="tablist" aria-label="Khoảng thời gian">
          {RANGE_OPTIONS.map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={range === option}
              className={range === option ? "is-active" : ""}
              key={option}
              onClick={() => setRange(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="admin-audit-list">
          {loading ? (
            <div className="admin-core-empty">Đang tải hoạt động...</div>
          ) : error ? (
            <div className="admin-core-alert">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="admin-core-empty">
              Không có hoạt động phù hợp.
            </div>
          ) : (
            filtered.map((row) => (
              <article key={row.id}>
                <p>
                  {new Date(row.createdAt).toLocaleString("vi-VN")}
                  <span>{eventType(row)}</span>
                </p>
                <h2>{actionLabel(row.action)}</h2>
                <small>
                  {row.actorName ?? "Admin"} · {row.entityType} #
                  {row.entityKey ?? row.entityId ?? "-"}
                </small>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
