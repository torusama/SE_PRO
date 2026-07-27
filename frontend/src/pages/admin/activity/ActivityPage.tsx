import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

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

const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

function eventType(row: AuditRow): EventType {
  const value = `${row.action} ${row.entityType}`.toLowerCase();
  if (value.includes("payment")) return "Thanh toán";
  if (value.includes("contract") || value.includes("ownership") || value.includes("transfer"))
    return "Hợp đồng";
  if (value.includes("service") || value.includes("appointment")) return "Dịch vụ";
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
  const header = ["Thời gian", "Loại", "Người thực hiện", "Hành động", "Đối tượng"];
  const body = rows.map((row) => [
    new Date(row.createdAt).toLocaleString("vi-VN"),
    eventType(row),
    row.actorName ?? "Admin",
    row.action,
    `${row.entityType} #${row.entityKey ?? row.entityId ?? "-"}`,
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>("Tất cả");
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>("Hôm nay");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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
    return () => {
      active = false;
    };
  }, [range]);

  const filtered = useMemo(
    () => rows.filter((row) => typeFilter === "Tất cả" || eventType(row) === typeFilter),
    [rows, typeFilter],
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "var(--color-text-primary)" }}>Hoạt động gần đây</h1>
          <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
            Lịch sử thao tác quản trị được ghi nhận từ hệ thống
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            {TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
          <button onClick={() => exportToCsv(filtered)}>Xuất CSV</button>
        </div>
      </header>
      <div style={panelStyle}>
        <div style={{ padding: "16px 20px 0", display: "flex", gap: 8 }}>
          {RANGE_OPTIONS.map((option) => (
            <button key={option} onClick={() => setRange(option)} style={{
              border: "1px solid var(--color-border)",
              background: range === option ? "rgba(0,200,160,0.14)" : "transparent",
              color: range === option ? "var(--color-accent-teal)" : "var(--color-text-secondary)",
              borderRadius: 7, padding: "6px 12px", cursor: "pointer",
            }}>{option}</button>
          ))}
        </div>
        <div style={{ padding: 20 }}>
          {loading ? <div>Đang tải hoạt động...</div> : error ? <div style={{ color: "#FF5C5C" }}>{error}</div> :
            filtered.length === 0 ? <div>Không có hoạt động phù hợp.</div> :
            <div style={{ display: "grid", gap: 16 }}>
              {filtered.map((row) => (
                <div key={row.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {new Date(row.createdAt).toLocaleString("vi-VN")} · {eventType(row)}
                  </div>
                  <div style={{ color: "var(--color-text-primary)", fontWeight: 600, marginTop: 3 }}>
                    {row.action}
                  </div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: 12, marginTop: 2 }}>
                    {row.actorName ?? "Admin"} · {row.entityType} #{row.entityKey ?? row.entityId ?? "-"}
                  </div>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}
