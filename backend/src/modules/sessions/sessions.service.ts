import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { DatabaseService } from '../../database/database.service';

interface RequestInfo {
  ip?: string;
  userAgent?: string;
}

// Quản lý phiên đăng nhập thật theo thiết bị (bảng user_sessions). Không có dữ
// liệu mẫu/giả lập nào ở đây — mọi thiết bị hiển thị trên UI đều tương ứng 1 JWT
// thật đã được phát hành, phân tích trực tiếp từ header User-Agent của request.
function cleanIpAddress(ip?: string | null): string | null {
  if (!ip) return null;
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '::1' || cleaned === '127.0.0.1' || cleaned === 'localhost') {
    return null;
  }
  return cleaned;
}

@Injectable()
export class SessionsService {
  constructor(private readonly database: DatabaseService) {}

  private describeDevice(userAgent?: string) {
    if (!userAgent) {
      return { label: 'Thiết bị không xác định', browser: null, os: null };
    }
    const { browser, os, device } = new UAParser(userAgent).getResult();
    const osLabel = [os.name, os.version].filter(Boolean).join(' ');
    const browserLabel = [browser.name, browser.version?.split('.')[0]]
      .filter(Boolean)
      .join(' ');
    const deviceLabel = device.model
      ? `${device.vendor ?? ''} ${device.model}`.trim()
      : null;
    const label = [browserLabel, deviceLabel || osLabel]
      .filter(Boolean)
      .join(' trên ');
    return {
      label: label || 'Thiết bị không xác định',
      browser: browser.name ?? null,
      os: osLabel || null,
    };
  }

  async createSession(userId: number, jti: string, info: RequestInfo) {
    const { label, browser, os } = this.describeDevice(info.userAgent);
    await this.database.query(
      `INSERT INTO user_sessions
         (jti, user_id, device_label, browser, os, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        jti,
        userId,
        label,
        browser,
        os,
        cleanIpAddress(info.ip),
        info.userAgent ?? null,
      ],
    );
  }

  /** Gọi ở mỗi request đã xác thực: cập nhật last_active_at, trả về null nếu
   * phiên đã bị thu hồi hoặc không tồn tại (JwtStrategy sẽ từ chối JWT đó). */
  async touchSession(jti: string) {
    const row = await this.database.queryOne<{ user_id: number }>(
      `UPDATE user_sessions SET last_active_at = NOW()
       WHERE jti = $1 AND revoked_at IS NULL
       RETURNING user_id`,
      [jti],
    );
    return row;
  }

  async listSessions(userId: number, currentJti: string | null) {
    const rows = await this.database.query<{
      id: number;
      device_label: string | null;
      browser: string | null;
      os: string | null;
      ip_address: string | null;
      created_at: Date;
      last_active_at: Date;
      jti: string;
    }>(
      `SELECT id, jti, device_label, browser, os, ip_address, created_at, last_active_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY last_active_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      deviceLabel: r.device_label,
      browser: r.browser,
      os: r.os,
      ipAddress: cleanIpAddress(r.ip_address),
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      isCurrent: r.jti === currentJti,
    }));
  }

  async revokeSession(userId: number, sessionId: number) {
    const row = await this.database.queryOne(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [sessionId, userId],
    );
    return { revoked: Boolean(row) };
  }

  async revokeOtherSessions(userId: number, currentJti: string | null) {
    const rows = await this.database.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL AND jti IS DISTINCT FROM $2
       RETURNING id`,
      [userId, currentJti],
    );
    return { revokedCount: rows.length };
  }

  async revokeByJti(jti: string) {
    await this.database.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL`,
      [jti],
    );
  }
}
