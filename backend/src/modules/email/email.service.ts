import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { GmailApiClient } from './gmail-api.client';
import { GmailMessage } from './gmail-message';

// Gói gọn việc gửi mail qua Gmail HTTP API. Không cứng bất kỳ nội dung/mẫu
// email nào chứa dữ liệu giả — OTP luôn được sinh ngẫu nhiên thật.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly gmailApi: GmailApiClient) {
    if (!this.gmailApi.isConfigured()) {
      // Không throw để các API không phụ thuộc email vẫn khởi động được. Các
      // luồng bắt buộc gửi mail như OTP sẽ báo lỗi rõ ràng khi được gọi.
      this.logger.warn(
        'Gmail API chưa được cấu hình đầy đủ — chức năng gửi email sẽ không hoạt động cho đến khi bạn điền các biến GMAIL_* trong backend/.env.',
      );
    }
  }

  isConfigured(): boolean {
    return this.gmailApi.isConfigured();
  }

  private async sendEmail(message: GmailMessage): Promise<void> {
    await this.gmailApi.send(message);
  }

  async sendOtpEmail(to: string, otpCode: string, purpose: string) {
    await this.sendEmail({
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
   * Gmail API chưa cấu hình — chỉ log cảnh báo, để không làm gián đoạn cron job
   * (in-app notification vẫn được tạo bình thường). */
  async sendReminderEmail(to: string, title: string, message: string) {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Bỏ qua gửi email nhắc lịch tới ${to} vì Gmail API chưa được cấu hình.`,
      );
      return;
    }

    await this.sendEmail({
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

  /** Gửi email xác nhận cho khách hàng ngay sau khi đặt một dịch vụ mới
   * (chăm sóc mộ, thay hoa, thắp hương...). Không throw khi Gmail API chưa cấu
   * hình — chỉ log cảnh báo, để không làm luồng đặt dịch vụ bị lỗi. */
  async sendServiceOrderConfirmationEmail(
    to: string,
    params: {
      serviceName: string;
      plotCode?: string | null;
      requestedDate?: string | null;
      amount: number;
      orderId: number;
    },
  ) {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Bỏ qua gửi email xác nhận đặt dịch vụ tới ${to} vì Gmail API chưa được cấu hình.`,
      );
      return;
    }
    const amountText = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(params.amount);
    const dateText = params.requestedDate
      ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
          new Date(params.requestedDate),
        )
      : 'Chưa chọn';
    const orderCode = `#DV-${String(params.orderId).padStart(4, '0')}`;

    await this.sendEmail({
      to,
      subject: `[Vĩnh Phúc Viên] Đã ghi nhận đặt dịch vụ: ${params.serviceName}`,
      text: `Bạn đã đặt dịch vụ "${params.serviceName}" (mã đơn ${orderCode}) vào ngày ${dateText}${
        params.plotCode ? ` cho lô ${params.plotCode}` : ''
      }. Đơn giá: ${amountText}.\n\nĐơn của bạn đang ở trạng thái chờ xác nhận từ ban quản lý. Chúng tôi sẽ gửi email/thông báo khi có cập nhật mới.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f766e;">🌸 Đã ghi nhận đặt dịch vụ</h2>
          <p>Bạn đã đặt dịch vụ <b>${params.serviceName}</b> (mã đơn ${orderCode}).</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            ${
              params.plotCode
                ? `<tr><td style="padding:4px 0; color:#666;">Lô phần mộ</td><td style="padding:4px 0; text-align:right; font-weight:600;">${params.plotCode}</td></tr>`
                : ''
            }
            <tr><td style="padding:4px 0; color:#666;">Ngày mong muốn thực hiện</td><td style="padding:4px 0; text-align:right; font-weight:600;">${dateText}</td></tr>
            <tr><td style="padding:4px 0; color:#666;">Đơn giá</td><td style="padding:4px 0; text-align:right; font-weight:600;">${amountText}</td></tr>
          </table>
          <p>Đơn của bạn đang ở trạng thái <b>chờ xác nhận</b> từ ban quản lý. Chúng tôi sẽ thông báo ngay khi có cập nhật mới.</p>
          <p style="color:#888; font-size:12px;">Bạn nhận được email này vì đã đặt dịch vụ trên hệ thống Vĩnh Phúc Viên.</p>
        </div>
      `,
    });
  }

  /** Gửi email cho khách hàng khi admin xác nhận HOÀN THÀNH dịch vụ, kèm
   * ảnh bằng chứng (đính kèm trực tiếp trong email) và nội dung hoàn thành.
   * Không throw khi Gmail API chưa cấu hình — chỉ log cảnh báo, để không làm
   * gián đoạn thao tác hoàn thành đơn của admin. */
  async sendServiceOrderCompletionEmail(
    to: string,
    params: {
      orderId: number;
      serviceName: string;
      completionNote?: string | null;
      completedAt?: string | null;
      attachments: { filename: string; path: string }[];
    },
  ) {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Bỏ qua gửi email hoàn thành dịch vụ tới ${to} vì Gmail API chưa được cấu hình.`,
      );
      return;
    }
    const orderCode = `#DV-${String(params.orderId).padStart(4, '0')}`;
    const dateText = params.completedAt
      ? new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(params.completedAt))
      : new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date());
    const noteText =
      params.completionNote?.trim() ||
      'Dịch vụ đã được thực hiện đầy đủ theo yêu cầu.';

    const attachments = await Promise.all(
      params.attachments.map(async (attachment) => ({
        filename: attachment.filename,
        content: await readFile(attachment.path),
      })),
    );

    await this.sendEmail({
      to,
      subject: `[Vĩnh Phúc Viên] Đã hoàn thành dịch vụ: ${params.serviceName}`,
      text: `Dịch vụ "${params.serviceName}" (mã đơn ${orderCode}) của bạn đã được hoàn thành lúc ${dateText}.\n\nNội dung thực hiện: ${noteText}\n\n${
        params.attachments.length
          ? `Chúng tôi đính kèm ${params.attachments.length} ảnh bằng chứng hoàn thành trong email này.`
          : ''
      }\n\nCảm ơn bạn đã sử dụng dịch vụ tại Vĩnh Phúc Viên.`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color:#0f766e;">✅ Đã hoàn thành dịch vụ</h2>
          <p>Dịch vụ <b>${params.serviceName}</b> (mã đơn ${orderCode}) của bạn đã được hoàn thành lúc <b>${dateText}</b>.</p>
          <div style="background:#f0fdfa; border-left:4px solid #0f766e; padding:12px 16px; margin:16px 0; border-radius:4px;">
            <strong>Nội dung thực hiện:</strong>
            <p style="margin:8px 0 0;">${noteText}</p>
          </div>
          ${
            params.attachments.length
              ? `<p>Ảnh bằng chứng hoàn thành được đính kèm trong email này (${params.attachments.length} ảnh).</p>`
              : ''
          }
          <p style="color:#888; font-size:12px; margin-top:24px;">Bạn nhận được email này vì đã đặt dịch vụ trên hệ thống Vĩnh Phúc Viên. Cảm ơn bạn đã tin tưởng sử dụng dịch vụ.</p>
        </div>
      `,
      attachments,
    });
  }

  /** Gửi email chứa liên kết đặt lại mật khẩu (luồng "Quên mật khẩu"). */
  async sendPasswordResetEmail(to: string, resetLink: string) {
    await this.sendEmail({
      to,
      subject: '[Vĩnh Phúc Viên] Yêu cầu đặt lại mật khẩu',
      text: `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\n\nBấm vào liên kết sau để đặt mật khẩu mới (liên kết có hiệu lực trong 30 phút):\n${resetLink}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f766e;">Đặt lại mật khẩu</h2>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="background:#0f766e;color:#fff;padding:12px 22px;text-decoration:none;border-radius:4px;font-weight:600;display:inline-block;">
              Đặt lại mật khẩu
            </a>
          </p>
          <p>Hoặc dán liên kết sau vào trình duyệt:<br/>
            <a href="${resetLink}">${resetLink}</a>
          </p>
          <p>Liên kết có hiệu lực trong <b>30 phút</b>.</p>
          <p style="color:#888; font-size:12px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.</p>
        </div>
      `,
    });
  }
}
