import { DatabaseService } from '../../database/database.service';
import { PlotAdjacencyService } from '../plots/plot-adjacency.service';
import { BaziRuleService } from './bazi-rule.service';
import { PlotRecommendationService } from './plot-recommendation.service';

describe('PlotRecommendationService', () => {
  const plots = [
    {
      id: 1,
      plotCode: 'A-01-001',
      zoneId: 1,
      zoneName: 'Khu A',
      price: 100_000_000,
      status: 'available',
      direction: 'Đông',
      plotType: 'family',
      areaSqm: 20,
      rowNumber: '1',
      columnNumber: '1',
      mapX: 0,
      mapY: 0,
      mapWidth: 10,
      mapHeight: 10,
    },
    {
      id: 2,
      plotCode: 'A-01-002',
      zoneId: 1,
      zoneName: 'Khu A',
      price: 110_000_000,
      status: 'available',
      direction: 'Đông',
      plotType: 'family',
      areaSqm: 20,
      rowNumber: '1',
      columnNumber: '2',
      mapX: 10,
      mapY: 0,
      mapWidth: 10,
      mapHeight: 10,
    },
    {
      id: 3,
      plotCode: 'A-01-003',
      zoneId: 1,
      zoneName: 'Khu A',
      price: 200_000_000,
      status: 'available',
      direction: 'Tây',
      plotType: 'single',
      areaSqm: 18,
      rowNumber: '3',
      columnNumber: '3',
      mapX: 50,
      mapY: 50,
      mapWidth: 10,
      mapHeight: 10,
    },
  ];

  function createService() {
    const database = {
      query: jest.fn().mockResolvedValueOnce(plots).mockResolvedValueOnce([]),
    };
    const adjacency = new PlotAdjacencyService();
    return {
      database,
      service: new PlotRecommendationService(
        database as unknown as DatabaseService,
        adjacency,
        new BaziRuleService(),
      ),
    };
  }

  it('uses parameterized filters and returns only adjacent options in budget', async () => {
    const { database, service } = createService();
    const result = await service.recommend({
      budgetMax: 250_000_000,
      numberOfPlots: 2,
      preferredZone: 'Khu A',
      preferredDirection: 'Đông',
      needAdjacent: true,
    });

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).not.toContain('Khu A');
    expect(sql).toMatch(/LIMIT \$\d+/);
    expect(params).toContain('%Khu A%');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].plotIds).toEqual([1, 2]);
    expect(result.recommendations[0].plotCost).toBeLessThanOrEqual(250_000_000);
    expect(result.recommendations[0].isAdjacent).toBe(true);
  });

  it('calculates costs from database prices instead of client prices', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ price: 100 }, { price: 200 }])
        .mockResolvedValueOnce([{ id: 9, basePrice: 50 }]),
    };
    const service = new PlotRecommendationService(
      database as unknown as DatabaseService,
      new PlotAdjacencyService(),
      new BaziRuleService(),
    );

    await expect(
      service.estimateTotalCost([1, 2], [{ serviceTypeId: 9, quantity: 3 }]),
    ).resolves.toEqual({
      plotCost: 300,
      serviceCost: 150,
      estimatedTotal: 450,
      currency: 'VND',
    });
  });

  it('browses real available plots without inventing a customer budget', async () => {
    const { database, service } = createService();

    const result = await service.browseAvailablePlots({
      numberOfPlots: 1,
    });

    const [, params] = database.query.mock.calls[0];
    expect(params).toContain(Number.MAX_SAFE_INTEGER);
    expect(result.requirements).not.toHaveProperty('budgetMax');
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].plotIds).toEqual([1]);
    expect(
      new Set(result.recommendations.map((option) => option.score)).size,
    ).toBeGreaterThan(1);
    expect(result.rankerVersion).toBe('availability-browse-v1');
    expect(
      result.recommendations.every(
        (option) =>
          option.analysisSummary.includes('Điểm cần cân nhắc:') &&
          option.reasons.length >= 3 &&
          option.tradeOffs.length >= 1,
      ),
    ).toBe(true);
    expect(result.recommendations[1].tradeOffs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('phương án tiết kiệm nhất'),
      ]),
    );
  });

  it('diversifies alternatives instead of returning only near-identical neighboring plots', async () => {
    const { service } = createService();

    const result = await service.recommend({
      budgetMax: 250_000_000,
      numberOfPlots: 1,
      recommendationCount: 2,
      comparisonRequested: true,
    });

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].plotIds).toEqual([1]);
    expect(result.recommendations.map((option) => option.plotIds[0])).toContain(3);
    expect(
      new Set(result.recommendations.flatMap((option) => option.directions)).size,
    ).toBeGreaterThan(1);
  });

  it('returns exactly the number of alternatives explicitly requested', async () => {
    const { service } = createService();

    const result = await service.browseAvailablePlots({
      numberOfPlots: 1,
      recommendationCount: 2,
      comparisonRequested: true,
    });

    expect(result.recommendations).toHaveLength(2);
    expect(result.requirements).toMatchObject({
      recommendationCount: 2,
      comparisonRequested: true,
      numberOfPlots: 1,
    });
  });

  it('passes every previously rejected plot id through a parameterized exclusion', async () => {
    const { database, service } = createService();

    await service.recommend({
      budgetMax: 250_000_000,
      numberOfPlots: 1,
      excludePlotIds: [1, 2, 2],
    });

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toContain('NOT (p.plot_id = ANY(');
    expect(params).toContainEqual([1, 2]);
  });

  it('prioritizes verified entrance access without exposing raw geometry as advice', async () => {
    const database = {
      query: jest.fn().mockResolvedValue([
        {
          ...plots[0],
          id: 10,
          plotCode: 'A-01-001',
          price: 80_000_000,
          mapX: 20,
          mapY: 40,
        },
        {
          ...plots[0],
          id: 11,
          plotCode: 'H-06-001',
          zoneName: 'Khu H',
          rowNumber: '6',
          columnNumber: '1',
          price: 90_000_000,
          mapX: 450,
          mapY: 1490,
        },
      ]),
    };
    const service = new PlotRecommendationService(
      database as unknown as DatabaseService,
      new PlotAdjacencyService(),
      new BaziRuleService(),
    );

    const result = await service.recommend({
      budgetMax: 100_000_000,
      numberOfPlots: 1,
      preferNearEntrance: true,
    });

    expect(result.recommendations[0].plotIds).toEqual([11]);
    expect(result.recommendations[0].accessSummary).toContain('Cổng chính');
    expect(result.inventoryPriceContext).toMatchObject({
      candidateCount: 2,
      minimumListedPrice: 80_000_000,
      maximumListedPrice: 90_000_000,
      scope: 'matching_available_inventory',
    });
  });

  it('builds a grounded candidate pool without invoking a separate trained ranker', async () => {
    const database = {
      query: jest.fn().mockResolvedValueOnce(plots).mockResolvedValueOnce([]),
    };
    const service = new PlotRecommendationService(
      database as unknown as DatabaseService,
      new PlotAdjacencyService(),
      new BaziRuleService(),
    );

    const result = await service.recommend(
      {
        budgetMax: 250_000_000,
        numberOfPlots: 2,
        needAdjacent: true,
      },
      {
        userId: 7,
        conversationId: 10,
        sourceMessageId: 20,
      },
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.rankerVersion).toBe('grounded-candidate-pool-v2');
    expect(result.rankerFallbackReason).toBe('llm_final_selection');
    expect(result.recommendations[0].plotIds).toEqual([1, 2]);
    const traceInsert = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_recommendation_runs'),
    );
    expect(traceInsert?.[1]).toEqual(
      expect.arrayContaining([
        7,
        10,
        20,
        'grounded-candidate-pool-v2',
        false,
        'llm_final_selection',
      ]),
    );
    expect(String(traceInsert?.[1]?.[6])).not.toContain(
      'historical_acceptance_rate',
    );
    expect(String(traceInsert?.[1]?.[6])).not.toContain('bazi_direction_match');
  });
  it('filters specific care-service interests without falsely matching burial from the generic words dich vu', async () => {
    const database = {
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Dịch vụ mai táng',
          description: 'Hỗ trợ quy trình mai táng tại nghĩa trang',
          basePrice: 5_000_000,
          unit: 'lần',
          category: 'burial',
        },
        {
          id: 2,
          name: 'Chăm sóc mộ định kỳ',
          description: 'Vệ sinh và chăm sóc mộ phần hàng tháng',
          basePrice: 500_000,
          unit: 'tháng',
          category: 'maintenance',
        },
        {
          id: 3,
          name: 'Dọn dẹp mộ',
          description: 'Lau dọn mộ phần',
          basePrice: 200_000,
          unit: 'lần',
          category: 'maintenance',
        },
        {
          id: 4,
          name: 'Thắp hương',
          description: 'Thắp hương vào ngày đặc biệt',
          basePrice: 100_000,
          unit: 'lần',
          category: 'memorial',
        },
      ]),
    };
    const service = new PlotRecommendationService(
      database as unknown as DatabaseService,
      new PlotAdjacencyService(),
      new BaziRuleService(),
    );

    const services = await service.getServiceSuggestions(5, [
      'chăm sóc mộ phần',
      'lau dọn mộ',
      'thắp hương ngày rằm',
    ]);

    expect(services.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        'Chăm sóc mộ định kỳ',
        'Dọn dẹp mộ',
        'Thắp hương',
      ]),
    );
    expect(services.map((item) => item.name)).not.toContain('Dịch vụ mai táng');
  });

});
