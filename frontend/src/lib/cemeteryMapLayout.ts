export interface MapCoordinateInput {
  rowCode?: string;
  plotNumber?: number | string;
}

// 8 khu thật: 7 khu mộ đơn (A,B,D,E,F,G,H — bên TRÁI bản đồ) + Khu C dành
// cho lô gia tộc (bên PHẢI bản đồ, chia thành 4 cụm C1-C4 để nhiều gia tộc
// khác nhau có khu vực riêng, không dồn chung một khối).
export const CEMETERY_ZONES = [
  {
    key: "A",
    name: "Khu A - Cao cấp",
    dot: "#00b89e",
    labelX: 265,
    labelY: 44,
    mode: "single",
  },
  {
    key: "B",
    name: "Khu B - Tiêu chuẩn",
    dot: "#c9a84c",
    labelX: 655,
    labelY: 44,
    mode: "single",
  },
  {
    key: "D",
    name: "Khu D - Bình dân",
    dot: "#4da6ff",
    labelX: 265,
    labelY: 364,
    mode: "single",
  },
  {
    key: "E",
    name: "Khu E - Cải táng",
    dot: "#00b4d8",
    labelX: 655,
    labelY: 364,
    mode: "single",
  },
  {
    key: "F",
    name: "Khu F - Mật độ cao",
    dot: "#52b788",
    labelX: 265,
    labelY: 914,
    mode: "single",
  },
  {
    key: "G",
    name: "Khu G - Mở rộng",
    dot: "#2d9d6f",
    labelX: 655,
    labelY: 914,
    mode: "single",
  },
  {
    key: "H",
    name: "Khu H - Mộ đơn",
    dot: "#f4a340",
    labelX: 265,
    labelY: 1234,
    mode: "single",
  },
  {
    key: "C",
    name: "Khu C - Lô gia tộc",
    dot: "#7b6bcc",
    labelX: 1310,
    labelY: 44,
    mode: "cluster",
  },
] as const;

export interface ZoneGroups {
  cols: number; // số cụm chia theo chiều ngang
  rows: number; // số cụm chia theo chiều dọc
  gap: number; // khoảng trống (đường đi) giữa các cụm, LỚN hơN hẳn khoảng
  // cách giữa 2 ô mộ thường (gap) để tách bạch rõ ràng
}

export interface ZoneLayout {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  gap: number;
  groups?: ZoneGroups;
}

// ------------------------------------------------------------------
// BỐ CỤC TỔNG MẶT BẰNG
// ------------------------------------------------------------------
// - Bên TRÁI: 7 khu mộ đơn, xếp 2 cột x 4 hàng, có Khu Tâm Linh chen giữa
//   hàng 2 và hàng 3, đường chính chạy dọc SÁT BÊN PHẢI của khối này,
//   Cổng chính nằm dưới cùng khối này.
// - Bên PHẢI (cách một khoảng nối/đường dẫn): khối Khu C - lô gia tộc,
//   chia thành 4 cụm C1→C4 xếp chồng dọc, MỖI cụm là 1 khu riêng biệt có
//   khoảng trống bao quanh (không dính nhau), Cổng phụ nằm dưới cùng khối
//   này.
// - Người dùng kéo/lướt ngang qua lại giữa 2 khối thay vì bấm nút chuyển
//   hẳn nội dung — cả 2 khối luôn hiển thị cùng lúc trên 1 bản đồ.
//
// Khoảng cách giữa các khối/hàng/cột đều được nới rộng (>= 60-80px) và lớp
// nền trang trí (xem cemeteryMapVisuals.ts) chỉ phình ra ĐÚNG NGOÀI phần
// khoảng trống này — đã kiểm chứng bằng toạ độ để không đè lên đường xá.
export const CEMETERY_ZONE_LAYOUT: Record<string, ZoneLayout> = {
  A: {
    name: CEMETERY_ZONES[0].name,
    x: 100,
    y: 60,
    width: 330,
    height: 250,
    cols: 6,
    rows: 7,
    gap: 6,
  }, // 42 mộ
  B: {
    name: CEMETERY_ZONES[1].name,
    x: 490,
    y: 60,
    width: 330,
    height: 250,
    cols: 7,
    rows: 6,
    gap: 6,
  }, // 42 mộ
  D: {
    name: CEMETERY_ZONES[2].name,
    x: 100,
    y: 380,
    width: 330,
    height: 250,
    cols: 6,
    rows: 8,
    gap: 5,
  }, // 48 mộ
  E: {
    name: CEMETERY_ZONES[3].name,
    x: 490,
    y: 380,
    width: 330,
    height: 250,
    cols: 7,
    rows: 7,
    gap: 5,
  }, // 49 mộ
  F: {
    name: CEMETERY_ZONES[4].name,
    x: 100,
    y: 930,
    width: 330,
    height: 250,
    cols: 8,
    rows: 6,
    gap: 5,
  }, // 48 mộ
  G: {
    name: CEMETERY_ZONES[5].name,
    x: 490,
    y: 930,
    width: 330,
    height: 250,
    cols: 6,
    rows: 7,
    gap: 6,
  }, // 42 mộ
  H: {
    name: CEMETERY_ZONES[6].name,
    x: 100,
    y: 1250,
    width: 330,
    height: 250,
    cols: 7,
    rows: 6,
    gap: 6,
  }, // 42 mộ

  // Khu C: 10 cột x 20 hàng, chia thành 4 cụm (C1-C4) theo chiều dọc, mỗi
  // cụm cách nhau 80px (đường nội bộ) -> mỗi cụm 10x5 = 50 lô gia tộc,
  // tổng 200 lô, đủ chỗ cho nhiều gia tộc khác nhau chọn khu riêng.
  C: {
    name: CEMETERY_ZONES[7].name,
    x: 1000,
    y: 60,
    width: 620,
    height: 1440,
    cols: 10,
    rows: 20,
    gap: 8,
    groups: { cols: 1, rows: 4, gap: 80 },
  },
};

// Thông tin mặc định (giá tham khảo/diện tích/loại lô/giới thiệu) theo từng
// khu — dùng chung cho cả trang khách hàng lẫn trang quản trị.
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
      "Khu C dành cho lô gia tộc, chia thành nhiều cụm riêng biệt (C1-C4) để mỗi gia tộc có khu vực quây quần độc lập.",
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

// Xác định lô nằm ở cụm nào (0-based) theo trục dọc/ngang, dùng cho cả toạ
// độ lẫn hiển thị badge "C1..C4".
export function getGroupIndex(zoneCode: string, row: number, col: number) {
  const layout = CEMETERY_ZONE_LAYOUT[zoneCode];
  if (!layout?.groups) return 0;
  const { cols: gCols, rows: gRows } = layout.groups;
  const colsPerGroup = layout.cols / gCols;
  const rowsPerGroup = layout.rows / gRows;
  const localCol = (((col - 1) % layout.cols) + layout.cols) % layout.cols;
  const localRow = (((row - 1) % layout.rows) + layout.rows) % layout.rows;
  const colGroupIndex = Math.floor(localCol / colsPerGroup);
  const rowGroupIndex = Math.floor(localRow / rowsPerGroup);
  return rowGroupIndex * gCols + colGroupIndex;
}

// Mỗi khu là một lưới đều (hoặc một lưới được chia thành nhiều CỤM tách
// biệt qua trường `groups`, dùng cho Khu C). Vượt quá số hàng/cột khai báo
// sẽ tự cuộn (modulo) thay vì tràn ra ngoài khung khu.
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
  const localCol = (((col - 1) % layout.cols) + layout.cols) % layout.cols;
  const localRow = (((row - 1) % layout.rows) + layout.rows) % layout.rows;

  if (layout.groups) {
    const { cols: gCols, rows: gRows, gap: groupGap } = layout.groups;
    const colsPerGroup = layout.cols / gCols;
    const rowsPerGroup = layout.rows / gRows;
    const groupWidth = (layout.width - groupGap * (gCols - 1)) / gCols;
    const groupHeight = (layout.height - groupGap * (gRows - 1)) / gRows;
    const cellWidth =
      (groupWidth - layout.gap * (colsPerGroup - 1)) / colsPerGroup;
    const cellHeight =
      (groupHeight - layout.gap * (rowsPerGroup - 1)) / rowsPerGroup;
    const colGroupIndex = Math.floor(localCol / colsPerGroup);
    const rowGroupIndex = Math.floor(localRow / rowsPerGroup);
    const colInGroup = localCol % colsPerGroup;
    const rowInGroup = localRow % rowsPerGroup;
    const x =
      layout.x +
      colGroupIndex * (groupWidth + groupGap) +
      colInGroup * (cellWidth + layout.gap);
    const y =
      layout.y +
      rowGroupIndex * (groupHeight + groupGap) +
      rowInGroup * (cellHeight + layout.gap);
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      width: Number(cellWidth.toFixed(2)),
      height: Number(cellHeight.toFixed(2)),
      rowCode: String(row).padStart(2, "0"),
      plotNumber: col,
    };
  }

  const width = (layout.width - layout.gap * (layout.cols - 1)) / layout.cols;
  const height = (layout.height - layout.gap * (layout.rows - 1)) / layout.rows;
  return {
    x: Number((layout.x + localCol * (width + layout.gap)).toFixed(2)),
    y: Number((layout.y + localRow * (height + layout.gap)).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    rowCode: String(row).padStart(2, "0"),
    plotNumber: col,
  };
}
