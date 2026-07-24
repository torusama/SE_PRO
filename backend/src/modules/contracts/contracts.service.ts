import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const CONTRACT_STATUS_LABEL: Record<string, string> = {
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
  ) {}

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
    const contract = await this.database.queryOne<any>(
      `UPDATE contracts
       SET inheritance_content = $2, inheritance_updated_by = $3,
           inheritance_updated_at = NOW(), updated_at = NOW()
       WHERE contract_id = $1 AND is_deleted = FALSE
       RETURNING contract_id AS id, contract_code AS "contractCode",
                 inheritance_content AS "inheritanceContent",
                 inheritance_updated_at AS "inheritanceUpdatedAt",
                 user_id AS "userId"`,
      [id, content.trim() || null, adminId],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    await this.notificationsService.createInApp(
      contract.userId,
      'contract_updated',
      'Hợp đồng đã được cập nhật',
      `Nội dung thừa kế/thụ hưởng của hợp đồng ${contract.contractCode} vừa được cập nhật.`,
      'contract',
      contract.id,
    );

    return contract;
  }

  async signAsBuyer(userId: number, id: number, signatureName: string) {
    return this.sign(id, userId, signatureName, 'b');
  }

  async signAsAdmin(adminId: number, id: number, signatureName: string) {
    return this.sign(id, adminId, signatureName, 'a');
  }

  private async sign(
    id: number,
    signerId: number,
    signatureName: string,
    party: 'a' | 'b',
  ) {
    const contract = await this.database.queryOne<any>(
      `SELECT contract_id, user_id, status, contract_content,
              inheritance_content, party_${party}_signed_at
       FROM contracts WHERE contract_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    if (party === 'b' && Number(contract.user_id) !== signerId) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status !== 'active') {
      throw new BadRequestException('Only active contracts can be signed');
    }
    if (contract[`party_${party}_signed_at`]) {
      throw new BadRequestException('This party has already signed');
    }

    const signedAt = new Date();
    const cleanName = signatureName.trim();
    const hash = createHash('sha256')
      .update(
        [
          id,
          signerId,
          party,
          cleanName,
          signedAt.toISOString(),
          contract.contract_content ?? '',
          contract.inheritance_content ?? '',
        ].join('|'),
      )
      .digest('hex');
    const result = await this.database.queryOne<any>(
      `UPDATE contracts SET
         party_${party}_signed_by = $2,
         party_${party}_signature_name = $3,
         party_${party}_signed_at = $4,
         party_${party}_signature_hash = $5,
         updated_at = NOW()
       WHERE contract_id = $1
       RETURNING contract_id AS id, contract_code AS "contractCode",
         party_${party}_signature_name AS "signatureName",
         party_${party}_signed_at AS "signedAt",
         party_${party}_signature_hash AS "signatureHash"`,
      [id, signerId, cleanName, signedAt, hash],
    );

    const signerLabel = party === 'a' ? 'Ban quản lý nghĩa trang' : 'Bạn';
    await this.notificationsService.createInApp(
      contract.user_id,
      'contract_updated',
      party === 'a' ? 'Hợp đồng đã được ký xác nhận' : 'Đã ghi nhận chữ ký',
      `${signerLabel} vừa ký hợp đồng ${result.contractCode}.`,
      'contract',
      id,
    );

    return result;
  }

  async savePdf(
    id: number,
    actorId: number,
    relativeUrl: string,
    isAdmin: boolean,
  ) {
    const row = await this.database.queryOne<any>(
      `UPDATE contracts SET pdf_url = $3, pdf_uploaded_by = $2,
              pdf_uploaded_at = NOW(), updated_at = NOW()
       WHERE contract_id = $1 AND is_deleted = FALSE
         AND ($4::boolean = TRUE OR user_id = $2)
       RETURNING contract_id AS id, contract_code AS "contractCode",
                 pdf_url AS "pdfUrl", pdf_uploaded_at AS "pdfUploadedAt",
                 user_id AS "userId"`,
      [id, actorId, relativeUrl, isAdmin],
    );
    if (!row) throw new NotFoundException('Contract not found');

    if (isAdmin) {
      await this.notificationsService.createInApp(
        row.userId,
        'contract_pdf_ready',
        'Bản PDF hợp đồng đã sẵn sàng',
        `Hợp đồng ${row.contractCode} đã có bản PDF, bạn có thể tải về để lưu trữ.`,
        'contract',
        row.id,
      );
    }

    return row;
  }

  async getPdf(id: number, actorId: number, isAdmin: boolean) {
    const row = await this.database.queryOne<{ pdfUrl: string | null }>(
      `SELECT pdf_url AS "pdfUrl" FROM contracts
       WHERE contract_id = $1 AND is_deleted = FALSE
         AND ($3::boolean = TRUE OR user_id = $2)`,
      [id, actorId, isAdmin],
    );
    if (!row) throw new NotFoundException('Contract not found');
    if (!row.pdfUrl) throw new NotFoundException('Contract PDF not found');
    return row.pdfUrl;
  }

  async addPayment(id: number, body: any, adminId: number) {
    const result = await this.database.transaction(async (client) => {
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
      const contract = await client.query(
        `UPDATE contracts
         SET paid_amount = paid_amount + $2,
             payment_status = CASE WHEN paid_amount + $2 >= total_amount THEN 'paid' ELSE 'partial' END,
             updated_at = NOW()
         WHERE contract_id = $1
         RETURNING contract_id AS id, contract_code AS "contractCode", user_id AS "userId",
                   paid_amount::float AS "paidAmount", total_amount::float AS "totalAmount",
                   payment_status AS "paymentStatus"`,
        [id, body.amount],
      );
      return { payment: payment.rows[0], contract: contract.rows[0] };
    });

    const { payment, contract } = result;
    const isPaidOff = contract.paymentStatus === 'paid';
    await this.notificationsService.createInApp(
      contract.userId,
      'contract_updated',
      isPaidOff ? 'Hợp đồng đã thanh toán đủ' : 'Đã ghi nhận thanh toán',
      isPaidOff
        ? `Hợp đồng ${contract.contractCode} đã được thanh toán đầy đủ ${money.format(contract.totalAmount)}.`
        : `Hợp đồng ${contract.contractCode} vừa ghi nhận thanh toán ${money.format(payment.amount)}. Còn lại ${money.format(contract.totalAmount - contract.paidAmount)}.`,
      'contract',
      contract.id,
    );

    return payment;
  }

  private baseQuery(suffix: string) {
    return `SELECT c.contract_id AS id, c.contract_code AS "contractCode", c.status,
                   c.total_amount::float AS "totalAmount", c.paid_amount::float AS "paidAmount",
                   (c.total_amount - c.paid_amount)::float AS "remainingAmount",
                   c.payment_status AS "paymentStatus", c.contract_date AS "contractDate",
                   c.effective_date AS "effectiveDate", c.expiry_date AS "expiryDate",
                   c.pdf_url AS "pdfUrl", c.contract_content AS "contractContent",
                   c.inheritance_content AS "inheritanceContent",
                   c.inheritance_updated_at AS "inheritanceUpdatedAt",
                   c.party_a_signature_name AS "partyASignatureName",
                   c.party_a_signed_at AS "partyASignedAt",
                   c.party_a_signature_hash AS "partyASignatureHash",
                   c.party_b_signature_name AS "partyBSignatureName",
                   c.party_b_signed_at AS "partyBSignedAt",
                   c.party_b_signature_hash AS "partyBSignatureHash",
                   c.pdf_uploaded_at AS "pdfUploadedAt",
                   u.full_name AS "customerName", u.id_card_number AS "customerIdCard",
                   u.address AS "customerAddress", u.phone_number AS "customerPhone",
                   u.notes AS "customerNotes",
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
