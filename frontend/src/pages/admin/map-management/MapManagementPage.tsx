import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import {
  CEMETERY_ZONES,
  CEMETERY_ZONE_LAYOUT,
  ZONE_META,
  getCemeteryCoordinates,
  getGroupIndex,
} from "@/lib/cemeteryMapLayout";
import {
  BOTTOM_ROAD,
  CENTRAL_ROAD_NORTH,
  CENTRAL_ROAD_SOUTH,
  CLUSTER_GROUP_BACKDROPS,
  CROSS_ROADS,
  FAMILY_AISLE_ROAD,
  FAMILY_CROSS_ROADS,
  FAMILY_ROAD,
  LEFT_ROAD,
  MAIN_ROAD,
  MAP_BG_RECT,
  MAP_BOUNDARY_POINTS,
  MAP_GATE,
  MAP_VIEWBOX,
  ROAD_CORNER_CHAMFERS,
  SECONDARY_GATE,
  SPIRIT_PARK,
  TOP_ROAD,
  ZONE_BACKDROPS,
  gateMarkerPoints,
  getHeadingLabel,
} from "@/lib/cemeteryMapVisuals";
import "./MapManagementPage.css";

type PlotStatus = "available" | "pending" | "reserved" | "sold" | "locked";
type MapMode = "single" | "cluster";
type Direction =
  | "Đông"
  | "Tây"
  | "Nam"
  | "Bắc"
  | "Đông Bắc"
  | "Đông Nam"
  | "Tây Bắc"
  | "Tây Nam";

const DIRECTIONS: Direction[] = [
  "Đông",
  "Tây",
  "Nam",
  "Bắc",
  "Đông Bắc",
  "Đông Nam",
  "Tây Bắc",
  "Tây Nam",
];

const SINGLE_ZONES = CEMETERY_ZONES.filter((zone) => zone.mode === "single");
const clusterZone = CEMETERY_ZONES.find((zone) => zone.mode === "cluster");

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
  direction: Direction;
  description: string;
}

interface PaginatedPlots {
  items: BackendPlot[];
  total: number;
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
  const clusterNote =
    zoneCode === "C"
      ? ` Thuộc cụm C${getGroupIndex(zoneCode, row, col) + 1} - khu vực riêng biệt, tách bạch với các cụm gia tộc khác.`
      : "";
  return [
    `Tổng quan: ${plot.plotCode} là ${plot.area >= 10 ? "lô gia tộc" : "lô đơn"} thuộc ${zoneName}, diện tích ${plot.area || 0} m², hướng ${(plot.direction || "chưa cập nhật").toLowerCase()}.`,
    `Điểm nổi bật: Vị trí ${band}, ${side}, phù hợp cho việc thăm viếng định kỳ.${clusterNote}`,
    `Gợi ý: ${zoneNote}`,
    `Giá: Giá niêm yết ${formatPrice(plot.price)}.`,
  ];
}

export default function MapManagementPage() {
  const [plots, setPlots] = useState<BackendPlot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PlotStatus | "noData">("all");
  const [mapMode, setMapMode] = useState<MapMode>("single");

  function toggleStatusFilter(targetStatus: "all" | PlotStatus | "noData") {
    setStatusFilter((prev) => (prev === targetStatus ? "all" : targetStatus));
    setSelectedCode(null);
  }
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<PlotForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<BackendPlot | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mapCanvasRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [firstPlotResponse, zoneResponse] = await Promise.all([
        api.get<{ data: PaginatedPlots }>("/admin/plots", {
          params: { page: 1, pageSize: 100 },
        }),
        api.get<{ data: Zone[] }>("/admin/plot-zones"),
      ]);
      const firstPage = firstPlotResponse.data.data;
      const pageCount = Math.ceil((firstPage?.total || 0) / 100);
      const remainingResponses =
        pageCount > 1
          ? await Promise.all(
              Array.from({ length: pageCount - 1 }, (_, index) =>
                api.get<{ data: PaginatedPlots }>("/admin/plots", {
                  params: { page: index + 2, pageSize: 100 },
                }),
              ),
            )
          : [];
      setPlots([
        ...(firstPage?.items || []),
        ...remainingResponses.flatMap(
          (response) => response.data.data?.items || [],
        ),
      ]);
      setZones(zoneResponse.data.data || []);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useRealtimeRefresh(["plots", "reservations", "ownership"], () =>
    loadData(true),
  );

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".admin-map-plot")) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(
          event.pointerId,
        );
      } catch {
        // ignore
      }
    }
  }

  function resetMapTransform() {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

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
    resetMapTransform();
  }

  function openCreate(target: MapSlot) {
    if (target.plot) return;
    const zone =
      zones.find((item) => item.code === target.zoneCode) || zones[0];
    setForm({
      ...EMPTY_FORM,
      plotCode: target.code,
      zoneId: zone ? String(zone.id) : "",
      rowNumber: String(target.row).padStart(2, "0"),
      columnNumber: String(target.col).padStart(3, "0"),
      area: target.zoneCode === "C" ? "12" : "",
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
      price: Number.isFinite(plot.price) ? String(plot.price / 1_000_000) : "",
      area: String(plot.area || ""),
      direction: DIRECTIONS.includes(plot.direction as Direction)
        ? (plot.direction as Direction)
        : "Nam",
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
    const priceInMillions = Number(form.price);
    if (
      !zone ||
      !form.plotCode.trim() ||
      !form.price.trim() ||
      !Number.isFinite(priceInMillions) ||
      priceInMillions < 0
    ) {
      setError("Vui lòng nhập đầy đủ mã lô, khu vực và giá hợp lệ.");
      return;
    }
    const coordinate = getCemeteryCoordinates(
      { rowCode: form.rowNumber, plotNumber: form.columnNumber },
      form.plotCode.trim().toUpperCase(),
      zone.code,
    );
    const editablePayload = {
      price: Math.round(priceInMillions * 1_000_000),
      area: form.area ? Number(form.area) : undefined,
      direction: form.direction,
      description: form.description,
    };
    const createPayload = {
      ...editablePayload,
      plotCode: form.plotCode.trim().toUpperCase(),
      zoneId: Number(form.zoneId),
      rowNumber: form.rowNumber.padStart(2, "0"),
      columnNumber: form.columnNumber.padStart(3, "0"),
      plotType: zone.code === "C" ? "family" : "single",
      mapX: coordinate.x,
      mapY: coordinate.y,
      mapWidth: coordinate.width,
      mapHeight: coordinate.height,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/plots/${editing.id}`, editablePayload);
        notify(`Đã cập nhật lô ${form.plotCode}.`);
      } else {
        await api.post("/admin/plots", createPayload);
        notify(`Đã thêm lô ${createPayload.plotCode} vào bản đồ.`);
      }
      setEditing(undefined);
      setSelectedCode(form.plotCode);
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
              <svg
                className="admin-search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhập mã lô hoặc tên khu..."
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
                onClick={() => {
                  setZoneFilter("all");
                  setSelectedCode(null);
                }}
              >
                <i className="all-zones" />
                <strong>Tất cả khu</strong>
                <span>{modeSlots.length} lô</span>
              </button>
              {modeZones.map((zone) => (
                <button
                  key={zone.key}
                  className={zoneFilter === zone.key ? "active" : ""}
                  onClick={() => {
                    setZoneFilter(zone.key);
                    setSelectedCode(null);
                  }}
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
            <div
              className={`stat-card ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("all")}
            >
              <span className="stat-num teal">{modeSlots.length}</span>
              <span className="stat-lbl">Tổng lô đất</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "available" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("available")}
            >
              <span className="stat-num green">{stats.available}</span>
              <span className="stat-lbl">Còn trống</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("pending")}
            >
              <span className="stat-num amber">{stats.pending}</span>
              <span className="stat-lbl">Đang chờ</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "reserved" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("reserved")}
            >
              <span className="stat-num yellow">{stats.reserved}</span>
              <span className="stat-lbl">Đã giữ chỗ</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "sold" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("sold")}
            >
              <span className="stat-num red">{stats.sold}</span>
              <span className="stat-lbl">Đã bán</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "noData" ? "active" : ""}`}
              onClick={() => toggleStatusFilter("noData")}
            >
              <span className="stat-num gray">{stats.noData}</span>
              <span className="stat-lbl single-line">Chưa có dữ liệu</span>
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
                Lô đơn
              </button>
              <button
                className={mapMode === "cluster" ? "active" : ""}
                onClick={() => changeMode("cluster")}
              >
                Lô gia tộc
              </button>
            </div>
          </div>

          <div className="admin-map-viewport">
            <div
              className="admin-map-canvas"
              ref={mapCanvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              <div
                className="admin-map-stage"
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                }}
              >
                <svg
                  className="admin-cemetery-map"
                  viewBox={MAP_VIEWBOX}
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
                    <clipPath id="admin-cemetery-boundary-clip">
                      <polygon points={MAP_BOUNDARY_POINTS} />
                    </clipPath>
                  </defs>
                  <rect
                    x={MAP_BG_RECT.x}
                    y={MAP_BG_RECT.y}
                    width={MAP_BG_RECT.width}
                    height={MAP_BG_RECT.height}
                    fill="url(#admin-grid)"
                  />
                  {/* Ranh giới tổng thể khu đất */}
                  <polygon
                    className="admin-map-land"
                    points={MAP_BOUNDARY_POINTS}
                  />
                  <polygon
                    className="admin-map-boundary"
                    points={MAP_BOUNDARY_POINTS}
                  />

                  {/* Mạng lưới đường giao thông liên kết 100% (cắt gọn theo ranh giới đỏ) */}
                  <g className="admin-map-road-network" clipPath="url(#admin-cemetery-boundary-clip)">
                    <rect
                      x={LEFT_ROAD.x}
                      y={LEFT_ROAD.y}
                      width={LEFT_ROAD.width}
                      height={LEFT_ROAD.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={MAIN_ROAD.x}
                      y={MAIN_ROAD.y}
                      width={MAIN_ROAD.width}
                      height={MAIN_ROAD.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={CENTRAL_ROAD_SOUTH.x}
                      y={CENTRAL_ROAD_SOUTH.y}
                      width={CENTRAL_ROAD_SOUTH.width}
                      height={CENTRAL_ROAD_SOUTH.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={CENTRAL_ROAD_NORTH.x}
                      y={CENTRAL_ROAD_NORTH.y}
                      width={CENTRAL_ROAD_NORTH.width}
                      height={CENTRAL_ROAD_NORTH.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={FAMILY_ROAD.x}
                      y={FAMILY_ROAD.y}
                      width={FAMILY_ROAD.width}
                      height={FAMILY_ROAD.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={TOP_ROAD.x}
                      y={TOP_ROAD.y}
                      width={TOP_ROAD.width}
                      height={TOP_ROAD.height}
                      className="admin-map-road"
                    />
                    <rect
                      x={BOTTOM_ROAD.x}
                      y={BOTTOM_ROAD.y}
                      width={BOTTOM_ROAD.width}
                      height={BOTTOM_ROAD.height}
                      className="admin-map-road"
                    />
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
                    {/* 3 đường ngang nối giữa các cụm mộ Gia tộc (C1-C4) sang Trục chính */}
                    {FAMILY_CROSS_ROADS.map((road, index) => (
                      <rect
                        key={`fam-cross-${index}`}
                        x={road.x}
                        y={road.y}
                        width={road.width}
                        height={road.height}
                        className="admin-map-road"
                      />
                    ))}
                    {/* Lối đi dọc nội bộ CỔNG PHỤ xuyên khối Gia Tộc */}
                    <rect
                      x={FAMILY_AISLE_ROAD.x}
                      y={FAMILY_AISLE_ROAD.y}
                      width={FAMILY_AISLE_ROAD.width}
                      height={FAMILY_AISLE_ROAD.height}
                      className="admin-map-road"
                    />
                    {ROAD_CORNER_CHAMFERS.map((pts, i) => (
                      <polygon key={i} points={pts} className="admin-map-road" />
                    ))}
                  </g>

                  {/* Khu Tâm Linh - công viên trung tâm (khối mộ đơn) */}
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
                      KHU TÂM LINH
                    </text>
                  </g>

                  {/* Cổng CHÍNH - chỉ ở khối mộ đơn (trái) */}
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
                  {/* Cổng PHỤ - khối lô gia tộc (phải) */}
                  <polygon
                    className="admin-map-gate-marker admin-map-gate-secondary"
                    points={gateMarkerPoints(SECONDARY_GATE)}
                  />
                  <text
                    x={SECONDARY_GATE.x}
                    y={SECONDARY_GATE.y - 36}
                    textAnchor="middle"
                    className="admin-map-gate-label admin-map-gate-label-secondary"
                  >
                    Cổng phụ
                  </text>

                  {/* Khối nền 7 khu mộ đơn */}
                  {SINGLE_ZONES.map((zone) => {
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
                      </g>
                    );
                  })}
                  {SINGLE_ZONES.map((zone) => (
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

                  {/* Khu C: 4 cụm C1-C4 */}
                  {CLUSTER_GROUP_BACKDROPS.map((backdrop, index) => (
                    <g key={`cluster-backdrop-${index}`}>
                      <polygon
                        points={backdrop.points}
                        fill={clusterZone?.dot}
                        fillOpacity={0.09}
                        stroke={clusterZone?.dot}
                        strokeOpacity={0.55}
                        strokeWidth={1}
                        strokeDasharray="5 3"
                      />
                    </g>
                  ))}
                  {/* Nhãn tên từng cụm KHU C1, C2, C3, C4 ở chính giữa trên đầu mỗi lô gia tộc */}
                  {CLUSTER_GROUP_BACKDROPS.map((backdrop, index) => (
                    <text
                      key={`cluster-header-${index}`}
                      x={backdrop.cx}
                      y={backdrop.y - 10}
                      textAnchor="middle"
                      className="admin-map-zone-label"
                    >
                      {`KHU C${index + 1}`}
                    </text>
                  ))}

                  {visibleSlots.map((slot) => {
                    const plot = slot.plot;
                    const meta = plot ? STATUS_META[plot.status] : null;
                    const selected = selectedCode === slot.code;
                    const isFiltered =
                      statusFilter !== "all" &&
                      (statusFilter === "noData"
                        ? Boolean(plot)
                        : !plot || plot.status !== statusFilter);

                    return (
                      <g
                        key={slot.code}
                        className={`admin-map-plot ${plot ? "" : "placeholder"} ${selected ? "selected" : ""} ${isFiltered ? "dimmed" : ""}`}
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
              </div>

              {loading && (
                <div className="admin-map-empty">
                  Đang tải dữ liệu bản đồ...
                </div>
              )}
              {!loading && !visibleSlots.length && (
                <div className="admin-map-empty">
                  Không có lô phù hợp với bộ lọc hiện tại.
                </div>
              )}
            </div>

            {/* Lớp phủ cố định trong vùng bản đồ, nằm ngoài admin-map-canvas */}
            <svg
              className="admin-map-compass"
              viewBox="0 0 40 40"
              aria-label="Đặt lại hướng Bắc"
              role="button"
              onClick={resetMapTransform}
              style={{ transform: `rotate(${-rotation}deg)` }}
            >
              <circle cx="20" cy="20" r="18" />
              <polygon points="20,4 23,18 20,20 17,18" className="north" />
              <polygon points="20,36 23,22 20,20 17,22" className="south" />
              <text x="20" y="8" textAnchor="middle">
                N
              </text>
            </svg>

            <div className="admin-map-rotate">
              <button
                title="Xoay trái"
                onClick={() => setRotation((r) => (r - 30 + 360) % 360)}
              >
                ⟲
              </button>
              <button
                className="heading-btn"
                title="Hướng hiện tại - bấm để đặt lại góc nhìn ban đầu"
                onClick={resetMapTransform}
              >
                {getHeadingLabel(rotation)}
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
                title="Phóng to"
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
              <div className="admin-map-detail-header">
                <span className="admin-map-detail-tag">
                  Bản đồ nghĩa trang 2D
                </span>
                <button
                  className="admin-map-detail-close"
                  title="Đóng thông tin lô"
                  onClick={() => setSelectedCode(null)}
                >
                  ✕
                </button>
              </div>
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
                  <div className="admin-map-detail-header">
                    <span className="admin-map-detail-tag">
                      Bản đồ nghĩa trang 2D
                    </span>
                    <button
                      className="admin-map-detail-close"
                      title="Đóng thông tin lô"
                      onClick={() => setSelectedCode(null)}
                    >
                      ✕
                    </button>
                  </div>
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
                <input required readOnly value={form.plotCode} />
              </label>
              <label>
                Khu vực
                <input
                  required
                  readOnly
                  value={(() => {
                    const zone = zones.find(
                      (item) => item.id === Number(form.zoneId),
                    );
                    return zone
                      ? CEMETERY_ZONE_LAYOUT[zone.code]?.name || zone.name
                      : "";
                  })()}
                />
              </label>
              <label>
                Hàng
                <input required readOnly value={form.rowNumber} />
              </label>
              <label>
                Số ô
                <input required readOnly value={form.columnNumber} />
              </label>
              <label>
                Giá niêm yết
                <span className="plot-price-input">
                  <input
                    required
                    min="0"
                    step="0.1"
                    type="number"
                    value={form.price}
                    onChange={(event) =>
                      updateForm("price", event.target.value)
                    }
                  />
                  <span>triệu</span>
                </span>
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
                <select
                  required
                  value={form.direction}
                  onChange={(event) =>
                    updateForm("direction", event.target.value as Direction)
                  }
                >
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction}
                    </option>
                  ))}
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
