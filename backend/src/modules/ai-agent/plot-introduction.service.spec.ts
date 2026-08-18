import { PlotIntroductionService } from './plot-introduction.service';

describe('PlotIntroductionService', () => {
  const plot = {
    id: 7,
    plotCode: 'A-02-005',
    zoneName: 'Khu A - Cao cấp',
    price: 48000000,
    status: 'available',
    direction: 'Nam',
    plotType: 'single',
    areaSqm: 4,
    rowNumber: '02',
    columnNumber: '005',
    description: 'Lô còn trống trong quỹ hiện tại.',
  };

  it('uses the shared content pool for an AI introduction', async () => {
    const database = { queryOne: jest.fn().mockResolvedValue(plot) };
    const contentLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'Lô A-02-005 thuộc Khu A, phù hợp để gia đình cân nhắc khi ưu tiên diện tích gọn và hướng Nam.',
            },
          },
        ],
      }),
    };
    const service = new PlotIntroductionService(
      database as never,
      contentLlm as never,
    );

    await expect(service.generate(7)).resolves.toEqual({
      introduction:
        'Lô A-02-005 thuộc Khu A, phù hợp để gia đình cân nhắc khi ưu tiên diện tích gọn và hướng Nam.',
      source: 'ai',
    });
    expect(contentLlm.chat).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      'auto',
      expect.objectContaining({
        routingKey: 'plot-introduction-7',
        enableThinking: false,
        reasoningEffort: 'low',
      }),
    );
  });

  it('keeps the factual fallback when the shared model is unavailable', async () => {
    const database = { queryOne: jest.fn().mockResolvedValue(plot) };
    const contentLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockRejectedValue(new Error('provider busy')),
    };
    const service = new PlotIntroductionService(
      database as never,
      contentLlm as never,
    );

    const result = await service.generate(7);

    expect(result.source).toBe('fallback');
    expect(result.introduction).toContain('A-02-005');
    expect(result.introduction).toContain('48.000.000 VND');
  });

  it('rejects invented investment language and returns factual data', async () => {
    const database = { queryOne: jest.fn().mockResolvedValue(plot) };
    const contentLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'Đây là cơ hội đầu tư uy tín cho một dự án nghĩa trang hiện đại.',
            },
          },
        ],
      }),
    };
    const service = new PlotIntroductionService(
      database as never,
      contentLlm as never,
    );

    const result = await service.generate(7);

    expect(result.source).toBe('fallback');
    expect(result.introduction).toContain('A-02-005');
    expect(result.introduction).not.toContain('cơ hội đầu tư');
  });
});
