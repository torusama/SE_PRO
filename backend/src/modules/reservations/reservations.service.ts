import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: number, dto: CreateReservationDto, isAiDraft = false) {
    return this.database.transaction(async (client) => {
      const plots = await this.availablePlots(client, dto.plotIds);
      if (plots.length !== dto.plotIds.length) {
        throw new BadRequestException('All plots must be available');
      }
      const total = plots.reduce((sum, plot) => sum + Number(plot.price), 0);
      const request = await client.query(
        `INSERT INTO reservation_requests (user_id, request_type, status, total_price, note, is_ai_draft)
         VALUES ($1, $2, 'draft', $3, $4, $5)
         RETURNING request_id AS id, request_type AS type, status, total_price AS "totalPrice"`,
        [userId, dto.type, total, dto.note ?? null, isAiDraft],
      );
      for (const plot of plots) {
        await client.query(
          `INSERT INTO request_plots (request_id, plot_id, plot_price)
           VALUES ($1, $2, $3)`,
          [request.rows[0].id, plot.plot_id, plot.price],
        );
      }
      return request.rows[0];
    });
  }

  async submit(userId: number, id: number) {
    return this.database.transaction(async (client) => {
      const request = await this.getOwnedRequest(client, userId, id);
      if (!['draft', 'cancelled'].includes(request.status)) {
        throw new BadRequestException('Only draft reservations can be submitted');
      }
      const plotRows = await client.query(
        `SELECT p.plot_id, p.status
         FROM request_plots rp JOIN plots p ON p.plot_id = rp.plot_id
         WHERE rp.request_id = $1
         FOR UPDATE`,
        [id],
      );
      if (!plotRows.rows.length || plotRows.rows.some((plot) => plot.status !== 'available')) {
        throw new BadRequestException('Selected plots are no longer available');
      }
      await client.query(
        `UPDATE plots SET status = 'pending', reserved_until = NOW() + INTERVAL '30 minutes', updated_at = NOW()
         WHERE plot_id = ANY($1::int[])`,
        [plotRows.rows.map((plot) => plot.plot_id)],
      );
      const updated = await client.query(
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
      const updated = await client.query(
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
      `SELECT request_id AS id, request_type AS type, status, total_price::float AS "totalPrice",
              note, created_at AS "createdAt"
       FROM reservation_requests
       WHERE user_id = $1 AND is_deleted = FALSE
       ORDER BY created_at DESC`,
      [userId],
    );
  }

  async myOne(userId: number, id: number) {
    const request = await this.database.queryOne(
      `SELECT request_id AS id, request_type AS type, status, total_price::float AS "totalPrice",
              note, created_at AS "createdAt"
       FROM reservation_requests
       WHERE request_id = $1 AND user_id = $2 AND is_deleted = FALSE`,
      [id, userId],
    );
    if (!request) throw new NotFoundException('Reservation not found');
    return request;
  }

  async adminList() {
    return this.database.query(
      `SELECT request_id AS id, request_type AS type, status, customer_name AS "customerName",
              customer_email AS "customerEmail", total_price::float AS "totalPrice",
              plot_codes AS "plotCodes", plot_count AS "plotCount", created_at AS "createdAt"
       FROM vw_reservation_requests_full
       ORDER BY created_at DESC`,
    );
  }

  async adminOne(id: number) {
    const request = await this.database.queryOne(
      `SELECT request_id AS id, request_type AS type, status, customer_name AS "customerName",
              customer_email AS "customerEmail", total_price::float AS "totalPrice",
              plot_codes AS "plotCodes", plot_count AS "plotCount", note, created_at AS "createdAt"
       FROM vw_reservation_requests_full
       WHERE request_id = $1`,
      [id],
    );
    if (!request) throw new NotFoundException('Reservation not found');
    return request;
  }

  async approve(adminId: number, id: number, adminNote?: string) {
    return this.database.transaction(async (client) => {
      const requestResult = await client.query(
        `SELECT * FROM reservation_requests WHERE request_id = $1 AND is_deleted = FALSE FOR UPDATE`,
        [id],
      );
      const request = requestResult.rows[0];
      if (!request) throw new NotFoundException('Reservation not found');
      if (!['submitted', 'pending'].includes(request.status)) {
        throw new BadRequestException('Only submitted reservations can be approved');
      }

      const finalPlotStatus = request.request_type === 'purchase' ? 'sold' : 'reserved';
      await client.query(
        `UPDATE plots SET status = $2, reserved_until = NULL, updated_at = NOW()
         WHERE plot_id IN (SELECT plot_id FROM request_plots WHERE request_id = $1)`,
        [id, finalPlotStatus],
      );
      await client.query(
        `UPDATE reservation_requests
         SET status = 'approved', admin_id = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, adminNote ?? null],
      );
      if (request.request_type === 'purchase') {
        await this.createContractsForRequest(client, id, adminId);
      }
      await this.notify(client, request.user_id, 'request_approved', 'Reservation approved', 'Your reservation request has been approved.', 'reservation_request', id);
      return { id, status: 'approved' };
    });
  }

  async reject(adminId: number, id: number, adminNote?: string) {
    return this.database.transaction(async (client) => {
      const requestResult = await client.query(
        `SELECT * FROM reservation_requests WHERE request_id = $1 AND is_deleted = FALSE FOR UPDATE`,
        [id],
      );
      const request = requestResult.rows[0];
      if (!request) throw new NotFoundException('Reservation not found');
      await client.query(
        `UPDATE plots SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE plot_id IN (SELECT plot_id FROM request_plots WHERE request_id = $1)
           AND status = 'pending'`,
        [id],
      );
      await client.query(
        `UPDATE reservation_requests
         SET status = 'rejected', admin_id = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, adminNote ?? null],
      );
      await this.notify(client, request.user_id, 'request_rejected', 'Reservation rejected', 'Your reservation request has been rejected.', 'reservation_request', id);
      return { id, status: 'rejected' };
    });
  }

  private async availablePlots(client: PoolClient, plotIds: number[]) {
    const result = await client.query(
      `SELECT plot_id, price FROM plots
       WHERE plot_id = ANY($1::int[]) AND status = 'available' AND is_deleted = FALSE
       FOR UPDATE`,
      [plotIds],
    );
    return result.rows;
  }

  private async getOwnedRequest(client: PoolClient, userId: number, id: number) {
    const result = await client.query(
      `SELECT * FROM reservation_requests
       WHERE request_id = $1 AND user_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [id, userId],
    );
    if (!result.rows[0]) throw new NotFoundException('Reservation not found');
    return result.rows[0];
  }

  private async createContractsForRequest(client: PoolClient, requestId: number, adminId: number) {
    const rows = await client.query(
      `SELECT rr.user_id, rp.plot_id, rp.plot_price
       FROM reservation_requests rr JOIN request_plots rp ON rp.request_id = rr.request_id
       WHERE rr.request_id = $1`,
      [requestId],
    );
    const groupCode = `GRP-${requestId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    for (const row of rows.rows) {
      await client.query(
        `INSERT INTO contracts (contract_code, request_id, user_id, plot_id, total_amount, created_by, group_contract_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (contract_code) DO NOTHING`,
        [`HD-${requestId}-${row.plot_id}`, requestId, row.user_id, row.plot_id, row.plot_price, adminId, groupCode],
      );
    }
  }

  private async notify(client: PoolClient, userId: number, type: string, title: string, message: string, entity: string, entityId: number) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, message, entity, entityId],
    );
  }
}
