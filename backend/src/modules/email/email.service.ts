import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Gói gọn việc gửi mail qua SMTP (mặc định cấu hình sẵn cho Gmail SMTP + App
// Password — xem hướng dẫn trong backend/.env.example). Không cứng bất kỳ nội
// dung/mẫu email nào chứa dữ liệu giả — OTP luôn được sinh ngẫu nhiên thật.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const smtp = this.config.get<{
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from?: string;
    }>('smtp');

    if (!smtp?.user || !smtp?.pass) {
      // Chưa cấu hình SMTP_USER/SMTP_PASS trong .env — không throw để app vẫn
      // chạy được (các API khác không phụ thuộc email), nhưng gửi OTP sẽ báo lỗi rõ ràng.
      this.logger.warn(
        'SMTP chưa được cấu hình (SMTP_USER/SMTP_PASS trống) — chức năng gửi email OTP sẽ không hoạt động cho đến khi bạn điền file .env.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendOtpEmail(to: string, otpCode: string, purpose: string) {
    if (!this.transporter) {
      throw new Error(
        'Máy chủ chưa cấu hình SMTP (SMTP_USER/SMTP_PASS). Vui lòng điền file backend/.env rồi khởi động lại server.',
      );
    }
    const smtp = this.config.get<{ from?: string }>('smtp');

    await this.transporter.sendMail({
      from: smtp?.from ? `"Vĩnh Phúc Viên" <${smtp.from}>` : undefined,
      to,
      subject: `[Vĩnh Phúc Viên] Mã xác thực email của bạn: ${otpCode}`,
      text: `Mã xác thực (OTP) cho ${purpose} của bạn là: ${otpCode}\n\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này cho bất kỳ ai.\n\nNếu bạn không yêu cầu mã này, vui lòng bỏ qua email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f766e;">Xác thực email</h2>
          <p>Mã xác thực (OTP) cho <b>${purpose}</b> của bạn là:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color:#0f766e;">${otpCode}</p>
          <p>Mã có hiệu lực trong <b>10 phút</b>. Không chia sẻ mã này cho bất kỳ ai.</p>
          <p style="color:#888; font-size:12px;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
        </div>
      `,
    });
  }

  /** Gửi email nhắc lịch (ngày giỗ / tưởng niệm / chăm sóc mộ...) tới 1 địa
   * chỉ Gmail mà người dùng đã thêm ở "Kênh nhận thông báo". Không throw khi
   * SMTP chưa cấu hình — chỉ log cảnh báo, để không làm gián đoạn cron job
   * (in-app notification vẫn được tạo bình thường). */
  async sendReminderEmail(to: string, title: string, message: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Bỏ qua gửi email nhắc lịch tới ${to} vì SMTP chưa được cấu hình.`,
      );
      return;
    }
    const smtp = this.config.get<{ from?: string }>('smtp');

    await this.transporter.sendMail({
      from: smtp?.from ? `"Vĩnh Phúc Viên" <${smtp.from}>` : undefined,
      to,
      subject: `[Vĩnh Phúc Viên] Nhắc lịch: ${title}`,
      text: `${message}\n\nBạn nhận được email này vì đã đăng ký nhận thông báo nhắc lịch qua Gmail này trên hệ thống Vĩnh Phúc Viên.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f766e;">🕯️ ${title}</h2>
          <p style="font-size: 15px;">${message}</p>
          <p style="color:#888; font-size:12px;">Bạn nhận được email này vì đã đăng ký nhận thông báo nhắc lịch qua Gmail này trên hệ thống Vĩnh Phúc Viên.</p>
        </div>
      `,
    });
  }
}
