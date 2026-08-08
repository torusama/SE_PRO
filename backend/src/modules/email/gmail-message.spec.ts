import { buildGmailRawMessage } from './gmail-message';

describe('buildGmailRawMessage', () => {
  it('builds a base64url MIME message with UTF-8 text and an attachment', () => {
    const raw = buildGmailRawMessage('sender@gmail.com', {
      to: 'customer@example.com',
      subject: 'Mã xác thực của bạn',
      text: 'Mã OTP là 123456',
      html: '<b>123456</b>',
      attachments: [
        { filename: 'bằng-chứng.jpg', content: Buffer.from('proof-image') },
      ],
    });
    const mime = Buffer.from(raw, 'base64url').toString('utf8');

    expect(mime).toContain('From: =?UTF-8?B?');
    expect(mime).toContain('To: customer@example.com');
    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain('Content-Type: image/jpeg');
    expect(mime).toContain(Buffer.from('Mã OTP là 123456').toString('base64'));
    expect(mime).toContain(Buffer.from('proof-image').toString('base64'));
  });

  it('rejects recipient header injection', () => {
    expect(() =>
      buildGmailRawMessage('sender@gmail.com', {
        to: 'customer@example.com\r\nBcc: attacker@example.com',
        subject: 'OTP',
        text: '123456',
        html: '<b>123456</b>',
      }),
    ).toThrow('địa chỉ email hợp lệ');
  });
});
