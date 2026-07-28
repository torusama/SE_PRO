interface ZoneLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  gap: number;
  groups?: {
    cols: number;
    rows: number;
    gap: number;
  };
}

// Keep these canonical customer-map coordinates aligned with
// frontend/src/lib/cemeteryMapLayout.ts and cemeteryMapVisuals.ts.
const ZONE_LAYOUT: Record<string, ZoneLayout> = {
  A: { x: 100, y: 60, width: 330, height: 250, cols: 6, rows: 7, gap: 6 },
  B: { x: 490, y: 60, width: 330, height: 250, cols: 7, rows: 6, gap: 6 },
  D: { x: 100, y: 380, width: 330, height: 250, cols: 6, rows: 8, gap: 5 },
  E: { x: 490, y: 380, width: 330, height: 250, cols: 7, rows: 7, gap: 5 },
  F: { x: 100, y: 930, width: 330, height: 250, cols: 8, rows: 6, gap: 5 },
  G: { x: 490, y: 930, width: 330, height: 250, cols: 6, rows: 7, gap: 6 },
  H: { x: 100, y: 1250, width: 330, height: 250, cols: 7, rows: 6, gap: 6 },
  C: {
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

const ENTRANCES = {
  main: { x: 460, y: 1560 },
  secondary: { x: 1310, y: 1560 },
} as const;

const NEAR_MAX_DISTANCE = 420;
const MODERATE_MAX_DISTANCE = 800;

export interface PlotEntranceAccess {
  nearestEntrance: 'main' | 'secondary' | null;
  entranceProximity: 'near' | 'moderate' | 'far' | null;
  entranceDistanceMapUnits: number | null;
}

export function calculatePlotEntranceAccess(input: {
  plotCode: string;
  zoneName?: string | null;
  rowNumber?: string | null;
  columnNumber?: string | null;
}): PlotEntranceAccess {
  const codeParts = input.plotCode.match(/^([A-H])-(\d{2})-(\d{3})$/i);
  const zoneCode =
    codeParts?.[1]?.toUpperCase() ??
    input.zoneName?.match(/Khu\s+([A-H])/i)?.[1]?.toUpperCase();
  const layout = zoneCode ? ZONE_LAYOUT[zoneCode] : undefined;
  if (!layout) return emptyAccess();

  const row = Number(input.rowNumber || codeParts?.[2] || 1);
  const column = Number(input.columnNumber || codeParts?.[3] || 1);
  if (!Number.isFinite(row) || !Number.isFinite(column)) return emptyAccess();

  const localColumn =
    (((column - 1) % layout.cols) + layout.cols) % layout.cols;
  const localRow = (((row - 1) % layout.rows) + layout.rows) % layout.rows;
  const cell = layout.groups
    ? groupedCell(layout, localColumn, localRow)
    : regularCell(layout, localColumn, localRow);
  const centerX = cell.x + cell.width / 2;
  const centerY = cell.y + cell.height / 2;
  const nearest = Object.entries(ENTRANCES)
    .map(([entrance, point]) => ({
      entrance: entrance as 'main' | 'secondary',
      distance: Math.hypot(centerX - point.x, centerY - point.y),
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return {
    nearestEntrance: nearest.entrance,
    entranceDistanceMapUnits: Number(nearest.distance.toFixed(2)),
    entranceProximity:
      nearest.distance <= NEAR_MAX_DISTANCE
        ? 'near'
        : nearest.distance <= MODERATE_MAX_DISTANCE
          ? 'moderate'
          : 'far',
  };
}

function regularCell(layout: ZoneLayout, column: number, row: number) {
  const width = (layout.width - layout.gap * (layout.cols - 1)) / layout.cols;
  const height = (layout.height - layout.gap * (layout.rows - 1)) / layout.rows;
  return {
    x: layout.x + column * (width + layout.gap),
    y: layout.y + row * (height + layout.gap),
    width,
    height,
  };
}

function groupedCell(layout: ZoneLayout, column: number, row: number) {
  const groups = layout.groups!;
  const columnsPerGroup = layout.cols / groups.cols;
  const rowsPerGroup = layout.rows / groups.rows;
  const groupWidth =
    (layout.width - groups.gap * (groups.cols - 1)) / groups.cols;
  const groupHeight =
    (layout.height - groups.gap * (groups.rows - 1)) / groups.rows;
  const width =
    (groupWidth - layout.gap * (columnsPerGroup - 1)) / columnsPerGroup;
  const height = (groupHeight - layout.gap * (rowsPerGroup - 1)) / rowsPerGroup;
  const columnGroup = Math.floor(column / columnsPerGroup);
  const rowGroup = Math.floor(row / rowsPerGroup);
  return {
    x:
      layout.x +
      columnGroup * (groupWidth + groups.gap) +
      (column % columnsPerGroup) * (width + layout.gap),
    y:
      layout.y +
      rowGroup * (groupHeight + groups.gap) +
      (row % rowsPerGroup) * (height + layout.gap),
    width,
    height,
  };
}

function emptyAccess(): PlotEntranceAccess {
  return {
    nearestEntrance: null,
    entranceProximity: null,
    entranceDistanceMapUnits: null,
  };
}
