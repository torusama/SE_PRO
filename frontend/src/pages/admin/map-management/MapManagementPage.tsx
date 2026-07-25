import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  CEMETERY_ZONES,
  CEMETERY_ZONE_LAYOUT,
  ZONE_META,
  getCemeteryCoordinates,
} from "@/lib/cemeteryMapLayout";
import {
  CROSS_ROADS,
  LEFT_DIAGONAL_ROAD_POINTS,
  MAIN_ROAD,
  MAP_BG_RECT,
  MAP_BOUNDARY_POINTS,
  MAP_GATE,
  MAP_VIEWBOX,
  SPIRIT_PARK,
  ZONE_BACKDROPS,
  gateMarkerPoints,
} from "@/lib/cemeteryMapVisuals";
import "./MapManagementPage.css";

type PlotStatus = "available" | "pending" | "reserved" | "sold" | "locked";
type MapMode = "single" | "cluster";

interface BackendPlot {
  id: number;
  plotCode: string;
  zoneId: number;
  zoneCode?: string;
  zoneName: string;
  rowCode: string;
  plotNumber: number | string;
  status: PlotStatus;
  price: number;
  area: number;
  direction?: string;
  plotType?: "single" | "double" | "family";
  description?: string;
}

interface Zone {
  id: number;
  code: string;
  name: string;
  color?: string;
}

interface MapSlot {
  code: string;
  zoneCode: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  plot?: BackendPlot;
}

interface PlotForm {
  plotCode: string;
  zoneId: string;
  rowNumber: string;
  columnNumber: string;
  price: string;
  area: string;
  direction: string;
  plotType: "single" | "double" | "family";
  description: string;
}

const STATUS_META: Record<
  PlotStatus,
  { label: string; fill: string; stroke: string; text: string }
> = {
  available: {
    label: "Còn trống",
    fill: "#dff7f1",
    stroke: "#0c9b7b",
    text: "#08745d",
  },
  pending: {
    label: "Đang chờ",
    fill: "#fff1d6",
    stroke: "#d99118",
    text: "#9b650d",
  },
  reserved: {
    label: "Đã giữ chỗ",
    fill: "#fff4cc",
    stroke: "#ba8b12",
    text: "#7d5d08",
  },
  sold: {
    label: "Đã bán",
    fill: "#fde3e3",
    stroke: "#d34a4a",
    text: "#a52d2d",
  },
  locked: {
    label: "Đã khóa",
    fill: "#e9edf2",
    stroke: "#7d8998",
    text: "#566170",
  },
};

const EMPTY_FORM: PlotForm = {
  plotCode: "",
  zoneId: "",
  rowNumber: "01",
  columnNumber: "001",
  price: "",
  area: "",
  direction: "Nam",
  plotType: "single",
  description: "",
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string | string[] } } }
    ).response;
    const message = response?.data?.message;
    return Array.isArray(message)
      ? message.join(", ")
      : message || "Thao tác không thành công.";
  }
  return "Không thể kết nối tới máy chủ.";
}

function formatPrice(value: number) {
  return value
    ? `${new Intl.NumberFormat("vi-VN").format(value)} đ`
    : "Chưa cập nhật";
}

function getSize(plot: BackendPlot) {
  if (plot.plotType === "family" || plot.area >= 10) return "3.0 × 4.0 m";
  if (plot.area >= 8) return "4.0 × 2.0 m";
  return "2.0 × 2.0 m";
}

function descriptionLines(value?: string) {
  if (!value?.trim()) return [];
  return value
    .split(/\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function plotDescriptionLines(
  plot: BackendPlot,
  zoneCode: string,
  zoneName: string,
) {
  const customLines = descriptionLines(plot.description);
  if (customLines.length) return customLines;
  const row = Number(plot.rowCode || 1);
  const col = Number(plot.plotNumber || 1);
  const layout = CEMETERY_ZONE_LAYOUT[zoneCode] || CEMETERY_ZONE_LAYOUT.A;
  const maxCol = layout.cols;
  const maxRow = layout.rows;
  const band =
    row <= Math.ceil(maxRow / 3)
      ? "nằm ở dải phía trên, gần trục đường ngang đầu khu"
      : row <= Math.ceil((maxRow * 2) / 3)
        ? "nằm ở khu trung tâm, thuận tiện di chuyển từ cả hai trục đường"
        : "nằm ở dải phía dưới, gần lối vào từ cổng chính";
  const side =
    col <= Math.ceil(maxCol / 3)
      ? "sát nhánh lối bên trái của khu"
      : col >= maxCol - Math.floor(maxCol / 3) + 1
        ? "sát nhánh lối bên phải của khu"
        : "nằm trong phần lõi yên tĩnh của khu";
  const zoneNote = (ZONE_META[zoneCode] || ZONE_META.A).blurb;
  return [
    `Tổng quan: ${plot.plotCode} là ${plot.area >= 10 ? "lô gia tộc" : "lô đơn"} thuộc ${zoneName}, diện tích ${plot.area || 0} m², hướng ${(plot.direction || "chưa cập nhật").toLowerCase()}.`,
    `Điểm nổi bật: Vị trí ${band}, ${side}, phù hợp cho việc thăm viếng định kỳ.`,
    `Gợi ý: ${zoneNote}`,
    `Giá: Giá niêm yết ${formatPrice(plot.price)}.`,
  ];
}

export default function MapManagementPage() {
  const [plots, setPlots] = useState<BackendPlot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PlotStatus>("all");
  const [mapMode, setMapMode] = useState<MapMode>("single");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<PlotForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<BackendPlot | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mapCanvasRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [plotResponse, zoneResponse] = await Promise.all([
        api.get<{ data: BackendPlot[] }>("/plots/map"),
        api.get<{ data: Zone[] }>("/admin/plot-zones"),
      ]);
      setPlots(plotResponse.data.data || []);
      setZones(zoneResponse.data.data || []);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const interval = window.setInterval(() => void loadData(true), 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadData]);

  useEffect(() => {
    const el = mapCanvasRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setZoom((current) =>
        Number(Math.min(4, Math.max(0.5, current * factor)).toFixed(3)),
      );
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const slots = useMemo(() => {
    const byCode = new Map(
      plots.map((plot) => [plot.plotCode.toUpperCase(), plot]),
    );
    const result: MapSlot[] = [];
    Object.entries(CEMETERY_ZONE_LAYOUT).forEach(([zoneCode, layout]) => {
      for (let row = 1; row <= layout.rows; row += 1) {
        for (let col = 1; col <= layout.cols; col += 1) {
          const code = `${zoneCode}-${String(row).padStart(2, "0")}-${String(col).padStart(3, "0")}`;
          const coordinate = getCemeteryCoordinates(
            { rowCode: String(row), plotNumber: col },
            code,
            zoneCode,
          );
          result.push({
            code,
            zoneCode,
            row,
            col,
            ...coordinate,
            plot: byCode.get(code),
          });
        }
      }
    });
    return result;
  }, [plots]);

  const modeZoneCodes = useMemo(
    () =>
      new Set<string>(
        CEMETERY_ZONES.filter((zone) => zone.mode === mapMode).map(
          (zone) => zone.key,
        ),
      ),
    [mapMode],
  );

  const modeSlots = useMemo(
    () => slots.filter((slot) => modeZoneCodes.has(slot.zoneCode)),
    [slots, modeZoneCodes],
  );

  const visibleSlots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return modeSlots.filter((slot) => {
      const plot = slot.plot;
      const matchesSearch =
        !query ||
        slot.code.toLowerCase().includes(query) ||
        plot?.zoneName.toLowerCase().includes(query);
      const matchesZone = zoneFilter === "all" || slot.zoneCode === zoneFilter;
      const matchesStatus =
        statusFilter === "all" || plot?.status === statusFilter;
      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [modeSlots, search, statusFilter, zoneFilter]);

  const selectedSlot = slots.find((slot) => slot.code === selectedCode);
  const modeZones = CEMETERY_ZONES.filter((zone) => zone.mode === mapMode);
  const stats = useMemo(
    () =>
      modeSlots.reduce(
        (result, slot) => {
          if (!slot.plot) result.noData += 1;
          else result[slot.plot.status] += 1;
          return result;
        },
        {
          available: 0,
          pending: 0,
          reserved: 0,
          sold: 0,
          locked: 0,
          noData: 0,
        },
      ),
    [modeSlots],
  );

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  }

  function changeMode(mode: MapMode) {
    setMapMode(mode);
    setZoneFilter("all");
    setSelectedCode(null);
    setZoom(1);
    setRotation(0);
  }

  function openCreate(slot?: MapSlot) {
    const target =
      slot ||
      modeSlots.find((item) => !item.plot) ||
      slots.find((item) => !item.plot);
    const zone =
      zones.find((item) => item.code === target?.zoneCode) || zones[0];
    setForm({
      ...EMPTY_FORM,
      plotCode: target?.code || "",
      zoneId: zone ? String(zone.id) : "",
      rowNumber: target ? String(target.row).padStart(2, "0") : "01",
      columnNumber: target ? String(target.col).padStart(3, "0") : "001",
      area: target?.zoneCode === "C" ? "12" : "",
      plotType: target?.zoneCode === "C" ? "family" : "single",
    });
    setEditing(null);
    setError("");
  }

  function openEdit(plot: BackendPlot) {
    setForm({
      plotCode: plot.plotCode,
      zoneId: String(plot.zoneId),
      rowNumber: String(plot.rowCode || ""),
      columnNumber: String(plot.plotNumber || ""),
      price: String(plot.price || ""),
      area: String(plot.area || ""),
      direction: plot.direction || "",
      plotType: plot.plotType || "single",
      description: plot.description || "",
    });
    setEditing(plot);
    setError("");
  }

  function updateForm<K extends keyof PlotForm>(key: K, value: PlotForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePlot(event: React.FormEvent) {
    event.preventDefault();
    const zone = zones.find((item) => item.id === Number(form.zoneId));
    if (!zone || !form.plotCode.trim() || Number(form.price) < 0) {
      setError("Vui lòng nhập đầy đủ mã lô, khu vực và giá hợp lệ.");
      return;
    }
    const coordinate = getCemeteryCoordinates(
      { rowCode: form.rowNumber, plotNumber: form.columnNumber },
      form.plotCode.trim().toUpperCase(),
      zone.code,
    );
    const payload = {
      plotCode: form.plotCode.trim().toUpperCase(),
      zoneId: Number(form.zoneId),
      rowNumber: form.rowNumber.padStart(2, "0"),
      columnNumber: form.columnNumber.padStart(3, "0"),
      price: Number(form.price),
      area: form.area ? Number(form.area) : undefined,
      direction: form.direction || undefined,
      plotType: form.plotType,
      description: form.description,
      mapX: coordinate.x,
      mapY: coordinate.y,
      mapWidth: coordinate.width,
      mapHeight: coordinate.height,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/plots/${editing.id}`, payload);
        notify(`Đã cập nhật lô ${payload.plotCode}.`);
      } else {
        await api.post("/admin/plots", payload);
        notify(`Đã thêm lô ${payload.plotCode} vào bản đồ.`);
      }
      setEditing(undefined);
      setSelectedCode(payload.plotCode);
      await loadData(true);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(plot: BackendPlot, status: PlotStatus) {
    if (plot.status === status) return;
    setSaving(true);
    try {
      await api.patch(`/admin/plots/${plot.id}/status`, { status });
      notify(`Đã chuyển ${plot.plotCode} sang “${STATUS_META[status].label}”.`);
      await loadData(true);
    } catch (statusError) {
      setError(errorMessage(statusError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleLock(plot: BackendPlot) {
    setSaving(true);
    try {
      if (plot.status === "locked") {
        await api.post(`/admin/plots/${plot.id}/unlock`);
        notify(`Đã mở khóa lô ${plot.plotCode}.`);
      } else {
        await api.post(`/admin/plots/${plot.id}/lock`, {
          reason: "Khóa từ bản đồ quản trị 2D",
        });
        notify(`Đã khóa lô ${plot.plotCode}.`);
      }
      await loadData(true);
    } catch (lockError) {
      setError(errorMessage(lockError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-map-page">
      <header className="admin-map-page-header">
        <div>
          <h1>Bản đồ 2D quản trị</h1>
          <p>Cùng cấu trúc và dữ liệu với bản đồ công khai /ban-do</p>
        </div>
        <div className="admin-map-header-actions">
          <button onClick={() => void loadData()} disabled={loading}>
            ↻ Làm mới
          </button>
          <button className="admin-primary-button" onClick={() => openCreate()}>
            + Thêm lô
          </button>
        </div>
      </header>

      {message && <div className="admin-map-toast success">{message}</div>}
      {error && editing === undefined && (
        <div className="admin-map-toast error">{error}</div>
      )}

      <section className="admin-map-shell">
        <aside className="admin-map-left">
          <div className="admin-map-section">
            <div className="admin-map-section-title">Tìm kiếm lô</div>
            <label className="admin-map-search">
              <span>Mã lô</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="A-01-001 hoặc tên khu"
              />
            </label>
            <div className="admin-map-chips">
              <button
                className={statusFilter === "all" ? "active" : ""}
                onClick={() => setStatusFilter("all")}
              >
                Tất cả
              </button>
              {(Object.keys(STATUS_META) as PlotStatus[]).map((status) => (
                <button
                  key={status}
                  className={statusFilter === status ? "active" : ""}
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-map-section">
            <div className="admin-map-section-title">Khu vực</div>
            <div className="admin-map-zone-list">
              <button
                className={zoneFilter === "all" ? "active" : ""}
                onClick={() => setZoneFilter("all")}
              >
                <i className="all-zones" />
                <strong>Tất cả khu</strong>
                <span>{modeSlots.length} lô</span>
              </button>
              {modeZones.map((zone) => (
                <button
                  key={zone.key}
                  className={zoneFilter === zone.key ? "active" : ""}
                  onClick={() => setZoneFilter(zone.key)}
                >
                  <i style={{ background: zone.dot }} />
                  <strong>{zone.name}</strong>
                  <span>
                    {
                      modeSlots.filter((slot) => slot.zoneCode === zone.key)
                        .length
                    }{" "}
                    lô
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-map-section compact">
            <div className="admin-map-section-title">Chú giải</div>
            <div className="admin-map-legend">
              {(Object.keys(STATUS_META) as PlotStatus[]).map((status) => (
                <span key={status}>
                  <i
                    style={{
                      background: STATUS_META[status].fill,
                      borderColor: STATUS_META[status].stroke,
                    }}
                  />
                  {STATUS_META[status].label}
                </span>
              ))}
              <span>
                <i className="no-data" />
                Chưa có dữ liệu
              </span>
            </div>
          </div>

          <div className="admin-map-stats">
            <div>
              <strong>{modeSlots.length}</strong>
              <span>Ô đất quy hoạch</span>
            </div>
            <div>
              <strong>{stats.available}</strong>
              <span>Còn trống</span>
            </div>
            <div>
              <strong className="amber">
                {stats.pending + stats.reserved}
              </strong>
              <span>Đang chờ / Đã giữ</span>
            </div>
            <div>
              <strong className="red">{stats.sold}</strong>
              <span>Đã bán</span>
            </div>
            <div>
              <strong className="gray">{stats.noData}</strong>
              <span>Chưa có dữ liệu</span>
            </div>
          </div>
        </aside>

        <main className="admin-map-center">
          <div className="admin-map-toolbar">
            <div className="admin-map-mode-switch">
              <button
                className={mapMode === "single" ? "active" : ""}
                onClick={() => changeMode("single")}
              >
                Một lô
              </button>
              <button
                className={mapMode === "cluster" ? "active" : ""}
                onClick={() => changeMode("cluster")}
              >
                Lô gia tộc
              </button>
            </div>
          </div>

          <div className="admin-map-canvas" ref={mapCanvasRef}>
            <svg
              className="admin-map-compass"
              viewBox="0 0 40 40"
              aria-label="Đặt lại hướng Bắc"
              role="button"
              onClick={() => setRotation(0)}
              style={{ transform: `rotate(${-rotation}deg)` }}
            >
              <circle cx="20" cy="20" r="18" />
              <polygon points="20,4 23,18 20,20 17,18" className="north" />
              <polygon points="20,36 23,22 20,20 17,22" className="south" />
              <text x="20" y="8" textAnchor="middle">
                N
              </text>
            </svg>

            <svg
              className="admin-cemetery-map"
              viewBox={MAP_VIEWBOX}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            >
              <defs>
                <pattern
                  id="admin-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M 20 0 L 0 0 0 20" />
                </pattern>
              </defs>
              <rect
                x={MAP_BG_RECT.x}
                y={MAP_BG_RECT.y}
                width={MAP_BG_RECT.width}
                height={MAP_BG_RECT.height}
                fill="url(#admin-grid)"
              />
              {/* Ranh giới tổng thể khu đất: đa giác bất cân đối, viền nét đứt đỏ */}
              <polygon
                className="admin-map-land"
                points={MAP_BOUNDARY_POINTS}
              />
              <polygon
                className="admin-map-boundary"
                points={MAP_BOUNDARY_POINTS}
              />

              {/* Đường bao/đường chéo bên trái */}
              <polygon
                className="admin-map-road admin-map-road-diagonal"
                points={LEFT_DIAGONAL_ROAD_POINTS}
              />
              {/* Đường chính chạy dọc bên phải */}
              <rect
                x={MAIN_ROAD.x}
                y={MAIN_ROAD.y}
                width={MAIN_ROAD.width}
                height={MAIN_ROAD.height}
                className="admin-map-road"
              />
              <text
                x={MAIN_ROAD.x + MAIN_ROAD.width / 2}
                y={MAIN_ROAD.y - 8}
                textAnchor="middle"
                className="admin-map-road-label"
              >
                Trục đường chính
              </text>
              {CROSS_ROADS.map((road, index) => (
                <rect
                  key={`cross-${index}`}
                  x={road.x}
                  y={road.y}
                  width={road.width}
                  height={road.height}
                  className="admin-map-road"
                />
              ))}

              {/* Đài Nước Vĩnh Yên - công viên trung tâm */}
              <g>
                <rect
                  x={SPIRIT_PARK.x}
                  y={SPIRIT_PARK.y}
                  width={SPIRIT_PARK.width}
                  height={SPIRIT_PARK.height}
                  rx="18"
                  className="admin-spirit-park-rect"
                />
                <circle
                  cx={SPIRIT_PARK.cx}
                  cy={SPIRIT_PARK.cy}
                  r={SPIRIT_PARK.r}
                  className="admin-spirit-park-circle"
                />
                <text
                  x={SPIRIT_PARK.cx}
                  y={SPIRIT_PARK.cy + 4}
                  textAnchor="middle"
                  className="admin-spirit-park-label"
                >
                  ĐÀI NƯỚC VĨNH YÊN
                </text>
              </g>

              <polygon
                className="admin-map-gate-marker"
                points={gateMarkerPoints(MAP_GATE)}
              />
              <text
                x={MAP_GATE.x}
                y={MAP_GATE.y - 36}
                textAnchor="middle"
                className="admin-map-gate-label"
              >
                Cổng chính
              </text>

              {/* Khối nền từng khu: đa giác vát góc kiểu bản vẽ kiến trúc phân lô */}
              {modeZones.map((zone) => {
                const backdrop = ZONE_BACKDROPS[zone.key];
                if (!backdrop) return null;
                return (
                  <g key={`backdrop-${zone.key}`}>
                    <polygon
                      points={backdrop.points}
                      fill={zone.dot}
                      fillOpacity={0.08}
                      stroke={zone.dot}
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      strokeDasharray="5 3"
                    />
                    <circle
                      cx={backdrop.cx}
                      cy={backdrop.cy}
                      r="11"
                      className="admin-map-zone-badge"
                      stroke={zone.dot}
                    />
                    <text
                      x={backdrop.cx}
                      y={backdrop.cy + 4}
                      textAnchor="middle"
                      className="admin-map-zone-badge-text"
                      fill={zone.dot}
                    >
                      {zone.key}
                    </text>
                  </g>
                );
              })}

              {modeZones.map((zone) => (
                <text
                  key={zone.key}
                  x={zone.labelX}
                  y={zone.labelY}
                  textAnchor="middle"
                  className="admin-map-zone-label"
                >
                  {`KHU ${zone.key}`}
                </text>
              ))}

              {visibleSlots.map((slot) => {
                const plot = slot.plot;
                const meta = plot ? STATUS_META[plot.status] : null;
                const selected = selectedCode === slot.code;
                return (
                  <g
                    key={slot.code}
                    className={`admin-map-plot ${plot ? "" : "placeholder"} ${selected ? "selected" : ""}`}
                    onClick={() => setSelectedCode(slot.code)}
                  >
                    <rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      rx="2"
                      fill={meta?.fill}
                      stroke={meta?.stroke}
                    />
                    <title>
                      {plot
                        ? `${plot.plotCode} - ${plot.zoneName} - ${STATUS_META[plot.status].label} - ${formatPrice(plot.price)}`
                        : `${slot.code} - Chưa có dữ liệu`}
                    </title>
                    <text
                      x={slot.x + slot.width / 2}
                      y={slot.y + Math.min(16, slot.height / 2 + 3)}
                      textAnchor="middle"
                      fill={meta?.text}
                    >
                      {slot.col}
                    </text>
                  </g>
                );
              })}

              {selectedSlot &&
                visibleSlots.some(
                  (slot) => slot.code === selectedSlot.code,
                ) && (
                  <rect
                    x={selectedSlot.x + 1}
                    y={selectedSlot.y + 1}
                    width={selectedSlot.width - 2}
                    height={selectedSlot.height - 2}
                    rx="3"
                    className="admin-map-selection"
                  />
                )}
            </svg>

            {loading && (
              <div className="admin-map-empty">Đang tải dữ liệu bản đồ...</div>
            )}
            {!loading && !visibleSlots.length && (
              <div className="admin-map-empty">
                Không có lô phù hợp với bộ lọc hiện tại.
              </div>
            )}
            <div className="admin-map-rotate">
              <button
                title="Xoay trái"
                onClick={() => setRotation((r) => (r - 30 + 360) % 360)}
              >
                ⟲
              </button>
              <button title="Đặt lại hướng Bắc" onClick={() => setRotation(0)}>
                N
              </button>
              <button
                title="Xoay phải"
                onClick={() => setRotation((r) => (r + 30) % 360)}
              >
                ⟳
              </button>
            </div>

            <div className="admin-map-zoom">
              <button
                title="Phóng to (hoặc cuộn touchpad)"
                onClick={() => setZoom((value) => Math.min(value * 1.3, 4))}
              >
                +
              </button>
              <button
                title="Thu nhỏ (hoặc cuộn touchpad)"
                onClick={() => setZoom((value) => Math.max(value / 1.3, 0.5))}
              >
                −
              </button>
            </div>
          </div>
        </main>

        <aside className="admin-map-right">
          {!selectedSlot && (
            <div className="admin-map-detail-empty">
              <strong>Chưa chọn lô</strong>
              <p>
                Chọn một lô trên bản đồ để xem và chỉnh sửa thông tin quản trị.
              </p>
            </div>
          )}

          {selectedSlot && !selectedSlot.plot && (
            <div className="admin-map-detail">
              <span className="admin-map-detail-tag">
                Bản đồ nghĩa trang 2D
              </span>
              <h2>{selectedSlot.code}</h2>
              <p className="admin-map-detail-zone">
                {CEMETERY_ZONE_LAYOUT[selectedSlot.zoneCode]?.name} · Hàng{" "}
                {String(selectedSlot.row).padStart(2, "0")} · Số lô{" "}
                {selectedSlot.col}
              </p>
              <span className="admin-map-status no-data">Chưa có dữ liệu</span>
              <div className="admin-map-divider" />
              <div className="admin-map-detail-row">
                <span>Mã lô</span>
                <strong>{selectedSlot.code}</strong>
              </div>
              <div className="admin-map-detail-row">
                <span>Khu</span>
                <strong>
                  {CEMETERY_ZONE_LAYOUT[selectedSlot.zoneCode]?.name}
                </strong>
              </div>
              <div className="admin-map-detail-row">
                <span>Hàng</span>
                <strong>{String(selectedSlot.row).padStart(2, "0")}</strong>
              </div>
              <div className="admin-map-detail-row">
                <span>Trạng thái</span>
                <strong>Chưa có dữ liệu</strong>
              </div>
              <button
                className="admin-primary-button admin-map-main-action"
                onClick={() => openCreate(selectedSlot)}
              >
                + Thêm lô tại vị trí này
              </button>
            </div>
          )}

          {selectedSlot?.plot &&
            (() => {
              const plot = selectedSlot.plot;
              const status = STATUS_META[plot.status];
              return (
                <div className="admin-map-detail">
                  <span className="admin-map-detail-tag">
                    Bản đồ nghĩa trang 2D
                  </span>
                  <h2>{plot.plotCode}</h2>
                  <p className="admin-map-detail-zone">
                    {CEMETERY_ZONE_LAYOUT[selectedSlot.zoneCode]?.name} · Hàng{" "}
                    {plot.rowCode} · Số lô {plot.plotNumber}
                  </p>
                  <span
                    className="admin-map-status"
                    style={{
                      color: status.text,
                      borderColor: status.stroke,
                      background: status.fill,
                    }}
                  >
                    <i style={{ background: status.stroke }} />
                    {status.label}
                  </span>
                  <div className="admin-map-divider" />
                  <div className="admin-map-detail-row">
                    <span>Mã lô</span>
                    <strong>{plot.plotCode}</strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Khu</span>
                    <strong>
                      {CEMETERY_ZONE_LAYOUT[selectedSlot.zoneCode]?.name}
                    </strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Hàng</span>
                    <strong>{plot.rowCode}</strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Trạng thái</span>
                    <strong style={{ color: status.text }}>
                      {status.label}
                    </strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Giá</span>
                    <strong>{formatPrice(plot.price)}</strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Diện tích</span>
                    <strong>{plot.area || 0} m²</strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Kích thước</span>
                    <strong>{getSize(plot)}</strong>
                  </div>
                  <div className="admin-map-detail-row">
                    <span>Hướng</span>
                    <strong>{plot.direction || "Chưa cập nhật"}</strong>
                  </div>
                  <div className="admin-map-description">
                    <span>Mô tả</span>
                    <ul>
                      {plotDescriptionLines(
                        plot,
                        selectedSlot.zoneCode,
                        CEMETERY_ZONE_LAYOUT[selectedSlot.zoneCode]?.name ||
                          plot.zoneName,
                      ).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    className="admin-primary-button admin-map-main-action"
                    onClick={() => openEdit(plot)}
                  >
                    Sửa thông tin
                  </button>
                  <div className="admin-map-management-actions">
                    {plot.status !== "locked" && (
                      <label>
                        Cập nhật trạng thái
                        <select
                          value={plot.status}
                          disabled={saving}
                          onChange={(event) =>
                            void changeStatus(
                              plot,
                              event.target.value as PlotStatus,
                            )
                          }
                        >
                          {(
                            [
                              "available",
                              "pending",
                              "reserved",
                              "sold",
                            ] as PlotStatus[]
                          ).map((value) => (
                            <option key={value} value={value}>
                              {STATUS_META[value].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      className={plot.status === "locked" ? "unlock" : "lock"}
                      disabled={saving}
                      onClick={() => void toggleLock(plot)}
                    >
                      {plot.status === "locked" ? "Mở khóa lô" : "Khóa lô"}
                    </button>
                  </div>
                </div>
              );
            })()}
        </aside>
      </section>

      {editing !== undefined && (
        <div
          className="plot-modal-backdrop"
          onMouseDown={() => !saving && setEditing(undefined)}
        >
          <form
            className="plot-modal"
            onSubmit={(event) => void savePlot(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {editing ? "Cập nhật lô đất" : "Thêm lô vào bản đồ"}
                </span>
                <h2>{form.plotCode || "Lô mới"}</h2>
              </div>
              <button type="button" onClick={() => setEditing(undefined)}>
                ×
              </button>
            </header>
            {error && <div className="admin-map-toast error">{error}</div>}
            <div className="plot-form-grid">
              <label>
                Mã lô
                <input
                  required
                  value={form.plotCode}
                  onChange={(event) =>
                    updateForm("plotCode", event.target.value.toUpperCase())
                  }
                  placeholder="A-01-001"
                />
              </label>
              <label>
                Khu vực
                <select
                  required
                  value={form.zoneId}
                  onChange={(event) => updateForm("zoneId", event.target.value)}
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {CEMETERY_ZONE_LAYOUT[zone.code]?.name || zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Hàng
                <input
                  required
                  value={form.rowNumber}
                  onChange={(event) =>
                    updateForm("rowNumber", event.target.value)
                  }
                />
              </label>
              <label>
                Số ô
                <input
                  required
                  value={form.columnNumber}
                  onChange={(event) =>
                    updateForm("columnNumber", event.target.value)
                  }
                />
              </label>
              <label>
                Giá niêm yết (đ)
                <input
                  required
                  min="0"
                  type="number"
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                />
              </label>
              <label>
                Diện tích (m²)
                <input
                  min="0"
                  step="0.1"
                  type="number"
                  value={form.area}
                  onChange={(event) => updateForm("area", event.target.value)}
                />
              </label>
              <label>
                Hướng
                <input
                  value={form.direction}
                  onChange={(event) =>
                    updateForm("direction", event.target.value)
                  }
                />
              </label>
              <label>
                Loại lô
                <select
                  value={form.plotType}
                  onChange={(event) =>
                    updateForm(
                      "plotType",
                      event.target.value as PlotForm["plotType"],
                    )
                  }
                >
                  <option value="single">Lô đơn</option>
                  <option value="double">Lô đôi</option>
                  <option value="family">Lô gia tộc</option>
                </select>
              </label>
              <label className="full-width">
                Mô tả
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(undefined)}>
                Hủy
              </button>
              <button className="admin-primary-button" disabled={saving}>
                {saving
                  ? "Đang lưu..."
                  : editing
                    ? "Lưu thay đổi"
                    : "Thêm vào bản đồ"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
