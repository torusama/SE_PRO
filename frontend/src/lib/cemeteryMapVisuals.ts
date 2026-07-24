// Hình học trang trí dùng chung cho bản đồ 2D (trang khách hàng + trang quản trị).
// Mục tiêu: làm cho RANH GIỚI TỔNG THỂ của khu đất trông như một thửa đất thật
// (đa giác không đều, có góc vát/lồi) thay vì một hình chữ nhật hoàn hảo,
// trong khi TỪNG Ô MỘ NHỎ vẫn giữ nguyên toạ độ/hình dạng/màu sắc/hover cũ
// (toạ độ ô mộ vẫn lấy từ cemeteryMapLayout.ts, không bị thay đổi).
//
// Vùng nội dung (grid ô mộ) hiện chiếm khoảng x:[60,740] y:[48,554].
// Hàng rào vuông cũ là x:[30,770] y:[30,570]. Đa giác bên dưới được vẽ
// RỘNG HƠN hàng rào cũ ở mọi cạnh (phình ra ngoài + vát góc), nên không
// bao giờ cắt ngang qua một ô mộ nào — đã kiểm chứng bằng toạ độ.

// viewBox mở rộng để đa giác có đủ khoảng trống phình ra ngoài mà không
// đụng vào lưới ô mộ bên trong.
export const MAP_VIEWBOX = "-60 -30 920 660";
export const MAP_BG_RECT = { x: -60, y: -30, width: 920, height: 660 };

// Đường viền tổng thể khu đất (đi theo chiều kim đồng hồ), có góc vát
// và cạnh lồi để trông như một thửa đất thật ngoài khảo sát, không phải
// hình chữ nhật lý thuyết.
const BOUNDARY_RAW: Array<[number, number]> = [
  [90, -10],
  [690, -10],
  [770, 10],
  [800, 60],
  [800, 540],
  [770, 590],
  [120, 610],
  [-40, 610],
  [-40, 180],
  [30, 60],
];

export const MAP_BOUNDARY_POINTS = BOUNDARY_RAW.map((p) => p.join(",")).join(
  " ",
);

// Cổng chính nằm ở phần lồi phía dưới, giữa trục đường trung tâm.
export const MAP_GATE = { x: 400, y: 600 };

export function gateMarkerPoints(gate: { x: number; y: number } = MAP_GATE) {
  return `${gate.x - 13},${gate.y - 4} ${gate.x + 13},${gate.y - 4} ${gate.x},${gate.y - 30}`;
}

// ------------------------------------------------------------------
// KHỐI NỀN TỪNG KHU (phong cách bản vẽ kiến trúc phân lô)
// ------------------------------------------------------------------
// Lưới ô mộ thật (bấm/hover/màu trạng thái) vẫn vẽ y như cũ, KHÔNG đổi.
// Lớp dưới đây chỉ là một khối "nền đất" vẽ PHÍA SAU lưới đó, có góc vát/
// bẻ lệch giống bản vẽ kiến trúc thay vì một khối chữ nhật vuông vắn.
// Vì vẽ phía sau nên không bao giờ che hay chặn hover/click của ô mộ thật.

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

// Khoảng x của từng "cột khu" — rộng hơn lưới ô mộ thật một chút (như một
// thửa đất bao quanh cụm mộ), dùng chung cho cả Khu A/B/D (chế độ "Một lô")
// lẫn 3 cụm gia tộc của Khu C (chế độ "Lô gia tộc") vì chúng dùng chung
// hệ toạ độ cột trong cemeteryMapLayout.ts.
const COLUMN_BOUNDS: Record<"A" | "B" | "D", { x1: number; x2: number }> = {
  A: { x1: 50, x2: 260 },
  B: { x1: 295, x2: 505 },
  D: { x1: 540, x2: 750 },
};

// 3 dải theo chiều dọc, tương ứng dải trên/giữa/dưới (2 trục đường ngang
// cắt qua). Vát góc đổi bên xen kẽ để mỗi dải có dáng hơi khác nhau,
// giống các khối A1/A2/A3 lệch nhau trong bản vẽ mẫu.
const BAND_BOUNDS: Array<{
  key: string;
  y1: number;
  y2: number;
  corners: ChamferCorners;
}> = [
  { key: "1", y1: 34, y2: 164, corners: "tl-br" },
  { key: "2", y1: 196, y2: 352, corners: "tr-bl" },
  { key: "3", y1: 406, y2: 562, corners: "tl-br" },
];

export interface ZoneBackdropBand {
  key: string;
  points: string;
  cx: number;
  cy: number;
}

function buildColumnBackdrops(x1: number, x2: number): ZoneBackdropBand[] {
  return BAND_BOUNDS.map((band) => ({
    key: band.key,
    points: chamferedRect(
      x1,
      band.y1,
      x2 - x1,
      band.y2 - band.y1,
      18,
      band.corners,
    ),
    cx: (x1 + x2) / 2,
    cy: (band.y1 + band.y2) / 2,
  }));
}

// Danh sách khối nền theo từng cột (A/B/D) — dùng trực tiếp cho chế độ
// "Một lô", và dùng lại (đổi màu theo Khu C) cho chế độ "Lô gia tộc".
export const ZONE_BACKDROPS: Record<"A" | "B" | "D", ZoneBackdropBand[]> = {
  A: buildColumnBackdrops(COLUMN_BOUNDS.A.x1, COLUMN_BOUNDS.A.x2),
  B: buildColumnBackdrops(COLUMN_BOUNDS.B.x1, COLUMN_BOUNDS.B.x2),
  D: buildColumnBackdrops(COLUMN_BOUNDS.D.x1, COLUMN_BOUNDS.D.x2),
};

export const ZONE_BACKDROP_COLUMNS: Array<"A" | "B" | "D"> = ["A", "B", "D"];
