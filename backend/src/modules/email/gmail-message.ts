import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';

export type GmailAttachment = {
  filename: string;
  content: Buffer;
};

export type GmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: GmailAttachment[];
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function assertEmail(value: string, field: string): string {
  const normalized = value.trim();
  if (!EMAIL_PATTERN.test(normalized) || /[\r\n]/.test(normalized)) {
    throw new Error(`${field} không phải là địa chỉ email hợp lệ.`);
  }
  return normalized;
}

function assertSafeHeader(value: string, field: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${field} chứa ký tự xuống dòng không hợp lệ.`);
  }
  return value;
}

function encodeMimeWord(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function wrapBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString('base64')
    : Buffer.from(value, 'utf8').toString('base64');
  return encoded.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function buildAlternativeBody(boundary: string, message: GmailMessage): string {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(message.html),
    `--${boundary}--`,
  ].join('\r\n');
}

function attachmentContentType(filename: string): string {
  return (
    CONTENT_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream'
  );
}

export function buildGmailRawMessage(
  senderEmail: string,
  message: GmailMessage,
): string {
  const sender = assertEmail(senderEmail, 'GMAIL_SENDER_EMAIL');
  const recipient = assertEmail(message.to, 'Địa chỉ người nhận');
  const subject = assertSafeHeader(message.subject, 'Tiêu đề email');
  const attachments = message.attachments ?? [];
  const alternativeBoundary = `alt_${randomBytes(16).toString('hex')}`;
  const headers = [
    `From: ${encodeMimeWord('Vĩnh Phúc Viên')} <${sender}>`,
    `To: ${recipient}`,
    `Subject: ${encodeMimeWord(subject)}`,
    'MIME-Version: 1.0',
  ];

  let rawMessage: string;
  if (attachments.length === 0) {
    rawMessage = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      '',
      buildAlternativeBody(alternativeBoundary, message),
    ].join('\r\n');
  } else {
    const mixedBoundary = `mixed_${randomBytes(16).toString('hex')}`;
    const parts = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      '',
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      '',
      buildAlternativeBody(alternativeBoundary, message),
    ];

    for (const attachment of attachments) {
      const filename = assertSafeHeader(
        attachment.filename.trim() || 'attachment',
        'Tên file đính kèm',
      );
      const encodedFilename = encodeMimeWord(filename);
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${attachmentContentType(filename)}; name="${encodedFilename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${encodedFilename}"`,
        '',
        wrapBase64(attachment.content),
      );
    }

    parts.push(`--${mixedBoundary}--`);
    rawMessage = parts.join('\r\n');
  }

  return Buffer.from(rawMessage, 'utf8').toString('base64url');
}
