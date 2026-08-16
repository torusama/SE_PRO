import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { AdminOwnershipQueryDto } from './dto/admin-ownership-query.dto';
import { AdminTransferQueryDto } from './dto/admin-transfer-query.dto';
import { AdminTransferRequestQueryDto } from './dto/admin-transfer-request-query.dto';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { CreateTransferAppointmentDto } from './dto/create-transfer-appointment.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { RealtimeService } from '../realtime/realtime.service';
import type { RealtimeTopic } from '../realtime/realtime.types';

interface RecipientInput {
  fullName: string;
  email: string;
  phone: string;
  idCard: string;
  address: string;
  dateOfBirth?: string;
}

interface TransferInput {
  plotIds: number[];
  recipient: RecipientInput;
  adminNote?: string;
}

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async search(mode: string, query: string) {
    if (!['customer', 'plot'].includes(mode)) {
      throw new BadRequestException('Chế độ tìm kiếm không hợp lệ');
    }
    const keyword = query.trim();
    if (keyword.length < 2) return { items: [], message: null };
    const customerCondition = `(
      u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.phone_number ILIKE $1 OR
      COALESCE(u.id_card_number, '') ILIKE $1
    )`;
    const plotCondition = `(p.plot_code ILIKE $1 OR p.plot_id::text = $2)`;
    const params: unknown[] =
      mode === 'customer'
        ? [`%${keyword}%`]
        : [`%${keyword}%`, /^\d+$/.test(keyword) ? Number(keyword) : -1];
    const items = await this.database.query(
      `SELECT p.plot_id AS "plotId", p.plot_code AS "plotCode", p.status AS "plotStatus",
              p.area_sqm::float AS "areaSqm", p.plot_type AS "plotType",
              z.zone_name AS "zoneName", c.contract_id AS "contractId",
              c.contract_code AS "contractCode", o.ownership_id AS "ownershipId",
              u.user_id AS "holderId", u.full_name AS "holderName", u.email AS "holderEmail",
              u.phone_number AS "holderPhone", u.id_card_number AS "holderIdCard",
              u.address AS "holderAddress"
       FROM ownership_records o
       JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       JOIN contracts c ON c.contract_id = o.contract_id AND c.status = 'active' AND c.is_deleted = FALSE
       JOIN users u ON u.user_id = o.user_id AND u.is_deleted = FALSE
       WHERE o.is_current = TRUE AND ${mode === 'customer' ? customerCondition : plotCondition}
       ORDER BY u.full_name, p.plot_code LIMIT 100`,
      params,
    );

    if (items.length > 0) {
      return { items, message: null };
    }

    let message: string;
    if (mode === 'customer') {
      const userCheck = await this.database.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM users u
         WHERE u.is_deleted = FALSE AND ${customerCondition}`,
        [`%${keyword}%`],
      );
      const userCount = Number(userCheck?.count ?? 0);
      if (userCount > 0) {
        message = 'Khách hàng chưa sở hữu lô đất nào';
      } else {
        message = 'Thông tin người dùng chưa có hãy kiểm tra lại thông tin';
      }
    } else {
      const plotCheck = await this.database.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM plots p
         WHERE p.is_deleted = FALSE AND ${plotCondition}`,
        params,
      );
      const plotCount = Number(plotCheck?.count ?? 0);
      if (plotCount > 0) {
        message = 'Lô đất trống chưa có chủ sở hữu';
      } else {
        message = 'Lô đất chưa có thông tin';
      }
    }

    return { items: [], message };
  }

  async listRecent(query: AdminTransferQueryDto = new AdminTransferQueryDto()) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (query.search) {
      values.push(`%${query.search}%`);
      conditions.push(
        `(b.batch_code ILIKE $1 OR old.full_name ILIKE $1 OR recipient.full_name ILIKE $1)`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM admin_transfer_batches b
       JOIN users old ON old.user_id=b.previous_holder_user_id
       JOIN users recipient ON recipient.user_id=b.recipient_user_id ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.database.query(
      `SELECT b.batch_id AS id, b.batch_code AS "batchCode", b.plot_count AS "plotCount",
              old.full_name AS "previousHolderName", recipient.full_name AS "recipientName",
              b.created_at AS "createdAt", admin.full_name AS "createdByName",
              ARRAY_AGG(p.plot_code ORDER BY p.plot_code) AS "plotCodes"
       FROM admin_transfer_batches b
       JOIN users old ON old.user_id = b.previous_holder_user_id
       JOIN users recipient ON recipient.user_id = b.recipient_user_id
       JOIN users admin ON admin.user_id = b.created_by
       JOIN admin_transfer_items item ON item.batch_id = b.batch_id
       JOIN plots p ON p.plot_id = item.plot_id
       ${where}
       GROUP BY b.batch_id, old.full_name, recipient.full_name, admin.full_name
       ORDER BY b.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async ownership(query: AdminOwnershipQueryDto) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(p.plot_code ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p})`,
      );
    }
    if (query.plotId) conditions.push(`o.plot_id=${add(query.plotId)}`);
    if (query.holderId) conditions.push(`o.user_id=${add(query.holderId)}`);
    if (query.currentOnly) conditions.push('o.is_current=TRUE');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM ownership_records o
       JOIN users u ON u.user_id=o.user_id JOIN plots p ON p.plot_id=o.plot_id ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.database.query(
      `SELECT o.ownership_id AS id, o.plot_id AS "plotId", p.plot_code AS "plotCode",
              o.user_id AS "holderId", u.full_name AS "holderName",
              o.contract_id AS "contractId", o.ownership_start AS "startedAt",
              o.ownership_end AS "endedAt", o.is_current AS "isCurrent",
              o.transfer_note AS note
       FROM ownership_records o JOIN users u ON u.user_id=o.user_id
       JOIN plots p ON p.plot_id=o.plot_id ${where}
       ORDER BY o.ownership_start DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async transferDetail(id: string) {
    const batch = await this.database.queryOne(
      `SELECT b.batch_id AS id, b.batch_code AS "batchCode",
              b.plot_count AS "plotCount", b.admin_note AS "adminNote",
              b.created_at AS "createdAt",
              old.full_name AS "previousHolderName",
              recipient.full_name AS "recipientName",
              admin.full_name AS "createdByName"
       FROM admin_transfer_batches b
       JOIN users old ON old.user_id=b.previous_holder_user_id
       JOIN users recipient ON recipient.user_id=b.recipient_user_id
       JOIN users admin ON admin.user_id=b.created_by
       WHERE b.batch_id=$1`,
      [id],
    );
    if (!batch) throw new NotFoundException('Không tìm thấy đợt chuyển quyền');
    const [items, documents] = await Promise.all([
      this.database.query(
        `SELECT i.item_id AS id, i.plot_id AS "plotId", p.plot_code AS "plotCode",
                i.previous_contract_id AS "previousContractId",
                i.new_contract_id AS "newContractId"
         FROM admin_transfer_items i JOIN plots p ON p.plot_id=i.plot_id
         WHERE i.batch_id=$1 ORDER BY p.plot_code`,
        [id],
      ),
      this.database.query(
        `SELECT document_id AS id, original_filename AS "filename",
                mime_type AS "mimeType", size_bytes AS "sizeBytes"
         FROM admin_transfer_documents WHERE batch_id=$1 ORDER BY created_at`,
        [id],
      ),
    ]);
    return { ...batch, items, documents };
  }

  async transfer(
    adminId: number,
    raw: unknown,
    files: Express.Multer.File[],
    context?: AdminRequestContext,
  ) {
    const input = this.validateInput(raw);
    if (!files.length)
      throw new BadRequestException('Cần ít nhất một văn bản ảnh hoặc PDF');
    try {
      return await this.database.transaction(async (client) => {
        const ownerships = await client.query<any>(
          `SELECT o.ownership_id, o.plot_id, o.contract_id, o.user_id,
                  u.full_name, u.email, u.phone_number, u.id_card_number, u.address,
                  p.plot_code
           FROM ownership_records o
           JOIN users u ON u.user_id = o.user_id
           JOIN plots p ON p.plot_id = o.plot_id
           JOIN contracts c ON c.contract_id = o.contract_id
           WHERE o.plot_id = ANY($1::int[]) AND o.is_current = TRUE
             AND c.status = 'active' AND c.is_deleted = FALSE
           ORDER BY o.plot_id FOR UPDATE OF o, p, c`,
          [input.plotIds],
        );
        if (ownerships.rows.length !== input.plotIds.length) {
          throw new ConflictException(
            'Một hoặc nhiều phần mộ không còn thuộc người đứng tên hiện tại',
          );
        }
        const holderIds = new Set(
          ownerships.rows.map((row) => Number(row.user_id)),
        );
        if (holderIds.size !== 1)
          throw new BadRequestException(
            'Các phần mộ được chọn phải cùng một người đứng tên',
          );
        const previousHolderId = Number(ownerships.rows[0].user_id);
        const recipient = await this.resolveRecipient(client, input.recipient);
        if (recipient.userId === previousHolderId) {
          throw new BadRequestException(
            'Người nhận phải khác người đứng tên hiện tại',
          );
        }

        const batchId = randomUUID();
        const year = new Date().getUTCFullYear();
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `admin-transfer:${year}`,
        ]);
        const seq = await client.query<{ value: string }>(
          `SELECT LPAD((COUNT(*) + 1)::text, 6, '0') AS value
           FROM admin_transfer_batches WHERE created_at >= $1 AND created_at < $2`,
          [`${year}-01-01`, `${year + 1}-01-01`],
        );
        const batchCode = `CN-${year}-${seq.rows[0].value}`;
        await client.query(
          `INSERT INTO admin_transfer_batches
             (batch_id,batch_code,previous_holder_user_id,recipient_user_id,recipient_snapshot,plot_count,admin_note,created_by)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
          [
            batchId,
            batchCode,
            previousHolderId,
            recipient.userId,
            JSON.stringify(input.recipient),
            input.plotIds.length,
            input.adminNote ?? null,
            adminId,
          ],
        );

        const groupCode = input.plotIds.length > 1 ? `TR-${batchCode}` : null;
        for (let index = 0; index < ownerships.rows.length; index += 1) {
          const old = ownerships.rows[index];
          await client.query(
            `UPDATE ownership_records SET is_current=FALSE, ownership_end=CURRENT_DATE,
               transfer_note=COALESCE(transfer_note || E'\n','') || $2
             WHERE ownership_id=$1`,
            [old.ownership_id, `Transferred by ${batchCode}`],
          );
          await client.query(
            `UPDATE contracts SET status='transferred', updated_at=NOW(),
               notes=COALESCE(notes || E'\n','') || $2 WHERE contract_id=$1`,
            [old.contract_id, `Replaced by transfer ${batchCode}`],
          );
          const contractCode = `HD-CN-${year}-${seq.rows[0].value}-${String(index + 1).padStart(2, '0')}`;
          const newContract = await client.query<{ contract_id: number }>(
            `INSERT INTO contracts
               (contract_code,user_id,plot_id,contract_date,effective_date,total_amount,paid_amount,
                payment_status,status,created_by,notes,group_contract_code,ownership_source)
             VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_DATE,0,0,'paid','active',$4,$5,$6,'transfer')
             RETURNING contract_id`,
            [
              contractCode,
              recipient.userId,
              old.plot_id,
              adminId,
              `Created from admin transfer ${batchCode}`,
              groupCode,
            ],
          );
          const newOwnership = await client.query<{ ownership_id: number }>(
            `SELECT ownership_id FROM ownership_records
             WHERE contract_id=$1 AND plot_id=$2 AND is_current=TRUE`,
            [newContract.rows[0].contract_id, old.plot_id],
          );
          await client.query(
            `INSERT INTO admin_transfer_items
               (item_id,batch_id,plot_id,previous_ownership_id,previous_contract_id,
                new_ownership_id,new_contract_id,previous_holder_snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
            [
              randomUUID(),
              batchId,
              old.plot_id,
              old.ownership_id,
              old.contract_id,
              newOwnership.rows[0].ownership_id,
              newContract.rows[0].contract_id,
              JSON.stringify({
                userId: previousHolderId,
                fullName: old.full_name,
                email: old.email,
                phone: old.phone_number,
                idCard: old.id_card_number,
                address: old.address,
              }),
            ],
          );
        }

        for (const file of files) {
          const bytes = await fs.readFile(file.path);
          await client.query(
            `INSERT INTO admin_transfer_documents
               (document_id,batch_id,stored_filename,original_filename,mime_type,size_bytes,
                checksum_sha256,uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              randomUUID(),
              batchId,
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              createHash('sha256').update(bytes).digest('hex'),
              adminId,
            ],
          );
        }
        await client.query(
          `INSERT INTO audit_logs
             (user_id,action,entity_type,entity_id,entity_key,old_value,new_value,
              ip_address,user_agent)
           VALUES ($1,'admin_plot_transfer_completed','admin_transfer_batch',NULL,$2,$3::jsonb,$4::jsonb,$5,$6)`,
          [
            adminId,
            batchId,
            JSON.stringify({
              holderUserId: previousHolderId,
              plotIds: input.plotIds,
            }),
            JSON.stringify({ recipientUserId: recipient.userId, batchCode }),
            context?.ipAddress ?? null,
            context?.userAgent ?? null,
          ],
        );
        return {
          id: batchId,
          batchCode,
          plotCount: input.plotIds.length,
          recipientUserId: recipient.userId,
          recipientAccountCreatedInactive: recipient.created,
        };
      });
    } catch (error) {
      await Promise.all(
        files.map((file) => fs.unlink(file.path).catch(() => undefined)),
      );
      throw error;
    }
  }

  async getDocument(id: string) {
    const row = await this.database.queryOne<{
      storedFilename: string;
      originalFilename: string;
    }>(
      `SELECT stored_filename AS "storedFilename", original_filename AS "originalFilename"
       FROM admin_transfer_documents WHERE document_id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu');
    return row;
  }

  private validateInput(raw: any): TransferInput {
    const plotIds: number[] = Array.isArray(raw?.plotIds)
      ? [
          ...new Set<number>(
            raw.plotIds
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isInteger(value) && value > 0),
          ),
        ]
      : [];
    const recipient = raw?.recipient ?? {};
    const required = ['fullName', 'email', 'phone', 'idCard', 'address'];
    if (!plotIds.length) throw new BadRequestException('Chưa chọn phần mộ');
    if (required.some((key) => !String(recipient[key] ?? '').trim())) {
      throw new BadRequestException('Thông tin người nhận chưa đầy đủ');
    }
    const email = String(recipient.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Email người nhận không hợp lệ');
    return {
      plotIds,
      recipient: {
        fullName: String(recipient.fullName).trim(),
        email,
        phone: String(recipient.phone).trim(),
        idCard: String(recipient.idCard).trim(),
        address: String(recipient.address).trim(),
        dateOfBirth: recipient.dateOfBirth
          ? String(recipient.dateOfBirth)
          : undefined,
      },
      adminNote: raw?.adminNote ? String(raw.adminNote).trim() : undefined,
    };
  }

  private async resolveRecipient(client: any, recipient: RecipientInput) {
    const existing = await client.query(
      `SELECT user_id FROM users WHERE LOWER(email)=LOWER($1) AND is_deleted=FALSE FOR UPDATE`,
      [recipient.email],
    );
    if (existing.rows[0])
      return { userId: Number(existing.rows[0].user_id), created: false };
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    const created = await client.query(
      `INSERT INTO users
         (email,password_hash,role,full_name,phone_number,address,id_card_number,date_of_birth,is_active)
       VALUES ($1,$2,'Customer',$3,$4,$5,$6,$7,FALSE) RETURNING user_id`,
      [
        recipient.email,
        passwordHash,
        recipient.fullName,
        recipient.phone,
        recipient.address,
        recipient.idCard,
        recipient.dateOfBirth ?? null,
      ],
    );
    return { userId: Number(created.rows[0].user_id), created: true };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Customer-initiated transfer request workflow
  // Uses reservation_requests (request_type='transfer'), request_plots,
  // transfer_request_details, transfer_request_documents, offline_appointments,
  // and contracts — reusing the purchase pipeline tables.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Customer gửi yêu cầu chuyển nhượng / thừa kế / tặng cho */
  async createTransferRequest(
    userId: number,
    dto: CreateTransferRequestDto,
    files: Express.Multer.File[],
  ) {
    if (!dto.plotIds?.length)
      throw new BadRequestException('Vui lòng chọn ít nhất một lô');

    const result = await this.database.transaction(async (client) => {
      // 1. Verify ownership — customer must currently own ALL selected plots
      const ownerships = await client.query<any>(
        `SELECT o.plot_id, o.ownership_id, p.plot_code, p.status AS plot_status
         FROM ownership_records o
         JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
         WHERE o.plot_id = ANY($1::int[])
           AND o.user_id = $2
           AND o.is_current = TRUE
           AND p.status = 'sold'
         FOR UPDATE OF o, p`,
        [dto.plotIds, userId],
      );
      if (ownerships.rows.length !== dto.plotIds.length) {
        throw new BadRequestException(
          'Một hoặc nhiều lô bạn chọn không thuộc quyền sở hữu của bạn',
        );
      }

      // 2. Check no active transfer/purchase request exists for these plots
      const existingActive = await client.query<{ plot_id: number }>(
        `SELECT rp.plot_id
         FROM request_plots rp
         JOIN reservation_requests rr ON rr.request_id = rp.request_id
         WHERE rp.plot_id = ANY($1::int[])
           AND rr.status NOT IN ('rejected', 'cancelled', 'completed')
         LIMIT 1`,
        [dto.plotIds],
      );
      if (existingActive.rows.length) {
        throw new ConflictException(
          'Một hoặc nhiều lô đã có yêu cầu đang xử lý',
        );
      }

      // 3. Determine total_price based on transfer type
      const totalPrice =
        dto.transferType === 'sale'
          ? Number(dto.transactionAmount ?? 0)
          : 0;

      // 4. Insert into reservation_requests (request_type = 'transfer')
      const inserted = await client.query<{ request_id: number }>(
        `INSERT INTO reservation_requests
           (user_id, request_type, transfer_type, status, total_price, requester_name, notes)
         VALUES ($1, 'transfer', $2, 'pending', $3, $4, $5)
         RETURNING request_id`,
        [
          userId,
          dto.transferType,
          totalPrice,
          ownerships.rows.map((r: any) => r.plot_code).join(', '),
          dto.agreementNote ?? null,
        ],
      );
      const requestId = inserted.rows[0].request_id;

      // 5. Insert request_plots (same table as purchase flow)
      for (const plotId of dto.plotIds) {
        await client.query(
          `INSERT INTO request_plots (request_id, plot_id) VALUES ($1, $2)`,
          [requestId, plotId],
        );
      }

      // 6. Insert transfer_request_details (recipient info)
      await client.query(
        `INSERT INTO transfer_request_details
           (request_id, recipient_full_name, recipient_id_card, recipient_phone,
            recipient_email, recipient_address, recipient_date_of_birth,
            recipient_relationship, transaction_amount, payment_method, agreement_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          requestId,
          dto.recipientFullName,
          dto.recipientIdCard,
          dto.recipientPhone,
          dto.recipientEmail ?? null,
          dto.recipientAddress ?? null,
          dto.recipientDateOfBirth ?? null,
          dto.recipientRelationship ?? null,
          dto.transferType === 'sale' ? (dto.transactionAmount ?? null) : null,
          dto.transferType === 'sale' ? (dto.paymentMethod ?? null) : null,
          dto.agreementNote ?? null,
        ],
      );

      // 7. Store uploaded documents
      for (const file of files) {
        const bytes = await fs.readFile(file.path);
        await client.query(
          `INSERT INTO transfer_request_documents
             (request_id, stored_filename, original_filename, mime_type, size_bytes, checksum_sha256, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            requestId,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            createHash('sha256').update(bytes).digest('hex'),
            userId,
          ],
        );
      }

      // 8. Notify admins
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         SELECT user_id, 'transfer_submitted',
                'Yêu cầu chuyển nhượng mới',
                'Khách hàng vừa gửi yêu cầu chuyển nhượng, đang chờ duyệt.',
                'transfer_request', $1
         FROM users WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
        [requestId],
      );

      return { requestId, plotCodes: ownerships.rows.map((r: any) => r.plot_code) };
    });

    this.publishRealtime(['transfers', 'notifications']);
    return result;
  }

  /** Customer xem danh sách yêu cầu chuyển nhượng của mình */
  async myTransferRequests(userId: number) {
    return this.database.query(
      `SELECT rr.request_id AS id, rr.transfer_type AS "transferType", rr.status,
              trd.recipient_full_name AS "recipientName",
              rr.created_at AS "createdAt", rr.reviewed_at AS "reviewedAt",
              rr.admin_note AS "adminNote",
              COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes"
       FROM reservation_requests rr
       JOIN transfer_request_details trd ON trd.request_id = rr.request_id
       LEFT JOIN request_plots rp ON rp.request_id = rr.request_id
       LEFT JOIN plots p ON p.plot_id = rp.plot_id
       WHERE rr.user_id = $1 AND rr.request_type = 'transfer'
       GROUP BY rr.request_id, trd.request_id
       ORDER BY rr.created_at DESC`,
      [userId],
    );
  }

  /** Customer xem chi tiết một yêu cầu */
  async myTransferRequestDetail(userId: number, requestId: number) {
    const req = await this.database.queryOne<any>(
      `SELECT rr.request_id AS id, rr.transfer_type AS "transferType", rr.status,
              trd.recipient_full_name AS "recipientName",
              trd.recipient_id_card AS "recipientIdCard",
              trd.recipient_phone AS "recipientPhone",
              trd.recipient_email AS "recipientEmail",
              trd.recipient_address AS "recipientAddress",
              trd.recipient_date_of_birth AS "recipientDateOfBirth",
              trd.recipient_relationship AS "recipientRelationship",
              trd.transaction_amount::float AS "transactionAmount",
              trd.payment_method AS "paymentMethod",
              trd.agreement_note AS "agreementNote",
              rr.admin_note AS "adminNote",
              rr.created_at AS "createdAt", rr.reviewed_at AS "reviewedAt"
       FROM reservation_requests rr
       JOIN transfer_request_details trd ON trd.request_id = rr.request_id
       WHERE rr.request_id = $1 AND rr.user_id = $2 AND rr.request_type = 'transfer'`,
      [requestId, userId],
    );
    if (!req) throw new NotFoundException('Không tìm thấy yêu cầu chuyển nhượng');
    const plots = await this.database.query(
      `SELECT p.plot_id AS id, p.plot_code AS code, z.zone_name AS "zoneName"
       FROM request_plots rp
       JOIN plots p ON p.plot_id = rp.plot_id
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE rp.request_id = $1 ORDER BY p.plot_code`,
      [requestId],
    );
    const docs = await this.database.query(
      `SELECT document_id AS id, original_filename AS filename, mime_type AS "mimeType",
              size_bytes AS "sizeBytes", created_at AS "createdAt"
       FROM transfer_request_documents WHERE request_id = $1 ORDER BY created_at`,
      [requestId],
    );
    // Reuses offline_appointments (same table as purchase flow)
    const appointment = await this.database.queryOne<any>(
      `SELECT appointment_id AS id, date_range_start AS "rangeStart",
              date_range_end AS "rangeEnd", location, status,
              customer_selected_date AS "customerSelectedDate",
              customer_selected_time AS "customerSelectedTime",
              customer_status AS "customerStatus",
              admin_note AS note
       FROM offline_appointments
       WHERE request_id = $1 AND is_deleted = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [requestId],
    );
    // Find contract linked to this request
    const contract = await this.database.queryOne<any>(
      `SELECT contract_id AS "contractId", contract_code AS "contractCode",
              status, payment_status AS "paymentStatus",
              generated_pdf_at AS "generatedPdfAt"
       FROM contracts WHERE request_id = $1 AND is_deleted = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [requestId],
    );
    return { ...req, plots, documents: docs, appointment: appointment ?? null, contract: contract ?? null };
  }

  /** Customer hủy yêu cầu (chỉ khi còn pending) */
  async cancelTransferRequest(userId: number, requestId: number) {
    const result = await this.database.transaction(async (client) => {
      const row = await client.query<{ status: string }>(
        `SELECT status FROM reservation_requests
         WHERE request_id = $1 AND user_id = $2 AND request_type = 'transfer' FOR UPDATE`,
        [requestId, userId],
      );
      if (!row.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (row.rows[0].status !== 'pending') {
        throw new BadRequestException(
          'Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt',
        );
      }
      await client.query(
        `UPDATE reservation_requests SET status = 'cancelled', updated_at = NOW()
         WHERE request_id = $1`,
        [requestId],
      );
      return { id: requestId, status: 'cancelled' };
    });
    this.publishRealtime(['transfers']);
    return result;
  }

  // ── Admin workflow ────────────────────────────────────────────────────────

  /** Admin lấy danh sách yêu cầu chuyển nhượng */
  async adminListTransferRequests(
    query: AdminTransferRequestQueryDto = new AdminTransferRequestQueryDto(),
  ) {
    const values: unknown[] = [];
    const conditions: string[] = ["rr.request_type = 'transfer'"];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(u.full_name ILIKE ${p} OR u.email ILIKE ${p}
          OR trd.recipient_full_name ILIKE ${p}
          OR EXISTS (
            SELECT 1 FROM request_plots rp2
            JOIN plots plt ON plt.plot_id = rp2.plot_id
            WHERE rp2.request_id = rr.request_id AND plt.plot_code ILIKE ${p}
          ))`,
      );
    }
    if (query.status) conditions.push(`rr.status = ${add(query.status)}`);
    if ((query as any).transferType) conditions.push(`rr.transfer_type = ${add((query as any).transferType)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM reservation_requests rr
       JOIN users u ON u.user_id = rr.user_id
       JOIN transfer_request_details trd ON trd.request_id = rr.request_id
       ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT rr.request_id AS id, rr.transfer_type AS "transferType", rr.status,
              trd.recipient_full_name AS "recipientName",
              rr.created_at AS "createdAt", rr.reviewed_at AS "reviewedAt",
              u.full_name AS "customerName", u.email AS "customerEmail",
              u.phone_number AS "customerPhone",
              COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes",
              COUNT(rp.plot_id)::int AS "plotCount"
       FROM reservation_requests rr
       JOIN users u ON u.user_id = rr.user_id
       JOIN transfer_request_details trd ON trd.request_id = rr.request_id
       LEFT JOIN request_plots rp ON rp.request_id = rr.request_id
       LEFT JOIN plots p ON p.plot_id = rp.plot_id
       ${where}
       GROUP BY rr.request_id, u.user_id, trd.request_id
       ORDER BY rr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return paginate(items, Number(count?.total ?? 0), query.page, query.pageSize);
  }

  /** Admin xem chi tiết một yêu cầu chuyển nhượng */
  async adminTransferRequestDetail(requestId: number) {
    const req = await this.database.queryOne<any>(
      `SELECT rr.request_id AS id, rr.transfer_type AS "transferType", rr.status,
              trd.recipient_full_name AS "recipientName",
              trd.recipient_id_card AS "recipientIdCard",
              trd.recipient_phone AS "recipientPhone",
              trd.recipient_email AS "recipientEmail",
              trd.recipient_address AS "recipientAddress",
              trd.recipient_date_of_birth AS "recipientDateOfBirth",
              trd.recipient_relationship AS "recipientRelationship",
              trd.transaction_amount::float AS "transactionAmount",
              trd.payment_method AS "paymentMethod",
              trd.agreement_note AS "agreementNote",
              rr.admin_note AS "adminNote",
              rr.created_at AS "createdAt", rr.reviewed_at AS "reviewedAt",
              u.full_name AS "customerName", u.email AS "customerEmail",
              u.phone_number AS "customerPhone",
              u.id_card_number AS "customerIdCard", u.address AS "customerAddress"
       FROM reservation_requests rr
       JOIN users u ON u.user_id = rr.user_id
       JOIN transfer_request_details trd ON trd.request_id = rr.request_id
       WHERE rr.request_id = $1 AND rr.request_type = 'transfer'`,
      [requestId],
    );
    if (!req) throw new NotFoundException('Không tìm thấy yêu cầu chuyển nhượng');
    const [plots, docs, appointment, contract] = await Promise.all([
      this.database.query(
        `SELECT p.plot_id AS id, p.plot_code AS code, z.zone_name AS "zoneName",
                p.area_sqm::float AS "areaSqm", p.status
         FROM request_plots rp
         JOIN plots p ON p.plot_id = rp.plot_id
         JOIN cemetery_zones z ON z.zone_id = p.zone_id
         WHERE rp.request_id = $1 ORDER BY p.plot_code`,
        [requestId],
      ),
      this.database.query(
        `SELECT document_id AS id, original_filename AS filename, mime_type AS "mimeType",
                size_bytes AS "sizeBytes", created_at AS "createdAt"
         FROM transfer_request_documents WHERE request_id = $1 ORDER BY created_at`,
        [requestId],
      ),
      this.database.queryOne<any>(
        `SELECT appointment_id AS id, date_range_start AS "rangeStart",
                date_range_end AS "rangeEnd", location, status,
                customer_selected_date AS "customerSelectedDate",
                customer_selected_time AS "customerSelectedTime",
                customer_status AS "customerStatus",
                admin_note AS note
         FROM offline_appointments
         WHERE request_id = $1 AND is_deleted = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [requestId],
      ),
      this.database.queryOne<any>(
        `SELECT contract_id AS "contractId", contract_code AS "contractCode",
                status, payment_status AS "paymentStatus",
                total_amount::float AS "totalAmount", paid_amount::float AS "paidAmount",
                generated_pdf_at AS "generatedPdfAt"
         FROM contracts WHERE request_id = $1 AND is_deleted = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [requestId],
      ),
    ]);
    return { ...req, plots, documents: docs, appointment: appointment ?? null, contract: contract ?? null };
  }

  /** Admin duyệt yêu cầu — tạo contract draft cho người nhận */
  async approveTransferRequest(
    adminId: number,
    requestId: number,
    adminNote?: string,
    context?: AdminRequestContext,
  ) {
    const result = await this.database.transaction(async (client) => {
      const req = await client.query<any>(
        `SELECT rr.request_id, rr.user_id, rr.status, rr.transfer_type,
                trd.recipient_full_name, trd.recipient_id_card, trd.recipient_phone,
                trd.recipient_email, trd.recipient_address, trd.recipient_date_of_birth,
                trd.transaction_amount
         FROM reservation_requests rr
         JOIN transfer_request_details trd ON trd.request_id = rr.request_id
         WHERE rr.request_id = $1 AND rr.request_type = 'transfer' FOR UPDATE`,
        [requestId],
      );
      const transferReq = req.rows[0];
      if (!transferReq) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (transferReq.status !== 'pending') {
        throw new BadRequestException('Yêu cầu này không ở trạng thái chờ duyệt');
      }

      // Get plots from request_plots
      const plots = await client.query<{ plot_id: number; plot_code: string }>(
        `SELECT p.plot_id, p.plot_code
         FROM request_plots rp
         JOIN plots p ON p.plot_id = rp.plot_id
         WHERE rp.request_id = $1 ORDER BY p.plot_code`,
        [requestId],
      );

      // Resolve or create recipient user account
      const recipient = await this.resolveRecipient(client, {
        fullName: transferReq.recipient_full_name,
        email: transferReq.recipient_email ?? `transfer_${requestId}@placeholder.local`,
        phone: transferReq.recipient_phone,
        idCard: transferReq.recipient_id_card,
        address: transferReq.recipient_address ?? '',
        dateOfBirth: transferReq.recipient_date_of_birth,
      });

      // Create transfer contract (draft) — reuses the contracts table
      const isSale = transferReq.transfer_type === 'sale';
      const totalAmount = isSale ? Number(transferReq.transaction_amount ?? 0) : 0;
      const year = new Date().getUTCFullYear();
      const contractCode = `HD-CN-${year}-${String(requestId).padStart(6, '0')}`;
      const groupCode = plots.rows.length > 1 ? `GRP-CN-${requestId}` : null;

      const contractInsert = await client.query<{ contract_id: number }>(
        `INSERT INTO contracts
           (contract_code, user_id, plot_id, request_id,
            contract_date, effective_date,
            total_amount, paid_amount,
            payment_status, status,
            created_by, notes, group_contract_code, ownership_source)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,CURRENT_DATE,$5,0,
                 CASE WHEN $5 = 0 THEN 'paid' ELSE 'unpaid' END,
                 'draft',$6,$7,$8,'transfer')
         RETURNING contract_id`,
        [
          contractCode,
          recipient.userId,
          plots.rows[0].plot_id,
          requestId,  // link contract back to this reservation_request
          totalAmount,
          adminId,
          `Created from transfer request #${requestId}`,
          groupCode,
        ],
      );
      const contractId = contractInsert.rows[0].contract_id;

      // Contract_plots
      for (const plot of plots.rows) {
        await client.query(
          `INSERT INTO contract_plots (contract_id, plot_id, agreed_price) VALUES ($1,$2,$3)`,
          [contractId, plot.plot_id, totalAmount / plots.rows.length],
        );
      }

      // Update reservation_request status
      await client.query(
        `UPDATE reservation_requests
         SET status = 'approved', admin_id = $2, admin_note = $3,
             reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [requestId, adminId, adminNote ?? null],
      );

      // Notify customer
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'transfer_approved', 'Yêu cầu chuyển nhượng đã được duyệt',
                 'Yêu cầu chuyển nhượng của bạn đã được duyệt. Ban quản lý sẽ liên hệ để đặt lịch ký hợp đồng.',
                 'transfer_request', $2)`,
        [transferReq.user_id, requestId],
      );

      return {
        id: requestId,
        status: 'approved',
        contractId,
        contractCode,
        recipientAccountCreated: recipient.created,
      };
    });
    this.publishRealtime(['transfers', 'contracts', 'notifications']);
    return result;
  }

  /** Admin từ chối yêu cầu */
  async rejectTransferRequest(
    adminId: number,
    requestId: number,
    adminNote?: string,
    context?: AdminRequestContext,
  ) {
    const result = await this.database.transaction(async (client) => {
      const req = await client.query<{ user_id: number; status: string }>(
        `SELECT user_id, status FROM reservation_requests
         WHERE request_id = $1 AND request_type = 'transfer' FOR UPDATE`,
        [requestId],
      );
      if (!req.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (req.rows[0].status !== 'pending') {
        throw new BadRequestException('Yêu cầu này không thể bị từ chối ở trạng thái hiện tại');
      }
      await client.query(
        `UPDATE reservation_requests
         SET status = 'rejected', admin_id = $2, admin_note = $3,
             reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [requestId, adminId, adminNote ?? null],
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'transfer_rejected', 'Yêu cầu chuyển nhượng bị từ chối',
                 $2, 'transfer_request', $3)`,
        [
          req.rows[0].user_id,
          adminNote
            ? `Yêu cầu chuyển nhượng bị từ chối. Lý do: ${adminNote}`
            : 'Yêu cầu chuyển nhượng của bạn đã bị từ chối.',
          requestId,
        ],
      );
      return { id: requestId, status: 'rejected' };
    });
    this.publishRealtime(['transfers', 'notifications']);
    return result;
  }

  /** Admin tạo lịch hẹn ký hợp đồng — reuses offline_appointments */
  async createTransferAppointment(
    adminId: number,
    requestId: number,
    dto: CreateTransferAppointmentDto,
  ) {
    const result = await this.database.transaction(async (client) => {
      const req = await client.query<{ user_id: number; status: string }>(
        `SELECT user_id, status FROM reservation_requests
         WHERE request_id = $1 AND request_type = 'transfer' FOR UPDATE`,
        [requestId],
      );
      if (!req.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (req.rows[0].status !== 'approved') {
        throw new BadRequestException('Yêu cầu cần được duyệt trước khi đặt lịch');
      }
      // Cancel any existing scheduled appointment for this request
      await client.query(
        `UPDATE offline_appointments
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE request_id = $1 AND is_deleted = FALSE AND status = 'scheduled'`,
        [requestId],
      );
      const appt = await client.query<{ appointment_id: number }>(
        `INSERT INTO offline_appointments
           (request_id, date_range_start, date_range_end, location, admin_note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING appointment_id`,
        [requestId, dto.rangeStart, dto.rangeEnd, dto.location, dto.note ?? null, adminId],
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'transfer_appointment_scheduled', 'Lịch hẹn ký hợp đồng chuyển nhượng',
                 'Ban quản lý đã đặt lịch hẹn ký hợp đồng. Vui lòng xem chi tiết và xác nhận.',
                 'transfer_request', $2)`,
        [req.rows[0].user_id, requestId],
      );
      return { id: appt.rows[0].appointment_id, requestId };
    });
    this.publishRealtime(['transfers', 'notifications']);
    return result;
  }

  /** Customer xác nhận lịch hẹn — reuses offline_appointments */
  async confirmTransferAppointment(userId: number, requestId: number) {
    const result = await this.database.transaction(async (client) => {
      const req = await client.query<{ user_id: number; status: string }>(
        `SELECT user_id, status FROM reservation_requests
         WHERE request_id = $1 AND request_type = 'transfer' FOR UPDATE`,
        [requestId],
      );
      if (!req.rows[0] || req.rows[0].user_id !== userId)
        throw new NotFoundException('Không tìm thấy yêu cầu');
      await client.query(
        `UPDATE offline_appointments
         SET customer_status = 'confirmed', customer_selected_date = CURRENT_DATE,
             updated_at = NOW()
         WHERE request_id = $1 AND is_deleted = FALSE AND status = 'scheduled'`,
        [requestId],
      );
      return { id: requestId, appointmentConfirmed: true };
    });
    this.publishRealtime(['transfers']);
    return result;
  }

  // NOTE: PDF generation, payment recording, and signed evidence upload are
  // handled by the existing ContractsController endpoints:
  //   POST /admin/contracts/:id/generated-pdf
  //   POST /admin/contracts/:id/payments
  //   POST /admin/contracts/:id/signed-evidence
  // The admin frontend uses the contractId returned from approveTransferRequest.

  /** Admin kích hoạt quyền sở hữu — bước cuối: đóng ownership cũ + activate contract mới */
  async activateTransferOwnership(
    adminId: number,
    requestId: number,
    context?: AdminRequestContext,
  ) {
    const result = await this.database.transaction(async (client) => {
      // Find the contract linked to this transfer request
      const req = await client.query<any>(
        `SELECT rr.request_id, rr.user_id, rr.status, rr.transfer_type,
                c.contract_id, c.user_id AS recipient_user_id,
                c.status AS contract_status, c.payment_status
         FROM reservation_requests rr
         JOIN contracts c ON c.request_id = rr.request_id AND c.is_deleted = FALSE
         WHERE rr.request_id = $1 AND rr.request_type = 'transfer' FOR UPDATE`,
        [requestId],
      );
      const transferReq = req.rows[0];
      if (!transferReq) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (transferReq.status === 'completed') {
        throw new BadRequestException('Yêu cầu chuyển nhượng này đã được hoàn tất');
      }
      if (transferReq.contract_status !== 'draft') {
        throw new BadRequestException('Hợp đồng không ở trạng thái nháp');
      }

      // Verify signed evidence exists
      const evidence = await client.query(
        `SELECT evidence_id FROM contract_signed_evidence WHERE contract_id = $1 LIMIT 1`,
        [transferReq.contract_id],
      );
      if (!evidence.rows.length) {
        throw new BadRequestException('Chưa có tài liệu hợp đồng đã ký');
      }

      // For sale: verify payment is complete
      if (transferReq.transfer_type === 'sale' && transferReq.payment_status !== 'paid') {
        throw new BadRequestException('Hợp đồng cần được thanh toán đầy đủ trước khi kích hoạt');
      }

      // Get plots from contract_plots
      const plots = await client.query<{ plot_id: number; plot_code: string }>(
        `SELECT p.plot_id, p.plot_code
         FROM contract_plots cp JOIN plots p ON p.plot_id = cp.plot_id
         WHERE cp.contract_id = $1`,
        [transferReq.contract_id],
      );

      // Close old ownership records and mark old contracts as transferred
      for (const plot of plots.rows) {
        await client.query(
          `UPDATE ownership_records
           SET is_current = FALSE, ownership_end = CURRENT_DATE,
               transfer_note = COALESCE(transfer_note || E'\\n', '') || $2
           WHERE plot_id = $1 AND is_current = TRUE`,
          [plot.plot_id, `Transferred via request #${requestId}`],
        );
        await client.query(
          `UPDATE contracts SET status = 'transferred', updated_at = NOW()
           WHERE plot_id = $1 AND status = 'active' AND is_deleted = FALSE`,
          [plot.plot_id],
        );
      }

      // Activate new contract → trigger fn_auto_create_ownership fires
      await client.query(
        `UPDATE contracts SET status = 'active', updated_at = NOW()
         WHERE contract_id = $1 AND status = 'draft'`,
        [transferReq.contract_id],
      );

      // Mark transfer request completed
      await client.query(
        `UPDATE reservation_requests SET status = 'completed', updated_at = NOW()
         WHERE request_id = $1`,
        [requestId],
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs
           (user_id, action, entity_type, entity_key, old_value, new_value, ip_address, user_agent)
         VALUES ($1, 'transfer_request.activate_ownership', 'transfer_request', $2, $3::jsonb, $4::jsonb, $5, $6)`,
        [
          adminId,
          String(requestId),
          JSON.stringify({ transferStatus: transferReq.status }),
          JSON.stringify({ transferStatus: 'completed', contractId: transferReq.contract_id }),
          context?.ipAddress ?? null,
          context?.userAgent ?? null,
        ],
      );

      // Notify customer
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'transfer_completed', 'Chuyển nhượng lô hoàn tất',
                 'Quyền sở hữu lô đã được chuyển sang bên nhận thành công.',
                 'transfer_request', $2)`,
        [transferReq.user_id, requestId],
      );

      return {
        id: requestId,
        status: 'completed',
        contractId: transferReq.contract_id,
        plotCount: plots.rows.length,
        plotCodes: plots.rows.map((p: any) => p.plot_code),
      };
    });
    this.publishRealtime(['transfers', 'contracts', 'ownership', 'plots', 'notifications', 'dashboard']);
    return result;
  }

  /** Admin/Customer download tài liệu đính kèm yêu cầu */
  async getTransferRequestDocument(userId: number, documentId: number, isAdmin = false) {
    const doc = await this.database.queryOne<{
      storedFilename: string;
      originalFilename: string;
      requestUserId: number;
    }>(
      `SELECT d.stored_filename AS "storedFilename", d.original_filename AS "originalFilename",
              rr.user_id AS "requestUserId"
       FROM transfer_request_documents d
       JOIN reservation_requests rr ON rr.request_id = d.request_id
       WHERE d.document_id = $1`,
      [documentId],
    );
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    if (!isAdmin && doc.requestUserId !== userId) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }
    return doc;
  }

  private publishRealtime(topics: RealtimeTopic[]) {
    try {
      this.realtime?.publish(topics, ['authenticated']);
    } catch (err) {
      this.logger.warn(`Realtime publish failed: ${(err as Error).message}`);
    }
  }
}
