import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { PlotAdjacencyService } from '../plots/plot-adjacency.service';
import { RecommendPlotsDto } from './dto/recommend-plots.dto';
import { BaziRuleService } from './bazi-rule.service';
import { calculatePlotEntranceAccess } from './cemetery-map-access';
import {
  AgentRequirements,
  PlotCandidate,
  RecommendationExecutionContext,
  RecommendationOption,
  RecommendationResult,
} from './types/agent-response.types';

interface PlotRow extends QueryResultRow {
  id: number;
  plotCode: string;
  zoneId: number;
  zoneCode: string;
  zoneName: string;
  zoneDescription: string | null;
  price: number | string;
  status: string;
  direction: string | null;
  plotType: string;
  areaSqm: number | string | null;
  rowNumber: string | null;
  columnNumber: string | null;
  description: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
  mapX: number | string | null;
  mapY: number | string | null;
  mapWidth: number | string | null;
  mapHeight: number | string | null;
}

const NEAR_ENTRANCE_MAX_DISTANCE = 420;
const MODERATE_ENTRANCE_MAX_DISTANCE = 800;

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
  private readonly logger = new Logger(PlotRecommendationService.name);
  private readonly candidateLimit = 100;
  private readonly groupLimit = 20;

  constructor(
    private readonly database: DatabaseService,
    private readonly adjacency: PlotAdjacencyService,
    private readonly bazi: BaziRuleService,
  ) {}

  async recommend(
    dto: RecommendPlotsDto,
    context?: RecommendationExecutionContext,
  ): Promise<RecommendationResult> {
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
      this.orderCandidatesForGrouping(candidates, dto),
      dto.numberOfPlots,
      dto.needAdjacent ?? dto.numberOfPlots > 1,
      dto.budgetMax,
    );
    let recommendations = optionGroups
      .map((plots, index) => this.toRecommendation(plots, dto, index))
      .sort((left, right) => this.compareRecommendations(left, right, dto))
      .slice(0, 20);

    // This service no longer trains or invokes a separate PlotRanker model.
    // Its job is to build a bounded, authoritative candidate pool from live
    // inventory. In normal LLM-first flow the composer chooses the final
    // customer-facing subset/order; the deterministic score remains only as a
    // reproducible provider-outage fallback.
    const deterministicRanking = this.rankingSnapshot(recommendations);
    recommendations = this.applyComparativeFitScores(
      this.selectDiverseRecommendationOptions(
        recommendations,
        this.resolveRecommendationCount(dto),
      ),
    )
      .sort((left, right) => this.compareRecommendations(left, right, dto))
      .map((option, index) => ({
        ...option,
        optionId: `OPT-${String(index + 1).padStart(3, '0')}`,
      }));
    recommendations = this.enrichOptionExplanations(recommendations, dto);
    const finalFeatureSnapshot = Object.fromEntries(
      recommendations.map((option) => [
        option.optionId,
        this.buildFeatures(option, dto),
      ]),
    );
    const recommendationRunId = await this.recordRecommendationRun({
      context,
      requirements: dto,
      candidateOptionIds: recommendations.map((option) => option.optionId),
      featureSnapshot: finalFeatureSnapshot,
      deterministicRanking,
      mlRanking: null,
      finalRanking: this.rankingSnapshot(recommendations),
      modelVersion: 'grounded-candidate-pool-v2',
      rankerEnabled: false,
      fallbackReason: 'llm_final_selection',
    });

    const baziSuggestion =
      (dto.birthDate || dto.birthYear) &&
      (dto.gender === 'male' || dto.gender === 'female')
        ? this.bazi.suggest({
            birthDate: dto.birthDate,
            birthYear: dto.birthYear,
            birthTime: dto.birthTime,
            gender: dto.gender,
          })
        : undefined;

    return {
      requirements: { ...dto },
      recommendations,
      suggestedServices: [],
      baziSuggestion,
      inventoryPriceContext: this.buildInventoryPriceContext(candidates),
      rankerVersion: 'grounded-candidate-pool-v2',
      fallbackUsed: false,
      rankerFallbackReason: 'llm_final_selection',
      ...(recommendationRunId ? { recommendationRunId } : {}),
    };
  }

  async browseAvailablePlots(
    requirements: AgentRequirements,
    context?: RecommendationExecutionContext,
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
      this.orderCandidatesForGrouping(candidates, query),
      numberOfPlots,
      query.needAdjacent ?? numberOfPlots > 1,
      Number.MAX_SAFE_INTEGER,
    );
    const recommendations = this.enrichOptionExplanations(
      this.applyComparativeFitScores(
        this.selectDiverseRecommendationOptions(
          optionGroups
            .map((plots, index) =>
              this.toRecommendation(plots, query, index, false),
            )
            .sort((left, right) =>
              this.compareRecommendations(left, right, query),
            ),
          this.resolveRecommendationCount(requirements),
        ),
      )
        .sort((left, right) => this.compareRecommendations(left, right, query))
        .map((option, index) => ({
          ...option,
          optionId: `OPT-${String(index + 1).padStart(3, '0')}`,
        })),
      requirements,
    );
    const recommendationRunId = await this.recordRecommendationRun({
      context,
      requirements,
      candidateOptionIds: recommendations.map((option) => option.optionId),
      featureSnapshot: {},
      deterministicRanking: this.rankingSnapshot(recommendations),
      mlRanking: null,
      finalRanking: this.rankingSnapshot(recommendations),
      modelVersion: 'availability-browse-v1',
      rankerEnabled: false,
      fallbackReason: 'not_applicable_browse',
    });

    return {
      requirements: {
        ...requirements,
        numberOfPlots,
        needAdjacent: query.needAdjacent,
      },
      recommendations,
      suggestedServices: [],
      inventoryPriceContext: this.buildInventoryPriceContext(candidates),
      rankerVersion: 'availability-browse-v1',
      fallbackUsed: false,
      rankerFallbackReason: 'not_applicable_browse',
      ...(recommendationRunId ? { recommendationRunId } : {}),
    };
  }

  async searchAvailablePlots(dto: RecommendPlotsDto) {
    const params: unknown[] = [];
    const conditions = [
      `p.status = 'available'`,
      `p.price IS NOT NULL`,
      `p.price > 0`,
    ];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    conditions.push(`p.price <= ${add(dto.budgetMax)}`);
    if (dto.budgetMin !== undefined) {
      conditions.push(`p.price >= ${add(dto.budgetMin)}`);
    }
    if (dto.preferredZone) {
      conditions.push(`z.zone_name ILIKE ${add(`%${dto.preferredZone}%`)}`);
    }
    if (dto.preferredDirection) {
      conditions.push(
        `COALESCE(p.direction, '') ILIKE ${add(`%${dto.preferredDirection}%`)}`,
      );
    }
    if (dto.plotType) {
      conditions.push(`p.plot_type = ${add(dto.plotType)}`);
    }
    if (dto.excludePlotIds?.length) {
      const excluded = [...new Set(dto.excludePlotIds)]
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)
        .slice(0, 100);
      if (excluded.length) {
        conditions.push(`NOT (p.plot_id = ANY(${add(excluded)}::int[]))`);
      }
    }
    if (dto.minAreaSqm !== undefined) {
      conditions.push(`p.area_sqm >= ${add(dto.minAreaSqm)}`);
    }
    if (dto.maxAreaSqm !== undefined) {
      conditions.push(`p.area_sqm <= ${add(dto.maxAreaSqm)}`);
    }
    const limitParam = add(this.candidateLimit);

    const rows = await this.database.query<PlotRow>(
      `SELECT p.plot_id AS id, p.plot_code AS "plotCode", p.zone_id AS "zoneId",
              z.zone_code AS "zoneCode", z.zone_name AS "zoneName",
              z.description AS "zoneDescription", p.price::float, p.status,
              p.direction, p.plot_type AS "plotType",
              p.area_sqm::float AS "areaSqm", p.row_number AS "rowNumber",
              p.column_number AS "columnNumber", p.description,
              p.image_url AS "imageUrl", p.updated_at::text AS "updatedAt",
              p.map_x::float AS "mapX", p.map_y::float AS "mapY",
              p.map_width::float AS "mapWidth", p.map_height::float AS "mapHeight"
       FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE p.is_deleted = FALSE AND z.is_active = TRUE
         AND ${conditions.join(' AND ')}
       ORDER BY p.price ASC, z.zone_name ASC, p.row_number ASC, p.column_number ASC
       LIMIT ${limitParam}`,
      params,
    );
    return rows.map((row) => this.normalizePlot(row));
  }

  private resolveRecommendationCount(
    requirements: Pick<AgentRequirements, 'recommendationCount'>,
  ) {
    const count = requirements.recommendationCount;
    return Number.isInteger(count) && count !== undefined
      ? Math.min(10, Math.max(1, count))
      : 3;
  }

  async getServiceSuggestions(limit = 6, queries: string[] = []) {
    const boundedLimit = Math.min(Math.max(limit, 1), 20);
    // When the semantic planner has resolved specific service interests, load a
    // slightly wider active catalogue and deterministically resolve those names.
    // This is entity matching against authoritative rows, not intent routing.
    const rows = await this.database.query<ServiceRow>(
      `SELECT service_type_id AS id, name, description,
              base_price::float AS "basePrice", unit, category
       FROM service_types
       WHERE is_active = TRUE AND is_deleted = FALSE
       ORDER BY sort_order, base_price
       LIMIT $1`,
      [queries.length ? 50 : boundedLimit],
    );
    const services = rows.map((row) => ({
      ...row,
      id: Number(row.id),
      basePrice: Number(row.basePrice),
    }));
    if (!queries.length) return services.slice(0, boundedLimit);

    const normalizedQueries = queries
      .map((query) => this.normalizeServiceText(query))
      .filter(Boolean);
    if (!normalizedQueries.length) return services.slice(0, boundedLimit);

    const scored = services
      .map((service, index) => ({
        service,
        index,
        score: Math.max(
          ...normalizedQueries.map((query) =>
            this.serviceSemanticNameScore(
              service.name,
              service.description,
              query,
            ),
          ),
        ),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) => right.score - left.score || left.index - right.index,
      );

    return scored.slice(0, boundedLimit).map((item) => item.service);
  }

  private normalizeServiceText(value: string | null | undefined) {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private serviceSemanticNameScore(
    name: string,
    description: string | null,
    normalizedQuery: string,
  ) {
    // "dịch vụ" is catalogue boilerplate. Counting those two words caused
    // queries about grave care to falsely match "Dịch vụ mai táng".
    const stopwords = new Set(['dich', 'vu']);
    // Generic umbrella terms that, when they form the ENTIRE query, mean
    // "show me the full catalogue" rather than a specific service filter.
    const umbrellaWords = new Set(['cham', 'soc', 'hien', 'co', 'cac']);
    const nameTokens = this.normalizeServiceText(name)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !stopwords.has(token));
    if (!nameTokens.length) return 0;

    const expandedQuery = normalizedQuery
      .replace(/\blau don\b/g, 'don dep mo')
      .replace(/\bve sinh mo\b/g, 'don dep mo');
    const allQueryTokens = expandedQuery
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !stopwords.has(token));
    // If after removing generic umbrella words no substantive tokens remain,
    // this is a catalogue-browsing request, not a specific service filter.
    const substantiveTokens = allQueryTokens.filter(
      (token) => !umbrellaWords.has(token),
    );
    if (!substantiveTokens.length) return 0;
    const queryTokens = new Set(allQueryTokens);
    const nameOverlap = nameTokens.filter((token) =>
      queryTokens.has(token),
    ).length;
    const requiredOverlap = Math.max(1, Math.ceil(nameTokens.length * 0.4));
    if (nameOverlap >= requiredOverlap) {
      return 100 + nameOverlap * 10 - nameTokens.length;
    }

    const descriptionTokens = this.normalizeServiceText(description)
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !stopwords.has(token));
    const descriptionOverlap = descriptionTokens.filter((token) =>
      queryTokens.has(token),
    ).length;
    return descriptionOverlap >= 2 ? 20 + descriptionOverlap : 0;
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
      `SELECT p.plot_id AS id, p.plot_code AS "plotCode", p.zone_id AS "zoneId",
              z.zone_code AS "zoneCode", z.zone_name AS "zoneName",
              z.description AS "zoneDescription", p.price::float, p.status,
              p.direction, p.plot_type AS "plotType",
              p.area_sqm::float AS "areaSqm", p.row_number AS "rowNumber",
              p.column_number AS "columnNumber", p.description,
              p.image_url AS "imageUrl", p.updated_at::text AS "updatedAt",
              p.map_x::float AS "mapX", p.map_y::float AS "mapY",
              p.map_width::float AS "mapWidth", p.map_height::float AS "mapHeight"
       FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE p.plot_id = ANY($1::int[]) AND p.status = 'available'
         AND p.is_deleted = FALSE AND z.is_active = TRUE
       ORDER BY p.plot_id`,
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

  private orderCandidatesForGrouping(
    candidates: PlotCandidate[],
    requirements: Pick<RecommendPlotsDto, 'preferNearEntrance'>,
  ) {
    if (!requirements.preferNearEntrance) return candidates;
    return [...candidates].sort((left, right) => {
      const leftDistance =
        left.entranceDistanceMapUnits ?? Number.POSITIVE_INFINITY;
      const rightDistance =
        right.entranceDistanceMapUnits ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance || left.price - right.price;
    });
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
      ? Math.max(0, 1 - Math.min(1, plotCost / dto.budgetMax) * 0.35)
      : 0.8;
    const baseScore =
      budgetScore * 0.3 +
      (zoneMatches ? 1 : 0) * 0.2 +
      (directionMatches ? 1 : 0) * 0.15 +
      (plots.length > 1 ? 1 : 0.7) * 0.15 +
      (plots.every((plot) => !dto.plotType || plot.plotType === dto.plotType)
        ? 1
        : 0) *
        0.1 +
      (plots.length === dto.numberOfPlots ? 1 : 0) * 0.1;
    const entranceDistances = plots
      .map((plot) => plot.entranceDistanceMapUnits)
      .filter((value): value is number => value !== null);
    const entranceDistanceMapUnits = entranceDistances.length
      ? entranceDistances.reduce((sum, value) => sum + value, 0) /
        entranceDistances.length
      : null;
    const entranceScore =
      entranceDistanceMapUnits === null
        ? 0
        : Math.max(0, 1 - entranceDistanceMapUnits / 1800);
    const score = Number(
      (dto.preferNearEntrance
        ? baseScore * 0.75 + entranceScore * 0.25
        : baseScore
      ).toFixed(4),
    );
    const accessSummary = this.buildAccessSummary(
      plots,
      entranceDistanceMapUnits,
    );
    const reasons = [
      budgetSpecified
        ? `Tổng giá ${plotCost.toLocaleString('vi-VN')} VND nằm trong ngân sách`
        : `Giá niêm yết ${plotCost.toLocaleString('vi-VN')} VND từ dữ liệu lô đang trống`,
      plots.length > 1
        ? `${plots.length} lô tạo thành một nhóm liền kề hợp lệ`
        : 'Lô đang được hệ thống ghi nhận là còn trống tại thời điểm tìm kiếm',
      ...(plots.every((plot) => plot.plotType === 'family')
        ? ['Đúng loại lô gia đình dành cho gia đình hoặc dòng tộc']
        : []),
      ...(zoneMatches && dto.preferredZone
        ? [`Đúng khu vực ${dto.preferredZone}`]
        : []),
      ...(directionMatches && dto.preferredDirection
        ? [`Có hướng ${dto.preferredDirection} theo yêu cầu`]
        : []),
      ...(dto.preferNearEntrance && accessSummary ? [accessSummary] : []),
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
      ...(dto.preferNearEntrance &&
      plots.every((plot) => plot.entranceProximity === 'far')
        ? ['Vị trí nằm sâu hơn so với cổng gần nhất trên sơ đồ nội khu']
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
      analysisSummary: '',
      highlightPlotIds: plots.map((plot) => plot.id),
      accessSummary,
      entranceDistanceMapUnits,
    };
  }

  private enrichOptionExplanations(
    options: RecommendationOption[],
    requirements: AgentRequirements,
  ) {
    if (!options.length) return options;

    const cheapest = Math.min(...options.map((option) => option.plotCost));
    const largestArea = Math.max(
      ...options.map((option) => option.totalAreaSqm),
    );
    const hasRealBudget =
      requirements.budgetMax !== undefined &&
      Number.isFinite(requirements.budgetMax) &&
      requirements.budgetMax < Number.MAX_SAFE_INTEGER;

    return options.map((option, index) => {
      const reasons = [...option.reasons];
      const tradeOffs = [...option.tradeOffs];
      const perPlotPrice = Math.round(
        option.plotCost / Math.max(option.plotIds.length, 1),
      );

      reasons.push(`Thuộc ${option.zoneName}`);
      if (option.totalAreaSqm > 0) {
        reasons.push(
          `Tổng diện tích được ghi nhận là ${option.totalAreaSqm.toLocaleString('vi-VN')} m²`,
        );
      }
      if (option.directions.length) {
        reasons.push(`Hướng được ghi nhận: ${option.directions.join(', ')}`);
      }

      if (hasRealBudget) {
        const headroom = Math.max(
          0,
          Number(requirements.budgetMax) - option.plotCost,
        );
        const percentage = Math.round(
          (headroom / Math.max(Number(requirements.budgetMax), 1)) * 100,
        );
        if (headroom > 0) {
          reasons.push(
            `Còn dư khoảng ${headroom.toLocaleString('vi-VN')} VND so với ngân sách tối đa (${percentage}%)`,
          );
        }
      }

      if (option.plotIds.length > 1) {
        reasons.push(
          `Bình quân khoảng ${perPlotPrice.toLocaleString('vi-VN')} VND cho mỗi lô trong nhóm`,
        );
      }

      if (options.length > 1) {
        if (option.plotCost === cheapest) {
          reasons.push(
            'Có tổng giá thấp nhất trong các phương án đang so sánh',
          );
        } else {
          tradeOffs.push(
            `Tổng giá cao hơn phương án tiết kiệm nhất ${(option.plotCost - cheapest).toLocaleString('vi-VN')} VND`,
          );
        }

        if (option.totalAreaSqm > 0 && option.totalAreaSqm === largestArea) {
          reasons.push(
            'Có tổng diện tích lớn nhất trong các phương án đang so sánh',
          );
        } else if (largestArea > option.totalAreaSqm) {
          tradeOffs.push(
            `Tổng diện tích nhỏ hơn phương án rộng nhất ${(largestArea - option.totalAreaSqm).toLocaleString('vi-VN')} m²`,
          );
        }
      }

      if (
        option.accessSummary &&
        !reasons.some((reason) => reason === option.accessSummary)
      ) {
        reasons.push(option.accessSummary);
      }
      if (!option.accessSummary) {
        tradeOffs.push(
          'Chưa có dữ liệu xác thực để so sánh khả năng tiếp cận từ cổng trên sơ đồ nội khu',
        );
      }
      if (!option.directions.length) {
        tradeOffs.push(
          'Hướng lô chưa được ghi nhận, cần kiểm tra trước khi gửi yêu cầu',
        );
      } else if (!requirements.preferredDirection) {
        tradeOffs.push(
          `Gia đình chưa xác nhận hướng ${option.directions.join(', ')} có phải hướng ưu tiên hay không`,
        );
      }
      if (!requirements.preferredZone) {
        tradeOffs.push(
          `Gia đình chưa xác nhận ${option.zoneName} có phải khu vực mong muốn hay không`,
        );
      }
      if (!tradeOffs.length) {
        tradeOffs.push(
          'Cần kiểm tra vị trí thực tế trên bản đồ và xác nhận lại trạng thái còn trống trước khi gửi yêu cầu',
        );
      }

      const uniqueReasons = [...new Set(reasons)];
      const uniqueTradeOffs = [...new Set(tradeOffs)];
      const tradeOffSummary =
        uniqueTradeOffs[0] ??
        'cần kiểm tra trực tiếp vị trí, hướng và kích thước trên bản đồ trước khi gửi yêu cầu';
      const directionKey = [...option.directions]
        .map((direction) => direction.toLocaleLowerCase('vi-VN'))
        .sort()
        .join('|');
      const equivalentOptions = options.filter((candidate) => {
        if (candidate.optionId === option.optionId) return false;
        const candidateDirectionKey = [...candidate.directions]
          .map((direction) => direction.toLocaleLowerCase('vi-VN'))
          .sort()
          .join('|');
        return (
          candidate.plotCost === option.plotCost &&
          candidate.totalAreaSqm === option.totalAreaSqm &&
          candidate.zoneName === option.zoneName &&
          candidateDirectionKey === directionKey &&
          candidate.accessSummary === option.accessSummary
        );
      });
      const positions = option.plots
        .map((plot) => {
          const parts = [
            plot.rowNumber ? `hàng ${plot.rowNumber}` : '',
            plot.columnNumber ? `cột ${plot.columnNumber}` : '',
          ].filter(Boolean);
          return parts.length ? `${plot.plotCode}: ${parts.join(', ')}` : '';
        })
        .filter(Boolean);
      const distinctStrengths: string[] = [];
      if (options.length > 1) {
        if (
          option.plotCost === cheapest &&
          options.filter((candidate) => candidate.plotCost === cheapest)
            .length === 1
        ) {
          distinctStrengths.push('có tổng giá thấp nhất');
        }
        if (
          option.totalAreaSqm === largestArea &&
          options.filter((candidate) => candidate.totalAreaSqm === largestArea)
            .length === 1
        ) {
          distinctStrengths.push('có tổng diện tích lớn nhất');
        }
        if (
          option.accessSummary &&
          options.some(
            (candidate) => candidate.accessSummary !== option.accessSummary,
          )
        ) {
          distinctStrengths.push(option.accessSummary.toLowerCase());
        }
      }
      const analysisSummary = equivalentOptions.length
        ? `Các dữ liệu quyết định chính hiện tương đương với ${equivalentOptions.map((candidate) => candidate.plotCodes.join(', ')).join('; ')} về giá, diện tích, khu vực, hướng và khả năng tiếp cận. ${positions.length ? `Khác biệt xác thực của phương án này là vị trí ${positions.join('; ')} trên sơ đồ nội khu.` : 'Chưa có thêm dữ liệu xác thực tạo ra khác biệt quyết định; nên xem các vị trí trên bản đồ trước khi xếp hạng.'} Điểm cần cân nhắc: ${tradeOffSummary}.`
        : `Điểm phân biệt của phương án ${index + 1}: ${distinctStrengths.join('; ') || uniqueReasons.slice(0, 3).join('; ')}${positions.length ? `; vị trí ${positions.join('; ')} trên sơ đồ nội khu` : ''}. Điểm cần cân nhắc: ${tradeOffSummary}.`;

      return {
        ...option,
        reasons: uniqueReasons,
        tradeOffs: uniqueTradeOffs,
        analysisSummary,
      };
    });
  }

  /**
   * Keep alternatives meaningfully different instead of repeatedly returning
   * neighboring plots with the same price/direction just because their base
   * scores tie. The first option remains the strongest ranked candidate; later
   * options balance ranking quality with novelty in direction, price band,
   * area, access, zone and map row. This is deterministic (no random shuffle),
   * so the UI remains reproducible while comparisons become more useful.
   */
  private selectDiverseRecommendationOptions(
    options: RecommendationOption[],
    count: number,
  ) {
    const target = Math.min(Math.max(count, 1), options.length);
    if (target === 0) return [];
    if (target === 1) return options.slice(0, 1);

    const selected: RecommendationOption[] = [options[0]];
    const remaining = options.slice(1).map((option, index) => ({
      option,
      originalRank: index + 1,
    }));

    const distanceBucket = (value: number | null) => {
      if (value === null) return 'unknown';
      if (value <= NEAR_ENTRANCE_MAX_DISTANCE) return 'near';
      if (value <= MODERATE_ENTRANCE_MAX_DISTANCE) return 'moderate';
      return 'far';
    };
    const normalizedDifference = (
      left: number,
      right: number,
      meaningfulRatio: number,
    ) =>
      Math.min(
        1,
        Math.abs(left - right) /
          Math.max(Math.max(Math.abs(left), Math.abs(right)), 1) /
          meaningfulRatio,
      );

    while (selected.length < target && remaining.length) {
      let bestIndex = 0;
      let bestScore = Number.NEGATIVE_INFINITY;

      remaining.forEach((entry, index) => {
        const candidate = entry.option;
        const rankQuality =
          options.length <= 1
            ? 1
            : 1 - entry.originalRank / Math.max(options.length, 1);
        const candidateDirections = new Set(
          candidate.directions.map((value) => value.toLowerCase()),
        );
        const selectedDirections = new Set(
          selected.flatMap((item) =>
            item.directions.map((value) => value.toLowerCase()),
          ),
        );
        const directionNovelty =
          candidateDirections.size > 0 &&
          [...candidateDirections].every(
            (direction) => !selectedDirections.has(direction),
          )
            ? 1
            : 0;
        const zoneNovelty = selected.some(
          (item) =>
            item.zoneName.toLowerCase() === candidate.zoneName.toLowerCase(),
        )
          ? 0
          : 1;
        const accessNovelty = selected.some(
          (item) =>
            distanceBucket(item.entranceDistanceMapUnits) ===
            distanceBucket(candidate.entranceDistanceMapUnits),
        )
          ? 0
          : 1;
        const rowKey = candidate.plots
          .map((plot) => `${plot.zoneId}:${plot.rowNumber ?? 'unknown'}`)
          .join('|');
        const rowNovelty = selected.some(
          (item) =>
            item.plots
              .map((plot) => `${plot.zoneId}:${plot.rowNumber ?? 'unknown'}`)
              .join('|') === rowKey,
        )
          ? 0
          : 1;
        const priceNovelty = Math.min(
          ...selected.map((item) =>
            normalizedDifference(candidate.plotCost, item.plotCost, 0.15),
          ),
        );
        const areaNovelty = Math.min(
          ...selected.map((item) =>
            normalizedDifference(
              candidate.totalAreaSqm,
              item.totalAreaSqm,
              0.2,
            ),
          ),
        );
        const diversityScore =
          directionNovelty * 0.25 +
          zoneNovelty * 0.2 +
          priceNovelty * 0.2 +
          rowNovelty * 0.15 +
          accessNovelty * 0.1 +
          areaNovelty * 0.1;
        const score = rankQuality * 0.58 + diversityScore * 0.42;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      selected.push(remaining.splice(bestIndex, 1)[0].option);
    }

    return selected;
  }

  /**
   * Add a small, evidence-based comparative signal to the absolute rule score.
   * This prevents visually identical percentages when options differ in price,
   * area or verified entrance access, without inventing a preference that the
   * customer never stated. Tiny metric spreads intentionally have less impact.
   */
  private applyComparativeFitScores(options: RecommendationOption[]) {
    if (options.length < 2) return options;

    const prices = options.map((option) => option.plotCost);
    const areas = options.map((option) => option.totalAreaSqm);
    const distances = options
      .map((option) => option.entranceDistanceMapUnits)
      .filter((value): value is number => value !== null);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minArea = Math.min(...areas);
    const maxArea = Math.max(...areas);
    const minDistance = distances.length ? Math.min(...distances) : 0;
    const maxDistance = distances.length ? Math.max(...distances) : 0;

    const normalized = (value: number, min: number, max: number) =>
      max === min ? 0.5 : (value - min) / (max - min);
    const spreadStrength = (min: number, max: number, multiplier: number) =>
      max === min
        ? 0
        : Math.min(
            1,
            (Math.abs(max - min) / Math.max(Math.abs(max), 1)) * multiplier,
          );

    const priceStrength = spreadStrength(minPrice, maxPrice, 8);
    const areaStrength = spreadStrength(minArea, maxArea, 4);
    const accessStrength =
      distances.length > 1
        ? Math.min(1, Math.abs(maxDistance - minDistance) / 700)
        : 0;

    return options.map((option) => {
      const affordability =
        0.5 +
        (0.5 - normalized(option.plotCost, minPrice, maxPrice)) * priceStrength;
      const areaValue =
        0.5 +
        (normalized(option.totalAreaSqm, minArea, maxArea) - 0.5) *
          areaStrength;
      const accessValue =
        option.entranceDistanceMapUnits === null
          ? 0.5
          : 0.5 +
            (0.5 -
              normalized(
                option.entranceDistanceMapUnits,
                minDistance,
                maxDistance,
              )) *
              accessStrength;
      const comparativeSignal =
        affordability * 0.5 + areaValue * 0.2 + accessValue * 0.3;
      const comparativeTarget = 0.55 + comparativeSignal * 0.35;
      return {
        ...option,
        score: Number(
          Math.max(
            0,
            Math.min(0.98, option.score * 0.76 + comparativeTarget * 0.24),
          ).toFixed(4),
        ),
      };
    });
  }

  private compareRecommendations(
    left: RecommendationOption,
    right: RecommendationOption,
    dto: Pick<RecommendPlotsDto, 'preferNearEntrance'>,
  ) {
    if (dto.preferNearEntrance) {
      const leftDistance =
        left.entranceDistanceMapUnits ?? Number.POSITIVE_INFINITY;
      const rightDistance =
        right.entranceDistanceMapUnits ?? Number.POSITIVE_INFINITY;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    }
    return right.score - left.score || left.plotCost - right.plotCost;
  }

  private buildAccessSummary(
    plots: PlotCandidate[],
    averageDistance: number | null,
  ) {
    if (averageDistance === null) return null;
    const entrances = [
      ...new Set(plots.map((plot) => plot.nearestEntrance).filter(Boolean)),
    ];
    const entranceLabel =
      entrances.length === 1
        ? entrances[0] === 'main'
          ? 'Cổng chính'
          : 'Cổng phụ'
        : 'cổng gần nhất';
    if (averageDistance <= NEAR_ENTRANCE_MAX_DISTANCE) {
      return `Thuộc nhóm gần ${entranceLabel} trên sơ đồ nội khu`;
    }
    if (averageDistance <= MODERATE_ENTRANCE_MAX_DISTANCE) {
      return `Khoảng tiếp cận trung bình tới ${entranceLabel} trên sơ đồ nội khu`;
    }
    return `Nằm sâu hơn so với ${entranceLabel} trên sơ đồ nội khu`;
  }

  private buildInventoryPriceContext(candidates: PlotCandidate[]) {
    if (!candidates.length) return undefined;
    const prices = candidates.map((plot) => plot.price).sort((a, b) => a - b);
    const middle = Math.floor(prices.length / 2);
    const medianListedPrice =
      prices.length % 2 === 0
        ? (prices[middle - 1] + prices[middle]) / 2
        : prices[middle];
    return {
      candidateCount: prices.length,
      minimumListedPrice: prices[0],
      medianListedPrice,
      maximumListedPrice: prices[prices.length - 1],
      scope: 'matching_available_inventory' as const,
    };
  }

  private normalizePlot(row: PlotRow): PlotCandidate {
    const numberOrNull = (value: number | string | null) =>
      value === null || value === undefined ? null : Number(value);
    const mapX = numberOrNull(row.mapX);
    const mapY = numberOrNull(row.mapY);
    const mapWidth = numberOrNull(row.mapWidth);
    const mapHeight = numberOrNull(row.mapHeight);
    const access = calculatePlotEntranceAccess({
      plotCode: row.plotCode,
      zoneName: row.zoneName,
      rowNumber: row.rowNumber,
      columnNumber: row.columnNumber,
    });
    return {
      ...row,
      id: Number(row.id),
      zoneId: Number(row.zoneId),
      price: Number(row.price),
      areaSqm: numberOrNull(row.areaSqm),
      description: row.description ?? null,
      mapX,
      mapY,
      mapWidth,
      mapHeight,
      ...access,
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
    };
  }

  private rankingSnapshot(recommendations: RecommendationOption[]) {
    return recommendations.map((option, index) => ({
      rank: index + 1,
      optionId: option.optionId,
      plotIds: option.plotIds,
      score: option.score,
      estimatedTotal: option.estimatedTotal,
    }));
  }

  private async recordRecommendationRun(input: {
    context?: RecommendationExecutionContext;
    requirements: AgentRequirements;
    candidateOptionIds: string[];
    featureSnapshot: Record<string, Record<string, number>>;
    deterministicRanking: ReturnType<
      PlotRecommendationService['rankingSnapshot']
    >;
    mlRanking: ReturnType<PlotRecommendationService['rankingSnapshot']> | null;
    finalRanking: ReturnType<PlotRecommendationService['rankingSnapshot']>;
    modelVersion: string;
    rankerEnabled: boolean;
    fallbackReason?: string;
  }) {
    const recommendationRunId = `REC-${randomUUID()}`;
    try {
      await this.database.query(
        `INSERT INTO ai_recommendation_runs
           (recommendation_run_id, user_id, conversation_id,
            source_message_id, requirement_snapshot, candidate_option_ids,
            feature_snapshot, deterministic_ranking, ml_ranking,
            final_ranking, model_version, ranker_enabled, fallback_reason)
         VALUES
           ($1, $2, $3, $4, $5::jsonb, $6::jsonb,
            $7::jsonb, $8::jsonb, $9::jsonb,
            $10::jsonb, $11, $12, $13)`,
        [
          recommendationRunId,
          input.context?.userId ?? null,
          input.context?.conversationId ?? null,
          input.context?.sourceMessageId ?? null,
          JSON.stringify(input.requirements),
          JSON.stringify(input.candidateOptionIds),
          JSON.stringify(input.featureSnapshot),
          JSON.stringify(input.deterministicRanking),
          JSON.stringify(input.mlRanking),
          JSON.stringify(input.finalRanking),
          input.modelVersion,
          input.rankerEnabled,
          input.fallbackReason ?? null,
        ],
      );
      return recommendationRunId;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          conversationId: input.context?.conversationId ?? null,
          sourceMessageId: input.context?.sourceMessageId ?? null,
          action: 'record_recommendation_run',
          resultStatus: 'error',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return undefined;
    }
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
