export interface MapCoordinateInput {
  rowCode?: string;
  plotNumber?: number | string;
}

// 8 khu thật (A-H khu mộ đơn/gia tộc + Khu C dành riêng cho lô gia tộc,
// hiển thị ở chế độ "Lô gia tộc"). Vị trí (labelX/labelY) khớp với bố cục
// 2 cột x 4 hàng trong CEMETERY_ZONE_LAYOUT bên dưới.
export const CEMETERY_ZONES = [
  {
    key: "A",
    name: "Khu A - Cao cấp",
    dot: "#00b89e",
    labelX: 215,
    labelY: 26,
    mode: "single",
  },
  {
    key: "B",
    name: "Khu B - Tiêu chuẩn",
    dot: "#c9a84c",
    labelX: 545,
    labelY: 26,
    mode: "single",
  },
  {
    key: "D",
    name: "Khu D - Bình dân",
    dot: "#4da6ff",
    labelX: 215,
    labelY: 236,
    mode: "single",
  },
  {
    key: "E",
    name: "Khu E - Cải táng",
    dot: "#00b4d8",
    labelX: 545,
    labelY: 236,
    mode: "single",
  },
  {
    key: "F",
    name: "Khu F - Mật độ cao",
    dot: "#52b788",
    labelX: 215,
    labelY: 586,
    mode: "single",
  },
  {
    key: "G",
    name: "Khu G - Mở rộng",
    dot: "#2d9d6f",
    labelX: 545,
    labelY: 586,
    mode: "single",
  },
  {
    key: "H",
    name: "Khu H - Mộ đơn",
    dot: "#f4a340",
    labelX: 215,
    labelY: 796,
    mode: "single",
  },
  {
    key: "C",
    name: "Khu C - Lô gia tộc",
    dot: "#7b6bcc",
    labelX: 380,
    labelY: 26,
    mode: "cluster",
  },
] as const;

export interface ZoneLayout {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  gap: number;
}

// Mỗi khu giờ là MỘT khối chữ nhật độc lập (không còn chia 3 dải trên/giữa/
// dưới dùng chung như trước) — bố cục tổng thể theo kiểu bản vẽ quy hoạch:
// 2 cột khu x 4 hàng, đường chính chạy dọc bên phải (ngoài cột phải),
// đường bao/đường chéo bên trái, Khu Tâm Linh chen giữa hàng 2 và hàng 3.
// (Hình dạng "lệch/vát góc" thực tế của từng khu do cemeteryMapVisuals.ts vẽ
// thêm ở lớp nền phía sau lưới ô mộ — toạ độ ô mộ dưới đây vẫn là lưới đều
// để giữ nguyên cách vẽ/hover/chọn lô như cũ.)
export const CEMETERY_ZONE_LAYOUT: Record<string, ZoneLayout> = {
  A: {
    name: CEMETERY_ZONES[0].name,
    x: 60,
    y: 40,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  B: {
    name: CEMETERY_ZONES[1].name,
    x: 390,
    y: 40,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  D: {
    name: CEMETERY_ZONES[2].name,
    x: 60,
    y: 250,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  E: {
    name: CEMETERY_ZONES[3].name,
    x: 390,
    y: 250,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  F: {
    name: CEMETERY_ZONES[4].name,
    x: 60,
    y: 600,
    width: 310,
    height: 170,
    cols: 6,
    rows: 4,
    gap: 5,
  },
  G: {
    name: CEMETERY_ZONES[5].name,
    x: 390,
    y: 600,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  H: {
    name: CEMETERY_ZONES[6].name,
    x: 60,
    y: 810,
    width: 310,
    height: 170,
    cols: 5,
    rows: 4,
    gap: 6,
  },
  // Khu C dùng chung toàn bộ bề ngang (60-700) khi ở chế độ "Lô gia tộc"
  // (thay thế hoàn toàn nội dung của 7 khu trên trong lúc hiển thị, đúng như
  // hành vi chuyển chế độ hiện có của trang).
  C: {
    name: CEMETERY_ZONES[7].name,
    x: 60,
    y: 40,
    width: 640,
    height: 660,
    cols: 12,
    rows: 12,
    gap: 8,
  },
};

// Thông tin mặc định (giá tham khảo/diện tích/loại lô/giới thiệu) theo từng
// khu — dùng chung cho cả trang khách hàng lẫn trang quản trị để tránh lặp
// code và tránh sót khu khi thêm khu mới.
export interface ZoneMeta {
  basePrice: number;
  area: number;
  plotType: "single" | "family";
  size: string;
  blurb: string;
}

export const ZONE_META: Record<string, ZoneMeta> = {
  A: {
    basePrice: 65000000,
    area: 4.5,
    plotType: "single",
    size: "2.0 x 2.0 m",
    blurb:
      "Khu A có không gian trang trọng, mật độ thoáng và phù hợp với gia đình muốn chọn vị trí cao cấp.",
  },
  B: {
    basePrice: 45000000,
    area: 3.5,
    plotType: "single",
    size: "2.0 x 2.0 m",
    blurb:
      "Khu B cân bằng giữa chi phí và vị trí, phù hợp nhu cầu chọn lô ổn định, dễ tiếp cận.",
  },
  D: {
    basePrice: 32000000,
    area: 3,
    plotType: "single",
    size: "1.5 x 2.0 m",
    blurb:
      "Khu D có mức giá dễ tiếp cận, phù hợp gia đình muốn ưu tiên chi phí nhưng vẫn đảm bảo lối đi rõ ràng.",
  },
  E: {
    basePrice: 28000000,
    area: 3,
    plotType: "single",
    size: "1.5 x 2.0 m",
    blurb:
      "Khu E dành cho mộ cải táng, quy trình di dời/an táng lại được hỗ trợ đúng theo nghi thức truyền thống.",
  },
  F: {
    basePrice: 24000000,
    area: 2.4,
    plotType: "single",
    size: "1.2 x 2.0 m",
    blurb:
      "Khu F mật độ cao, diện tích mỗi lô nhỏ gọn, mức giá tối ưu cho ngân sách vừa phải.",
  },
  G: {
    basePrice: 36000000,
    area: 3.2,
    plotType: "single",
    size: "1.6 x 2.0 m",
    blurb:
      "Khu G là khu mở rộng mới, không gian rộng rãi, còn nhiều lô đẹp để lựa chọn vị trí.",
  },
  H: {
    basePrice: 30000000,
    area: 3,
    plotType: "single",
    size: "1.5 x 2.0 m",
    blurb:
      "Khu H bố trí các mộ đơn lẻ, phù hợp nhu cầu an táng cá nhân với chi phí hợp lý.",
  },
  C: {
    basePrice: 120000000,
    area: 12,
    plotType: "family",
    size: "3.0 x 4.0 m",
    blurb:
      "Khu C dành cho lô gia tộc, diện tích rộng hơn, thuận tiện quy tụ nhiều thành viên trong cùng gia đình.",
  },
};

export function getCemeteryZoneCode(
  plotCode: string,
  zoneCode?: string,
  zoneName?: string,
) {
  const explicit = zoneCode?.toUpperCase();
  if (explicit && CEMETERY_ZONE_LAYOUT[explicit]) return explicit;
  const fromCode = plotCode.match(/^[A-H]/i)?.[0]?.toUpperCase();
  if (fromCode && CEMETERY_ZONE_LAYOUT[fromCode]) return fromCode;
  const fromName = zoneName?.match(/Khu\s+([A-H])/i)?.[1]?.toUpperCase();
  return fromName && CEMETERY_ZONE_LAYOUT[fromName] ? fromName : "A";
}

// Mỗi khu giờ là một lưới đều đơn giản (không còn khái niệm "dải trên/giữa/
// dưới" dùng chung nhiều khu như phiên bản cũ) — công thức toạ độ vì vậy
// cũng đơn giản hơn hẳn. Vượt quá số hàng/cột khai báo sẽ tự cuộn (modulo)
// thay vì tràn ra ngoài khung khu.
export function getCemeteryCoordinates(
  item: MapCoordinateInput,
  plotCode: string,
  zoneCode: string,
) {
  const layout = CEMETERY_ZONE_LAYOUT[zoneCode] || CEMETERY_ZONE_LAYOUT.A;
  const [, rowPart, plotPart] =
    plotCode.match(/^[A-H]-(\d{2})-(\d{3})$/i) || [];
  const row = Number(item.rowCode || rowPart || 1);
  const col = Number(item.plotNumber || plotPart || 1);

  const width = (layout.width - layout.gap * (layout.cols - 1)) / layout.cols;
  const height = (layout.height - layout.gap * (layout.rows - 1)) / layout.rows;
  const localCol = (((col - 1) % layout.cols) + layout.cols) % layout.cols;
  const localRow = (((row - 1) % layout.rows) + layout.rows) % layout.rows;

  return {
    x: Number((layout.x + localCol * (width + layout.gap)).toFixed(2)),
    y: Number((layout.y + localRow * (height + layout.gap)).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    rowCode: String(row).padStart(2, "0"),
    plotNumber: col,
  };
}
