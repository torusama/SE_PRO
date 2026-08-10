import { AppointmentEmailDraftService } from './appointment-email-draft.service';

describe('AppointmentEmailDraftService', () => {
  function createService(configured = true) {
    const llm = {
      isConfigured: jest.fn(() => configured),
      chat: jest.fn(),
    };
    return {
      llm,
      service: new AppointmentEmailDraftService(llm as never),
    };
  }

  const input = {
    customerName: 'An Võ',
    appointmentDate: '2099-08-11',
    startTime: '09:00',
    endTime: '10:00',
    location: 'Vĩnh Phúc Viên',
    topic: 'Trao đổi lịch hẹn',
    fallback: 'Nội dung nhắc lịch dự phòng.',
  };

  it('prioritizes AI-generated body text when the draft model succeeds', async () => {
    const { service, llm } = createService();
    llm.chat.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Buổi hẹn đã được xác nhận cho ngày mai. Quý khách vui lòng kiểm tra lại thời gian và địa điểm trước khi đến.',
          },
        },
      ],
    });

    const result = await service.generate(input);

    expect(result.aiUsed).toBe(true);
    expect(result.content).toContain('Buổi hẹn đã được xác nhận');
    expect(llm.chat).toHaveBeenCalledTimes(1);
  });

  it('uses the controlled fallback when the AI provider is unavailable', async () => {
    const { service, llm } = createService(false);

    const result = await service.generate(input);

    expect(result).toEqual({
      content: input.fallback,
      aiUsed: false,
    });
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('uses the controlled fallback when AI generation fails', async () => {
    const { service, llm } = createService();
    llm.chat.mockRejectedValue(new Error('provider timeout'));

    const result = await service.generate(input);

    expect(result).toEqual({
      content: input.fallback,
      aiUsed: false,
    });
  });
});
