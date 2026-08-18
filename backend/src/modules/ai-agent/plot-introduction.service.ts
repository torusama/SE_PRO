import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EmailDraftAiService } from './openai.service';

interface PlotIntroductionRow {
  id: number;
  plotCode: string;
  zoneName: string;
  price: number | string;
  status: string;
  direction: string | null;
  plotType: string;
  areaSqm: number | string | null;
  rowNumber: string | null;
  columnNumber: string | null;
  description: string | null;
}

@Injectable()
export class PlotIntroductionService {
  private readonly cache = new Map<
    number,
    { fingerprint: string; introduction: string; expiresAt: number }
  >();

  constructor(
    private readonly database: DatabaseService,
    // Email and plot copy are low-volume content-generation tasks. Sharing one
    // provider instance means they also share rotation, affinity and cooldown
    // state instead of competing with the customer-chat pools.
    private readonly contentLlm: EmailDraftAiService,
  ) {}

  async generate(plotId: number) {
    const plot = await this.database.queryOne<PlotIntroductionRow>(
      `SELECT p.plot_id AS id, p.plot_code AS "plotCode",
              z.zone_name AS "zoneName", p.price::float, p.status,
              p.direction, p.plot_type AS "plotType",
              p.area_sqm::float AS "areaSqm", p.row_number AS "rowNumber",
              p.column_number AS "columnNumber", p.description
       FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE p.plot_id = $1 AND p.is_deleted = FALSE`,
      [plotId],
    );
    if (!plot) {
      return {
        introduction: 'Thông tin giới thiệu của lô này hiện chưa khả dụng.',
        source: 'fallback' as const,
      };
    }

    const normalized = {
      ...plot,
      price: Number(plot.price),
      areaSqm: Number(plot.areaSqm ?? 0),
    };
    const fingerprint = JSON.stringify(normalized);
    const cached = this.cache.get(plotId);
    if (
      cached &&
      cached.fingerprint === fingerprint &&
      cached.expiresAt > Date.now()
    ) {
      return { introduction: cached.introduction, source: 'ai' as const };
    }

    const fallback = this.fallback(normalized);
    if (!this.contentLlm.isConfigured()) {
      return { introduction: fallback, source: 'fallback' as const };
    }

    try {
      const response = await this.contentLlm.chat(
        [
          {
            role: 'system',
            content:
              'Bạn viết phần giới thiệu ngắn cho một lô đất nghĩa trang tại Vĩnh Phúc Viên, dành cho gia đình đang cân nhắc nơi an nghỉ. Viết tiếng Việt tự nhiên, trang trọng, 55-90 từ, một đoạn duy nhất, không markdown, không emoji. Chỉ sử dụng dữ liệu được cung cấp; không tự suy đoán phong thủy, cảnh quan, độ yên tĩnh, khoảng cách, pháp lý hoặc ưu đãi. Không gọi lô đất là cơ hội đầu tư, dự án hoặc sản phẩm sinh lời; không tự nhận xét uy tín. Chọn tối đa hai đặc điểm hữu ích để diễn đạt thay vì đọc lại toàn bộ bảng dữ liệu. Nếu mô tả gốc có thông tin cụ thể thì diễn đạt lại tự nhiên.',
          },
          {
            role: 'user',
            content: JSON.stringify(normalized),
          },
        ],
        [],
        'auto',
        {
          temperature: 0.25,
          maxTokens: 180,
          // Map copy is non-blocking and has an immediate factual fallback, so
          // it must not inherit the longer allowance used by scheduled email.
          timeoutMs: 10000,
          totalTimeoutMs: 12000,
          routingKey: `plot-introduction-${plotId}`,
          enableThinking: false,
          reasoningEffort: 'low',
        },
      );
      const introduction = (response.choices[0]?.message?.content ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 900);
      if (!this.isAcceptableIntroduction(introduction)) {
        throw new Error('Unsafe or unusable plot introduction');
      }
      this.cache.set(plotId, {
        fingerprint,
        introduction,
        expiresAt: Date.now() + 15 * 60_000,
      });
      return { introduction, source: 'ai' as const };
    } catch {
      return { introduction: fallback, source: 'fallback' as const };
    }
  }

  private fallback(plot: PlotIntroductionRow & { price: number; areaSqm: number }) {
    const type =
      plot.plotType === 'family'
        ? 'lô gia đình'
        : plot.plotType === 'double'
          ? 'lô đôi'
          : 'lô đơn';
    const location = [
      plot.zoneName,
      plot.rowNumber ? `hàng ${plot.rowNumber}` : '',
      plot.columnNumber ? `ô ${plot.columnNumber}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const facts = [
      `Lô ${plot.plotCode} là ${type} tại ${location}`,
      plot.areaSqm > 0 ? `diện tích ${plot.areaSqm.toLocaleString('vi-VN')} m²` : '',
      plot.direction ? `hướng ${plot.direction}` : '',
      plot.price > 0
        ? `giá niêm yết ${plot.price.toLocaleString('vi-VN')} VND`
        : '',
    ].filter(Boolean);
    const original = plot.description?.trim();
    return `${facts.join(', ')}.${original ? ` ${original}` : ''}`.slice(0, 900);
  }

  private isAcceptableIntroduction(value: string) {
    if (!value) return false;
    return !/(?:cơ hội đầu tư|dự án nghĩa trang|sinh lời|sổ đỏ|pháp lý đầy đủ|cam kết|uy tín)/i.test(
      value,
    );
  }
}
