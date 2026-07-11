import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  PlotAdjacencyResult,
  PlotAdjacencyService,
} from '../plots/plot-adjacency.service';
import { CreateMultipleReservationDto } from './dto/create-multiple-reservation.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

type ReservationStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

interface ReservationRow extends QueryResultRow {
  id: number;
  type: 'reserve' | 'purchase';
  status: string;
  totalPrice: number | string | null;
  note: string | null;
  adminNote?: string | null;
  reviewedAt?: Date | string | null;
  createdAt: Date | string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  adminName?: string | null;
  plotCodes?: string[];
  plotCount?: number | string;
}

interface PlotRow extends QueryResultRow {
  id: number;
  code: string;
  status: string;
  price: number | string;
  zoneId?: number | null;
  rowNumber?: string | null;
  columnNumber?: string | null;
  mapX?: number | string | null;
  mapY?: number | string | null;
  mapWidth?: number | string | null;
  mapHeight?: number | string | null;
}

interface LockedReservationRow extends QueryResultRow {
  request_id: number;
  user_id: number;
  request_type: 'reserve' | 'purchase';
  status: string;
}

interface LegacyPlotRow extends QueryResultRow {
  plot_id: number;
  status: string;
}

export interface StatusRow extends QueryResultRow {
  id: number;
  status: string;
}

@Injectable()
export class ReservationsService {
  private readonly activeStatuses: ReservationStatus[] = [
    'pending',
    'submitted',
    'approved',
  ];

  constructor(
    private readonly database: DatabaseService,
    private readonly plotAdjacency?: PlotAdjacencyService,
  ) {}

  async create(userId: number, dto: CreateReservationDto, isAiDraft = false) {
    return this.createReservation(userId, dto, isAiDraft);
  }

  async createMultiple(userId: number, dto: CreateMultipleReservationDto) {
    if (dto.plotIds.length < 2) {
      throw new BadRequestException(
        'At least two plots are required for a multi-plot reservation',
      );
    }
    return this.createReservation(userId, dto, false, true);
  }

  private async createReservation(
    userId: number,
    dto: CreateReservationDto,
    isAiDraft = false,
    requireAdjacency = false,
  ) {
    this.assertUniquePlotIds(dto.plotIds);

    return this.database.transaction(async (client) => {
      const plots = await this.lockPlots(client, dto.plotIds);
      if (
        plots.length !== dto.plotIds.length ||
        plots.some((plot) => plot.status !== 'available')
      ) {
        throw new BadRequestException('All plots must be available');
      }
      const adjacency = requireAdjacency
        ? this.validateAdjacency(plots)
        : undefined;

      const total = plots.reduce((sum, plot) => sum + Number(plot.price), 0);
      const request = await client.query<{ id: number }>(
        `INSERT INTO reservation_requests (user_id, request_type, status, total_price, note, is_ai_draft)
         VALUES ($1, $2, 'pending', $3, $4, $5)
         RETURNING request_id AS id`,
        [userId, dto.type, total, dto.note || null, isAiDraft],
      );
      const requestId = request.rows[0].id;

      for (const plot of plots) {
        await client.query(
          `INSERT INTO request_plots (request_id, plot_id, plot_price)
           VALUES ($1, $2, $3)`,
          [requestId, plot.id, plot.price],
        );
      }

      const update = await client.query(
        `UPDATE plots
         SET status = 'pending', reserved_until = NOW() + INTERVAL '30 minutes', updated_at = NOW()
         WHERE plot_id = ANY($1::int[]) AND status = 'available'`,
        [dto.plotIds],
      );
      if (update.rowCount !== dto.plotIds.length) {
        throw new BadRequestException('Selected plots are no longer available');
      }

      const detail = await this.getDetailForClient(client, requestId, userId);
      return adjacency ? { ...detail, adjacency } : detail;
    });
  }

  async submit(userId: number, id: number) {
    return this.database.transaction(async (client) => {
      const request = await this.getOwnedRequest(client, userId, id);
      if (!['draft', 'cancelled'].includes(request.status)) {
        throw new BadRequestException(
          'Only draft reservations can be submitted',
        );
      }
      const plotRows = await client.query<LegacyPlotRow>(
        `SELECT p.plot_id, p.status
         FROM request_plots rp JOIN plots p ON p.plot_id = rp.plot_id
         WHERE rp.request_id = $1
         FOR UPDATE`,
        [id],
      );
      if (
        !plotRows.rows.length ||
        plotRows.rows.some((plot) => plot.status !== 'available')
      ) {
        throw new BadRequestException('Selected plots are no longer available');
      }
      await client.query(
        `UPDATE plots SET status = 'pending', reserved_until = NOW() + INTERVAL '30 minutes', updated_at = NOW()
         WHERE plot_id = ANY($1::int[])`,
        [plotRows.rows.map((plot) => plot.plot_id)],
      );
      const updated = await client.query<StatusRow>(
        `UPDATE reservation_requests SET status = 'submitted', updated_at = NOW()
         WHERE request_id = $1
         RETURNING request_id AS id, status`,
        [id],
      );
      return updated.rows[0];
    });
  }

  async cancel(userId: number, id: number) {
    return this.database.transaction(async (client) => {
      await this.getOwnedRequest(client, userId, id);
      await client.query(
        `UPDATE plots SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE plot_id IN (SELECT plot_id FROM request_plots WHERE request_id = $1)
           AND status = 'pending'`,
        [id],
      );
      const updated = await client.query<StatusRow>(
        `UPDATE reservation_requests SET status = 'cancelled', updated_at = NOW()
         WHERE request_id = $1
         RETURNING request_id AS id, status`,
        [id],
      );
      return updated.rows[0];
    });
  }

  async my(userId: number) {
    return this.database.query(
      `SELECT rr.request_id AS id, rr.request_type AS type, rr.status,
              rr.total_price::float AS "totalPrice",
              COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes",
              COUNT(rp.plot_id)::int AS "plotCount",
              rr.created_at AS "createdAt", rr.reviewed_at AS "reviewedAt"
       FROM reservation_requests rr
       LEFT JOIN request_plots rp ON rp.request_id = rr.request_id
       LEFT JOIN plots p ON p.plot_id = rp.plot_id
       WHERE rr.user_id = $1 AND rr.is_deleted = FALSE
       GROUP BY rr.request_id
       ORDER BY rr.created_at DESC`,
      [userId],
    );
  }

  async myOne(userId: number, id: number) {
    const request = await this.database.queryOne<ReservationRow>(
      this.detailSql('WHERE rr.request_id = $1 AND rr.user_id = $2'),
      [id, userId],
    );
    if (!request) throw new NotFoundException('Reservation not found');
    const plots = await this.database.query<PlotRow>(this.plotsSql(), [id]);
    return this.mapDetail(request, plots);
  }

  async adminList() {
    return this.database.query(
      `SELECT request_id AS id, request_type AS type, status,
              customer_name AS "customerName", customer_email AS "customerEmail",
              total_price::float AS "totalPrice", plot_codes AS "plotCodes",
              plot_count::int AS "plotCount", created_at AS "createdAt",
              reviewed_at AS "reviewedAt"
       FROM vw_reservation_requests_full
       ORDER BY created_at DESC`,
    );
  }

  async adminOne(id: number) {
    const request = await this.database.queryOne<ReservationRow>(
      this.detailSql('WHERE rr.request_id = $1'),
      [id],
    );
    if (!request) throw new NotFoundException('Reservation not found');
    const plots = await this.database.query<PlotRow>(this.plotsSql(), [id]);
    return this.mapDetail(request, plots);
  }

  async approve(adminId: number, id: number, adminNote?: string) {
    return this.database.transaction(async (client) => {
      const request = await this.lockRequest(client, id);
      this.assertPendingDecision(request.status, 'approved');
      const plots = await this.lockRequestPlots(client, id);
      this.assertPlotsPending(plots);

      const finalPlotStatus =
        request.request_type === 'purchase' ? 'sold' : 'reserved';
      const plotIds = plots.map((plot) => plot.id);
      const plotUpdate = await client.query(
        `UPDATE plots
         SET status = $2, reserved_until = NULL, updated_at = NOW()
         WHERE plot_id = ANY($1::int[]) AND status = 'pending'`,
        [plotIds, finalPlotStatus],
      );
      if (plotUpdate.rowCount !== plotIds.length) {
        throw new BadRequestException(
          'Reservation plots are no longer pending',
        );
      }

      await client.query(
        `UPDATE reservation_requests
         SET status = 'approved', admin_id = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, adminNote || null],
      );
      await this.notify(
        client,
        request.user_id,
        'request_approved',
        'Yeu cau da duoc duyet',
        'Yeu cau giu cho/mua lo cua ban da duoc duyet.',
        id,
      );

      return {
        id,
        status: 'approved',
        plotStatus: finalPlotStatus,
        notificationCreated: true,
      };
    });
  }

  async reject(adminId: number, id: number, adminNote?: string) {
    return this.database.transaction(async (client) => {
      const request = await this.lockRequest(client, id);
      this.assertPendingDecision(request.status, 'rejected');
      const plots = await this.lockRequestPlots(client, id);
      const plotIds = plots.map((plot) => plot.id);

      await client.query(
        `UPDATE reservation_requests
         SET status = 'rejected', admin_id = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, adminNote || null],
      );
      await client.query(
        `UPDATE plots p
         SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE p.plot_id = ANY($1::int[])
           AND p.status = 'pending'
           AND NOT EXISTS (
             SELECT 1
             FROM request_plots rp
             JOIN reservation_requests rr ON rr.request_id = rp.request_id
             WHERE rp.plot_id = p.plot_id
               AND rr.request_id <> $2
               AND rr.is_deleted = FALSE
               AND rr.status = ANY($3::text[])
           )`,
        [plotIds, id, this.activeStatuses],
      );
      await this.notify(
        client,
        request.user_id,
        'request_rejected',
        'Yeu cau da bi tu choi',
        'Yeu cau giu cho/mua lo cua ban da bi tu choi.',
        id,
      );

      return {
        id,
        status: 'rejected',
        plotStatus: 'available',
        notificationCreated: true,
      };
    });
  }

  private assertUniquePlotIds(plotIds: number[]) {
    if (new Set(plotIds).size !== plotIds.length) {
      throw new BadRequestException('Duplicate plot IDs are not allowed');
    }
  }

  private async lockPlots(client: PoolClient, plotIds: number[]) {
    const result = await client.query<PlotRow>(
      `SELECT plot_id AS id, plot_code AS code, status, price::float AS price,
              zone_id AS "zoneId", row_number AS "rowNumber",
              column_number AS "columnNumber", map_x AS "mapX",
              map_y AS "mapY", map_width AS "mapWidth",
              map_height AS "mapHeight"
       FROM plots
       WHERE plot_id = ANY($1::int[]) AND is_deleted = FALSE
       ORDER BY plot_id
       FOR UPDATE`,
      [plotIds],
    );
    return result.rows;
  }

  private async lockRequest(client: PoolClient, id: number) {
    const result = await client.query<LockedReservationRow>(
      `SELECT *
       FROM reservation_requests
       WHERE request_id = $1 AND is_deleted = FALSE
       FOR UPDATE`,
      [id],
    );
    const request = result.rows[0];
    if (!request) throw new NotFoundException('Reservation not found');
    return request;
  }

  private async lockRequestPlots(client: PoolClient, requestId: number) {
    const result = await client.query<PlotRow>(
      `SELECT p.plot_id AS id, p.plot_code AS code, p.status, p.price::float AS price,
              p.zone_id AS "zoneId", p.row_number AS "rowNumber",
              p.column_number AS "columnNumber", p.map_x AS "mapX",
              p.map_y AS "mapY", p.map_width AS "mapWidth",
              p.map_height AS "mapHeight"
       FROM request_plots rp
       JOIN plots p ON p.plot_id = rp.plot_id
       WHERE rp.request_id = $1
       ORDER BY p.plot_id
       FOR UPDATE`,
      [requestId],
    );
    if (!result.rows.length) {
      throw new BadRequestException('Reservation has no plots');
    }
    return result.rows;
  }

  private assertPendingDecision(
    status: string,
    action: 'approved' | 'rejected',
  ) {
    if (!['pending', 'submitted'].includes(status)) {
      throw new BadRequestException(
        `Only pending reservations can be ${action}`,
      );
    }
  }

  private assertPlotsPending(plots: PlotRow[]) {
    if (plots.some((plot) => plot.status !== 'pending')) {
      throw new BadRequestException('Reservation plots are no longer pending');
    }
  }

  private async getOwnedRequest(
    client: PoolClient,
    userId: number,
    id: number,
  ) {
    const result = await client.query<LockedReservationRow>(
      `SELECT * FROM reservation_requests
       WHERE request_id = $1 AND user_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [id, userId],
    );
    if (!result.rows[0]) throw new NotFoundException('Reservation not found');
    return result.rows[0];
  }

  private async getDetailForClient(
    client: PoolClient,
    requestId: number,
    userId: number,
  ) {
    const request = await client.query<ReservationRow>(
      this.detailSql('WHERE rr.request_id = $1 AND rr.user_id = $2'),
      [requestId, userId],
    );
    if (!request.rows[0]) throw new NotFoundException('Reservation not found');
    const plots = await client.query<PlotRow>(this.plotsSql(), [requestId]);
    return this.mapDetail(request.rows[0], plots.rows);
  }

  private detailSql(whereClause: string) {
    return `SELECT rr.request_id AS id, rr.request_type AS type, rr.status,
                   rr.total_price::float AS "totalPrice", rr.note,
                   rr.admin_note AS "adminNote", rr.reviewed_at AS "reviewedAt",
                   rr.created_at AS "createdAt",
                   u.full_name AS "customerName", u.email AS "customerEmail",
                   u.phone_number AS "customerPhone", adm.full_name AS "adminName"
            FROM reservation_requests rr
            JOIN users u ON u.user_id = rr.user_id
            LEFT JOIN users adm ON adm.user_id = rr.admin_id
            ${whereClause}
              AND rr.is_deleted = FALSE`;
  }

  private plotsSql() {
    return `SELECT p.plot_id AS id, p.plot_code AS code, p.status,
                   rp.plot_price::float AS price,
                   p.zone_id AS "zoneId", p.row_number AS "rowNumber",
                   p.column_number AS "columnNumber", p.map_x AS "mapX",
                   p.map_y AS "mapY", p.map_width AS "mapWidth",
                   p.map_height AS "mapHeight"
            FROM request_plots rp
            JOIN plots p ON p.plot_id = rp.plot_id
            WHERE rp.request_id = $1
            ORDER BY p.plot_code`;
  }

  private mapDetail(request: ReservationRow, plots: PlotRow[]) {
    return {
      ...request,
      totalPrice: Number(request.totalPrice ?? 0),
      plotCount: plots.length,
      plotCodes: plots.map((plot) => plot.code),
      plots: plots.map((plot) => ({
        ...plot,
        price: Number(plot.price),
        mapX:
          plot.mapX === null || plot.mapX === undefined
            ? plot.mapX
            : Number(plot.mapX),
        mapY:
          plot.mapY === null || plot.mapY === undefined
            ? plot.mapY
            : Number(plot.mapY),
        mapWidth:
          plot.mapWidth === null || plot.mapWidth === undefined
            ? plot.mapWidth
            : Number(plot.mapWidth),
        mapHeight:
          plot.mapHeight === null || plot.mapHeight === undefined
            ? plot.mapHeight
            : Number(plot.mapHeight),
      })),
    };
  }

  private validateAdjacency(plots: PlotRow[]): PlotAdjacencyResult {
    if (!this.plotAdjacency) {
      throw new BadRequestException(
        'Selected plots do not have enough location data to validate adjacency',
      );
    }
    return this.plotAdjacency.validateAdjacent(plots);
  }

  private async notify(
    client: PoolClient,
    userId: number,
    type: string,
    title: string,
    message: string,
    requestId: number,
  ) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, 'reservation_request', $5)`,
      [userId, type, title, message, requestId],
    );
  }
}
