import { BadRequestException, Injectable } from '@nestjs/common';

export interface PlotPosition {
  id: number;
  code: string;
  zoneId?: number | null;
  rowNumber?: string | null;
  columnNumber?: string | null;
  mapX?: number | string | null;
  mapY?: number | string | null;
  mapWidth?: number | string | null;
  mapHeight?: number | string | null;
}

export interface PlotAdjacencyResult {
  valid: boolean;
  method: 'map' | 'grid';
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

@Injectable()
export class PlotAdjacencyService {
  private readonly tolerance = 2;

  validateAdjacent(plots: PlotPosition[]): PlotAdjacencyResult {
    if (plots.length < 2) {
      throw new BadRequestException(
        'At least two plots are required for a multi-plot reservation',
      );
    }
    if (new Set(plots.map((plot) => plot.id)).size !== plots.length) {
      throw new BadRequestException('Duplicate plot IDs are not allowed');
    }

    if (plots.every((plot) => this.hasUsableMapData(plot))) {
      if (!this.isConnected(plots, (a, b) => this.rectanglesTouch(a, b))) {
        throw new BadRequestException(
          'Selected plots must be adjacent or near each other',
        );
      }
      return { valid: true, method: 'map' };
    }

    if (plots.every((plot) => this.hasUsableGridData(plot))) {
      if (!this.isConnected(plots, (a, b) => this.gridCellsTouch(a, b))) {
        throw new BadRequestException(
          'Selected plots must be adjacent or near each other',
        );
      }
      return { valid: true, method: 'grid' };
    }

    throw new BadRequestException(
      'Selected plots do not have enough location data to validate adjacency',
    );
  }

  private isConnected(
    plots: PlotPosition[],
    touches: (a: PlotPosition, b: PlotPosition) => boolean,
  ) {
    const seen = new Set<number>([0]);
    const queue = [0];

    while (queue.length) {
      const currentIndex = queue.shift()!;
      for (let index = 0; index < plots.length; index += 1) {
        if (seen.has(index)) continue;
        if (touches(plots[currentIndex], plots[index])) {
          seen.add(index);
          queue.push(index);
        }
      }
    }

    return seen.size === plots.length;
  }

  private rectanglesTouch(a: PlotPosition, b: PlotPosition) {
    const first = this.toRect(a);
    const second = this.toRect(b);
    const horizontalGap = Math.max(
      0,
      Math.max(first.left, second.left) - Math.min(first.right, second.right),
    );
    const verticalGap = Math.max(
      0,
      Math.max(first.top, second.top) - Math.min(first.bottom, second.bottom),
    );

    return horizontalGap <= this.tolerance && verticalGap <= this.tolerance;
  }

  private gridCellsTouch(a: PlotPosition, b: PlotPosition) {
    if (a.zoneId !== b.zoneId) return false;
    const rowA = this.parseGridNumber(a.rowNumber);
    const rowB = this.parseGridNumber(b.rowNumber);
    const colA = this.parseGridNumber(a.columnNumber);
    const colB = this.parseGridNumber(b.columnNumber);
    if ([rowA, rowB, colA, colB].some((value) => value === null)) {
      return false;
    }
    const rowDistance = Math.abs(rowA! - rowB!);
    const columnDistance = Math.abs(colA! - colB!);
    return rowDistance + columnDistance === 1;
  }

  private hasUsableMapData(plot: PlotPosition) {
    const width = this.toNumber(plot.mapWidth);
    const height = this.toNumber(plot.mapHeight);
    return (
      this.toNumber(plot.mapX) !== null &&
      this.toNumber(plot.mapY) !== null &&
      width !== null &&
      width > 0 &&
      height !== null &&
      height > 0
    );
  }

  private hasUsableGridData(plot: PlotPosition) {
    return (
      plot.zoneId !== null &&
      plot.zoneId !== undefined &&
      this.parseGridNumber(plot.rowNumber) !== null &&
      this.parseGridNumber(plot.columnNumber) !== null
    );
  }

  private toRect(plot: PlotPosition): Rect {
    const left = this.toNumber(plot.mapX)!;
    const top = this.toNumber(plot.mapY)!;
    const width = this.toNumber(plot.mapWidth)!;
    const height = this.toNumber(plot.mapHeight)!;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
    };
  }

  private toNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private parseGridNumber(value: string | null | undefined) {
    if (!value) return null;
    const match = value.match(/\d+/);
    if (!match) return null;
    return Number(match[0]);
  }
}
