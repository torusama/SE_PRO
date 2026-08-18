import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Gửi SMS OTP qua một SMS gateway generic (POST JSON tới SMS_API_URL kèm
// Bearer SMS_API_KEY — phù hợp với hầu hết nhà cung cấp VN như eSMS, SpeedSMS,
// Twilio (đổi URL/format cho khớp API thật của nhà cung cấp bạn chọn).
//
// QUAN TRỌNG: nếu chưa cấu hình SMS_API_URL/SMS_API_KEY trong .env, hệ thống
// KHÔNG giả vờ gửi thành công. Ở môi trường development, mã OTP được ghi ra
// log server VÀ trả kèm trong response (field `devOtpCode`) để bạn test được
// tính năng mà không cần trả phí SMS thật — ở production thì bắt buộc phải
// cấu hình, không có đường vòng.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const sms = this.config.get<{ apiUrl?: string; apiKey?: string }>('sms');
    return Boolean(sms?.apiUrl && sms?.apiKey);
  }

  /** Trả về `devOtpCode` CHỈ khi đang ở dev-fallback (chưa cấu hình gateway thật). */
  async sendOtpSms(
    phone: string,
    code: string,
  ): Promise<{ devOtpCode?: string }> {
    const sms = this.config.get<{ apiUrl?: string; apiKey?: string }>('sms');
    const isProd = this.config.get<string>('nodeEnv') === 'production';

    if (sms?.apiUrl && sms?.apiKey) {
      const res = await fetch(sms.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sms.apiKey}`,
        },
        body: JSON.stringify({
          phone,
          message: `Ma xac thuc Vinh Phuc Vien cua ban la: ${code}. Ma co hieu luc 10 phut.`,
        }),
      });
      if (!res.ok) {
        throw new Error(`Gửi SMS thất bại (SMS gateway trả về ${res.status}).`);
      }
      return {};
    }

    if (isProd) {
      throw new Error(
        'Máy chủ chưa cấu hình dịch vụ gửi SMS (SMS_API_URL/SMS_API_KEY trong .env).',
      );
    }

    // Dev-fallback: KHÔNG dùng ở production (bị chặn bởi nhánh isProd ở trên).
    this.logger.warn(
      `[DEV-ONLY, không gửi SMS thật] Mã OTP cho ${phone}: ${code}`,
    );
    return { devOtpCode: code };
  }
}
