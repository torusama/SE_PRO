import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { GmailApiClient } from './gmail-api.client';
import { GmailMessage } from './gmail-message';

describe('EmailService', () => {
  const createService = (configured = true) => {
    const gmailApi = {
      isConfigured: jest.fn().mockReturnValue(configured),
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as GmailApiClient;
    const config = {
      get: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as ConfigService;
    return {
      service: new EmailService(gmailApi, config),
      send: gmailApi.send as jest.MockedFunction<
        (message: GmailMessage) => Promise<void>
      >,
    };
  };

  it('reports missing Gmail API configuration', () => {
    const { service } = createService(false);

    expect(service.isConfigured()).toBe(false);
  });

  it('sends OTP through the Gmail API client', async () => {
    const { service, send } = createService();

    await service.sendOtpEmail(
      'customer@example.com',
      '123456',
      'đăng ký tài khoản',
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: expect.stringContaining('123456'),
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('propagates Gmail API errors for required email', async () => {
    const { service, send } = createService();
    send.mockRejectedValue(new Error('invalid_grant'));

    await expect(
      service.sendPasswordResetEmail(
        'customer@example.com',
        'https://example.com/reset',
      ),
    ).rejects.toThrow('invalid_grant');
  });

  it('reads local completion evidence before passing it to Gmail', async () => {
    const filePath = join(tmpdir(), `email-proof-${randomUUID()}.jpg`);
    const fileContent = Buffer.from('proof-image');
    await writeFile(filePath, fileContent);

    try {
      const { service, send } = createService();

      await service.sendServiceOrderCompletionEmail('customer@example.com', {
        orderId: 12,
        serviceName: 'Chăm sóc phần mộ',
        attachments: [{ filename: 'proof.jpg', path: filePath }],
      });

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            { filename: 'proof.jpg', content: fileContent },
          ]),
        }),
      );
    } finally {
      await unlink(filePath);
    }
  });

  it('keeps a long AI reminder and the footer inside the extended artwork', async () => {
    const { service, send } = createService();

    await service.sendReminderEmail(
      'customer@example.com',
      'Ngày tưởng niệm người thân',
      [
        'Kính gửi gia đình Nguyễn Văn A,',
        '',
        'Nhân ngày tưởng niệm sắp tới, Vĩnh Phúc Viên xin gửi lời nhắc để gia đình chủ động chuẩn bị chu đáo. Nội dung này đủ dài để kiểm tra việc xuống dòng trong thẻ nội dung mà không làm phần chân thư tràn khỏi nền trang trí.',
        '',
        'Trân trọng,',
        'Vĩnh Phúc Viên',
      ].join('\n'),
    );

    const html = send.mock.calls[0][0].html ?? '';
    expect(html).toContain('height="930"');
    expect(html).toContain('background-size:600px 930px');
    expect(html).not.toContain('Kính gửi gia đình Nguyễn Văn A');
    expect(html).not.toContain('Trân trọng,<br/>Vĩnh Phúc Viên');
    expect(html).toContain('Gìn giữ an yên, trọn vẹn tưởng nhớ.');
  });
});
