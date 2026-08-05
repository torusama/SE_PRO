// src/pages/customer/map/MapPage.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { API_BASE_URL, api } from "@/lib/api";
import {
  buildCemeteryDirection,
  getCemeteryRoutePoints,
} from "@/lib/cemeteryMapRoute";
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
  CONNECTOR_ROAD,
  CROSS_ROADS,
  FAMILY_AISLE_ROAD,
  FAMILY_CROSS_ROADS,
  FAMILY_ROAD,
  LEFT_DIAGONAL_ROAD_POINTS,
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
import { useAuthStore } from "@/store/authStore";
import { HelpCircle } from "lucide-react";
import GuidePopup, { type GuideStep } from "@/components/guide/GuidePopup";
import "./MapPage.css";

type PlotStatus = "available" | "pending" | "reserved" | "sold" | "locked";
type StatusFilter = "all" | PlotStatus;
type SelectionMode = "single" | "cluster";
type ReservationType = "reserve" | "purchase";
type CustomerReservationStatus =
  "draft" | "submitted" | "pending" | "approved" | "rejected" | "cancelled";

interface BackendMapPlot {
  id?: string | number;
  plotCode?: string;
  zoneName?: string;
  rowCode?: string;
  plotNumber?: number | string;
  status?: string;
  price?: number | string;
  area?: number | string;
  size?: string;
  direction?: string;
  description?: string;
  currentViewers?: number;
  currentSelectors?: number;
}

interface MapPlot {
  id: string;
  plotCode: string;
  zoneCode: string;
  zoneName: string;
  rowCode: string;
  plotNumber: number;
  status: PlotStatus;
  price: number;
  area: number;
  size: string;
  direction: string;
  description: string;
  currentViewers: number;
  currentSelectors: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isPlaceholder?: boolean;
}

interface CustomerReservation {
  id: number;
  type: ReservationType;
  status: CustomerReservationStatus;
  plotCodes?: string[];
  plotCount?: number;
  createdAt?: string;
  reviewedAt?: string | null;
}

interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return typeof error === "object" && error !== null && "response" in error;
}

const T = {
  home: "Trang ch\u1ee7",
  pageTitle: "B\u1ea3n \u0111\u1ed3 ngh\u0129a trang 2D",
  searchTitle: "T\u00ecm ki\u1ebfm l\u00f4",
  plotCode: "M\u00e3 l\u00f4",
  searchPlaceholder: "A-01-001 ho\u1eb7c t\u00ean khu",
  zones: "Khu v\u1ef1c",
  allZones: "T\u1ea5t c\u1ea3 khu",
  plots: "l\u00f4",
  legend: "Ch\u00fa gi\u1ea3i",
  empty:
    "Kh\u00f4ng c\u00f3 l\u00f4 n\u00e0o kh\u1edbp v\u1edbi t\u00ecm ki\u1ebfm ho\u1eb7c b\u1ed9 l\u1ecdc hi\u1ec7n t\u1ea1i.",
  loading: "\u0110ang t\u1ea3i d\u1eef li\u1ec7u l\u00f4 t\u1eeb backend...",
  loadError:
    "Kh\u00f4ng l\u1ea5y \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u t\u1eeb backend.",
  noData: "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u",
  plannedSlot: "\u00d4 \u0111\u1ea5t quy ho\u1ea1ch",
  realtimeStatus: "Tr\u1ea1ng th\u00e1i th\u1eadt",
  single: "L\u00f4 \u0111\u01a1n",
  cluster: "L\u00f4 gia t\u1ed9c",
  reset: "\u0110\u1eb7t l\u1ea1i",
  northRoad: "Tr\u1ee5c \u0111\u01b0\u1eddng B\u1eafc",
  centralRoad: "\u0110\u01b0\u1eddng trung t\u00e2m",
  gate: "C\u1ed5ng ch\u00ednh",
  funeralHome: "Nh\u00e0 tang l\u1ec5",
  serviceArea: "Khu d\u1ecbch v\u1ee5",
  notSelected: "Ch\u01b0a ch\u1ecdn l\u00f4",
  selectHint:
    "Ch\u1ecdn m\u1ed9t l\u00f4 tr\u00ean b\u1ea3n \u0111\u1ed3 \u0111\u1ec3 xem \u0111\u1ea7y \u0111\u1ee7 th\u00f4ng tin.",
  zone: "Khu",
  row: "H\u00e0ng",
  plotNumber: "S\u1ed1 l\u00f4",
  status: "Tr\u1ea1ng th\u00e1i",
  price: "Gi\u00e1",
  area: "Di\u1ec7n t\u00edch",
  size: "K\u00edch th\u01b0\u1edbc",
  direction: "H\u01b0\u1edbng",
  selectable: "C\u00f3 th\u1ec3 ch\u1ecdn",
  yes: "C\u00f3",
  no: "Kh\u00f4ng",
  viewing: "\u0110ang xem",
  selecting: "\u0110ang ch\u1ecdn",
  people: "ng\u01b0\u1eddi",
  description: "M\u00f4 t\u1ea3",
  directionGuide: "H\u01b0\u1edbng d\u1eabn \u0111\u01b0\u1eddng \u0111i",
  findRoute: "T\u00ecm \u0111\u01b0\u1eddng",
  hideRoute: "\u1ea8n \u0111\u01b0\u1eddng \u0111i",
  continuePlot: "G\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7",
  submitSelected:
    "G\u1eedi y\u00eau c\u1ea7u cho c\u00e1c l\u00f4 \u0111\u00e3 ch\u1ecdn",
  reserveAction: "Gi\u1eef ch\u1ed7",
  purchaseAction: "Mua l\u00f4",
  purchaseSelected:
    "G\u1eedi y\u00eau c\u1ea7u mua c\u00e1c l\u00f4 \u0111\u00e3 ch\u1ecdn",
  submitting: "\u0110ang g\u1eedi y\u00eau c\u1ea7u...",
  submitted: "\u0110\u00e3 g\u1eedi y\u00eau c\u1ea7u ch\u1edd duy\u1ec7t.",
  clusterMin:
    "Vui l\u00f2ng ch\u1ecdn \u00edt nh\u1ea5t 2 l\u00f4 li\u1ec1n k\u1ec1 cho nh\u00f3m gia \u0111\u00ecnh.",
  loginRequired:
    "B\u1ea1n c\u1ea7n \u0111\u0103ng nh\u1eadp \u0111\u1ec3 g\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7.",
  submitFailed:
    "Kh\u00f4ng th\u1ec3 g\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7.",
  unavailable: "L\u00f4 n\u00e0y hi\u1ec7n kh\u00f4ng th\u1ec3 ch\u1ecdn.",
  pendingUnavailable:
    "L\u00f4 n\u00e0y \u0111ang ch\u1edd duy\u1ec7t y\u00eau c\u1ea7u, kh\u00f4ng th\u1ec3 g\u1eedi th\u00eam y\u00eau c\u1ea7u.",
  reservedUnavailable:
    "L\u00f4 n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c gi\u1eef ch\u1ed7.",
  soldUnavailable:
    "L\u00f4 n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c b\u00e1n.",
  lockedUnavailable: "L\u00f4 n\u00e0y \u0111ang b\u1ecb kh\u00f3a.",
  selectedPlots: "L\u00f4 \u0111\u00e3 ch\u1ecdn",
  clusterHint:
    "Ch\u1ecdn c\u00e1c l\u00f4 c\u00f2n tr\u1ed1ng \u0111\u1ec3 th\u00eam v\u00e0o nh\u00f3m gia \u0111\u00ecnh. C\u00e1c l\u00f4 c\u1ea7n n\u1eb1m li\u1ec1n k\u1ec1 nhau.",
  removeGroup: "X\u00f3a kh\u1ecfi nh\u00f3m",
  totalPlots: "T\u1ed5ng s\u1ed1 l\u00f4",
  totalPrice: "T\u1ed5ng gi\u00e1 d\u1ef1 ki\u1ebfn",
  clear: "X\u00f3a l\u1ef1a ch\u1ecdn",
  contact: "Li\u00ean h\u1ec7 nh\u00e2n vi\u00ean",
  myPlot: "L\u00f4 c\u1ee7a t\u00f4i",
  myPending:
    "Y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n \u0111ang ch\u1edd duy\u1ec7t",
  myApprovedReserve:
    "L\u00f4 n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c gi\u1eef cho b\u1ea1n",
  myApprovedPurchase:
    "L\u00f4 n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t mua cho b\u1ea1n",
};

const MAP_GUIDE_STORAGE_KEY = "hideGuide_mapPage";
const MAP_GUIDE_STEPS: GuideStep[] = [
  {
    title: "Bước 1: Chọn lô đất",
    desc: "Người dùng lựa chọn lô đất còn trống trên bản đồ quy hoạch của dự án. Hệ thống hiển thị đầy đủ thông tin của lô đất để xem trước.",
  },
  {
    title: "Bước 2: Đăng ký giữ chỗ",
    desc: "Người dùng nhấn 'Giữ chỗ' để gửi yêu cầu giữ lô đất đã chọn. Hệ thống xác nhận yêu cầu và chuyển sang bước tiếp theo.",
  },
  {
    title: "Bước 3: Xem hồ sơ pháp lý và đặt lịch",
    desc: "Hệ thống hiển thị giấy tờ pháp lý dưới dạng PDF. Sau khi xem, người dùng chọn ngày và giờ để gặp nhân viên tư vấn ký hợp đồng.",
  },
  {
    title: "Bước 4: Hoàn tất giao dịch",
    desc: "Sau khi ký hợp đồng và hoàn tất thủ tục, hệ thống cập nhật quyền sở hữu lô đất cho người mua.",
  },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "T\u1ea5t c\u1ea3" },
  { value: "available", label: "C\u00f2n tr\u1ed1ng" },
  { value: "pending", label: "\u0110ang ch\u1edd" },
  { value: "reserved", label: "\u0110\u00e3 gi\u1eef ch\u1ed7" },
  { value: "sold", label: "\u0110\u00e3 b\u00e1n" },
  { value: "locked", label: "\u0110\u00e3 kh\u00f3a" },
];

const STATUS_LABEL: Record<PlotStatus, string> = {
  available: "C\u00f2n tr\u1ed1ng",
  pending: "\u0110ang ch\u1edd",
  reserved: "\u0110\u00e3 gi\u1eef ch\u1ed7",
  sold: "\u0110\u00e3 b\u00e1n",
  locked: "\u0110\u00e3 kh\u00f3a",
};

const STATUS_COLOR: Record<
  PlotStatus,
  { fill: string; stroke: string; text: string }
> = {
  available: {
    fill: "rgba(0,184,158,0.26)",
    stroke: "rgba(0,229,196,0.72)",
    text: "#bdfdf2",
  },
  pending: {
    fill: "rgba(245,166,35,0.34)",
    stroke: "rgba(245,166,35,0.86)",
    text: "#ffe2a7",
  },
  reserved: {
    fill: "rgba(201,168,76,0.36)",
    stroke: "rgba(240,192,96,0.9)",
    text: "#ffe2a7",
  },
  sold: {
    fill: "rgba(171,62,62,0.46)",
    stroke: "rgba(232,74,74,0.9)",
    text: "#ffd1d1",
  },
  locked: {
    fill: "rgba(116,124,137,0.32)",
    stroke: "rgba(154,164,180,0.68)",
    text: "#d5d9df",
  },
};

function getMyReservationLabel(reservation?: CustomerReservation) {
  if (!reservation) return "";
  if (["pending", "submitted", "draft"].includes(reservation.status))
    return T.myPending;
  if (reservation.status === "approved") {
    return reservation.type === "purchase"
      ? T.myApprovedPurchase
      : T.myApprovedReserve;
  }
  return T.myPlot;
}

const ZONES = CEMETERY_ZONES;
const SINGLE_ZONES = ZONES.filter((zone) => zone.mode === "single");
const clusterZone = ZONES.find((zone) => zone.mode === "cluster");
const ZONE_LAYOUT = CEMETERY_ZONE_LAYOUT;

const TEXT_FIXES: Array<[RegExp, string]> = [
  ...Object.entries(ZONE_LAYOUT).map(([code, layout]): [RegExp, string] => [
    new RegExp(`Khu\\s+${code}\\b[^|]*`, "i"),
    layout.name,
  ]),
  [/Ä.?Ã´ng|Ã„.?ÃƒÂ´ng/g, "\u0110\u00f4ng"],
  [/TÃ¢y|TÃƒÂ¢y/g, "T\u00e2y"],
  [/Báº¯c|BÃ¡ÂºÂ¯c/g, "B\u1eafc"],
];

function cleanText(value?: string) {
  let text = value || "";
  text = text
    .replace(/\?\?ng Nam/g, "\u0110\u00f4ng Nam")
    .replace(/\?\?ng/g, "\u0110\u00f4ng")
    .replace(/T\?y B\?c/g, "T\u00e2y B\u1eafc")
    .replace(/T\?y/g, "T\u00e2y")
    .replace(/B\?c/g, "B\u1eafc");
  TEXT_FIXES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text
    .replace(/â€”|â€“|Ã¢â‚¬â€|Ã¢â‚¬â€œ/g, "-")
    .replace(/Â|Ã‚/g, "")
    .trim();
}

function cleanDescriptionText(value?: string) {
  return (value || "")
    .replace(/\?\?ng Nam/g, "\u0110\u00f4ng Nam")
    .replace(/\?\?ng/g, "\u0110\u00f4ng")
    .replace(/T\?y B\?c/g, "T\u00e2y B\u1eafc")
    .replace(/T\?y/g, "T\u00e2y")
    .replace(/B\?c/g, "B\u1eafc")
    .replace(/Ã¢â‚¬â€|Ã¢â‚¬â€œ|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, "-")
    .replace(/Ã‚|Ãƒâ€š/g, "")
    .trim();
}

function normalizeStatus(status?: string): PlotStatus {
  if (status === "occupied" || status === "my-lot" || status === "sold")
    return "sold";
  if (status === "pending") return "pending";
  if (status === "reserved") return "reserved";
  if (status === "locked") return "locked";
  return "available";
}

function getZoneCode(plotCode: string, zoneName?: string) {
  const fromCode = plotCode.match(/^[A-H]/i)?.[0]?.toUpperCase();
  if (fromCode && ZONE_LAYOUT[fromCode]) return fromCode;
  const fromName = cleanText(zoneName)
    .match(/Khu\s+([A-H])/i)?.[1]
    ?.toUpperCase();
  return fromName && ZONE_LAYOUT[fromName] ? fromName : "A";
}

function getCoordinates(
  item: BackendMapPlot,
  plotCode: string,
  zoneCode: string,
) {
  return getCemeteryCoordinates(item, plotCode, zoneCode);
}

function makePlaceholderPlot(
  zoneCode: string,
  row: number,
  col: number,
): MapPlot {
  const layout = ZONE_LAYOUT[zoneCode] || ZONE_LAYOUT.A;
  const plotCode = `${zoneCode}-${String(row).padStart(2, "0")}-${String(col).padStart(3, "0")}`;
  const coord = getCoordinates(
    { rowCode: String(row), plotNumber: col, area: zoneCode === "C" ? 12 : 4 },
    plotCode,
    zoneCode,
  );
  const demo = getDemoPlotInfo(zoneCode, row, col);

  return {
    id: `planned-${plotCode}`,
    plotCode,
    zoneCode,
    zoneName: layout.name,
    rowCode: coord.rowCode,
    plotNumber: col,
    status: "locked",
    price: demo.price,
    area: demo.area,
    size: demo.size,
    direction: demo.direction,
    description: demo.description,
    currentViewers: 0,
    currentSelectors: 0,
    x: coord.x,
    y: coord.y,
    width: coord.width,
    height: coord.height,
    isPlaceholder: true,
  };
}

function getDemoPlotInfo(zoneCode: string, row: number, col: number) {
  const direction = getPlannedDirection(zoneCode, row, col);
  const meta = ZONE_META[zoneCode] || ZONE_META.A;
  const isCluster = meta.plotType === "family";
  const area = meta.area;
  const price =
    meta.basePrice +
    row * (isCluster ? 1600000 : 950000) +
    col * (isCluster ? 520000 : 420000);
  const size = meta.size;

  return {
    price,
    area,
    size,
    direction,
    description: buildPlotIntro(
      `${zoneCode}-${String(row).padStart(2, "0")}-${String(col).padStart(3, "0")}`,
      ZONE_LAYOUT[zoneCode]?.name || zoneCode,
      String(row).padStart(2, "0"),
      col,
      area,
      direction,
      price,
    ),
  };
}

function buildFullMapPlots(realPlots: MapPlot[]) {
  const byCode = new Map(realPlots.map((plot) => [plot.plotCode, plot]));
  const full: MapPlot[] = [];

  Object.entries(ZONE_LAYOUT).forEach(([zoneCode, layout]) => {
    for (let row = 1; row <= layout.rows; row += 1) {
      for (let col = 1; col <= layout.cols; col += 1) {
        const planned = makePlaceholderPlot(zoneCode, row, col);
        const real = byCode.get(planned.plotCode);
        full.push(
          real
            ? {
                ...planned,
                ...real,
                x: planned.x,
                y: planned.y,
                width: planned.width,
                height: planned.height,
                isPlaceholder: false,
              }
            : planned,
        );
      }
    }
  });

  return full;
}

const INITIAL_PLANNED_PLOTS = buildFullMapPlots([]);

function mapBackendPlot(item: BackendMapPlot, index: number): MapPlot {
  const plotCode = item.plotCode || String(item.id || `P-${index + 1}`);
  const zoneCode = getZoneCode(plotCode, item.zoneName);
  const coord = getCoordinates(item, plotCode, zoneCode);
  const status = normalizeStatus(item.status);
  const zoneName = ZONE_LAYOUT[zoneCode]?.name || cleanText(item.zoneName);
  const area = Number(item.area || 4);
  const direction =
    cleanText(item.direction) ||
    getPlannedDirection(zoneCode, coord.rowCode, coord.plotNumber);

  return {
    id: String(item.id ?? plotCode),
    plotCode,
    zoneCode,
    zoneName,
    rowCode: coord.rowCode,
    plotNumber: coord.plotNumber,
    status,
    price: Number(item.price || 0),
    area,
    size: item.size || (ZONE_META[zoneCode]?.size ?? "2.0 x 2.0 m"),
    direction,
    description:
      cleanDescriptionText(item.description) ||
      buildPlotIntro(
        plotCode,
        zoneName,
        coord.rowCode,
        coord.plotNumber,
        area,
        direction,
        Number(item.price || 0),
      ),
    currentViewers: Number(item.currentViewers || 0),
    currentSelectors: Number(item.currentSelectors || 0),
    x: coord.x,
    y: coord.y,
    width: coord.width,
    height: coord.height,
  };
}

function formatVnd(value: number) {
  if (!value) return T.contact;
  return `${new Intl.NumberFormat("vi-VN").format(value)} \u0111`;
}

function getStatusLabel(plot: MapPlot) {
  return plot.isPlaceholder ? T.noData : STATUS_LABEL[plot.status];
}

function getUnavailableMessage(plot: MapPlot) {
  if (plot.isPlaceholder) return T.noData;
  if (plot.status === "pending") return T.pendingUnavailable;
  if (plot.status === "reserved") return T.reservedUnavailable;
  if (plot.status === "sold") return T.soldUnavailable;
  if (plot.status === "locked") return T.lockedUnavailable;
  return T.unavailable;
}

function getPlannedDirection(
  zoneCode: string,
  rowInput: string | number,
  colInput: string | number,
) {
  const row = Number(rowInput || 1);
  const col = Number(colInput || 1);
  const coord = getCoordinates(
    { rowCode: String(row), plotNumber: col },
    `${zoneCode}-${String(row).padStart(2, "0")}-${String(col).padStart(3, "0")}`,
    zoneCode,
  );
  const centerX = coord.x + coord.width / 2;
  const centerY = coord.y + coord.height / 2;
  const roadCandidates = [
    {
      direction: centerX < MAIN_ROAD.x ? "\u0110\u00f4ng" : "T\u00e2y",
      distance: Math.abs(centerX - MAIN_ROAD.x),
    },
    {
      direction: centerY < SPIRIT_PARK.cy ? "Nam" : "B\u1eafc",
      distance: Math.abs(centerY - SPIRIT_PARK.cy),
    },
  ];
  return roadCandidates.sort((a, b) => a.distance - b.distance)[0].direction;
}

function buildPlotIntro(
  plotCode: string,
  zoneName: string,
  rowCode: string,
  plotNumber: number,
  area: number,
  direction: string,
  price: number,
) {
  const priceText = price
    ? `Gi\u00e1 ni\u00eam y\u1ebft ${formatVnd(price)}.`
    : "Gi\u00e1 s\u1ebd \u0111\u01b0\u1ee3c nh\u00e2n vi\u00ean x\u00e1c nh\u1eadn khi t\u01b0 v\u1ea5n.";
  const typeText =
    area >= 10 ? "l\u00f4 gia t\u1ed9c" : "l\u00f4 \u0111\u01a1n";
  const zoneCode = plotCode[0]?.toUpperCase() || "A";
  const row = Number(rowCode || 1);
  const positionNote = getPlotPositionNote(zoneCode, row, plotNumber);
  const zoneNote = getZoneIntro(zoneCode);
  return `T\u1ed5ng quan: ${plotCode} l\u00e0 ${typeText} thu\u1ed9c ${zoneName}, di\u1ec7n t\u00edch ${area} m2, h\u01b0\u1edbng ${direction.toLowerCase()} theo la b\u00e0n. | \u0110i\u1ec3m n\u1ed5i b\u1eadt: ${positionNote} | G\u1ee3i \u00fd: ${zoneNote} | Gi\u00e1: ${priceText}`;
}

function getPlotPositionNote(
  zoneCode: string,
  row: number,
  plotNumber: number,
) {
  const layout = ZONE_LAYOUT[zoneCode] || ZONE_LAYOUT.A;
  const maxCol = layout.cols;
  const maxRow = layout.rows;
  const band =
    row <= Math.ceil(maxRow / 3)
      ? "n\u1eb1m \u1edf d\u1ea3i ph\u00eda tr\u00ean, g\u1ea7n tr\u1ee5c \u0111\u01b0\u1eddng ngang \u0111\u1ea7u khu"
      : row <= Math.ceil((maxRow * 2) / 3)
        ? "n\u1eb1m \u1edf khu trung t\u00e2m, thu\u1eadn ti\u1ec7n di chuy\u1ec3n t\u1eeb c\u1ea3 hai tr\u1ee5c \u0111\u01b0\u1eddng"
        : "n\u1eb1m \u1edf d\u1ea3i ph\u00eda d\u01b0\u1edbi, g\u1ea7n l\u1ed1i v\u00e0o t\u1eeb c\u1ed5ng ch\u00ednh";
  const side =
    plotNumber <= Math.ceil(maxCol / 3)
      ? "s\u00e1t nh\u00e1nh l\u1ed1i b\u00ean tr\u00e1i c\u1ee7a khu"
      : plotNumber >= maxCol - Math.floor(maxCol / 3) + 1
        ? "s\u00e1t nh\u00e1nh l\u1ed1i b\u00ean ph\u1ea3i c\u1ee7a khu"
        : "n\u1eb1m trong ph\u1ea7n l\u00f5i y\u00ean t\u0129nh c\u1ee7a khu";
  const clusterNote =
    zoneCode === "C"
      ? ` Thu\u1ed9c c\u1ee5m C${getGroupIndex(zoneCode, row, plotNumber) + 1} - m\u1ed9t khu v\u1ef1c ri\u00eang bi\u1ec7t, t\u00e1ch b\u1ea1ch v\u1edbi c\u00e1c c\u1ee5m gia t\u1ed9c kh\u00e1c.`
      : "";
  return `V\u1ecb tr\u00ed ${band}, ${side}, ph\u00f9 h\u1ee3p cho vi\u1ec7c th\u0103m vi\u1ebfng \u0111\u1ecbnh k\u1ef3.${clusterNote}`;
}

function getZoneIntro(zoneCode: string) {
  return (ZONE_META[zoneCode] || ZONE_META.A).blurb;
}

function descriptionLines(description: string) {
  const text = description.trim();
  if (!text) return [];
  if (text.includes("|"))
    return text
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
  return text
    .split(". ")
    .map((line, index, items) => {
      const trimmed = line.trim();
      return trimmed && index < items.length - 1 && !trimmed.endsWith(".")
        ? `${trimmed}.`
        : trimmed;
    })
    .filter(Boolean);
}

function arePlotsAdjacent(a: MapPlot, b: MapPlot) {
  if (a.zoneCode !== b.zoneCode) return false;
  const colsPerBlock =
    a.zoneCode === "C" ? 4 : (ZONE_LAYOUT[a.zoneCode] || ZONE_LAYOUT.A).cols;
  const sameFamilyBlock =
    a.zoneCode !== "C" ||
    Math.floor((a.plotNumber - 1) / colsPerBlock) ===
      Math.floor((b.plotNumber - 1) / colsPerBlock);
  const sameRow =
    sameFamilyBlock &&
    a.rowCode === b.rowCode &&
    Math.abs(a.plotNumber - b.plotNumber) === 1;
  const sameCol =
    a.plotNumber === b.plotNumber &&
    Math.abs(Number(a.rowCode) - Number(b.rowCode)) === 1;
  return sameRow || sameCol;
}

function isAdjacentToCluster(plot: MapPlot, cluster: MapPlot[]) {
  return cluster.length === 0 || cluster.some((p) => arePlotsAdjacent(p, plot));
}

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const starsRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const dragModeRef = useRef<"add" | "remove" | null>(null);
  const dragVisitedRef = useRef<Set<string>>(new Set());
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const appliedHighlightRef = useRef<string | null>(null);

  const [plots, setPlots] = useState<MapPlot[]>(INITIAL_PLANNED_PLOTS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("single");
  const [selectedPlot, setSelectedPlot] = useState<MapPlot | null>(
    INITIAL_PLANNED_PLOTS[0] || null,
  );
  const [routePlotId, setRoutePlotId] = useState<string | null>(null);
  const [clusterPlots, setClusterPlots] = useState<MapPlot[]>([]);

  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(MAP_GUIDE_STORAGE_KEY) !== "true") {
      setGuideOpen(true);
    }
  }, []);
  const [adjacencyWarning, setAdjacencyWarning] = useState("");
  const [hoverPlot, setHoverPlot] = useState<MapPlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [requestType, setRequestType] = useState<ReservationType>("reserve");
  const [myReservations, setMyReservations] = useState<CustomerReservation[]>(
    [],
  );

  // Khai báo trước khi được dùng trong các useEffect bên dưới (tránh lỗi
  // "used before declared" của react-hooks/immutability).
  function endClusterDrag() {
    dragModeRef.current = null;
    dragVisitedRef.current.clear();
  }

  useEffect(() => {
    const el = starsRef.current;
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < 60; i += 1) {
      const d = document.createElement("div");
      d.className = "star";
      const size = Math.random() * 1.8 + 0.4;
      const teal = Math.random() < 0.1;
      const gold = Math.random() < 0.08;
      d.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;top:${Math.random() * 65}%;--d:${2 + Math.random() * 5}s;--delay:${-Math.random() * 6}s;background:${teal ? "#00e5c4" : gold ? "#c9a84c" : "#fff"}`;
      el.appendChild(d);
    }
  }, []);

  useEffect(() => {
    const rawHighlight = searchParams.get("highlight") ?? "";
    const shouldShowRoute = searchParams.get("route") === "1";
    if (!rawHighlight || appliedHighlightRef.current === rawHighlight) return;

    const highlightIds = [
      ...new Set(
        rawHighlight
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];
    if (!highlightIds.length) {
      appliedHighlightRef.current = rawHighlight;
      return;
    }

    const highlightedPlots = plots.filter(
      (plot) => !plot.isPlaceholder && highlightIds.includes(Number(plot.id)),
    );
    if (!highlightedPlots.length) return;

    let scrollTimer: number | undefined;
    const applyTimer = window.setTimeout(() => {
      appliedHighlightRef.current = rawHighlight;
      setSubmitMessage("");
      setSubmitError("");
      setAdjacencyWarning("");
      if (highlightedPlots.length === 1) {
        setSelectionMode("single");
        setSelectedPlot(highlightedPlots[0]);
        setClusterPlots([]);
        setRoutePlotId(shouldShowRoute ? highlightedPlots[0].id : null);
      } else {
        setSelectionMode("cluster");
        setSelectedPlot(highlightedPlots[0]);
        setClusterPlots(highlightedPlots);
        setRoutePlotId(shouldShowRoute ? highlightedPlots[0].id : null);
      }

      scrollTimer = window.setTimeout(() => {
        const mapWrap = mapWrapRef.current;
        if (!mapWrap) return;
        mapWrap.scrollTo({
          left: Math.max(0, (mapWrap.scrollWidth - mapWrap.clientWidth) / 2),
          top: Math.max(0, (mapWrap.scrollHeight - mapWrap.clientHeight) / 2),
          behavior: "smooth",
        });
      }, 80);
    }, 0);
    return () => {
      window.clearTimeout(applyTimer);
      if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
    };
  }, [plots, searchParams]);

  useEffect(() => {
    window.addEventListener("pointerup", endClusterDrag);
    window.addEventListener("pointercancel", endClusterDrag);
    return () => {
      window.removeEventListener("pointerup", endClusterDrag);
      window.removeEventListener("pointercancel", endClusterDrag);
    };
  }, []);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const el = mapWrapRef.current;
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
    if (target.closest(".plot-cell")) return;
    isDraggingRef.current = true;
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
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(
          event.pointerId,
        );
      } catch {
        // ignore
      }
    }
  }

  function resetCustomerMapTransform() {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const refreshMap = () => {
      setLoadError("");
      fetch(`${API_BASE_URL}/plots/map`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<
            BackendMapPlot[] | { data?: BackendMapPlot[] }
          >;
        })
        .then((data) => {
          if (cancelled) return;
          const raw = Array.isArray(data) ? data : data.data;
          const mapped = (raw || []).map(mapBackendPlot);
          const fullMap = buildFullMapPlots(mapped);
          setPlots(fullMap);
          setSelectedPlot(
            (current) =>
              fullMap.find((plot) => plot.id === current?.id) ||
              current ||
              fullMap[0] ||
              null,
          );
        })
        .catch((error: Error) => {
          if (cancelled || error.name === "AbortError") return;
          setPlots(INITIAL_PLANNED_PLOTS);
          setSelectedPlot(
            (current) => current || INITIAL_PLANNED_PLOTS[0] || null,
          );
          setLoadError("");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    };

    refreshMap();
    const interval = window.setInterval(refreshMap, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      // Đồng bộ với nguồn dữ liệu ngoài (token đăng nhập): khi người dùng
      // đăng xuất / mất token thì danh sách yêu cầu của khách phải được xoá.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state to sync with auth token going away
      setMyReservations([]);
      return;
    }

    api
      .get<{ data?: CustomerReservation[] }>("/my/reservations")
      .then((response) => {
        if (!cancelled) setMyReservations(response.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setMyReservations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const zones = useMemo(() => {
    return ZONES.filter((zone) => zone.mode === selectionMode).map((zone) => ({
      ...zone,
      count: plots.filter((plot) => plot.zoneCode === zone.key).length,
    }));
  }, [plots, selectionMode]);

  const stats = useMemo(() => {
    return plots.reduce(
      (acc, plot) => {
        const matchesMode =
          selectionMode === "cluster"
            ? plot.zoneCode === "C"
            : plot.zoneCode !== "C";
        if (!matchesMode) return acc;
        acc.total += 1;
        if (plot.isPlaceholder) {
          acc.noData += 1;
          return acc;
        }
        acc[plot.status] += 1;
        return acc;
      },
      {
        total: 0,
        available: 0,
        pending: 0,
        reserved: 0,
        sold: 0,
        locked: 0,
        noData: 0,
      } as Record<PlotStatus | "noData" | "total", number>,
    );
  }, [plots, selectionMode]);

  const filteredPlots = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return plots.filter((plot) => {
      const matchesMode =
        selectionMode === "cluster"
          ? plot.zoneCode === "C"
          : plot.zoneCode !== "C";
      const matchesSearch =
        !query ||
        plot.plotCode.toLowerCase().includes(query) ||
        plot.zoneName.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (!plot.isPlaceholder && plot.status === statusFilter);
      const matchesZone = zoneFilter === "all" || plot.zoneCode === zoneFilter;
      return matchesMode && matchesSearch && matchesStatus && matchesZone;
    });
  }, [plots, searchText, statusFilter, zoneFilter, selectionMode]);

  useEffect(() => {
    if (
      selectedPlot &&
      !filteredPlots.some((plot) => plot.id === selectedPlot.id)
    ) {
      // Đồng bộ lựa chọn hiện tại với danh sách lô đã lọc: nếu lô đang chọn
      // không còn nằm trong kết quả lọc thì phải bỏ chọn / ẩn đường đi.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile selection with the filtered list derived from external data
      setSelectedPlot(null);
      setRoutePlotId(null);
    }
    if (!selectedPlot && filteredPlots.length > 0) {
      setSelectedPlot(filteredPlots[0]);
    }
    setClusterPlots((current) =>
      current.filter((plot) => filteredPlots.some((fp) => fp.id === plot.id)),
    );
  }, [filteredPlots, selectedPlot]);

  const clusterTotalPrice = useMemo(
    () => clusterPlots.reduce((sum, p) => sum + p.price, 0),
    [clusterPlots],
  );
  const selectedColor = selectedPlot ? STATUS_COLOR[selectedPlot.status] : null;
  const selectedIsAvailable =
    selectedPlot?.status === "available" && !selectedPlot.isPlaceholder;
  const routePlot =
    selectedPlot && routePlotId === selectedPlot.id ? selectedPlot : null;
  const clusterIds = new Set(clusterPlots.map((p) => p.id));
  const myPlotByCode = useMemo(() => {
    const byCode = new Map<string, CustomerReservation>();
    myReservations
      .filter((reservation) =>
        ["draft", "pending", "submitted", "approved"].includes(
          reservation.status,
        ),
      )
      .forEach((reservation) => {
        (reservation.plotCodes ?? []).forEach((code) =>
          byCode.set(code, reservation),
        );
      });
    return byCode;
  }, [myReservations]);
  const selectedMyReservation = selectedPlot
    ? myPlotByCode.get(selectedPlot.plotCode)
    : undefined;

  function handleModeChange(mode: SelectionMode) {
    setSelectionMode(mode);
    setAdjacencyWarning("");
    setRoutePlotId(null);
    setZoneFilter("all");
    setSearchText("");
    setSelectedPlot(null);
    if (mode === "single") setClusterPlots([]);
    const el = mapWrapRef.current;
    if (el) {
      const target = mode === "cluster" ? el.scrollWidth - el.clientWidth : 0;
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }

  function handlePlotPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    plot: MapPlot,
  ) {
    event.preventDefault();
    setAdjacencyWarning("");
    setRoutePlotId(null);
    setSubmitMessage("");
    setSubmitError("");
    setSelectedPlot(plot);

    if (selectionMode === "single") return;

    const alreadySelected = clusterPlots.some((p) => p.id === plot.id);
    dragModeRef.current = alreadySelected ? "remove" : "add";
    dragVisitedRef.current = new Set();
    applyClusterDrag(plot, dragModeRef.current);
  }

  function handlePlotPointerEnter(plot: MapPlot) {
    if (selectionMode !== "cluster" || !dragModeRef.current) return;
    applyClusterDrag(plot, dragModeRef.current);
  }

  function applyClusterDrag(plot: MapPlot, mode: "add" | "remove") {
    if (dragVisitedRef.current.has(plot.id)) return;
    dragVisitedRef.current.add(plot.id);
    setSelectedPlot(plot);

    if (mode === "remove") {
      setClusterPlots((prev) => prev.filter((p) => p.id !== plot.id));
      setAdjacencyWarning("");
      return;
    }

    if (plot.isPlaceholder || plot.status !== "available") return;

    setClusterPlots((prev) => {
      if (prev.some((p) => p.id === plot.id)) return prev;
      if (!isAdjacentToCluster(plot, prev)) {
        setAdjacencyWarning(
          "Vui l\u00f2ng ch\u1ecdn c\u00e1c l\u00f4 li\u1ec1n k\u1ec1 nhau cho nh\u00f3m gia \u0111\u00ecnh.",
        );
        return prev;
      }
      setAdjacencyWarning("");
      return [...prev, plot];
    });
  }

  function removeFromCluster(plotId: string) {
    setClusterPlots((prev) => prev.filter((p) => p.id !== plotId));
  }

  function clearCluster() {
    setClusterPlots([]);
    setAdjacencyWarning("");
  }

  function handleMouseEnter(event: MouseEvent<SVGGElement>, plot: MapPlot) {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.display = "block";
    tooltip.style.left = event.clientX + 14 + "px";
    tooltip.style.top = event.clientY - 40 + "px";
    setHoverPlot(plot);
  }

  function handleMouseMove(event: MouseEvent<SVGGElement>) {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.left = event.clientX + 14 + "px";
    tooltip.style.top = event.clientY - 40 + "px";
  }

  function handleMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
  }

  async function submitReservation(
    targetPlots: MapPlot[],
    multiPlot = false,
    type: ReservationType = requestType,
  ) {
    const realAvailablePlots = targetPlots.filter(
      (plot) => !plot.isPlaceholder && plot.status === "available",
    );
    if (realAvailablePlots.length === 0) return;
    if (multiPlot && realAvailablePlots.length < 2) {
      setSubmitError(T.clusterMin);
      return;
    }
    if (!token) {
      setSubmitError(T.loginRequired);
      navigate(ROUTES.LOGIN);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");
    try {
      const plotIds = realAvailablePlots.map((plot) => Number(plot.id));
      const createResponse = await api.post(
        multiPlot ? "/reservations/multiple" : "/reservations",
        {
          type,
          plotIds,
          note: multiPlot
            ? `Khách hàng đã chọn ${plotIds.length} lô liền kề cho gia đình để ${type === "purchase" ? "mua" : "giữ chỗ"} từ bản đồ 2D`
            : `Khách hàng đã chọn ${plotIds.length} lô để ${type === "purchase" ? "mua" : "giữ chỗ"} từ bản đồ 2D`,
        },
      );
      const created = createResponse.data.data;
      setSubmitMessage(`${T.submitted} #${created.id}`);
      setMyReservations((current) => [
        created as CustomerReservation,
        ...current.filter((reservation) => reservation.id !== created.id),
      ]);
      setPlots((current) =>
        current.map((plot) =>
          plotIds.includes(Number(plot.id))
            ? { ...plot, status: "pending" }
            : plot,
        ),
      );
      setClusterPlots([]);
      if (selectedPlot && plotIds.includes(Number(selectedPlot.id))) {
        setSelectedPlot((current) =>
          current ? { ...current, status: "pending" } : current,
        );
      }
    } catch (error: unknown) {
      const message = isApiErrorResponse(error)
        ? error.response?.data?.message
        : undefined;
      setSubmitError(message || T.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function getPlotClassName(
    plot: MapPlot,
    myReservation?: CustomerReservation,
  ) {
    const parts = ["plot-cell"];
    if (plot.isPlaceholder) parts.push("placeholder");
    if (myReservation) parts.push("mine");
    if (selectedPlot?.id === plot.id) parts.push("selected");
    if (selectionMode === "cluster" && clusterIds.has(plot.id))
      parts.push("cluster-selected");
    return parts.join(" ");
  }

  function getPlotStroke(plot: MapPlot, myReservation?: CustomerReservation) {
    if (clusterIds.has(plot.id)) return "#00e5c4";
    if (selectedPlot?.id === plot.id) return "#f0c060";
    if (myReservation) return "#00e5c4";
    return STATUS_COLOR[plot.status].stroke;
  }

  return (
    <div className="map-page">
      <div className="bg-canvas">
        <div className="glow-orb glow-orb-gold" />
        <div className="glow-orb glow-orb-teal" />
        <svg
          className="mountain-layer"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,320 L0,200 Q180,120 360,170 Q540,220 720,130 Q900,40 1080,90 Q1200,125 1440,60 L1440,320 Z"
            fill="rgba(201,168,76,0.04)"
          />
          <path
            d="M0,320 L0,250 Q240,200 480,230 Q720,260 960,200 Q1200,140 1440,170 L1440,320 Z"
            fill="rgba(0,229,196,0.05)"
          />
        </svg>
        <div className="stars" ref={starsRef} />
      </div>

      <div className="breadcrumb">
        <a href={ROUTES.HOME}>{T.home}</a>
        <span className="sep">/</span>
        <span className="current">{T.pageTitle}</span>
        <button
          type="button"
          className="map-help-btn"
          aria-label="Xem hướng dẫn sử dụng"
          onClick={() => setGuideOpen(true)}
        >
          <HelpCircle size={18} strokeWidth={1.8} />
        </button>
      </div>

      <GuidePopup
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Quy trình giữ chỗ và mua lô đất"
        steps={MAP_GUIDE_STEPS}
        storageKey={MAP_GUIDE_STORAGE_KEY}
        finishLabel="Bắt đầu chọn lô đất"
      />

      <div className="app-body">
        <aside className="sidebar-left">
          <div className="sidebar-section">
            <div className="sidebar-title">{T.searchTitle}</div>
            <label className="search-box">
              <svg
                className="search-icon"
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
                type="text"
                value={searchText}
                placeholder={T.searchPlaceholder}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <div className="filter-chips">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${statusFilter === option.value ? "on" : ""}`}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">{T.zones}</div>
            <div className="zone-list">
              <button
                type="button"
                className={`zone-item ${zoneFilter === "all" ? "active-zone" : ""}`}
                onClick={() => setZoneFilter("all")}
              >
                <span className="zone-dot zone-dot-all" />
                <span className="zone-name">{T.allZones}</span>
                <span className="zone-count">
                  {plots.length} {T.plots}
                </span>
              </button>
              {zones.map((zone) => (
                <button
                  key={zone.key}
                  type="button"
                  className={`zone-item ${zoneFilter === zone.key ? "active-zone" : ""}`}
                  onClick={() => setZoneFilter(zone.key)}
                >
                  <span className="zone-dot" style={{ background: zone.dot }} />
                  <span className="zone-name">{zone.name}</span>
                  <span className="zone-count">
                    {zone.count} {T.plots}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section compact-section">
            <div className="sidebar-title">{T.legend}</div>
            <div className="status-legend">
              {STATUS_OPTIONS.filter((option) => option.value !== "all").map(
                (option) => {
                  const status = option.value as PlotStatus;
                  return (
                    <span key={status}>
                      <i
                        style={{
                          background: STATUS_COLOR[status].fill,
                          borderColor: STATUS_COLOR[status].stroke,
                        }}
                      />
                      {option.label}
                    </span>
                  );
                },
              )}
              <span>
                <i className="no-data" />
                {T.noData}
              </span>
            </div>
          </div>

          {(isLoading || loadError || filteredPlots.length === 0) && (
            <div className="sidebar-empty">
              {isLoading ? T.loading : loadError || T.empty}
            </div>
          )}

          <div className="stats-grid">
            <div
              className={`stat-card ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              <span className="stat-num teal">{stats.total}</span>
              <span className="stat-label">Tổng lô đất</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "available" ? "active" : ""}`}
              onClick={() => setStatusFilter("available")}
            >
              <span className="stat-num green">{stats.available}</span>
              <span className="stat-label">Còn trống</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => setStatusFilter("pending")}
            >
              <span className="stat-num amber">{stats.pending}</span>
              <span className="stat-label">Đang chờ</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "reserved" ? "active" : ""}`}
              onClick={() => setStatusFilter("reserved")}
            >
              <span className="stat-num yellow">{stats.reserved}</span>
              <span className="stat-label">Đã giữ chỗ</span>
            </div>
            <div
              className={`stat-card ${statusFilter === "sold" ? "active" : ""}`}
              onClick={() => setStatusFilter("sold")}
            >
              <span className="stat-num red">{stats.sold}</span>
              <span className="stat-label">Đã bán</span>
            </div>
            <div className="stat-card">
              <span className="stat-num gray">{stats.noData}</span>
              <span className="stat-label">Chưa có dữ liệu</span>
            </div>
          </div>
        </aside>

        <main className="map-area">
          <div className="map-toolbar">
            <div className="mode-switch">
              <button
                type="button"
                className={`mode-btn ${selectionMode === "single" ? "active" : ""}`}
                onClick={() => handleModeChange("single")}
              >
                {T.single}
              </button>
              <button
                type="button"
                className={`mode-btn ${selectionMode === "cluster" ? "active" : ""}`}
                onClick={() => handleModeChange("cluster")}
              >
                {T.cluster}
              </button>
            </div>
          </div>

          <div className="map-viewport">
            <div
              className="map-canvas-wrap"
              ref={mapWrapRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              <div
                className="map-stage"
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: isDraggingRef.current ? "none" : "transform 0.1s ease-out",
                }}
              >
                <svg
                  id="cemetery-map"
                  viewBox={MAP_VIEWBOX}
                  xmlns="http://www.w3.org/2000/svg"
                  onPointerUp={endClusterDrag}
                  onPointerLeave={endClusterDrag}
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="rgba(0,229,196,0.05)"
                        strokeWidth="0.5"
                      />
                    </pattern>
                    <clipPath id="cemetery-boundary-clip">
                      <polygon points={MAP_BOUNDARY_POINTS} />
                    </clipPath>
                  </defs>

                  <rect
                    x={MAP_BG_RECT.x}
                    y={MAP_BG_RECT.y}
                    width={MAP_BG_RECT.width}
                    height={MAP_BG_RECT.height}
                    fill="url(#grid)"
                  />
                  {/* Ranh giới tổng thể khu đất */}
                  <polygon className="map-land" points={MAP_BOUNDARY_POINTS} />
                  <polygon
                    className="map-boundary-line"
                    points={MAP_BOUNDARY_POINTS}
                  />

                  {/* Mạng lưới đường giao thông liên kết 100% (cắt gọn tuyệt đối theo ranh giới đỏ) */}
                  <g className="map-road-network" clipPath="url(#cemetery-boundary-clip)">
                    {/* Trục đường vành đai Tây */}
                    <rect
                      x={LEFT_ROAD.x}
                      y={LEFT_ROAD.y}
                      width={LEFT_ROAD.width}
                      height={LEFT_ROAD.height}
                      className="map-road"
                    />
                    {/* Trục đường chính Đông */}
                    <rect
                      x={MAIN_ROAD.x}
                      y={MAIN_ROAD.y}
                      width={MAIN_ROAD.width}
                      height={MAIN_ROAD.height}
                      className="map-road"
                    />
                    {/* Đại lộ trung tâm CỔNG CHÍNH (dẫn từ Cổng chính qua Khu Tâm Linh) */}
                    <rect
                      x={CENTRAL_ROAD_SOUTH.x}
                      y={CENTRAL_ROAD_SOUTH.y}
                      width={CENTRAL_ROAD_SOUTH.width}
                      height={CENTRAL_ROAD_SOUTH.height}
                      className="map-road"
                    />
                    <rect
                      x={CENTRAL_ROAD_NORTH.x}
                      y={CENTRAL_ROAD_NORTH.y}
                      width={CENTRAL_ROAD_NORTH.width}
                      height={CENTRAL_ROAD_NORTH.height}
                      className="map-road"
                    />
                    {/* Đại lộ CỔNG PHỤ (Khu Lô Gia Tộc) */}
                    <rect
                      x={FAMILY_ROAD.x}
                      y={FAMILY_ROAD.y}
                      width={FAMILY_ROAD.width}
                      height={FAMILY_ROAD.height}
                      className="map-road"
                    />
                    {/* Vành đai Bắc & Nam (nối Cổng chính, Cổng phụ và toàn bộ các đường) */}
                    <rect
                      x={TOP_ROAD.x}
                      y={TOP_ROAD.y}
                      width={TOP_ROAD.width}
                      height={TOP_ROAD.height}
                      className="map-road"
                    />
                    <rect
                      x={BOTTOM_ROAD.x}
                      y={BOTTOM_ROAD.y}
                      width={BOTTOM_ROAD.width}
                      height={BOTTOM_ROAD.height}
                      className="map-road"
                    />
                    {/* 4 đường ngang nội bộ N1-N4 */}
                    {CROSS_ROADS.map((road, index) => (
                      <rect
                        key={`cross-${index}`}
                        x={road.x}
                        y={road.y}
                        width={road.width}
                        height={road.height}
                        className="map-road"
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
                        className="map-road"
                      />
                    ))}
                    {/* Lối đi dọc nội bộ CỔNG PHỤ xuyên khối Gia Tộc */}
                    <rect
                      x={FAMILY_AISLE_ROAD.x}
                      y={FAMILY_AISLE_ROAD.y}
                      width={FAMILY_AISLE_ROAD.width}
                      height={FAMILY_AISLE_ROAD.height}
                      className="map-road"
                    />
                    {/* 4 góc vát nghiêng vành đai bo chuẩn theo khung nét đứt đỏ */}
                    {ROAD_CORNER_CHAMFERS.map((pts, i) => (
                      <polygon key={i} points={pts} className="map-road" />
                    ))}
                  </g>

                  {/* Khu Tâm Linh - công viên trung tâm (nằm trong khối mộ đơn) */}
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
                    <text
                      x={SPIRIT_PARK.cx}
                      y={SPIRIT_PARK.cy + 4}
                      textAnchor="middle"
                      className="spirit-park-label"
                    >
                      KHU TÂM LINH
                    </text>
                  </g>

                  {/* Cổng CHÍNH - chỉ ở khối mộ đơn (trái) */}
                  <polygon
                    className="map-gate-marker"
                    points={gateMarkerPoints(MAP_GATE)}
                  />
                  <text
                    x={MAP_GATE.x}
                    y={MAP_GATE.y - 36}
                    textAnchor="middle"
                    className="gate-label"
                  >
                    {T.gate}
                  </text>
                  {/* Cổng PHỤ - ở khối lô gia tộc (phải), không phải cổng chính */}
                  <polygon
                    className="map-gate-marker map-gate-secondary"
                    points={gateMarkerPoints(SECONDARY_GATE)}
                  />
                  <text
                    x={SECONDARY_GATE.x}
                    y={SECONDARY_GATE.y - 36}
                    textAnchor="middle"
                    className="gate-label gate-label-secondary"
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
                          fillOpacity={0.07}
                          stroke={zone.dot}
                          strokeOpacity={0.4}
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
                      className="zone-label"
                    >
                      {`KHU ${zone.key}`}
                    </text>
                  ))}

                  {/* Khối nền Khu C: 4 cụm C1-C4 */}
                  {CLUSTER_GROUP_BACKDROPS.map((backdrop, index) => (
                    <g key={`cluster-backdrop-${index}`}>
                      <polygon
                        points={backdrop.points}
                        fill={clusterZone?.dot}
                        fillOpacity={0.08}
                        stroke={clusterZone?.dot}
                        strokeOpacity={0.45}
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
                      className="zone-label"
                    >
                      {`KHU C${index + 1}`}
                    </text>
                  ))}

                  {routePlot && (
                    <polyline
                      className="route-line"
                      points={getCemeteryRoutePoints(routePlot)}
                    />
                  )}

                  {filteredPlots.map((plot) => {
                    const color = STATUS_COLOR[plot.status];
                    const myReservation = myPlotByCode.get(plot.plotCode);
                    const displayLabel = myReservation
                      ? getMyReservationLabel(myReservation)
                      : getStatusLabel(plot);
                    return (
                      <g
                        key={plot.id}
                        className={getPlotClassName(plot, myReservation)}
                        onPointerDown={(event) =>
                          handlePlotPointerDown(event, plot)
                        }
                        onPointerEnter={() => handlePlotPointerEnter(plot)}
                        onMouseEnter={(event) => handleMouseEnter(event, plot)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        <rect
                          className="lot-rect"
                          x={plot.x}
                          y={plot.y}
                          width={plot.width}
                          height={plot.height}
                          rx="2"
                          fill={
                            myReservation ? "rgba(0,229,196,0.24)" : color.fill
                          }
                          stroke={getPlotStroke(plot, myReservation)}
                          strokeWidth={
                            selectedPlot?.id === plot.id ||
                            clusterIds.has(plot.id) ||
                            myReservation
                              ? 2
                              : 0.8
                          }
                          data-id={plot.id}
                          data-zone={plot.zoneName}
                          data-status={plot.status}
                        />
                        <title>
                          {plot.plotCode} - {plot.zoneName} - {displayLabel}
                        </title>
                        <text
                          x={plot.x + plot.width / 2}
                          y={plot.y + Math.min(16, plot.height / 2 + 3)}
                          textAnchor="middle"
                          className="plot-code"
                          fill={color.text}
                        >
                          {plot.plotNumber}
                        </text>
                        {myReservation && (
                          <text
                            x={plot.x + plot.width - 5}
                            y={plot.y + 8}
                            textAnchor="middle"
                            className="plot-mine-mark"
                          >
                            ✓
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {selectedPlot &&
                    filteredPlots.some((plot) => plot.id === selectedPlot.id) && (
                      <rect
                      fill="none"
                      stroke="#f0c060"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      opacity="0.9"
                    />
                  )}
                </svg>
              </div>

              {(isLoading || loadError || filteredPlots.length === 0) && (
                <div className="map-empty">
                  {isLoading ? T.loading : loadError || T.empty}
                </div>
              )}
            </div>

            {/* Lớp phủ cố định trong VÙNG BẢN ĐỒ (không phải toàn trang):
                la bàn góc trên-phải, cụm xoay/zoom góc dưới-phải. Nằm NGOÀI
                .map-canvas-wrap nên không bị cuốn theo khi kéo/zoom bản đồ. */}
            <svg
              className="compass"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Đặt lại hướng Bắc"
              role="button"
              onClick={() => setRotation(0)}
              style={{
                transform: `rotate(${-rotation}deg)`,
                cursor: "pointer",
              }}
            >
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="rgba(0,229,196,0.2)"
                strokeWidth="0.5"
              />
              <polygon
                points="20,4 23,18 20,20 17,18"
                fill="rgba(232,74,74,0.7)"
              />
              <polygon
                points="20,36 23,22 20,20 17,22"
                fill="rgba(0,229,196,0.4)"
              />
              <text
                x="20"
                y="8"
                textAnchor="middle"
                fill="rgba(232,74,74,0.8)"
                fontSize="6"
                fontFamily="Be Vietnam Pro"
              >
                N
              </text>
            </svg>

            <div className="map-rotate">
              <button
                className="zoom-btn"
                type="button"
                title="Xoay trái"
                aria-label="Xoay trái"
                onClick={() => setRotation((r) => (r - 30 + 360) % 360)}
              >
                ⟲
              </button>
              <button
                className="zoom-btn heading-btn"
                type="button"
                title="Hướng hiện tại - bấm để đặt lại hướng Bắc"
                aria-label="Hướng hiện tại - bấm để đặt lại hướng Bắc"
                onClick={() => setRotation(0)}
              >
                {getHeadingLabel(rotation)}
              </button>
              <button
                className="zoom-btn"
                type="button"
                title="Xoay phải"
                aria-label="Xoay phải"
                onClick={() => setRotation((r) => (r + 30) % 360)}
              >
                ⟳
              </button>
            </div>

            <div className="map-zoom">
              <button
                className="zoom-btn"
                type="button"
                aria-label="Zoom in"
                title="Phóng to (hoặc cuộn touchpad)"
                onClick={() => setZoom((z) => Math.min(z * 1.3, 4))}
              >
                +
              </button>
              <button
                className="zoom-btn"
                type="button"
                aria-label="Zoom out"
                title="Thu nhỏ (hoặc cuộn touchpad)"
                onClick={() => setZoom((z) => Math.max(z / 1.3, 0.5))}
              >
                -
              </button>
            </div>
          </div>
        </main>

        <aside className="panel-right">
          {!selectedPlot && (
            <div className="detail-empty">
              <div className="detail-empty-title">{T.notSelected}</div>
              <p>{T.selectHint}</p>
            </div>
          )}

          {selectedPlot && (
            <div className="detail-panel visible">
              <div className="detail-tag">{T.pageTitle}</div>
              <div className="detail-lot-id">{selectedPlot.plotCode}</div>
              <div className="detail-zone">
                {selectedPlot.zoneName} - {selectedPlot.rowCode} -{" "}
                {T.plotNumber} {selectedPlot.plotNumber}
              </div>
              <div className={`status-badge ${selectedPlot.status}`}>
                <span
                  className="status-badge-dot"
                  style={{ background: selectedColor?.stroke }}
                />
                {selectedMyReservation
                  ? getMyReservationLabel(selectedMyReservation)
                  : getStatusLabel(selectedPlot)}
              </div>

              {selectedMyReservation && (
                <div className="my-plot-box">
                  <div className="box-label">{T.myPlot}</div>
                  <div className="my-plot-title">
                    Yêu cầu #{selectedMyReservation.id}
                  </div>
                  <div className="my-plot-note">
                    {selectedMyReservation.type === "purchase"
                      ? T.purchaseAction
                      : T.reserveAction}{" "}
                    · {getMyReservationLabel(selectedMyReservation)}
                  </div>
                </div>
              )}

              {!selectedPlot.isPlaceholder && (
                <div className="detail-actions route-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() =>
                      setRoutePlotId((id) =>
                        id === selectedPlot.id ? null : selectedPlot.id,
                      )
                    }
                  >
                    {routePlot ? T.hideRoute : T.findRoute}
                  </button>
                </div>
              )}

              <div className="detail-divider" />
              <div className="detail-row">
                <span className="detail-row-label">{T.plotCode}</span>
                <span className="detail-row-val">{selectedPlot.plotCode}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.zone}</span>
                <span className="detail-row-val">{selectedPlot.zoneName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.row}</span>
                <span className="detail-row-val">{selectedPlot.rowCode}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.status}</span>
                <span className="detail-row-val highlight">
                  {selectedMyReservation
                    ? getMyReservationLabel(selectedMyReservation)
                    : getStatusLabel(selectedPlot)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.price}</span>
                <span className="detail-row-val">
                  {formatVnd(selectedPlot.price)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.area}</span>
                <span className="detail-row-val">{selectedPlot.area} m2</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.size}</span>
                <span className="detail-row-val">{selectedPlot.size}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.direction}</span>
                <span className="detail-row-val">{selectedPlot.direction}</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.selectable}</span>
                <span className="detail-row-val">
                  {selectedIsAvailable ? T.yes : T.no}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.viewing}</span>
                <span className="detail-row-val">
                  {selectedPlot.currentViewers} {T.people}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">{T.selecting}</span>
                <span className="detail-row-val">
                  {selectedPlot.currentSelectors} {T.people}
                </span>
              </div>

              <div className="description-box">
                <div className="box-label">{T.description}</div>
                <ul className="description-list">
                  {descriptionLines(selectedPlot.description).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              {submitError && (
                <div className="selection-message">{submitError}</div>
              )}
              {submitMessage && (
                <div className="submit-success">{submitMessage}</div>
              )}

              {routePlot && (
                <div className="direction-box">
                  <div className="box-label">{T.directionGuide}</div>
                  <p>{buildCemeteryDirection(selectedPlot)}</p>
                </div>
              )}

              <div className="request-type-switch" aria-label="Loại yêu cầu">
                <button
                  type="button"
                  className={`request-type-btn ${requestType === "reserve" ? "active" : ""}`}
                  onClick={() => setRequestType("reserve")}
                >
                  {T.reserveAction}
                </button>
                <button
                  type="button"
                  className={`request-type-btn ${requestType === "purchase" ? "active" : ""}`}
                  onClick={() => setRequestType("purchase")}
                >
                  {T.purchaseAction}
                </button>
              </div>

              {selectionMode === "single" && (
                <div className="detail-actions">
                  {selectedPlot.isPlaceholder ? (
                    <div className="selection-message">
                      {getUnavailableMessage(selectedPlot)}
                    </div>
                  ) : (
                    <>
                      {selectedIsAvailable ? (
                        <button
                          className="btn-primary"
                          type="button"
                          disabled={submitting}
                          onClick={() => submitReservation([selectedPlot])}
                        >
                          {submitting
                            ? T.submitting
                            : requestType === "purchase"
                              ? T.purchaseAction
                              : T.continuePlot}
                        </button>
                      ) : (
                        <div className="selection-message">
                          {getUnavailableMessage(selectedPlot)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectionMode === "cluster" && adjacencyWarning && (
                <div className="adjacency-warning">{adjacencyWarning}</div>
              )}
              {selectionMode === "cluster" && !selectedIsAvailable && (
                <div className="selection-message">
                  {getUnavailableMessage(selectedPlot)}
                </div>
              )}
            </div>
          )}

          {selectionMode === "cluster" && (
            <div className="cluster-panel">
              <div className="cluster-title">
                {T.selectedPlots} ({clusterPlots.length})
              </div>
              {clusterPlots.length === 0 ? (
                <div className="cluster-empty">{T.clusterHint}</div>
              ) : (
                <>
                  <div className="cluster-list">
                    {clusterPlots.map((cp) => (
                      <div className="cluster-item" key={cp.id}>
                        <span className="cluster-item-code">{cp.plotCode}</span>
                        <span className="cluster-item-price">
                          {formatVnd(cp.price)}
                        </span>
                        <button
                          type="button"
                          className="cluster-remove-btn"
                          title={T.removeGroup}
                          onClick={() => removeFromCluster(cp.id)}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="cluster-summary">
                    <div className="cluster-summary-row">
                      <span className="cluster-summary-label">
                        {T.totalPlots}
                      </span>
                      <span className="cluster-summary-val">
                        {clusterPlots.length}
                      </span>
                    </div>
                    <div className="cluster-summary-row">
                      <span className="cluster-summary-label">
                        {T.totalPrice}
                      </span>
                      <span className="cluster-summary-val total">
                        {formatVnd(clusterTotalPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="detail-actions" style={{ marginTop: 14 }}>
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={submitting}
                      onClick={() => submitReservation(clusterPlots, true)}
                    >
                      {submitting
                        ? T.submitting
                        : requestType === "purchase"
                          ? T.purchaseSelected
                          : T.submitSelected}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={clearCluster}
                    >
                      {T.clear}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="map-tooltip" ref={tooltipRef}>
        <div className="tooltip-id">{hoverPlot?.plotCode}</div>
        <div
          className="tooltip-status"
          style={{
            color: hoverPlot ? STATUS_COLOR[hoverPlot.status].text : undefined,
          }}
        >
          {hoverPlot
            ? `${hoverPlot.zoneName} - ${myPlotByCode.get(hoverPlot.plotCode) ? getMyReservationLabel(myPlotByCode.get(hoverPlot.plotCode)) : getStatusLabel(hoverPlot)}`
            : ""}
        </div>
        <div className="tooltip-price">
          {hoverPlot ? formatVnd(hoverPlot.price) : ""}
        </div>
      </div>
    </div>
  );
}