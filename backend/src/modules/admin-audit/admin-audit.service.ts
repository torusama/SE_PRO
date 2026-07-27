import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { DatabaseService } from '../../database/database.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';

const SENSITIVE_KEY =
  /password|passcode|token|secret|otp|hash|id_?card|identity_?number|authorization|cookie/i;

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactAuditValue(item),
      ]),
    );
  }
  return value;
}

export interface AuditRecordInput {
  action: string;
  entityType: string;
  entityId?: number | null;
  entityKey?: string | null;
  before?: unknown;
  after?: unknown;
  context: AdminRequestContext;
}

interface AuditRow extends QueryResultRow {
  id: number;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(client: PoolClient, input: AuditRecordInput) {
    const result = await client.query<AuditRow>(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, entity_key,
          old_value, new_value, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
       RETURNING log_id AS id`,
      [
        input.context.adminId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.entityKey ?? null,
        JSON.stringify(redactAuditValue(input.before ?? null)),
        JSON.stringify(redactAuditValue(input.after ?? null)),
        input.context.ipAddress,
        input.context.userAgent,
      ],
    );
    return result.rows[0];
  }

  async list(query: AdminAuditQueryDto) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(a.action ILIKE ${p} OR a.entity_type ILIKE ${p} OR a.entity_key ILIKE ${p} OR u.full_name ILIKE ${p})`,
      );
    }
    if (query.action) conditions.push(`a.action = ${add(query.action)}`);
    if (query.entityType)
      conditions.push(`a.entity_type = ${add(query.entityType)}`);
    if (query.actorId) conditions.push(`a.user_id = ${add(query.actorId)}`);
    if (query.from) conditions.push(`a.created_at >= ${add(query.from)}`);
    if (query.to) conditions.push(`a.created_at <= ${add(query.to)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT a.log_id AS id, a.user_id AS "actorId",
              COALESCE(u.full_name, u.email, 'Admin') AS "actorName",
              a.action, a.entity_type AS "entityType",
              a.entity_id AS "entityId", a.entity_key AS "entityKey",
              a.old_value AS "before", a.new_value AS "after",
              a.ip_address AS "ipAddress", a.user_agent AS "userAgent",
              a.created_at AS "createdAt"
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
       ${where}
       ORDER BY a.created_at DESC, a.log_id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async detail(id: number) {
    const row = await this.database.queryOne(
      `SELECT a.log_id AS id, a.user_id AS "actorId",
              COALESCE(u.full_name, u.email, 'Admin') AS "actorName",
              a.action, a.entity_type AS "entityType",
              a.entity_id AS "entityId", a.entity_key AS "entityKey",
              a.old_value AS "before", a.new_value AS "after",
              a.ip_address AS "ipAddress", a.user_agent AS "userAgent",
              a.created_at AS "createdAt"
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.log_id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy nhật ký');
    return row;
  }
}
