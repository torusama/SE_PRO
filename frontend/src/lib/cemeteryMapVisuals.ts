import { CEMETERY_ZONE_LAYOUT } from "./cemeteryMapLayout";

// Hình học trang trí + bố cục "tổng mặt bằng" dùng chung cho bản đồ 2D
// (trang khách hàng + trang quản trị). Mục tiêu: khu đất trông như một bản
// vẽ quy hoạch kiến trúc thật — ranh giới bất cân đối (đa giác/hình thang mở
// rộng, viền nét đứt màu đỏ), đường chính chạy dọc bên phải, đường bao chéo
// xẻ bên trái, Khu Tâm Linh ở giữa — thay vì bàn cờ vuông vức như trước.
//
// Lưới ô mộ THẬT (toạ độ/kích thước/hover/màu trạng thái) vẫn lấy từ
// cemeteryMapLayout.ts như cũ, không đổi — mọi hình khối bên dưới chỉ vẽ
// PHÍA SAU/PHÍA NGOÀI lưới đó nên không ảnh hưởng hover/click.

export const MAP_VIEWBOX = "-90 -50 980 1200";
export const MAP_BG_RECT = { x: -90, y: -50, width: 980, height: 1200 };

// Ranh giới tổng thể khu đất: đa giác bất cân đối (không phải hình chữ
// nhật/hình thang lý thuyết), luôn nằm ngoài toàn bộ 7 khu đơn + đường
// chính + cổng (đã kiểm chứng bằng toạ độ) nên không bao giờ cắt ngang lô.
const BOUNDARY_RAW: Array<[number, number]> = [
  [100, -20],
  [760, -20],
  [860, 60],
  [860, 900],
  [820, 1060],
  [160, 1100],
  [-60, 980],
  [-60, 100],
];
export const MAP_BOUNDARY_POINTS = BOUNDARY_RAW.map((p) => p.join(",")).join(
  " ",
);

// Đường chính (trục đường chính vào khu) chạy DỌC bên phải, ngoài rìa cột
// khu bên phải — không còn là trục cắt giữa như bố cục bàn cờ cũ.
export const MAIN_ROAD = { x: 720, y: 10, width: 20, height: 1000 };

// Đường bao/đường chéo bên trái xẻ ngang khu đất — vẽ như một dải chéo
// (không song song trục) chạy dọc theo rìa trái, giống các tuyến "đường
// bao" trong bản vẽ quy hoạch thực tế.
export const LEFT_DIAGONAL_ROAD_POINTS =
  "-10,0 26,0 4,420 30,430 -2,600 24,610 -10,980";

// Các đường ngang nối giữa các hàng khu (mỗi đường là 1 dải ngang mảnh).
export const CROSS_ROADS = [
  { x: -10, y: 214, width: 870, height: 20 }, // giữa hàng 1 (A/B) và hàng 2 (D/E)
  { x: -10, y: 424, width: 870, height: 14 }, // giữa hàng 2 và Khu Tâm Linh
  { x: -10, y: 574, width: 870, height: 14 }, // giữa Khu Tâm Linh và hàng 3 (F/G)
  { x: -10, y: 774, width: 870, height: 20 }, // giữa hàng 3 và hàng 4 (H)
];

// Khu Tâm Linh (công viên trung tâm) — nằm giữa hàng 2 và hàng 3.
export const SPIRIT_PARK = {
  x: 260,
  y: 450,
  width: 240,
  height: 120,
  cx: 380,
  cy: 510,
  r: 46,
};

// Cổng chính, dưới cùng, giữa trục đường chính bên phải và đường bao bên trái.
export const MAP_GATE = { x: 400, y: 1030 };

export function gateMarkerPoints(gate: { x: number; y: number } = MAP_GATE) {
  return `${gate.x - 13},${gate.y - 4} ${gate.x + 13},${gate.y - 4} ${gate.x},${gate.y - 30}`;
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

const BACKDROP_PAD = 16;
const CHAMFER_CYCLE: ChamferCorners[] = ["tl-br", "tr-bl"];

// Một khối nền vát góc cho MỖI khu (kể cả Khu C), luôn phình RỘNG hơn lưới
// ô mộ thật của khu đó (đệm ra ngoài BACKDROP_PAD) nên không bao giờ che
// hay cắt vào ô mộ thật — chỉ tạo cảm giác "thửa đất lệch" phía sau.
export const ZONE_BACKDROPS: Record<string, ZoneBackdrop> = Object.fromEntries(
  Object.entries(CEMETERY_ZONE_LAYOUT).map(([key, layout], index) => {
    const x = layout.x - BACKDROP_PAD;
    const y = layout.y - BACKDROP_PAD;
    const w = layout.width + BACKDROP_PAD * 2;
    const h = layout.height + BACKDROP_PAD * 2;
    const corners = CHAMFER_CYCLE[index % CHAMFER_CYCLE.length];
    const cut = Math.min(28, Math.min(w, h) * 0.16);
    return [
      key,
      {
        points: chamferedRect(x, y, w, h, cut, corners),
        cx: x + w / 2,
        cy: y + h / 2,
      },
    ];
  }),
);
