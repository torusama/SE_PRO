import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { TrainingService } from './training.service';

describe('TrainingService learning-signal bridge', () => {
  it('materializes one complete pairwise signal as selected/rejected rows', async () => {
    const database = {
      query: jest.fn().mockResolvedValue([
        {
          signalId: 71,
          selectedOptionId: 'OPT-002',
          rejectedOptionId: 'OPT-001',
          featureSnapshot: {
            'OPT-001': { zone_match: 0, budget_match_score: 0.9 },
            'OPT-002': { zone_match: 1, budget_match_score: 0.7 },
          },
        },
      ]),
      queryOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 1001 })
        .mockResolvedValueOnce({ id: 1002 }),
    };
    const config = { get: jest.fn() };
    const service = new TrainingService(
      database as unknown as DatabaseService,
      config as unknown as ConfigService,
    );

    const count = await (
      service as unknown as {
        materializeReadySignals: (
          adminId: number,
          datasetVersion: string,
        ) => Promise<number>;
      }
    ).materializeReadySignals(9, 'dataset-review');

    expect(count).toBe(2);
    expect(database.queryOne).toHaveBeenCalledTimes(2);
    expect(database.queryOne.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        71,
        JSON.stringify({ zone_match: 1, budget_match_score: 0.7 }),
        JSON.stringify({ label_selected: 1 }),
        'dataset-review',
        9,
        '1',
      ]),
    );
    expect(database.queryOne.mock.calls[1][1]).toEqual(
      expect.arrayContaining([
        71,
        JSON.stringify({ zone_match: 0, budget_match_score: 0.9 }),
        JSON.stringify({ label_selected: 0 }),
        'dataset-review',
        9,
        '0',
      ]),
    );
  });

  it('does not materialize an incomplete feature snapshot', async () => {
    const database = {
      query: jest.fn().mockResolvedValue([
        {
          signalId: 72,
          selectedOptionId: 'OPT-002',
          rejectedOptionId: 'OPT-001',
          featureSnapshot: {
            'OPT-002': { zone_match: 1 },
          },
        },
      ]),
      queryOne: jest.fn(),
    };
    const service = new TrainingService(
      database as unknown as DatabaseService,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const count = await (
      service as unknown as {
        materializeReadySignals: (
          adminId: number,
          datasetVersion: string,
        ) => Promise<number>;
      }
    ).materializeReadySignals(9, 'dataset-review');

    expect(count).toBe(0);
    expect(database.queryOne).not.toHaveBeenCalled();
  });
});
