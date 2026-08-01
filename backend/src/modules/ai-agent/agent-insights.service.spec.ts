import { AgentInsightsService } from './agent-insights.service';

describe('AgentInsightsService', () => {
  const createService = () => {
    const database = {
      queryOne: jest.fn(),
      query: jest.fn(),
    };
    const reminders = { my: jest.fn() };
    const service = new AgentInsightsService(
      database as never,
      reminders as never,
    );
    return { service, database, reminders };
  };

  it('builds a transparent high internal-pressure signal', async () => {
    const { service, database } = createService();
    database.queryOne.mockResolvedValue({
      plotId: 10,
      plotCode: 'A-01-001',
      status: 'available',
      zoneName: 'Khu A',
      plotType: 'single',
      direction: 'Đông',
      areaSqm: '12',
      price: '110000000',
      availablePeerCount: 2,
      medianPeerPrice: '100000000',
      activeRequestCount: 2,
      recentInterestCount: 3,
      latestInterestAt: '2026-07-31T09:00:00.000Z',
    });

    const result = await service.analyzePlotCompetitiveness('a-01-001');

    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining("rr.status IN ('submitted', 'pending')"),
      ['A-01-001'],
    );
    expect(result).toMatchObject({
      found: true,
      plot: {
        plotCode: 'A-01-001',
        listedPrice: 110000000,
      },
      internalPressure: {
        level: 'high',
        score: 7,
        activeRequestCount: 2,
        recentInterestCount: 3,
      },
      comparableInventory: {
        availableAlternativeCount: 2,
        pricePosition: 'above_median',
        priceDifferencePercent: 10,
      },
      methodology: {
        excludedRequestStatuses: ['draft', 'rejected', 'cancelled'],
      },
    });
  });

  it('does not assign competition to a plot that is no longer actionable', async () => {
    const { service, database } = createService();
    database.queryOne.mockResolvedValue({
      plotId: 10,
      plotCode: 'A-01-001',
      status: 'sold',
      zoneName: 'Khu A',
      plotType: 'single',
      direction: null,
      areaSqm: null,
      price: 100000000,
      availablePeerCount: 8,
      medianPeerPrice: 100000000,
      activeRequestCount: 0,
      recentInterestCount: 1,
      latestInterestAt: null,
    });

    const result = await service.analyzePlotCompetitiveness('A-01-001');

    expect(result).toMatchObject({
      found: true,
      internalPressure: { level: 'not_applicable', score: null },
    });
  });

  it('returns a safe not-found result without inventing plot facts', async () => {
    const { service, database } = createService();
    database.queryOne.mockResolvedValue(null);

    await expect(
      service.analyzePlotCompetitiveness('unknown'),
    ).resolves.toEqual(
      expect.objectContaining({ found: false, plotCode: 'UNKNOWN' }),
    );
  });

  it('requires login before reading customer lifecycle data', async () => {
    const { service, database, reminders } = createService();

    await expect(service.getCustomerCareOverview(null)).resolves.toEqual(
      expect.objectContaining({ loginRequired: true }),
    );
    expect(database.queryOne).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
    expect(reminders.my).not.toHaveBeenCalled();
  });

  it('scopes every customer-care source to the trusted user', async () => {
    const { service, database, reminders } = createService();
    database.queryOne.mockResolvedValue({
      ownedPlotCount: '1',
      activeContractCount: '1',
      activeRequestCount: '1',
      activeServiceOrderCount: '1',
      upcomingAppointmentCount: '1',
    });
    database.query
      .mockResolvedValueOnce([{ plotCode: 'A-01-001' }])
      .mockResolvedValueOnce([{ status: 'pending', plotCodes: ['A-01-001'] }])
      .mockResolvedValueOnce([{ status: 'confirmed', serviceName: 'Vệ sinh' }])
      .mockResolvedValueOnce([{ status: 'confirmed', date: '2026-08-02' }]);
    reminders.my.mockResolvedValue([
      {
        title: 'Ngày giỗ',
        reminderType: 'death_anniversary',
        isActive: true,
        nextDate: '2026-08-03',
        daysUntil: 2,
        plotCode: 'A-01-001',
      },
    ]);

    const result = await service.getCustomerCareOverview(7);

    expect(database.queryOne).toHaveBeenCalledWith(expect.any(String), [7]);
    expect(database.query).toHaveBeenCalledTimes(4);
    for (const call of database.query.mock.calls) {
      expect(call[1]).toEqual([7]);
    }
    expect(reminders.my).toHaveBeenCalledWith(7);
    expect(result).toMatchObject({
      loginRequired: false,
      summary: {
        ownedPlotCount: 1,
        activeRequestCount: 1,
        activeServiceOrderCount: 1,
        upcomingAppointmentCount: 1,
        activeReminderCount: 1,
      },
      upcomingReminders: [
        expect.objectContaining({ title: 'Ngày giỗ', daysUntil: 2 }),
      ],
    });
  });
});
