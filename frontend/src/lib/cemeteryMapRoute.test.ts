import { describe, expect, it } from "vitest";
import { MAP_GATE, SECONDARY_GATE } from "@/lib/cemeteryMapVisuals";
import {
  buildCemeteryDirection,
  getCemeteryRoutePointList,
} from "@/lib/cemeteryMapRoute";

const basePlot = {
  plotCode: "A-02-001",
  zoneCode: "A",
  zoneName: "Khu A - Cao cấp",
  rowCode: "02",
  x: 520,
  y: 280,
  width: 40,
  height: 28,
};

describe("cemetery map route", () => {
  it("starts regular plot routes at the main southern gate", () => {
    const [start] = getCemeteryRoutePointList(basePlot);

    expect(start).toEqual([MAP_GATE.x, MAP_GATE.y - 30]);
    expect(buildCemeteryDirection(basePlot)).toContain(
      "cổng chính phía Nam",
    );
  });

  it("starts family plot routes at the secondary gate", () => {
    const familyPlot = {
      ...basePlot,
      plotCode: "C-01-001",
      zoneCode: "C",
      zoneName: "Khu C - Gia tộc",
    };
    const [start] = getCemeteryRoutePointList(familyPlot);

    expect(start).toEqual([SECONDARY_GATE.x, SECONDARY_GATE.y - 30]);
    expect(buildCemeteryDirection(familyPlot)).toContain("cổng phụ");
  });
});
