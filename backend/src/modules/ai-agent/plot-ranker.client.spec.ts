import { ConfigService } from '@nestjs/config';
import { PlotRankerClient, PlotRankerOption } from './plot-ranker.client';

const options: PlotRankerOption[] = [
  {
    optionId: 'OPT-001',
    features: {
      budget_match_score: 0.8,
      zone_match: 1,
    },
  },
  {
    optionId: 'OPT-002',
    features: {
      budget_match_score: 0.7,
      zone_match: 1,
    },
  },
];

function client(enabled: boolean) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ai.plotRankerEnabled') return enabled;
      if (key === 'ml.serviceUrl') return 'http://ml.test';
      if (key === 'ml.timeoutMs') return 1000;
      return undefined;
    }),
  };
  return new PlotRankerClient(config as unknown as ConfigService);
}

describe('PlotRankerClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is disabled by default and does not call the ML service', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('must not be called'));

    await expect(client(false).predict(options)).resolves.toEqual({
      enabled: false,
      prediction: null,
      fallbackReason: 'disabled',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back deterministically when no active model exists', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('no active model', { status: 503 }));

    await expect(client(true).predict(options)).resolves.toEqual({
      enabled: true,
      prediction: null,
      fallbackReason: 'no_active_model',
    });
  });

  it('rejects incomplete ML predictions instead of mixing scores', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          modelVersion: 'plot-ranker-test',
          predictions: [{ optionId: 'OPT-001', score: 0.9 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client(true).predict(options)).resolves.toEqual({
      enabled: true,
      prediction: null,
      fallbackReason: 'incomplete_predictions',
    });
  });

  it('returns a complete valid prediction with its model version', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          modelVersion: 'plot-ranker-test',
          predictions: [
            { optionId: 'OPT-001', score: 0.2 },
            { optionId: 'OPT-002', score: 0.9 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await client(true).predict(options);

    expect(result.enabled).toBe(true);
    expect(result.fallbackReason).toBeUndefined();
    expect(result.prediction?.modelVersion).toBe('plot-ranker-test');
    expect(result.prediction?.predictions).toHaveLength(2);
  });
});
