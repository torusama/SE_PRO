import { CEMETERY_ZONE_LAYOUT } from "./cemeteryMapLayout";

// Hình học trang trí + bố cục "tổng mặt bằng" dùng chung cho bản đồ 2D.
// Bố cục: khối 7 khu MỘ ĐƠN bên TRÁI + khối Khu C (LÔ GIA TỘC, 4 cụm
// C1-C4) bên PHẢI, nối với nhau bằng một đường dẫn — người dùng
// kéo/lướt ngang để di chuyển qua lại giữa 2 khối trên cùng 1 bản đồ,
// KHÔNG còn ẩn/hiện đổi hẳn nội dung như trước.
//
// Lưới ô mộ THẬT (toạ độ/kích thước/hover/màu trạng thái) vẫn lấy từ
// cemeteryMapLayout.ts như cũ. Mọi hình khối bên dưới chỉ vẽ PHÍA SAU/
// PHÍA NGOÀI lưới đó, và luôn cách đường xá một khoảng rõ ràng (đã kiểm
// chứng bằng toạ độ) để không bị dính/đè lên nhau.

export const MAP_VIEWBOX = "-100 -60 1780 1720";
export const MAP_BG_RECT = { x: -100, y: -60, width: 1780, height: 1720 };

// Ranh giới tổng thể khu đất: đa giác bất cân đối bao trọn CẢ HAI khối
// (mộ đơn bên trái + lô gia tộc bên phải), viền nét đứt đỏ.
const BOUNDARY_RAW: Array<[number, number]> = [
  [160, -40],
  [1560, -40],
  [1660, 60],
  [1660, 1460],
  [1590, 1600],
  [960, 1600],
  [140, 1600],
  [-80, 1480],
  [-80, 160],
];
export const MAP_BOUNDARY_POINTS = BOUNDARY_RAW.map((p) => p.join(",")).join(
  " ",
);

// Đường chính chạy dọc — sát rìa PHẢI của khối mộ đơn (bên trái bản đồ).
export const MAIN_ROAD = { x: 880, y: 40, width: 20, height: 1480 };

// Đường bao/đường chéo bên trái khối mộ đơn.
export const LEFT_DIAGONAL_ROAD_POINTS =
  "-40,20 0,20 -24,500 6,510 -30,720 -2,730 -40,1460";

// Đường ngang nối giữa các hàng khu (khối mộ đơn, bên trái).
export const CROSS_ROADS = [
  { x: -40, y: 322, width: 960, height: 26 }, // giữa hàng 1 (A/B) và hàng 2 (D/E)
  { x: -40, y: 640, width: 960, height: 20 }, // giữa hàng 2 và Khu Tâm Linh
  { x: -40, y: 862, width: 960, height: 20 }, // giữa Khu Tâm Linh và hàng 3 (F/G)
  { x: -40, y: 1192, width: 960, height: 26 }, // giữa hàng 3 và hàng 4 (H)
];

// Khu Tâm Linh (công viên trung tâm) — nằm giữa hàng 2 và hàng 3 của khối
// mộ đơn.
export const SPIRIT_PARK = {
  x: 300,
  y: 700,
  width: 400,
  height: 152,
  cx: 500,
  cy: 776,
  r: 58,
};

// Đường dẫn nối khối mộ đơn (trái) sang khối lô gia tộc (phải).
export const CONNECTOR_ROAD = { x: 900, y: 744, width: 100, height: 24 };

// Cổng CHÍNH — chỉ ở dưới cùng khối mộ đơn (bên trái).
export const MAP_GATE = { x: 460, y: 1560 };
// Cổng PHỤ — dưới cùng khối lô gia tộc (bên phải), không phải cổng chính.
export const SECONDARY_GATE = { x: 1310, y: 1560 };

export function gateMarkerPoints(gate: { x: number; y: number }) {
  return `${gate.x - 13},${gate.y - 4} ${gate.x + 13},${gate.y - 4} ${gate.x},${gate.y - 30}`;
}

// La bàn 12 hướng (mỗi nấc xoay 30°) — dùng cho readout hướng hiện tại ở
// nút giữa cụm xoay bản đồ (thay vì chỉ hiển thị chữ "N" cố định).
export const COMPASS_HEADINGS = [
  "B",
  "B-ĐB",
  "Đ-ĐB",
  "Đ",
  "Đ-ĐN",
  "N-ĐN",
  "N",
  "N-TN",
  "T-TN",
  "T",
  "T-TB",
  "B-TB",
];

export function getHeadingLabel(rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  const index = Math.round(normalized / 30) % COMPASS_HEADINGS.length;
  return COMPASS_HEADINGS[index];
}

// ------------------------------------------------------------------
// KHỐI NỀN TỪNG KHU (phong cách bản vẽ kiến trúc phân lô)
// ------------------------------------------------------------------
type ChamferCorners = "tl-br" | "tr-bl" | "all";

export function chamferedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
  corners: ChamferCorners = "tl-br",
) {
  const x2 = x + w;
  const y2 = y + h;
  const raw: Array<[number, number]> =
    corners === "all"
      ? [
          [x + cut, y],
          [x2 - cut, y],
          [x2, y + cut],
          [x2, y2 - cut],
          [x2 - cut, y2],
          [x + cut, y2],
          [x, y2 - cut],
          [x, y + cut],
        ]
      : corners === "tr-bl"
        ? [
            [x, y],
            [x2 - cut, y],
            [x2, y + cut],
            [x2, y2],
            [x + cut, y2],
            [x, y2 - cut],
          ]
        : [
            [x + cut, y],
            [x2, y],
            [x2, y2 - cut],
            [x2 - cut, y2],
            [x, y2],
            [x, y + cut],
          ];
  return raw.map((p) => p.join(",")).join(" ");
}

export interface ZoneBackdrop {
  points: string;
  cx: number;
  cy: number;
}

// Đệm ra ngoài lưới ô mộ thật — CHỪA đủ khoảng cách với đường xá xung
// quanh (đã kiểm chứng bằng toạ độ, xem ghi chú trong cemeteryMapLayout.ts).
const BACKDROP_PAD = 14;
const CHAMFER_CYCLE: ChamferCorners[] = ["tl-br", "tr-bl"];

function makeBackdrop(
  x: number,
  y: number,
  w: number,
  h: number,
  corners: ChamferCorners,
): ZoneBackdrop {
  const cut = Math.min(30, Math.min(w, h) * 0.14);
  return {
    points: chamferedRect(x, y, w, h, cut, corners),
    cx: x + w / 2,
    cy: y + h / 2,
  };
}

// Một khối nền vát góc cho MỖI khu mộ đơn (A,B,D,E,F,G,H).
export const ZONE_BACKDROPS: Record<string, ZoneBackdrop> = Object.fromEntries(
  Object.entries(CEMETERY_ZONE_LAYOUT)
    .filter(([key]) => key !== "C")
    .map(([key, layout], index) => [
      key,
      makeBackdrop(
        layout.x - BACKDROP_PAD,
        layout.y - BACKDROP_PAD,
        layout.width + BACKDROP_PAD * 2,
        layout.height + BACKDROP_PAD * 2,
        CHAMFER_CYCLE[index % CHAMFER_CYCLE.length],
      ),
    ]),
);

// Khu C được chia thành 4 cụm riêng biệt (C1-C4) — MỖI cụm có khối nền
// vát góc RIÊNG (không phải 1 khối nền chung cho cả Khu C), để nhìn rõ
// đây là 4 khu vực tách bạch dành cho 4 gia tộc khác nhau.
export const CLUSTER_GROUP_BACKDROPS: ZoneBackdrop[] = (() => {
  const layout = CEMETERY_ZONE_LAYOUT.C;
  const groups = layout.groups!;
  const groupWidth =
    (layout.width - groups.gap * (groups.cols - 1)) / groups.cols;
  const groupHeight =
    (layout.height - groups.gap * (groups.rows - 1)) / groups.rows;
  const result: ZoneBackdrop[] = [];
  for (let r = 0; r < groups.rows; r += 1) {
    for (let c = 0; c < groups.cols; c += 1) {
      const x = layout.x + c * (groupWidth + groups.gap) - BACKDROP_PAD;
      const y = layout.y + r * (groupHeight + groups.gap) - BACKDROP_PAD;
      const w = groupWidth + BACKDROP_PAD * 2;
      const h = groupHeight + BACKDROP_PAD * 2;
      result.push(
        makeBackdrop(
          x,
          y,
          w,
          h,
          CHAMFER_CYCLE[(r * groups.cols + c) % CHAMFER_CYCLE.length],
        ),
      );
    }
  }
  return result;
})();
