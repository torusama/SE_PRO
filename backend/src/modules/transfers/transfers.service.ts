import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { AdminOwnershipQueryDto } from './dto/admin-ownership-query.dto';
import { AdminTransferQueryDto } from './dto/admin-transfer-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';

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
  constructor(private readonly database: DatabaseService) {}

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
}
