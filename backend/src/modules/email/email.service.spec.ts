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
});
