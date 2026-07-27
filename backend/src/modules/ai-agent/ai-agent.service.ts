import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class AiAgentService {
  constructor(private readonly database: DatabaseService) {}

  async recommend(body: any) {
    const params: unknown[] = [body.budget ?? 999999999999];
    let zoneFilter = '';
    if (body.preferredZone) {
      params.push(body.preferredZone);
      zoneFilter = `AND zone_name ILIKE $${params.length}`;
      params[params.length - 1] = `%${body.preferredZone}%`;
    }
    const limit = Number(body.numberOfPlots ?? 1);
    const rows = await this.database.query(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_name AS "zoneName",
              price::float, status, map_x AS "mapX", map_y AS "mapY",
              direction, row_number AS "rowCode", column_number AS "plotNumber"
       FROM vw_plots_map
       WHERE status = 'available' AND price <= $1 ${zoneFilter}
       ORDER BY map_x, map_y, price
       LIMIT ${Math.max(limit, 1)}`,
      params,
    );
    const total = rows.reduce((sum, row: any) => sum + Number(row.price), 0);
    return { plots: total <= Number(params[0]) ? rows : [], totalPrice: total };
  }

  async createDraftReservation(userId: number, body: any) {
    if (!body.plotIds?.length) throw new BadRequestException('plotIds is required');
    const plots = await this.database.query(
      `SELECT plot_id, price FROM plots WHERE plot_id = ANY($1::int[]) AND status = 'available'`,
      [body.plotIds],
    );
    if (plots.length !== body.plotIds.length) throw new BadRequestException('All plots must be available');
    const total = plots.reduce((sum, row: any) => sum + Number(row.price), 0);
    const request = await this.database.queryOne(
      `INSERT INTO reservation_requests (user_id, request_type, status, total_price, note, is_ai_draft)
       VALUES ($1, 'purchase', 'draft', $2, $3, TRUE)
       RETURNING request_id AS id, status, total_price::float AS "totalPrice"`,
      [userId, total, body.note ?? 'AI draft reservation'],
    );
    for (const plot of plots) {
      await this.database.query(
        'INSERT INTO request_plots (request_id, plot_id, plot_price) VALUES ($1, $2, $3)',
        [(request as any).id, plot.plot_id, plot.price],
      );
    }
    return request;
  }

  async adminActivity(query: AdminAiActivityQueryDto) {
    const values: unknown[] = [];
    const conditions = ['rr.is_ai_draft = TRUE', 'rr.is_deleted = FALSE'];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
    }
    if (query.status) conditions.push(`rr.status = ${add(query.status)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM reservation_requests rr
       JOIN users u ON u.user_id=rr.user_id ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT rr.request_id AS id, rr.status, rr.request_type AS type,
              rr.total_price::float AS "totalPrice", rr.created_at AS "createdAt",
              u.user_id AS "customerId", u.full_name AS "customerName",
              COUNT(rp.plot_id)::int AS "plotCount",
              COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes"
       FROM reservation_requests rr JOIN users u ON u.user_id=rr.user_id
       LEFT JOIN request_plots rp ON rp.request_id=rr.request_id
       LEFT JOIN plots p ON p.plot_id=rp.plot_id
       ${where} GROUP BY rr.request_id,u.user_id
       ORDER BY rr.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return {
      ...paginate(items, Number(count?.total ?? 0), query.page, query.pageSize),
      capabilities: {
        recommendationTelemetry: false,
        promptHistory: false,
        modelUsage: false,
        retainedData: 'ai_reservation_drafts',
      },
    };
  }

  async adminActivityOne(id: number) {
    const item = await this.database.queryOne(
      `SELECT rr.request_id AS id, rr.status, rr.request_type AS type,
              rr.total_price::float AS "totalPrice", rr.note,
              rr.created_at AS "createdAt", u.user_id AS "customerId",
              u.full_name AS "customerName", u.email AS "customerEmail"
       FROM reservation_requests rr JOIN users u ON u.user_id=rr.user_id
       WHERE rr.request_id=$1 AND rr.is_ai_draft=TRUE AND rr.is_deleted=FALSE`,
      [id],
    );
    if (!item) throw new NotFoundException('AI activity not found');
    return item;
  }
}
