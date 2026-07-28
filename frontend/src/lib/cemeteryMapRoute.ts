import {
  CROSS_ROADS,
  MAIN_ROAD,
  MAP_GATE,
  SECONDARY_GATE,
} from "@/lib/cemeteryMapVisuals";

export interface CemeteryRoutePlot {
  plotCode: string;
  zoneCode?: string;
  zoneName: string;
  rowCode: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CemeteryRouteMeta {
  roadX: number;
  rowAisleY: number;
  attachX: number;
  attachY: number;
  gate: typeof MAP_GATE;
  gateLabel: string;
}

function getZoneCode(plot: CemeteryRoutePlot) {
  return (plot.zoneCode || plot.plotCode.split("-")[0] || "").toUpperCase();
}

export function getCemeteryRouteMeta(
  plot: CemeteryRoutePlot,
): CemeteryRouteMeta {
  const centerX = plot.x + plot.width / 2;
  const centerY = plot.y + plot.height / 2;

  if (getZoneCode(plot) === "C") {
    return {
      roadX: SECONDARY_GATE.x,
      rowAisleY: Number((SECONDARY_GATE.y - 30).toFixed(2)),
      attachX: Number(centerX.toFixed(2)),
      attachY: Number(centerY.toFixed(2)),
      gate: SECONDARY_GATE,
      gateLabel: "cổng phụ",
    };
  }

  const useMainRoad = centerX >= 380;
  const roadX = useMainRoad ? MAIN_ROAD.x : -10;
  const rowAisleY = CROSS_ROADS.reduce((closest, road) => {
    const roadY = road.y + road.height / 2;
    return Math.abs(roadY - centerY) < Math.abs(closest - centerY)
      ? roadY
      : closest;
  }, MAP_GATE.y - 30);

  return {
    roadX,
    rowAisleY: Number(rowAisleY.toFixed(2)),
    attachX: Number((useMainRoad ? plot.x + plot.width : plot.x).toFixed(2)),
    attachY: Number(centerY.toFixed(2)),
    gate: MAP_GATE,
    gateLabel: "cổng chính phía Nam",
  };
}

export function getCemeteryRoutePointList(
  plot: CemeteryRoutePlot,
): Array<[number, number]> {
  const route = getCemeteryRouteMeta(plot);
  return [
    [route.gate.x, route.gate.y - 30],
    [route.roadX, route.gate.y - 30],
    [route.roadX, route.rowAisleY],
    [route.attachX, route.rowAisleY],
    [route.attachX, route.attachY],
  ];
}

export function getCemeteryRoutePoints(plot: CemeteryRoutePlot) {
  return getCemeteryRoutePointList(plot)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function buildCemeteryDirection(plot: CemeteryRoutePlot) {
  const route = getCemeteryRouteMeta(plot);
  const turnText =
    route.roadX < plot.x + plot.width / 2
      ? "rẽ phải vào khu lô"
      : "rẽ trái vào khu lô";

  return `Từ ${route.gateLabel}, đi theo đường nội khu đến trục gần ${plot.zoneName}. Sau đó ${turnText}, đi dọc hàng ${plot.rowCode} và dừng cạnh lô ${plot.plotCode}.`;
}
