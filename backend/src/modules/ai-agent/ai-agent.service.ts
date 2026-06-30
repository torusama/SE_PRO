import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

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
}
