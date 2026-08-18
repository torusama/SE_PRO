import { MemorialEmailDraftService } from './memorial-email-draft.service';

describe('MemorialEmailDraftService', () => {
  const input = {
    customerName: 'Nguyễn Văn A',
    title: 'Ngày tưởng niệm người thân',
    dateLabel: '20/8 hằng năm (dương lịch)',
    fallback: 'Nội dung dự phòng an toàn.',
  };

  it('uses the fast language model when it returns a draft', async () => {
    const fastLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Kính gửi gia đình, đây là lời nhắc trang trọng.' } }],
      }),
    };
    const service = new MemorialEmailDraftService(fastLlm as never);

    await expect(service.generate(input)).resolves.toBe(
      'Kính gửi gia đình, đây là lời nhắc trang trọng.',
    );
    expect(fastLlm.chat).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      'auto',
      expect.objectContaining({
        enableThinking: false,
        reasoningEffort: 'low',
      }),
    );
  });

  it('falls back without interrupting the reminder workflow', async () => {
    const fastLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockRejectedValue(new Error('provider busy')),
    };
    const service = new MemorialEmailDraftService(fastLlm as never);

    await expect(service.generate(input)).resolves.toBe(input.fallback);
  });
});
