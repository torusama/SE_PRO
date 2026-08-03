import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminContractQueryDto } from './dto/admin-contract-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  composeContractContent,
  extractContractBaseContent,
  upgradePurchaseContractBase,
} from './contract-content';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'đang chờ ký offline',
  active: 'đang hiệu lực',
  completed: 'đã hoàn tất',
  cancelled: 'đã huỷ',
  expired: 'đã hết hạn',
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly audit?: AdminAuditService,
  ) {}

  async adminList(query: AdminContractQueryDto = new AdminContractQueryDto()) {
    const values: unknown[] = [];
    const conditions = ['c.is_deleted = FALSE'];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(c.contract_code ILIKE ${p} OR u.full_name ILIKE ${p} OR p.plot_code ILIKE ${p}
          OR EXISTS (
            SELECT 1 FROM contract_plots search_cp
            JOIN plots search_plot ON search_plot.plot_id = search_cp.plot_id
            WHERE search_cp.contract_id = c.contract_id
              AND search_plot.plot_code ILIKE ${p}
          ))`,
      );
    }
    if (query.status) conditions.push(`c.status = ${add(query.status)}`);
    if (query.paymentStatus)
      conditions.push(`c.payment_status = ${add(query.paymentStatus)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM contracts c
       JOIN users u ON u.user_id=c.user_id JOIN plots p ON p.plot_id=c.plot_id ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      this.baseQuery(
        `${where} ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      ),
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async adminOne(id: number) {
    const contract = await this.database.queryOne(
      this.baseQuery('WHERE c.contract_id = $1'),
      [id],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    const [payments, ownershipHistory] = await Promise.all([
      this.database.query(
        `SELECT transaction_id AS id, amount::float, payment_method AS "paymentMethod",
                payment_date AS "paymentDate", reference_code AS "referenceCode", note
         FROM payment_transactions WHERE contract_id=$1
         ORDER BY payment_date DESC, transaction_id DESC`,
        [id],
      ),
      this.database.query(
        `SELECT ownership_id AS id, user_id AS "userId", ownership_start AS "startedAt",
                ownership_end AS "endedAt", is_current AS "isCurrent", transfer_note AS note
         FROM ownership_records WHERE contract_id=$1 ORDER BY ownership_start DESC`,
        [id],
      ),
    ]);
    return { ...contract, payments, ownershipHistory };
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
    void adminId;
    const reservation = await this.database.queryOne<{
      type: string;
      status: string;
    }>(
      `SELECT request_type AS type, status
       FROM reservation_requests
       WHERE request_id = $1 AND is_deleted = FALSE`,
      [reservationId],
    );
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.type !== 'purchase' || reservation.status !== 'approved') {
      throw new BadRequestException(
        'Contract is created automatically when a purchase request is approved',
      );
    }
    const rows = await this.database.query(
      `SELECT contract_id AS id, contract_code AS "contractCode", status
       FROM contracts
       WHERE request_id = $1 AND is_deleted = FALSE
       ORDER BY contract_id`,
      [reservationId],
    );
    if (!rows.length) {
      throw new BadRequestException(
        'No contract was created for this approved request; review the approval transaction',
      );
    }
    return rows;
  }

  async updateStatus(id: number, status: string) {
    const contract = await this.database.queryOne<any>(
      `UPDATE contracts SET status = $2, updated_at = NOW()
       WHERE contract_id = $1 AND is_deleted = FALSE
       RETURNING contract_id AS id, contract_code AS "contractCode", status, user_id AS "userId"`,
      [id, status],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    const label = CONTRACT_STATUS_LABEL[status] ?? status;
    await this.notificationsService.createInApp(
      contract.userId,
      'contract_updated',
      'Hợp đồng đã được cập nhật',
      `Hợp đồng ${contract.contractCode} hiện ${label}.`,
      'contract',
      contract.id,
    );

    return contract;
  }

  async updateInheritance(id: number, content: string, adminId: number) {
    return this.database.transaction(async (client) => {
      const locked = await client.query<any>(
        `SELECT contract_id AS id, contract_code AS "contractCode",
                user_id AS "userId", status, contract_content AS "contractContent",
                contract_base_content AS "contractBaseContent",
                inheritance_content AS "inheritanceContent",
                EXISTS (
                  SELECT 1 FROM contract_signed_evidence evidence
                  WHERE evidence.contract_id = contracts.contract_id
                ) AS "hasSignedEvidence"
         FROM contracts
         WHERE contract_id = $1 AND is_deleted = FALSE
         FOR UPDATE`,
        [id],
      );
      const before = locked.rows[0];
      if (!before) throw new NotFoundException('Contract not found');
      const canEditLegacyActive =
        before.status === 'active' &&
        !before.hasSignedEvidence;
      if (before.status !== 'draft' && !canEditLegacyActive) {
        throw new BadRequestException(
          'Inheritance information is locked after signed evidence is recorded',
        );
      }
      const cleanContent = content.trim() || null;
      let baseContent = extractContractBaseContent(
        before.contractBaseContent || before.contractContent,
      );
      const contractPlots = await client.query<{
        code: string;
        zoneName: string | null;
        areaSqm: number | null;
        price: number;
      }>(
        `SELECT p.plot_code AS code, z.zone_name AS "zoneName",
                p.area_sqm::float AS "areaSqm", cp.agreed_price::float AS price
         FROM contract_plots cp
         JOIN plots p ON p.plot_id = cp.plot_id
         JOIN cemetery_zones z ON z.zone_id = p.zone_id
         WHERE cp.contract_id = $1
         ORDER BY p.plot_code`,
        [id],
      );
      baseContent = upgradePurchaseContractBase(baseContent, contractPlots.rows);
      const renderedContent = composeContractContent(baseContent, cleanContent);
      const updated = await client.query<any>(
        `UPDATE contracts
         SET inheritance_content = $2, inheritance_updated_by = $3,
             inheritance_updated_at = NOW(), contract_base_content = $4,
             contract_content = $5, updated_at = NOW()
         WHERE contract_id = $1
         RETURNING contract_id AS id, contract_code AS "contractCode",
                   inheritance_content AS "inheritanceContent",
                   inheritance_updated_at AS "inheritanceUpdatedAt",
                   contract_base_content AS "contractBaseContent",
                   contract_content AS "contractContent", user_id AS "userId"`,
        [id, cleanContent, adminId, baseContent, renderedContent],
      );
      const contract = updated.rows[0];
      await this.notificationsService.createInAppWithClient(
        client,
        contract.userId,
        'contract_updated',
        'Hợp đồng đã được cập nhật',
        `Nội dung thừa kế/thụ hưởng của hợp đồng ${contract.contractCode} vừa được cập nhật.`,
        'contract',
        contract.id,
      );
      await this.audit?.record(client, {
        action: 'contract.inheritance.update',
        entityType: 'contract',
        entityId: id,
        before: { inheritanceContent: before.inheritanceContent },
        after: { inheritanceContent: cleanContent },
        context: { adminId, ipAddress: null, userAgent: null },
      });
      return contract;
    });
  }

  async saveSignedEvidence(
    id: number,
    adminId: number,
    files: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
    }>,
  ) {
    if (!files.length) {
      throw new BadRequestException('At least one signed contract document is required');
    }
    return this.database.transaction(async (client) => {
      const contract = await client.query<{
        id: number;
        status: string;
      }>(
        `SELECT contract_id AS id, status
         FROM contracts
         WHERE contract_id = $1 AND is_deleted = FALSE
         FOR UPDATE`,
        [id],
      );
      if (!contract.rows[0]) throw new NotFoundException('Contract not found');
      if (!['draft', 'active'].includes(contract.rows[0].status)) {
        throw new BadRequestException(
          'Signed evidence cannot be added to this contract status',
        );
      }
      const count = await client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM contract_signed_evidence
         WHERE contract_id = $1`,
        [id],
      );
      if (Number(count.rows[0]?.total ?? 0) + files.length > 10) {
        throw new BadRequestException(
          'A contract can store at most 10 signed evidence documents',
        );
      }

      const saved: unknown[] = [];
      for (const file of files) {
        const inserted = await client.query(
          `INSERT INTO contract_signed_evidence
             (contract_id, stored_filename, original_name, mime_type, size_bytes, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING evidence_id AS id, stored_filename AS filename,
                     original_name AS "originalName", mime_type AS "mimeType",
                     size_bytes AS size, created_at AS "createdAt"`,
          [
            id,
            file.filename,
            file.originalname.slice(0, 255),
            file.mimetype,
            file.size,
            adminId,
          ],
        );
        saved.push(inserted.rows[0]);
      }
      await this.audit?.record(client, {
        action: 'contract.signed_evidence.upload',
        entityType: 'contract',
        entityId: id,
        after: { evidenceCount: saved.length },
        context: { adminId, ipAddress: null, userAgent: null },
      });
      return saved;
    });
  }

  async getSignedEvidence(id: number, filename: string) {
    const evidence = await this.database.queryOne<{
      filename: string;
      mimeType: string;
    }>(
      `SELECT stored_filename AS filename, mime_type AS "mimeType"
       FROM contract_signed_evidence
       WHERE contract_id = $1 AND stored_filename = $2`,
      [id, filename],
    );
    if (!evidence) throw new NotFoundException('Signed evidence not found');
    return evidence;
  }

  async activateOwnership(
    id: number,
    adminId: number,
    context?: AdminRequestContext,
  ) {
    return this.database.transaction(async (client) => {
      const locked = await client.query<{
        id: number;
        contractCode: string;
        userId: number;
        status: string;
        paymentStatus: string;
      }>(
        `SELECT contract_id AS id, contract_code AS "contractCode",
                user_id AS "userId", status,
                payment_status AS "paymentStatus"
         FROM contracts
         WHERE contract_id = $1 AND is_deleted = FALSE
         FOR UPDATE`,
        [id],
      );
      const contract = locked.rows[0];
      if (!contract) throw new NotFoundException('Contract not found');
      if (contract.status !== 'draft') {
        throw new BadRequestException(
          'Only draft contracts can activate ownership',
        );
      }
      if (contract.paymentStatus !== 'paid') {
        throw new BadRequestException(
          'The contract must be paid in full before ownership can be activated',
        );
      }
      const evidence = await client.query(
        `SELECT evidence_id
         FROM contract_signed_evidence
         WHERE contract_id = $1
         LIMIT 1`,
        [id],
      );
      if (!evidence.rows.length) {
        throw new BadRequestException(
          'Upload at least one signed contract document before activating ownership',
        );
      }
      const plots = await client.query<{
        id: number;
        code: string;
        status: string;
      }>(
        `SELECT p.plot_id AS id, p.plot_code AS code, p.status
         FROM contract_plots cp
         JOIN plots p ON p.plot_id = cp.plot_id
         WHERE cp.contract_id = $1
         ORDER BY p.plot_id
         FOR UPDATE OF p`,
        [id],
      );
      if (!plots.rows.length) {
        throw new BadRequestException('Contract does not contain any plots');
      }
      if (plots.rows.some((plot) => plot.status !== 'reserved')) {
        throw new BadRequestException(
          'All contract plots must still be reserved before ownership activation',
        );
      }
      const currentOwnership = await client.query(
        `SELECT ownership_id
         FROM ownership_records
         WHERE plot_id = ANY($1::int[]) AND is_current = TRUE
         LIMIT 1`,
        [plots.rows.map((plot) => plot.id)],
      );
      if (currentOwnership.rows.length) {
        throw new BadRequestException(
          'One or more plots already have a current owner',
        );
      }

      const updated = await client.query(
        `UPDATE contracts
         SET status = 'active', effective_date = COALESCE(effective_date, CURRENT_DATE),
             notes = COALESCE(notes || E'\n', '') ||
               'Signed offline contract evidence verified by admin.',
             updated_at = NOW()
         WHERE contract_id = $1
         RETURNING contract_id AS id, contract_code AS "contractCode", status`,
        [id],
      );
      const ownership = await client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM ownership_records
         WHERE contract_id = $1 AND is_current = TRUE`,
        [id],
      );
      if (Number(ownership.rows[0]?.total ?? 0) !== plots.rows.length) {
        throw new BadRequestException(
          'Ownership records could not be created for every contract plot',
        );
      }
      await this.notificationsService.createInAppWithClient(
        client,
        contract.userId,
        'ownership_activated',
        'Hợp đồng và quyền sở hữu đã có hiệu lực',
        `Hợp đồng ${contract.contractCode} đã được xác nhận ký offline. Quyền sở hữu ${plots.rows.length} lô đã được ghi nhận.`,
        'contract',
        id,
      );
      await this.audit?.record(client, {
        action: 'contract.ownership.activate',
        entityType: 'contract',
        entityId: id,
        before: {
          status: contract.status,
          paymentStatus: contract.paymentStatus,
        },
        after: {
          status: 'active',
          plotIds: plots.rows.map((plot) => plot.id),
          plotCodes: plots.rows.map((plot) => plot.code),
        },
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });
      return {
        ...updated.rows[0],
        ownershipCreated: plots.rows.length,
        plotCodes: plots.rows.map((plot) => plot.code),
      };
    });
  }

  async addPayment(
    id: number,
    body: RecordPaymentDto,
    adminId: number,
    context?: AdminRequestContext,
  ) {
    const result = await this.database.transaction(async (client) => {
      const locked = await client.query<any>(
        `SELECT contract_id AS id, contract_code AS "contractCode",
                user_id AS "userId", total_amount::float AS "totalAmount",
                paid_amount::float AS "paidAmount",
                payment_status AS "paymentStatus"
         FROM contracts
         WHERE contract_id = $1 AND is_deleted = FALSE
         FOR UPDATE`,
        [id],
      );
      const before = locked.rows[0];
      if (!before) throw new NotFoundException('Contract not found');
      if (body.amount > before.totalAmount - before.paidAmount) {
        throw new BadRequestException(
          'Payment amount exceeds the outstanding balance',
        );
      }
      if (body.referenceCode) {
        const duplicate = await client.query(
          `SELECT 1 FROM payment_transactions
           WHERE contract_id = $1 AND reference_code = $2 LIMIT 1`,
          [id, body.referenceCode],
        );
        if (duplicate.rows.length) {
          throw new BadRequestException('Payment reference already exists');
        }
      }
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
      // trg_payment_accum updates paid_amount (and trg_contract_payment_status
      // derives payment_status) synchronously after the payment insert.
      // Read that result instead of adding the amount a second time here.
      const contract = await client.query(
        `SELECT contract_id AS id, contract_code AS "contractCode", user_id AS "userId",
                paid_amount::float AS "paidAmount", total_amount::float AS "totalAmount",
                payment_status AS "paymentStatus"
         FROM contracts
         WHERE contract_id = $1`,
        [id],
      );
      const savedPayment = payment.rows[0];
      const updatedContract = contract.rows[0];
      const isPaidOff = updatedContract.paymentStatus === 'paid';
      await this.notificationsService.createInAppWithClient(
        client,
        updatedContract.userId,
        'contract_updated',
        isPaidOff ? 'Đã thanh toán đủ hợp đồng' : 'Đã ghi nhận thanh toán',
        isPaidOff
          ? `Hợp đồng ${updatedContract.contractCode} đã được thanh toán đầy đủ ${money.format(updatedContract.totalAmount)}.`
          : `Hợp đồng ${updatedContract.contractCode} vừa ghi nhận thanh toán ${money.format(savedPayment.amount)}. Còn lại ${money.format(updatedContract.totalAmount - updatedContract.paidAmount)}.`,
        'contract',
        updatedContract.id,
      );
      await this.audit?.record(client, {
        action: 'contract.payment.record',
        entityType: 'contract',
        entityId: id,
        before: {
          paidAmount: before.paidAmount,
          paymentStatus: before.paymentStatus,
        },
        after: {
          paidAmount: updatedContract.paidAmount,
          paymentStatus: updatedContract.paymentStatus,
          paymentId: savedPayment.id,
          amount: savedPayment.amount,
        },
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });
      return { payment: payment.rows[0], contract: contract.rows[0] };
    });

    return result.payment;
  }

  private baseQuery(suffix: string) {
    return `SELECT c.contract_id AS id, c.contract_code AS "contractCode", c.status,
                   c.total_amount::float AS "totalAmount", c.paid_amount::float AS "paidAmount",
                   (c.total_amount - c.paid_amount)::float AS "remainingAmount",
                   c.payment_status AS "paymentStatus", c.contract_date AS "contractDate",
                   c.effective_date AS "effectiveDate", c.expiry_date AS "expiryDate",
                   c.contract_content AS "contractContent",
                   c.contract_base_content AS "contractBaseContent",
                   c.inheritance_content AS "inheritanceContent",
                   c.inheritance_updated_at AS "inheritanceUpdatedAt",
                   (c.status = 'draft' OR (
                     c.status = 'active'
                     AND NOT EXISTS (
                       SELECT 1 FROM contract_signed_evidence edit_lock
                       WHERE edit_lock.contract_id = c.contract_id
                     )
                   )) AS "canEditInheritance",
                   u.full_name AS "customerName",
                   CASE WHEN u.id_card_number IS NULL THEN NULL
                        ELSE CONCAT('******', RIGHT(u.id_card_number, 4)) END AS "customerIdCard",
                   u.address AS "customerAddress", u.phone_number AS "customerPhone",
                   u.notes AS "customerNotes",
                   p.plot_id AS "plotId", p.plot_code AS "plotCode", p.area_sqm::float AS "areaSqm",
                   p.direction, p.plot_type AS "plotType", p.row_number AS "rowNumber",
                   p.column_number AS "columnNumber",
                   z.zone_name AS "zoneName", z.zone_code AS "zoneCode",
                   o.deceased_name AS "deceasedName", o.burial_date AS "burialDate",
                   COALESCE(contract_plot_data.plot_codes, ARRAY[p.plot_code]) AS "plotCodes",
                   COALESCE(
                     contract_plot_data.plots,
                     JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
                       'id', p.plot_id,
                       'code', p.plot_code,
                       'zoneName', z.zone_name,
                       'areaSqm', p.area_sqm::float,
                       'agreedPrice', c.total_amount::float
                     ))
                   ) AS plots,
                   COALESCE(evidence_data.items, '[]'::jsonb) AS "signedEvidence"
            FROM contracts c
            JOIN users u ON u.user_id = c.user_id
            JOIN plots p ON p.plot_id = c.plot_id
            JOIN cemetery_zones z ON z.zone_id = p.zone_id
            LEFT JOIN ownership_records o ON o.plot_id = p.plot_id AND o.is_current = TRUE
            LEFT JOIN LATERAL (
              SELECT ARRAY_AGG(cp_plot.plot_code ORDER BY cp_plot.plot_code) AS plot_codes,
                     JSONB_AGG(JSONB_BUILD_OBJECT(
                       'id', cp_plot.plot_id,
                       'code', cp_plot.plot_code,
                       'zoneName', cp_zone.zone_name,
                       'areaSqm', cp_plot.area_sqm::float,
                       'agreedPrice', cp.agreed_price::float
                     ) ORDER BY cp_plot.plot_code) AS plots
              FROM contract_plots cp
              JOIN plots cp_plot ON cp_plot.plot_id = cp.plot_id
              JOIN cemetery_zones cp_zone ON cp_zone.zone_id = cp_plot.zone_id
              WHERE cp.contract_id = c.contract_id
            ) contract_plot_data ON TRUE
            LEFT JOIN LATERAL (
              SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                       'id', evidence_id,
                       'filename', stored_filename,
                       'originalName', original_name,
                       'mimeType', mime_type,
                       'size', size_bytes,
                       'createdAt', created_at
                     ) ORDER BY created_at, evidence_id) AS items
              FROM contract_signed_evidence
              WHERE contract_id = c.contract_id
            ) evidence_data ON TRUE
            ${suffix}`;
  }
}
