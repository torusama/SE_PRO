import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import { GmailApiClient } from './gmail-api.client';
import { GmailMessage } from './gmail-message';

// Gói gọn việc gửi mail qua Gmail HTTP API. Không cứng bất kỳ nội dung/mẫu
// email nào chứa dữ liệu giả — OTP luôn được sinh ngẫu nhiên thật.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly gmailApi: GmailApiClient,
    private readonly config: ConfigService,
  ) {
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

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  /**
   * Makes short identifiers easy to copy. Real email clients (Gmail/Outlook)
   * intentionally block JavaScript, so the onclick clipboard call is only an
   * enhancement for browser/HTML previews. The CSS user-select fallback keeps
   * the whole value selectable in mail clients so the user can copy it without
   * dragging across individual characters.
   */
  private renderCopyableCode(value: string, options?: {
    color?: string;
    fontSize?: string;
    letterSpacing?: string;
    fontFamily?: string;
    fontWeight?: number;
  }): string {
    const safeValue = this.escapeHtml(value);
    const jsValue = JSON.stringify(String(value)).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const color = options?.color ?? '#1c453b';
    const fontSize = options?.fontSize ?? '13.5px';
    const letterSpacing = options?.letterSpacing ?? '0';
    const fontFamily = options?.fontFamily ?? "'Segoe UI',Tahoma,Arial,sans-serif";
    const fontWeight = options?.fontWeight ?? 700;

    return `<span role="button" tabindex="0" title="Bấm để sao chép" onclick="try{navigator.clipboard&&navigator.clipboard.writeText(${jsValue});this.setAttribute('title','Đã sao chép');}catch(e){}" style="display:inline-block;cursor:pointer;-webkit-user-select:all;user-select:all;font-family:${fontFamily};font-size:${fontSize};line-height:inherit;font-weight:${fontWeight};letter-spacing:${letterSpacing};color:${color};">${safeValue}</span>`;
  }

  private getBannerAttachment(filename: string) {
    const candidates = [
      path.join(process.cwd(), 'src', 'email', 'banner', filename),
      path.join(process.cwd(), 'email', 'banner', filename),
      path.join(__dirname, 'banner', filename),
    ];

    const bannerPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!bannerPath) {
      this.logger.warn(
        `Không tìm thấy banner email ${filename}. Đã thử: ${candidates.join(', ')}`,
      );
      return null;
    }

    return {
      filename,
      content: fs.readFileSync(bannerPath),
    };
  }

  /**
   * HTML email renderer intentionally uses old-school presentation tables +
   * inline styles. Gmail and many real mail clients do not reliably keep
   * position:absolute, class-based <style> rules, or CSS-only cid backgrounds.
   * The banner files shipped with this module are pre-sized to exactly 600x849,
   * so the table background still matches the browser preview even when a mail
   * client ignores background-size.
   */
  private renderShell(params: {
    theme: 'dark' | 'light';
    bannerCid: string;
    content: string;
    footerLine: string;
    /**
     * Keep the footer anchored to the exact same Y position even when a
     * service card needs a little more vertical room. The reminder uses the
     * original 592px content area; service mails can use up to 630px.
     */
    contentHeight?: number;
    /**
     * Moves only the visible footer copy slightly lower without changing the
     * fixed 600x849 canvas. Useful for the taller order-confirmation card.
     */
    footerShiftDown?: number;
  }): string {
    const dark = params.theme === 'dark';
    const brandColor = dark ? '#fff3d8' : '#24574b';
    const ruleColor = dark ? '#f3dfa8' : '#2c5c50';
    const footerColor = '#faf4e6';
    const footerBrand = dark ? '#fff0ce' : '#fff5dc';
    const footerSlogan = dark ? '#eadfc9' : '#eee7d6';

    // Header is always 112px and the whole artwork is always 849px.
    // The footer content itself needs 107px. By shrinking only the empty
    // space above that footer, its visible text stays at the same Y position
    // as the reminder email while giving tall service cards more room.
    const contentHeight = Math.min(Math.max(params.contentHeight ?? 592, 592), 630);
    const footerHeight = 849 - 112 - contentHeight;
    const footerShiftDown = Math.min(Math.max(params.footerShiftDown ?? 0, 0), 18);
    const footerTopSpace = footerHeight - 107 + footerShiftDown;
    const footerBottomSpace = 22 - footerShiftDown;

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body style="margin:0;padding:0;background-color:#eef0ea;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#eef0ea" style="width:100%;border-collapse:collapse;background-color:#eef0ea;">
      <tr>
        <td align="center" style="padding:24px 0;">
          <table role="presentation" width="600" height="849" border="0" cellspacing="0" cellpadding="0" bgcolor="${dark ? '#2f7459' : '#dff3ef'}" background="cid:${params.bannerCid}" style="width:600px;height:849px;border-collapse:separate;border-spacing:0;table-layout:fixed;background-color:${dark ? '#2f7459' : '#dff3ef'};background-image:url('cid:${params.bannerCid}');background-repeat:no-repeat;background-position:center top;background-size:600px 849px;border-radius:16px;overflow:hidden;">
            <tr>
              <td width="600" height="849" valign="top" style="width:600px;height:849px;padding:0;margin:0;">
                <table role="presentation" width="600" height="849" border="0" cellspacing="0" cellpadding="0" style="width:600px;height:849px;border-collapse:collapse;table-layout:fixed;">
                  <!-- IMPORTANT: fixed-height rows must NOT have vertical padding.
                       Gmail adds TD padding on top of the declared height, which made
                       the 849px artwork end early and pushed the footer into a fake
                       solid-green strip. Nested tables keep the whole mail exactly
                       600x849, matching the approved HTML preview. -->
                  <tr>
                    <td height="112" align="center" valign="top" style="height:112px;padding:0;text-align:center;">
                      <table role="presentation" width="600" height="112" border="0" cellspacing="0" cellpadding="0" style="width:600px;height:112px;border-collapse:collapse;">
                        <tr><td height="27" style="height:27px;font-size:0;line-height:0;">&nbsp;</td></tr>
                        <tr>
                          <td align="center" style="height:28px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:28px;letter-spacing:3.2px;font-weight:700;text-transform:uppercase;color:${brandColor};text-shadow:0 1px 3px rgba(15,30,22,.25);">VĨNH PHÚC VIÊN</td>
                        </tr>
                        <tr><td height="13" style="height:13px;font-size:0;line-height:0;">&nbsp;</td></tr>
                        <tr>
                          <td align="center" style="height:1px;font-size:0;line-height:0;text-align:center;">
                            <table role="presentation" width="72" border="0" cellspacing="0" cellpadding="0" align="center" style="width:72px;border-collapse:collapse;margin:0 auto;"><tr><td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};opacity:.55;">&nbsp;</td></tr></table>
                          </td>
                        </tr>
                        <tr><td height="43" style="height:43px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td height="${contentHeight}" valign="top" style="height:${contentHeight}px;padding:0;">${params.content}</td>
                  </tr>
                  <tr>
                    <td height="${footerHeight}" align="center" valign="bottom" style="height:${footerHeight}px;padding:0;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${footerColor};">
                      <table role="presentation" width="600" height="${footerHeight}" border="0" cellspacing="0" cellpadding="0" style="width:600px;height:${footerHeight}px;border-collapse:collapse;">
                        <tr>
                          <td height="${footerTopSpace}" style="height:${footerTopSpace}px;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:0 36px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                            <div style="max-width:500px;margin:0 auto;font-size:12px;white-space:nowrap;line-height:21px;color:${footerColor};text-shadow:0 1px 3px rgba(0,0,0,.28);">${params.footerLine}</div>
                          </td>
                        </tr>
                        <tr><td height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
                        <tr>
                          <td align="center" style="height:1px;font-size:0;line-height:0;text-align:center;">
                            <table role="presentation" width="46" border="0" cellspacing="0" cellpadding="0" align="center" style="width:46px;border-collapse:collapse;margin:0 auto;"><tr><td height="1" bgcolor="#f0e6d0" style="height:1px;line-height:1px;font-size:1px;background-color:#f0e6d0;opacity:.48;">&nbsp;</td></tr></table>
                          </td>
                        </tr>
                        <tr><td height="11" style="height:11px;font-size:0;line-height:0;">&nbsp;</td></tr>
                        <tr>
                          <td align="center" style="height:18px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;color:${footerBrand};text-shadow:0 1px 3px rgba(0,0,0,.25);">@ Vĩnh Phúc Viên</td>
                        </tr>
                        <tr><td height="5" style="height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
                        <tr>
                          <td align="center" style="height:17px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;letter-spacing:.15px;color:${footerSlogan};text-shadow:0 1px 3px rgba(0,0,0,.25);">Gìn giữ an yên, trọn vẹn tưởng nhớ.</td>
                        </tr>
                        <tr><td height="${footerBottomSpace}" style="height:${footerBottomSpace}px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <img src="cid:${params.bannerCid}" width="1" height="1" alt="" style="display:none!important;width:1px!important;height:1px!important;max-height:0!important;overflow:hidden!important;opacity:0!important;mso-hide:all;" />
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private renderDarkHero(params: {
    kicker: string;
    title: string;
    lead: string;
    extra: string;
  }): string {
    return `
      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px;border-collapse:collapse;">
        <tr>
          <td width="86" style="width:86px;font-size:0;line-height:0;">&nbsp;</td>
          <td width="360" valign="top" style="width:360px;padding-top:78px;font-family:Arial,Helvetica,sans-serif;color:#fbf3e2;">
            <div style="font-size:12px;line-height:19px;letter-spacing:3px;font-weight:700;text-transform:uppercase;color:#e3caa0;">${params.kicker}</div>
            <div style="margin-top:15px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:39px;font-weight:700;color:#fffaf0;text-shadow:0 1px 3px rgba(15,30,22,.30);">${params.title}</div>
            <div style="margin-top:27px;font-size:15px;line-height:30px;color:#f4ecdc;">${params.lead}</div>
            ${params.extra}
          </td>
          <td width="154" style="width:154px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>`;
  }

  private renderLightCard(params: {
    topSpace: number;
    content: string;
  }): string {
    return `
      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px;border-collapse:collapse;">
        <tr><td height="${params.topSpace}" style="height:${params.topSpace}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td align="center" valign="top" style="text-align:center;">
            <table role="presentation" align="center" width="480" border="0" cellspacing="0" cellpadding="0" bgcolor="#eef7f3" style="width:480px;margin:0 auto;border-collapse:separate;border-spacing:0;background-color:rgba(238,248,244,.76);border:1px solid rgba(255,255,255,.72);border-radius:18px;box-shadow:0 10px 26px rgba(39,74,64,.10);">
              <tr>
                <td style="padding:30px 36px 32px;text-align:left;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#365f56;">${params.content}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  private getFrontendUrl(): string {
    const raw =
      this.config.get<string>('frontendUrl') ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';
    const firstUrl = raw.split(',')[0].trim();
    return firstUrl.replace(/\/+$/, '');
  }

  private renderButton(label: string, href?: string, dark = false): string {
    const bg = dark ? '#f4e2bb' : '#3f8071';
    const fg = dark ? '#1f4136' : '#ffffff';
    const inner = href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;color:${fg};">${label}</a>`
      : `<span style="display:block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:${fg};">${label}</span>`;

    return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse:separate;margin-top:25px;"><tr><td bgcolor="${bg}" style="background-color:${bg};border-radius:24px;box-shadow:0 4px 14px rgba(20,40,30,.18);">${inner}</td></tr></table>`;
  }

  async sendOtpEmail(to: string, otpCode: string, purpose: string) {
    if (!this.isConfigured()) {
      this.logger.warn('Bỏ qua gửi email OTP vì Gmail API chưa được cấu hình.');
      return;
    }
    const safePurpose = this.escapeHtml(purpose);
    const bannerCid = 'vpv-mail-3-otp';
    const banner = this.getBannerAttachment('mail-3.png');

    const content = this.renderDarkHero({
      kicker: 'Xác thực tài khoản',
      title: 'Xác thực email',
      lead: `Mã xác thực dùng cho <strong style="color:#ffe6b0;">${safePurpose}</strong> của bạn:`,
      extra: `
        <div style="margin:32px 0 30px;line-height:45px;white-space:nowrap;text-shadow:0 1px 3px rgba(15,30,22,.25);">${this.renderCopyableCode(otpCode, { color: '#ffe2a6', fontSize: '42px', letterSpacing: '9px', fontFamily: "Consolas,'Courier New',monospace", fontWeight: 800 })}</div>
        <div style="max-width:345px;font-size:13.5px;line-height:27px;color:#efe6d3;">Mã có hiệu lực trong <strong style="color:#ffe6b0;">10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</div>`,
    });

    const html = this.renderShell({
      theme: 'dark',
      bannerCid,
      footerLine: 'Nếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.',
      content,
    });

    await this.sendEmail({
      to,
      subject: `[Vĩnh Phúc Viên] Mã xác thực email của bạn: ${otpCode}`,
      text: `Mã xác thực dùng cho ${purpose} của bạn là: ${otpCode}\n\nMã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.`,
      html,
      attachments: banner ? [banner] : [],
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
    const safeTitle = this.escapeHtml(title);
    const normalizedMessage = message
      .replace(/^\s*Kính\s+(?:báo|gửi)\s+quý\s+khách\s*[:：,.-]?\s*/i, '')
      .trim();
    const safeMessage = this.escapeHtml(normalizedMessage).replace(/\n/g, '<br/>');
    const bannerCid = 'vpv-mail-1-reminder';
    const banner = this.getBannerAttachment('mail-1.png');
    const reminderUrl = `${this.getFrontendUrl()}/nhac-lich`;

    const content = this.renderLightCard({
      topSpace: 90,
      content: `
        <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11.5px;line-height:18px;letter-spacing:3.1px;font-weight:600;text-transform:uppercase;color:#78998f;">Lịch tưởng niệm sắp tới</div>
        <div style="margin-top:14px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:22px;line-height:31px;font-weight:600;color:#2f5b51;">${safeTitle}</div>
        <div style="margin-top:22px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:27px;color:#58756d;">Kính gửi Quý khách,</div>
        <div style="margin-top:13px;padding-left:15px;border-left:2px solid #c9ddd7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:28px;color:#3f655c;">${safeMessage}</div>
        <div style="margin-top:18px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:26px;color:#6d877f;">Vĩnh Phúc Viên xin được đồng hành cùng gia đình để mọi sự chuẩn bị diễn ra chu đáo, trang nghiêm và an yên. Nếu Quý khách cần điều chỉnh thông tin, chúng tôi luôn sẵn lòng hỗ trợ.</div>
        ${this.renderButton('Xem chi tiết lịch', reminderUrl)}`,
    });

    const html = this.renderShell({
      theme: 'light',
      bannerCid,
      footerLine: 'Bạn nhận được email này vì đã bật thông báo nhắc lịch trên Vĩnh Phúc Viên.',
      content,
    });

    await this.sendEmail({
      to,
      subject: `[Vĩnh Phúc Viên] Nhắc lịch: ${title}`,
      text: `${message}\n\nBạn nhận được email này vì đã bật thông báo nhắc lịch trên Vĩnh Phúc Viên.`,
      html,
      attachments: banner ? [banner] : [],
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
      ? new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(params.requestedDate))
      : 'Chưa chọn';
    const orderCode = `#DV-${String(params.orderId).padStart(4, '0')}`;
    const safeServiceName = this.escapeHtml(params.serviceName);
    const safePlotCode = this.escapeHtml(params.plotCode ?? '');
    const copyableOrderCode = this.renderCopyableCode(orderCode);
    const copyablePlotCode = params.plotCode ? this.renderCopyableCode(params.plotCode) : '';
    const bannerCid = 'vpv-mail-1-order';
    const banner = this.getBannerAttachment('mail-1.png');
    const serviceUrl = `${this.getFrontendUrl()}/dich-vu`;

    const row = (label: string, value: string, last = false) => `
      <tr>
        <td style="padding:9px 0;${last ? '' : 'border-bottom:1px solid #d8e5e0;'}font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;color:#668078;">${label}</td>
        <td align="right" style="padding:9px 0;${last ? '' : 'border-bottom:1px solid #d8e5e0;'}font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;font-weight:600;color:#355e55;text-align:right;">${value}</td>
      </tr>`;

    const rows = [
      row('Mã yêu cầu', copyableOrderCode),
      ...(params.plotCode ? [row('Lô phần mộ', copyablePlotCode || safePlotCode)] : []),
      row('Ngày mong muốn', this.escapeHtml(dateText)),
      row('Chi phí', this.escapeHtml(amountText), true),
    ].join('');

    const content = this.renderLightCard({
      topSpace: 0,
      content: `
        <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11.5px;line-height:18px;letter-spacing:3.1px;font-weight:600;text-transform:uppercase;color:#78998f;">Đã tiếp nhận yêu cầu</div>
        <div style="margin-top:15px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:28px;color:#4f7067;">Kính gửi Quý khách, Vĩnh Phúc Viên đã trân trọng ghi nhận yêu cầu dịch vụ <strong style="font-weight:600;color:#2f5b51;">${safeServiceName}</strong>.</div>
        <div style="margin-top:10px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:25px;color:#718a82;">Thông tin đăng ký được tóm tắt dưới đây để Quý khách thuận tiện theo dõi.</div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:16px;">${rows}</table>
        <div style="margin-top:18px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:26px;color:#617d74;">Yêu cầu hiện đang chờ ban quản lý xác nhận. Chúng tôi sẽ kiểm tra cẩn thận và gửi thông báo ngay khi có cập nhật.</div>
        <div style="margin-top:11px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:26px;color:#789087;">Cảm ơn Quý khách đã tin tưởng Vĩnh Phúc Viên. Chúng tôi mong mỗi dịch vụ đều được thực hiện chu đáo và đúng với mong muốn của gia đình.</div>
        ${this.renderButton('Xem yêu cầu', serviceUrl)}`,
    });

    const html = this.renderShell({
      theme: 'light',
      bannerCid,
      footerLine: 'Bạn nhận được email này vì đã đặt dịch vụ trên hệ thống Vĩnh Phúc Viên.',
      content,
      contentHeight: 630,
      footerShiftDown: 8,
    });

    await this.sendEmail({
      to,
      subject: `[Vĩnh Phúc Viên] Đã ghi nhận đặt dịch vụ: ${params.serviceName}`,
      text: `Bạn đã đặt dịch vụ "${params.serviceName}" (mã đơn ${orderCode}) vào ngày ${dateText}${
        params.plotCode ? ` cho lô ${params.plotCode}` : ''
      }. Đơn giá: ${amountText}.\n\nĐơn của bạn đang ở trạng thái chờ xác nhận từ ban quản lý. Chúng tôi sẽ gửi email/thông báo khi có cập nhật mới.`,
      html,
      attachments: banner ? [banner] : [],
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
    const completedDate = params.completedAt ? new Date(params.completedAt) : new Date();
    const dateText = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(completedDate).replace(',', ' ·');
    const noteText = params.completionNote?.trim() || 'Dịch vụ đã được thực hiện đầy đủ theo yêu cầu.';
    const safeServiceName = this.escapeHtml(params.serviceName);
    const safeNote = this.escapeHtml(noteText).replace(/\n/g, '<br/>');
    const copyableOrderCode = this.renderCopyableCode(orderCode);
    const bannerCid = 'vpv-mail-2-completed';
    const banner = this.getBannerAttachment('mail-2.png');
    const serviceUrl = `${this.getFrontendUrl()}/dich-vu`;

    const content = this.renderLightCard({
      topSpace: 18,
      content: `
        <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11.5px;line-height:18px;letter-spacing:3.1px;font-weight:600;text-transform:uppercase;color:#78998f;">Dịch vụ đã hoàn tất</div>
        <div style="margin-top:15px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14.5px;line-height:28px;color:#4f7067;">Vĩnh Phúc Viên xin thông báo dịch vụ <strong style="font-weight:600;color:#2f5b51;">${safeServiceName}</strong> đã được hoàn tất.</div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:18px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #dbe7e3;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;color:#668078;">Mã yêu cầu</td><td align="right" style="padding:10px 0;border-bottom:1px solid #dbe7e3;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;font-weight:600;color:#355e55;text-align:right;">${copyableOrderCode}</td></tr>
          <tr><td style="padding:10px 0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;color:#668078;">Hoàn thành lúc</td><td align="right" style="padding:10px 0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:22px;font-weight:600;color:#355e55;text-align:right;">${this.escapeHtml(dateText)}</td></tr>
        </table>
        <div style="margin-top:19px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:27px;color:#5f7b72;">${safeNote}</div>
        ${params.attachments.length ? '<div style="margin-top:11px;font-family:Segoe UI,Tahoma,Arial,sans-serif;font-size:13.5px;line-height:26px;color:#789087;">Ảnh xác nhận sau khi hoàn tất đã được đính kèm trong email để Quý khách thuận tiện kiểm tra.</div>' : ''}
        <div style="margin-top:12px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:13.5px;line-height:26px;color:#789087;">Cảm ơn Quý khách đã tin tưởng để Vĩnh Phúc Viên được thay gia đình chăm chút phần mộ. Kính chúc Quý khách và gia đình luôn bình an.</div>
        ${this.renderButton('Xem chi tiết dịch vụ', serviceUrl)}`,
    });

    const html = this.renderShell({
      theme: 'light',
      bannerCid,
      footerLine: 'Cảm ơn bạn đã sử dụng dịch vụ của Vĩnh Phúc Viên.',
      content,
      contentHeight: 630,
    });

    const proofAttachments = await Promise.all(
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
      html,
      attachments: [
        ...(banner ? [banner] : []),
        ...proofAttachments,
      ],
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    if (!this.isConfigured()) {
      this.logger.warn('Bỏ qua gửi email đặt lại mật khẩu vì Gmail API chưa được cấu hình.');
      return;
    }
    const safeResetLink = this.escapeHtml(resetLink);
    const bannerCid = 'vpv-mail-3-reset';
    const banner = this.getBannerAttachment('mail-3.png');

    const content = this.renderDarkHero({
      kicker: 'Bảo mật tài khoản',
      title: 'Đặt lại mật khẩu',
      lead: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
      extra: `
        ${this.renderButton('Đặt lại mật khẩu', safeResetLink, true)}
        <div style="margin-top:27px;font-size:13.5px;line-height:27px;color:#efe6d3;">Liên kết có hiệu lực trong <strong style="color:#ffe6b0;">30 phút</strong>.</div>
        <div style="width:245px;margin-top:22px;font-size:12px;line-height:24px;color:#e1d5bd;">Nếu nút không mở được, hãy sao chép<br/>liên kết đặt lại mật khẩu từ email này<br/>vào trình duyệt.</div>`,
    });

    const html = this.renderShell({
      theme: 'dark',
      bannerCid,
      footerLine: 'Nếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.',
      content,
    });

    await this.sendEmail({
      to,
      subject: '[Vĩnh Phúc Viên] Yêu cầu đặt lại mật khẩu',
      text: `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\n\nBấm vào liên kết sau để đặt mật khẩu mới (liên kết có hiệu lực trong 30 phút):\n${resetLink}\n\nNếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.`,
      html,
      attachments: banner ? [banner] : [],
    });
  }
}
