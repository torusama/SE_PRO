// src/pages/customer/map/CemeteryMapVector.tsx
//
// Bản vẽ SVG "bản đồ 2D thật" của nghĩa trang (ranh giới đất, đường xá,
// Khu Tâm Linh, cổng chính/phụ, khối nền + nhãn từng khu, và lưới lô đất) —
// tách riêng khỏi MapPage.tsx để có thể tái sử dụng cho minimap của trang
// Bản đồ 3D (Map3DPage.tsx), thay vì vẽ lại bằng hình khối ước lượng.
//
// Toàn bộ hằng số hình học lấy trực tiếp từ cemeteryMapLayout.ts +
// cemeteryMapVisuals.ts (dữ liệu gốc, không ước lượng), nên bản vẽ ở đây
// khớp 1:1 với bản đồ 2D chính hiển thị ở trang "Bản đồ".
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  CEMETERY_ZONES,
  CEMETERY_ZONE_LAYOUT,
  getCemeteryCoordinates,
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
  ROAD_CORNER_CHAMFERS,
  SECONDARY_GATE,
  SPIRIT_PARK,
  TOP_ROAD,
  ZONE_BACKDROPS,
  gateMarkerPoints,
} from "@/lib/cemeteryMapVisuals";

const SINGLE_ZONES = CEMETERY_ZONES.filter((zone) => zone.mode === "single");
const clusterZone = CEMETERY_ZONES.find((zone) => zone.mode === "cluster");

/** Lớp nền tĩnh: ranh giới đất, đường xá, Khu Tâm Linh, cổng, khối nền +
 * nhãn từng khu. Không phụ thuộc dữ liệu lô đất (real-time), an toàn để
 * dùng ở bất kỳ đâu cần hiển thị "khung" bản đồ. */
export function CemeteryMapBackground() {
  return (
    <>
      <rect
        x={MAP_BG_RECT.x}
        y={MAP_BG_RECT.y}
        width={MAP_BG_RECT.width}
        height={MAP_BG_RECT.height}
        fill="rgba(6,10,22,0.4)"
      />
      <polygon className="map-land" points={MAP_BOUNDARY_POINTS} />
      <polygon className="map-boundary-line" points={MAP_BOUNDARY_POINTS} />

      <g className="map-road-network">
        <rect {...LEFT_ROAD} className="map-road" />
        <rect {...MAIN_ROAD} className="map-road" />
        <rect {...CENTRAL_ROAD_SOUTH} className="map-road" />
        <rect {...CENTRAL_ROAD_NORTH} className="map-road" />
        <rect {...FAMILY_ROAD} className="map-road" />
        <rect {...TOP_ROAD} className="map-road" />
        <rect {...BOTTOM_ROAD} className="map-road" />
        {CROSS_ROADS.map((road, index) => (
          <rect key={`cross-${index}`} {...road} className="map-road" />
        ))}
        {FAMILY_CROSS_ROADS.map((road, index) => (
          <rect key={`fam-cross-${index}`} {...road} className="map-road" />
        ))}
        <rect {...FAMILY_AISLE_ROAD} className="map-road" />
        {ROAD_CORNER_CHAMFERS.map((pts, i) => (
          <polygon key={i} points={pts} className="map-road" />
        ))}
      </g>

      <g className="spirit-park">
        <rect
          x={SPIRIT_PARK.x}
          y={SPIRIT_PARK.y}
          width={SPIRIT_PARK.width}
          height={SPIRIT_PARK.height}
          rx="18"
          className="spirit-park-rect"
        />
        <circle
          cx={SPIRIT_PARK.cx}
          cy={SPIRIT_PARK.cy}
          r={SPIRIT_PARK.r}
          className="spirit-park-circle"
        />
      </g>

      <polygon className="map-gate-marker" points={gateMarkerPoints(MAP_GATE)} />
      <polygon
        className="map-gate-marker map-gate-secondary"
        points={gateMarkerPoints(SECONDARY_GATE)}
      />

      {SINGLE_ZONES.map((zone) => {
        const backdrop = ZONE_BACKDROPS[zone.key];
        if (!backdrop) return null;
        return (
          <polygon
            key={`backdrop-${zone.key}`}
            points={backdrop.points}
            fill={zone.dot}
            fillOpacity={0.1}
            stroke={zone.dot}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeDasharray="8 5"
          />
        );
      })}
      {SINGLE_ZONES.map((zone) => (
        <text
          key={zone.key}
          x={zone.labelX}
          y={zone.labelY}
          textAnchor="middle"
          className="zone-label"
        >
          {`KHU ${zone.key}`}
        </text>
      ))}

      {CLUSTER_GROUP_BACKDROPS.map((backdrop, index) => (
        <polygon
          key={`cluster-backdrop-${index}`}
          points={backdrop.points}
          fill={clusterZone?.dot}
          fillOpacity={0.12}
          stroke={clusterZone?.dot}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeDasharray="8 5"
        />
      ))}
      {CLUSTER_GROUP_BACKDROPS.map((backdrop, index) => (
        <text
          key={`cluster-label-${index}`}
          x={backdrop.cx}
          y={backdrop.y - 10}
          textAnchor="middle"
          className="zone-label"
        >
          {`KHU C${index + 1}`}
        </text>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------
 * Lưới lô đất rút gọn (chỉ màu theo trạng thái, không tương tác) — dùng
 * để minimap trông đúng như bản đồ thật (từng ô lô đất nhỏ) thay vì chỉ
 * có khối nền trơn.
 * ------------------------------------------------------------------ */
type MiniStatus = "available" | "pending" | "reserved" | "sold" | "locked";
interface MiniPlot {
  x: number;
  y: number;
  width: number;
  height: number;
  status: MiniStatus | "placeholder";
}
interface RawBackendPlot {
  id?: string | number;
  plotCode?: string;
  zoneName?: string;
  rowCode?: string;
  plotNumber?: number | string;
  status?: string;
  area?: number | string;
}

const MINI_STATUS_FILL: Record<MiniStatus, string> = {
  available: "rgba(0,184,158,0.55)",
  pending: "rgba(245,166,35,0.6)",
  reserved: "rgba(201,168,76,0.62)",
  sold: "rgba(171,62,62,0.68)",
  locked: "rgba(116,124,137,0.5)",
};

function normalizeMiniStatus(status?: string): MiniStatus {
  if (status === "occupied" || status === "my-lot" || status === "sold")
    return "sold";
  if (status === "pending") return "pending";
  if (status === "reserved") return "reserved";
  if (status === "locked") return "locked";
  return "available";
}

function getZoneCodeMini(plotCode: string, zoneName?: string) {
  const fromCode = plotCode.match(/^[A-H]/i)?.[0]?.toUpperCase();
  if (fromCode && CEMETERY_ZONE_LAYOUT[fromCode]) return fromCode;
  const fromName = (zoneName || "")
    .match(/Khu\s+([A-H])/i)?.[1]
    ?.toUpperCase();
  return fromName && CEMETERY_ZONE_LAYOUT[fromName] ? fromName : "A";
}

function buildMiniPlots(raw: RawBackendPlot[]): MiniPlot[] {
  const byCode = new Map<string, MiniPlot>();
  raw.forEach((item) => {
    const plotCode = item.plotCode || String(item.id ?? "");
    if (!plotCode) return;
    const zoneCode = getZoneCodeMini(plotCode, item.zoneName);
    const coord = getCemeteryCoordinates(item, plotCode, zoneCode);
    byCode.set(plotCode, {
      x: coord.x,
      y: coord.y,
      width: coord.width,
      height: coord.height,
      status: normalizeMiniStatus(item.status),
    });
  });

  const full: MiniPlot[] = [];
  Object.entries(CEMETERY_ZONE_LAYOUT).forEach(([zoneCode, layout]) => {
    for (let row = 1; row <= layout.rows; row += 1) {
      for (let col = 1; col <= layout.cols; col += 1) {
        const plotCode = `${zoneCode}-${String(row).padStart(2, "0")}-${String(col).padStart(3, "0")}`;
        const real = byCode.get(plotCode);
        if (real) {
          full.push(real);
          continue;
        }
        const coord = getCemeteryCoordinates(
          { rowCode: String(row), plotNumber: col },
          plotCode,
          zoneCode,
        );
        full.push({
          x: coord.x,
          y: coord.y,
          width: coord.width,
          height: coord.height,
          status: "placeholder",
        });
      }
    }
  });
  return full;
}

/** Lưới lô đất thật (màu theo trạng thái), tự fetch 1 lần từ cùng API mà
 * trang Bản đồ 2D dùng. Chỉ hiển thị, không click/hover được — dùng cho
 * minimap. Nếu fetch lỗi, tự lặng lẽ bỏ qua (chỉ còn lớp nền tĩnh). */
export function CemeteryMapPlotsMini() {
  const [plots, setPlots] = useState<MiniPlot[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/plots/map`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as
          | RawBackendPlot[]
          | { data?: RawBackendPlot[] };
        const raw = Array.isArray(data) ? data : data.data || [];
        setPlots(buildMiniPlots(raw));
      } catch {
        // im lặng bỏ qua — minimap vẫn hiển thị được lớp nền tĩnh
      }
    })();
    return () => controller.abort();
  }, []);

  if (!plots.length) return null;

  return (
    <>
      {plots.map((plot, i) => (
        <rect
          key={i}
          x={plot.x}
          y={plot.y}
          width={plot.width}
          height={plot.height}
          fill={
            plot.status === "placeholder"
              ? "rgba(122,154,144,0.16)"
              : MINI_STATUS_FILL[plot.status]
          }
        />
      ))}
    </>
  );
}
