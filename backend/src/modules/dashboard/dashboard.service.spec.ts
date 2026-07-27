import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const database = {
    queryOne: jest.fn(),
    query: jest.fn(),
  };
  const service = new DashboardService(database as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns real aggregate fields and preserves zero values', async () => {
    database.queryOne.mockResolvedValue({
      totalPlots: 0,
      regularRequests: 2,
      aiDraftRequests: 1,
      totalPaid: 0,
    });
    await expect(service.summary()).resolves.toMatchObject({
      totalPlots: 0,
      regularRequests: 2,
      aiDraftRequests: 1,
      totalPaid: 0,
    });
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('admin_transfer_batches'),
    );
  });

  it('uses an allow-listed revenue period', async () => {
    database.query.mockResolvedValue([]);
    await service.revenue('quarter');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("date_trunc('quarter'"),
    );
  });
});
