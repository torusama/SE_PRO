import { Injectable } from '@nestjs/common';
import { EmailDraftAiService } from './openai.service';

interface MemorialDraftInput {
  customerName: string | null;
  title: string;
  dateLabel: string;
  fallback: string;
}

@Injectable()
export class MemorialEmailDraftService {
  private readonly cache = new Map<
    string,
    { content: string; expiresAt: number }
  >();

  constructor(private readonly fastLlm: EmailDraftAiService) {}

  async generate(input: MemorialDraftInput) {
    const cacheKey = JSON.stringify({
      customerName: input.customerName,
      title: input.title,
      dateLabel: input.dateLabel,
    });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.content;
    if (!this.fastLlm.isConfigured()) return input.fallback;

    try {
      const response = await this.fastLlm.chat(
        [
          {
            role: 'system',
            content:
              'Bạn soạn phần thân email nhắc ngày tưởng niệm cho gia đình tại Vĩnh Phúc Viên. Viết tiếng Việt trang trọng, ấm áp và tự nhiên, 90-140 từ, không markdown, không emoji, không tiêu đề, không lời chào mở đầu và không ký tên kết thư. Đây là thông báo về ngày tưởng niệm hoặc ngày giỗ của người thân đã qua đời, tuyệt đối không hiểu thành cuộc hẹn thăm người đang sống. Nhắc gia đình chủ động chuẩn bị và cho biết Vĩnh Phúc Viên sẵn sàng hỗ trợ. Không bịa tên người đã mất, quan hệ gia đình, nghi thức, tôn giáo, dịch vụ đã mua hoặc bất kỳ dữ kiện nào không được cung cấp.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerName: input.customerName,
              eventTitle: input.title,
              eventDate: input.dateLabel,
            }),
          },
        ],
        [],
        'auto',
        {
          temperature: 0.35,
          maxTokens: 260,
          routingKey: `memorial-email-${cacheKey}`,
          enableThinking: false,
          reasoningEffort: 'low',
        },
      );
      const content = (response.choices[0]?.message?.content ?? '')
        .replace(/^```(?:text)?\s*|\s*```$/g, '')
        .trim()
        .slice(0, 1800);
      if (!content) return input.fallback;
      this.cache.set(cacheKey, {
        content,
        expiresAt: Date.now() + 15 * 60_000,
      });
      return content;
    } catch {
      return input.fallback;
    }
  }
}
