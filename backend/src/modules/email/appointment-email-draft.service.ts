import { Injectable } from '@nestjs/common';
import { EmailDraftAiService } from '../ai-agent/openai.service';

export interface AppointmentEmailDraftInput {
  customerName: string | null;
  appointmentDate: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  topic?: string | null;
  fallback: string;
}

export interface AppointmentEmailDraftResult {
  content: string;
  aiUsed: boolean;
}

@Injectable()
export class AppointmentEmailDraftService {
  private readonly cache = new Map<
    string,
    { result: AppointmentEmailDraftResult; expiresAt: number }
  >();

  constructor(private readonly fastLlm: EmailDraftAiService) {}

  async generate(
    input: AppointmentEmailDraftInput,
  ): Promise<AppointmentEmailDraftResult> {
    const cacheKey = JSON.stringify({
      customerName: input.customerName,
      appointmentDate: input.appointmentDate,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      topic: input.topic,
    });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    if (!this.fastLlm.isConfigured()) {
      return { content: input.fallback, aiUsed: false };
    }

    try {
      const response = await this.fastLlm.chat(
        [
          {
            role: 'system',
            content:
              'Bạn là trợ lý Vĩnh Phúc Viên, soạn phần thân email nhắc lịch hẹn gặp giữa khách hàng và ban quản lý vào ngày mai. Viết tiếng Việt trang trọng, ấm áp, tự nhiên, khoảng 80-130 từ; nếu nhắc ngày ở dạng YYYY-MM-DD thì trình bày lại thành DD/MM/YYYY. Không markdown, không emoji, không tiêu đề, không lời chào mở đầu và không ký tên kết thư. Nhắc rõ khách nên kiểm tra thời gian/địa điểm và chuẩn bị giấy tờ hoặc nội dung cần trao đổi nếu phù hợp, nhưng tuyệt đối không bịa loại giấy tờ, dịch vụ, lô đất, nhân sự hay cam kết nào không có trong dữ liệu. Nếu topic trống, chỉ nói chung là buổi hẹn với ban quản lý.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerName: input.customerName,
              appointmentDate: input.appointmentDate,
              startTime: input.startTime,
              endTime: input.endTime,
              location: input.location,
              topic: input.topic,
            }),
          },
        ],
        [],
        'auto',
        {
          temperature: 0.3,
          maxTokens: 260,
          routingKey: `appointment-reminder-${cacheKey}`,
          enableThinking: false,
          reasoningEffort: 'low',
        },
      );
      const content = (response.choices[0]?.message?.content ?? '')
        .replace(/^```(?:text)?\s*|\s*```$/g, '')
        .trim()
        .slice(0, 1800);
      if (!content) return { content: input.fallback, aiUsed: false };

      const result = { content, aiUsed: true };
      this.cache.set(cacheKey, {
        result,
        expiresAt: Date.now() + 15 * 60_000,
      });
      return result;
    } catch {
      return { content: input.fallback, aiUsed: false };
    }
  }
}
