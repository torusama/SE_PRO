import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ContractsService {
  constructor(private readonly database: DatabaseService) {}

  adminList() {
    return this.database.query(this.baseQuery('ORDER BY c.created_at DESC'));
  }

  async adminOne(id: number) {
    const contract = await this.database.queryOne(
      this.baseQuery('WHERE c.contract_id = $1'),
      [id],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  my(userId: number) {
    return this.database.query(
      this.baseQuery('WHERE c.user_id = $1 ORDER BY c.created_at DESC'),
      [userId],
    );
  }

  async myOne(userId: number, id: number) {
    const contract = await this.database.queryOne(
      this.baseQuery('WHERE c.contract_id = $1 AND c.user_id = $2'),
      [id, userId],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    const payments = await this.database.query(
      `SELECT transaction_id AS id, amount::float, payment_method AS "paymentMethod",
              payment_date AS "paymentDate", reference_code AS "referenceCode", note
       FROM payment_transactions
       WHERE contract_id = $1
       ORDER BY payment_date ASC, transaction_id ASC`,
      [id],
    );

    return { ...contract, payments };
  }

  async createFromReservation(reservationId: number, adminId: number) {
    const rows = await this.database.query(
      `INSERT INTO contracts (contract_code, request_id, user_id, plot_id, total_amount, created_by, group_contract_code)
       SELECT CONCAT('HD-', rr.request_id, '-', rp.plot_id), rr.request_id, rr.user_id, rp.plot_id,
              rp.plot_price, $2, CONCAT('GRP-', rr.request_id, '-', TO_CHAR(NOW(), 'YYYYMMDD'))
       FROM reservation_requests rr JOIN request_plots rp ON rp.request_id = rr.request_id
       WHERE rr.request_id = $1
       ON CONFLICT (contract_code) DO NOTHING
       RETURNING contract_id AS id, contract_code AS "contractCode"`,
      [reservationId, adminId],
    );
    return rows;
  }

  async updateStatus(id: number, status: string) {
    const contract = await this.database.queryOne(
      `UPDATE contracts SET status = $2, updated_at = NOW()
       WHERE contract_id = $1 AND is_deleted = FALSE
       RETURNING contract_id AS id, contract_code AS "contractCode", status`,
      [id, status],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async addPayment(id: number, body: any, adminId: number) {
    return this.database.transaction(async (client) => {
      const payment = await client.query(
        `INSERT INTO payment_transactions (contract_id, amount, payment_method, reference_code, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING transaction_id AS id, amount::float, payment_method AS "paymentMethod"`,
        [
          id,
          body.amount,
          body.paymentMethod ?? 'cash',
          body.referenceCode ?? null,
          body.note ?? null,
          adminId,
        ],
      );
      await client.query(
        `UPDATE contracts
         SET paid_amount = paid_amount + $2,
             payment_status = CASE WHEN paid_amount + $2 >= total_amount THEN 'paid' ELSE 'partial' END,
             updated_at = NOW()
         WHERE contract_id = $1`,
        [id, body.amount],
      );
      return payment.rows[0];
    });
  }

  private baseQuery(suffix: string) {
    return `SELECT c.contract_id AS id, c.contract_code AS "contractCode", c.status,
                   c.total_amount::float AS "totalAmount", c.paid_amount::float AS "paidAmount",
                   (c.total_amount - c.paid_amount)::float AS "remainingAmount",
                   c.payment_status AS "paymentStatus", c.contract_date AS "contractDate",
                   c.effective_date AS "effectiveDate", c.expiry_date AS "expiryDate",
                   c.pdf_url AS "pdfUrl",
                   u.full_name AS "customerName",
                   p.plot_id AS "plotId", p.plot_code AS "plotCode", p.area_sqm::float AS "areaSqm",
                   p.direction, p.plot_type AS "plotType", p.row_number AS "rowNumber",
                   p.column_number AS "columnNumber",
                   z.zone_name AS "zoneName", z.zone_code AS "zoneCode",
                   o.deceased_name AS "deceasedName", o.burial_date AS "burialDate"
            FROM contracts c
            JOIN users u ON u.user_id = c.user_id
            JOIN plots p ON p.plot_id = c.plot_id
            JOIN cemetery_zones z ON z.zone_id = p.zone_id
            LEFT JOIN ownership_records o ON o.plot_id = p.plot_id AND o.is_current = TRUE
            ${suffix}`;
  }
}
