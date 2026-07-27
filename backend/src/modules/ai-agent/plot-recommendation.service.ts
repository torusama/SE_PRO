import { BadRequestException, Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { PlotAdjacencyService } from '../plots/plot-adjacency.service';
import { RecommendPlotsDto } from './dto/recommend-plots.dto';
import { BaziRuleService } from './bazi-rule.service';
import { PlotRankerClient } from './plot-ranker.client';
import {
  AgentRequirements,
  PlotCandidate,
  RecommendationOption,
  RecommendationResult,
} from './types/agent-response.types';

interface PlotRow extends QueryResultRow {
  id: number;
  plotCode: string;
  zoneId: number;
  zoneName: string;
  price: number | string;
  status: string;
  direction: string | null;
  plotType: string;
  areaSqm: number | string | null;
  rowNumber: string | null;
  columnNumber: string | null;
  mapX: number | string | null;
  mapY: number | string | null;
  mapWidth: number | string | null;
  mapHeight: number | string | null;
}

interface ServiceRow extends QueryResultRow {
  id: number;
  name: string;
  description: string | null;
  basePrice: number | string;
  unit: string;
  category: string;
}

@Injectable()
export class PlotRecommendationService {
  private readonly candidateLimit = 100;
  private readonly groupLimit = 20;

  constructor(
    private readonly database: DatabaseService,
    private readonly adjacency: PlotAdjacencyService,
    private readonly bazi: BaziRuleService,
    private readonly ranker?: PlotRankerClient,
  ) {}

  async recommend(dto: RecommendPlotsDto): Promise<RecommendationResult> {
    if (dto.budgetMin && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException(
        'budgetMin must be less than or equal to budgetMax',
      );
    }
    if (
      dto.minAreaSqm !== undefined &&
      dto.maxAreaSqm !== undefined &&
      dto.minAreaSqm > dto.maxAreaSqm
    ) {
      throw new BadRequestException(
        'minAreaSqm must be less than or equal to maxAreaSqm',
      );
    }

    const candidates = await this.searchAvailablePlots(dto);
    const optionGroups = this.buildOptionGroups(
      candidates,
      dto.numberOfPlots,
      dto.needAdjacent ?? dto.numberOfPlots > 1,
      dto.budgetMax,
    );
    let recommendations = optionGroups
      .map((plots, index) => this.toRecommendation(plots, dto, index))
      .sort((a, b) => b.score - a.score || a.plotCost - b.plotCost)
      .slice(0, 20);

    let rankerVersion = 'rule-based-v1';
    let fallbackUsed = true;
    const prediction = await this.ranker?.predict(
      recommendations.map((option) => ({
        optionId: option.optionId,
        features: this.buildFeatures(option, dto),
      })),
    );
    if (prediction) {
      const scores = new Map(
        prediction.predictions.map((item) => [
          item.optionId,
          Math.max(0, Math.min(1, Number(item.score))),
        ]),
      );
      recommendations = recommendations
        .map((option) => ({
          ...option,
          score: scores.get(option.optionId) ?? option.score,
        }))
        .sort((a, b) => b.score - a.score || a.plotCost - b.plotCost);
      rankerVersion = prediction.modelVersion;
      fallbackUsed = false;
    }
    recommendations = recommendations.slice(0, 3).map((option, index) => ({
      ...option,
      optionId: `OPT-${String(index + 1).padStart(3, '0')}`,
    }));

    const baziSuggestion = dto.birthDate
      ? this.bazi.suggest({
          birthDate: dto.birthDate,
          birthTime: dto.birthTime,
          gender: dto.gender,
        })
      : undefined;

    return {
      requirements: { ...dto },
      recommendations,
      suggestedServices: [],
      baziSuggestion,
      rankerVersion,
      fallbackUsed,
    };
  }

  async browseAvailablePlots(
    requirements: AgentRequirements,
  ): Promise<RecommendationResult> {
    const numberOfPlots = requirements.numberOfPlots ?? 1;
    if (numberOfPlots < 1 || numberOfPlots > 10) {
      throw new BadRequestException('numberOfPlots must be between 1 and 10');
    }
    if (
      requirements.minAreaSqm !== undefined &&
      requirements.maxAreaSqm !== undefined &&
      requirements.minAreaSqm > requirements.maxAreaSqm
    ) {
      throw new BadRequestException(
        'minAreaSqm must be less than or equal to maxAreaSqm',
      );
    }

    const query: RecommendPlotsDto = {
      ...requirements,
      budgetMax: Number.MAX_SAFE_INTEGER,
      numberOfPlots,
      needAdjacent: requirements.needAdjacent ?? numberOfPlots > 1,
    };
    const candidates = await this.searchAvailablePlots(query);
    const optionGroups = this.buildOptionGroups(
      candidates,
      numberOfPlots,
      query.needAdjacent ?? numberOfPlots > 1,
      Number.MAX_SAFE_INTEGER,
    );
    const recommendations = optionGroups
      .map((plots, index) => this.toRecommendation(plots, query, index, false))
      .sort((a, b) => b.score - a.score || a.plotCost - b.plotCost)
      .slice(0, 3)
      .map((option, index) => ({
        ...option,
        optionId: `OPT-${String(index + 1).padStart(3, '0')}`,
      }));

    return {
      requirements: {
        ...requirements,
        numberOfPlots,
        needAdjacent: query.needAdjacent,
      },
      recommendations,
      suggestedServices: [],
      rankerVersion: 'availability-browse-v1',
      fallbackUsed: false,
    };
  }

  async searchAvailablePlots(dto: RecommendPlotsDto) {
    const params: unknown[] = [];
    const conditions = [
      `status = 'available'`,
      `price IS NOT NULL`,
      `price > 0`,
    ];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    conditions.push(`price <= ${add(dto.budgetMax)}`);
    if (dto.budgetMin !== undefined) {
      conditions.push(`price >= ${add(dto.budgetMin)}`);
    }
    if (dto.preferredZone) {
      conditions.push(`zone_name ILIKE ${add(`%${dto.preferredZone}%`)}`);
    }
    if (dto.preferredDirection) {
      conditions.push(
        `COALESCE(direction, '') ILIKE ${add(`%${dto.preferredDirection}%`)}`,
      );
    }
    if (dto.plotType) {
      conditions.push(`plot_type = ${add(dto.plotType)}`);
    }
    if (dto.minAreaSqm !== undefined) {
      conditions.push(`area_sqm >= ${add(dto.minAreaSqm)}`);
    }
    if (dto.maxAreaSqm !== undefined) {
      conditions.push(`area_sqm <= ${add(dto.maxAreaSqm)}`);
    }
    const limitParam = add(this.candidateLimit);

    const rows = await this.database.query<PlotRow>(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
              zone_name AS "zoneName", price::float, status, direction,
              plot_type AS "plotType", area_sqm::float AS "areaSqm",
              row_number AS "rowNumber", column_number AS "columnNumber",
              map_x::float AS "mapX", map_y::float AS "mapY",
              map_width::float AS "mapWidth", map_height::float AS "mapHeight"
       FROM vw_plots_map
       WHERE ${conditions.join(' AND ')}
       ORDER BY price ASC, zone_name ASC, row_number ASC, column_number ASC
       LIMIT ${limitParam}`,
      params,
    );
    return rows.map((row) => this.normalizePlot(row));
  }

  async getServiceSuggestions(limit = 6) {
    const rows = await this.database.query<ServiceRow>(
      `SELECT service_type_id AS id, name, description,
              base_price::float AS "basePrice", unit, category
       FROM service_types
       WHERE is_active = TRUE AND is_deleted = FALSE
       ORDER BY sort_order, base_price
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 20)],
    );
    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      basePrice: Number(row.basePrice),
    }));
  }

  async findAdjacentPlotGroups(
    candidatePlotIds: number[],
    groupSize: number,
    maxGroups = 20,
  ) {
    const uniqueIds = [...new Set(candidatePlotIds)].slice(
      0,
      this.candidateLimit,
    );
    if (groupSize < 2 || groupSize > 10 || uniqueIds.length < groupSize) {
      throw new BadRequestException('Invalid adjacent group request');
    }
    const rows = await this.database.query<PlotRow>(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
              zone_name AS "zoneName", price::float, status, direction,
              plot_type AS "plotType", area_sqm::float AS "areaSqm",
              row_number AS "rowNumber", column_number AS "columnNumber",
              map_x::float AS "mapX", map_y::float AS "mapY",
              map_width::float AS "mapWidth", map_height::float AS "mapHeight"
       FROM vw_plots_map
       WHERE plot_id = ANY($1::int[]) AND status = 'available'
       ORDER BY plot_id`,
      [uniqueIds],
    );
    const candidates = rows.map((row) => this.normalizePlot(row));
    const groups = this.buildOptionGroups(
      candidates,
      groupSize,
      true,
      Number.MAX_SAFE_INTEGER,
    ).slice(0, Math.min(Math.max(maxGroups, 1), this.groupLimit));
    return {
      groups: groups.map((plots) => {
        const validation = this.adjacency.validateAdjacent(
          plots.map((plot) => this.toPosition(plot)),
        );
        return {
          plotIds: plots.map((plot) => plot.id),
          adjacencyMethod: validation.method,
          totalPrice: this.totalPrice(plots),
          totalAreaSqm: plots.reduce(
            (sum, plot) => sum + Number(plot.areaSqm ?? 0),
            0,
          ),
        };
      }),
    };
  }

  async estimateTotalCost(
    plotIds: number[],
    services: Array<{ serviceTypeId: number; quantity: number }> = [],
  ) {
    if (!plotIds.length || services.some((item) => item.quantity < 1)) {
      throw new BadRequestException('Invalid plot or service quantity');
    }
    const plots = await this.database.query<{ price: number | string }>(
      `SELECT price::float
       FROM plots
       WHERE plot_id = ANY($1::int[]) AND is_deleted = FALSE`,
      [plotIds],
    );
    if (plots.length !== new Set(plotIds).size) {
      throw new BadRequestException('One or more plots do not exist');
    }
    const plotCost = plots.reduce((sum, plot) => sum + Number(plot.price), 0);
    let serviceCost = 0;
    if (services.length) {
      const ids = services.map((item) => item.serviceTypeId);
      const rows = await this.database.query<{
        id: number;
        basePrice: number | string;
      }>(
        `SELECT service_type_id AS id, base_price::float AS "basePrice"
         FROM service_types
         WHERE service_type_id = ANY($1::int[])
           AND is_active = TRUE AND is_deleted = FALSE`,
        [ids],
      );
      if (rows.length !== new Set(ids).size) {
        throw new BadRequestException('One or more services are unavailable');
      }
      const prices = new Map(
        rows.map((row) => [Number(row.id), Number(row.basePrice)]),
      );
      serviceCost = services.reduce(
        (sum, item) =>
          sum + (prices.get(item.serviceTypeId) ?? 0) * item.quantity,
        0,
      );
    }
    return {
      plotCost,
      serviceCost,
      estimatedTotal: plotCost + serviceCost,
      currency: 'VND' as const,
    };
  }

  private buildOptionGroups(
    candidates: PlotCandidate[],
    groupSize: number,
    needAdjacent: boolean,
    budgetMax: number,
  ) {
    if (groupSize === 1) {
      return candidates
        .filter((plot) => plot.price <= budgetMax)
        .slice(0, this.groupLimit)
        .map((plot) => [plot]);
    }
    if (!needAdjacent) {
      const groups: PlotCandidate[][] = [];
      for (
        let start = 0;
        start + groupSize <= candidates.length &&
        groups.length < this.groupLimit;
        start += 1
      ) {
        const group = candidates.slice(start, start + groupSize);
        if (this.totalPrice(group) <= budgetMax) groups.push(group);
      }
      return groups;
    }

    const results: PlotCandidate[][] = [];
    const seen = new Set<string>();
    const expand = (group: PlotCandidate[], startIndex: number) => {
      if (results.length >= this.groupLimit) return;
      if (group.length === groupSize) {
        if (this.totalPrice(group) > budgetMax) return;
        try {
          this.adjacency.validateAdjacent(
            group.map((plot) => this.toPosition(plot)),
          );
          const key = group
            .map((plot) => plot.id)
            .sort((a, b) => a - b)
            .join(',');
          if (!seen.has(key)) {
            seen.add(key);
            results.push(group);
          }
        } catch {
          // Connected validation is authoritative; invalid groups are skipped.
        }
        return;
      }
      for (
        let index = startIndex;
        index < candidates.length && results.length < this.groupLimit;
        index += 1
      ) {
        const next = candidates[index];
        if (
          group.length &&
          !group.some((plot) => this.areAdjacent(plot, next))
        ) {
          continue;
        }
        const nextGroup = [...group, next];
        if (this.totalPrice(nextGroup) <= budgetMax) {
          expand(nextGroup, index + 1);
        }
      }
    };
    for (
      let index = 0;
      index < candidates.length && results.length < this.groupLimit;
      index += 1
    ) {
      expand([candidates[index]], index + 1);
    }
    return results;
  }

  private areAdjacent(first: PlotCandidate, second: PlotCandidate) {
    try {
      return this.adjacency.validateAdjacent([
        this.toPosition(first),
        this.toPosition(second),
      ]).valid;
    } catch {
      return false;
    }
  }

  private toRecommendation(
    plots: PlotCandidate[],
    dto: RecommendPlotsDto,
    index: number,
    budgetSpecified = true,
  ): RecommendationOption {
    const plotCost = this.totalPrice(plots);
    const totalAreaSqm = plots.reduce(
      (sum, plot) => sum + Number(plot.areaSqm ?? 0),
      0,
    );
    const directions = [
      ...new Set(
        plots
          .map((plot) => plot.direction)
          .filter((value): value is string => !!value),
      ),
    ];
    const zoneMatches =
      !dto.preferredZone ||
      plots.every((plot) =>
        plot.zoneName.toLowerCase().includes(dto.preferredZone!.toLowerCase()),
      );
    const directionMatches =
      !dto.preferredDirection ||
      directions.some((direction) =>
        direction.toLowerCase().includes(dto.preferredDirection!.toLowerCase()),
      );
    const budgetScore = budgetSpecified
      ? Math.min(1, plotCost / dto.budgetMax)
      : 0.8;
    const score = Number(
      (
        budgetScore * 0.3 +
        (zoneMatches ? 1 : 0) * 0.2 +
        (directionMatches ? 1 : 0) * 0.15 +
        (plots.length > 1 ? 1 : 0.7) * 0.15 +
        (plots.every((plot) => !dto.plotType || plot.plotType === dto.plotType)
          ? 1
          : 0) *
          0.1 +
        (plots.length === dto.numberOfPlots ? 1 : 0) * 0.1
      ).toFixed(4),
    );
    const reasons = [
      budgetSpecified
        ? `Tổng giá ${plotCost.toLocaleString('vi-VN')} VND nằm trong ngân sách`
        : `Giá niêm yết ${plotCost.toLocaleString('vi-VN')} VND từ dữ liệu lô đang trống`,
      plots.length > 1
        ? `${plots.length} lô tạo thành một nhóm liền kề hợp lệ`
        : 'Lô đang ở trạng thái sẵn sàng',
      ...(plots.every((plot) => plot.plotType === 'family')
        ? ['Đúng loại lô family dành cho gia đình hoặc dòng tộc']
        : []),
      ...(zoneMatches && dto.preferredZone
        ? [`Đúng khu vực ${dto.preferredZone}`]
        : []),
      ...(directionMatches && dto.preferredDirection
        ? [`Có hướng ${dto.preferredDirection} theo yêu cầu`]
        : []),
    ];
    const tradeOffs = [
      ...(!zoneMatches && dto.preferredZone
        ? [`Không đúng hoàn toàn khu vực ${dto.preferredZone}`]
        : []),
      ...(!directionMatches && dto.preferredDirection
        ? [`Không có hướng ${dto.preferredDirection}`]
        : []),
      ...(budgetSpecified && plotCost > dto.budgetMax * 0.95
        ? ['Tổng giá gần sát ngân sách tối đa']
        : []),
    ];

    return {
      optionId: `OPT-${String(index + 1).padStart(3, '0')}`,
      plotIds: plots.map((plot) => plot.id),
      plotCodes: plots.map((plot) => plot.plotCode),
      plots,
      score,
      plotCost,
      serviceCost: 0,
      estimatedTotal: plotCost,
      currency: 'VND',
      zoneName: [...new Set(plots.map((plot) => plot.zoneName))].join(', '),
      directions,
      totalAreaSqm,
      isAdjacent: plots.length > 1,
      reasons,
      tradeOffs,
      highlightPlotIds: plots.map((plot) => plot.id),
    };
  }

  private normalizePlot(row: PlotRow): PlotCandidate {
    const numberOrNull = (value: number | string | null) =>
      value === null || value === undefined ? null : Number(value);
    return {
      ...row,
      id: Number(row.id),
      zoneId: Number(row.zoneId),
      price: Number(row.price),
      areaSqm: numberOrNull(row.areaSqm),
      mapX: numberOrNull(row.mapX),
      mapY: numberOrNull(row.mapY),
      mapWidth: numberOrNull(row.mapWidth),
      mapHeight: numberOrNull(row.mapHeight),
    };
  }

  private buildFeatures(option: RecommendationOption, dto: RecommendPlotsDto) {
    const zoneMatch =
      !dto.preferredZone ||
      option.zoneName.toLowerCase().includes(dto.preferredZone.toLowerCase());
    const directionMatch =
      !dto.preferredDirection ||
      option.directions.some((direction) =>
        direction.toLowerCase().includes(dto.preferredDirection!.toLowerCase()),
      );
    const areaTarget =
      dto.minAreaSqm !== undefined || dto.maxAreaSqm !== undefined;
    const areaMatch =
      !areaTarget ||
      ((dto.minAreaSqm === undefined ||
        option.totalAreaSqm >= dto.minAreaSqm) &&
        (dto.maxAreaSqm === undefined ||
          option.totalAreaSqm <= dto.maxAreaSqm));
    return {
      budget_match_score: Math.min(1, option.estimatedTotal / dto.budgetMax),
      zone_match: zoneMatch ? 1 : 0,
      preferred_direction_match: directionMatch ? 1 : 0,
      bazi_direction_match: 0,
      adjacency_score: option.isAdjacent ? 1 : dto.numberOfPlots === 1 ? 1 : 0,
      plot_type_match: option.plots.every(
        (plot) => !dto.plotType || plot.plotType === dto.plotType,
      )
        ? 1
        : 0,
      number_of_plots_match:
        option.plotIds.length === dto.numberOfPlots ? 1 : 0,
      area_match_score: areaMatch ? 1 : 0,
      price_to_budget_ratio: Math.min(1, option.estimatedTotal / dto.budgetMax),
      historical_acceptance_rate: 0,
    };
  }

  private toPosition(plot: PlotCandidate) {
    return {
      id: plot.id,
      code: plot.plotCode,
      zoneId: plot.zoneId,
      rowNumber: plot.rowNumber,
      columnNumber: plot.columnNumber,
      mapX: plot.mapX,
      mapY: plot.mapY,
      mapWidth: plot.mapWidth,
      mapHeight: plot.mapHeight,
    };
  }

  private totalPrice(plots: PlotCandidate[]) {
    return plots.reduce((sum, plot) => sum + plot.price, 0);
  }
}
