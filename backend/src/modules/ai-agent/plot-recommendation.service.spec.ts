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
    expect(result.rankerVersion).toBe('availability-browse-v1');
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
});
