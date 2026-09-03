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
import { composeContractContent } from '../contracts/contract-content';

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

  async getDetail(id: string) {
    const batch = await this.database.queryOne<any>(
      `SELECT b.batch_id AS id, b.batch_code AS "batchCode", b.plot_count AS "plotCount",
              b.admin_note AS "adminNote", b.created_at AS "createdAt",
              old.user_id AS "previousHolderId", old.full_name AS "previousHolderName",
              old.email AS "previousHolderEmail", old.phone_number AS "previousHolderPhone",
              old.id_card_number AS "previousHolderIdCard", old.address AS "previousHolderAddress",
              recipient.user_id AS "recipientId", recipient.full_name AS "recipientName",
              recipient.email AS "recipientEmail", recipient.phone_number AS "recipientPhone",
              recipient.id_card_number AS "recipientIdCard", recipient.address AS "recipientAddress",
              b.recipient_snapshot AS "recipientSnapshot",
              admin.full_name AS "createdByName"
       FROM admin_transfer_batches b
       JOIN users old ON old.user_id = b.previous_holder_user_id
       JOIN users recipient ON recipient.user_id = b.recipient_user_id
       JOIN users admin ON admin.user_id = b.created_by
       WHERE b.batch_id = $1`,
      [id],
    );
    if (!batch) throw new NotFoundException('Không tìm thấy phiên chuyển nhượng');

    const [items, documents] = await Promise.all([
      this.database.query(
        `SELECT item.item_id AS "itemId", p.plot_id AS "plotId", p.plot_code AS "plotCode",
                z.zone_name AS "zoneName", p.area_sqm::float AS "areaSqm",
                old_c.contract_code AS "previousContractCode",
                new_c.contract_code AS "newContractCode"
         FROM admin_transfer_items item
         JOIN plots p ON p.plot_id = item.plot_id
         JOIN cemetery_zones z ON z.zone_id = p.zone_id
         JOIN contracts old_c ON old_c.contract_id = item.previous_contract_id
         JOIN contracts new_c ON new_c.contract_id = item.new_contract_id
         WHERE item.batch_id = $1 ORDER BY p.plot_code`,
        [id],
      ),
      this.database.query(
        `SELECT document_id AS id, original_filename AS filename, mime_type AS "mimeType",
                size_bytes AS "sizeBytes", created_at AS "createdAt"
         FROM admin_transfer_documents WHERE batch_id = $1 ORDER BY created_at`,
        [id],
      ),
    ]);

    return { ...batch, items, documents };
  }

  async ownership(query: AdminOwnershipQueryDto = new AdminOwnershipQueryDto()) {
    const values: unknown[] = [];
    const conditions: string[] = [
      'p.is_deleted = FALSE',
      'u.is_deleted = FALSE',
    ];
    const add = (val: unknown) => {
      values.push(val);
      return `$${values.length}`;
    };
    if (query.currentOnly !== false) {
      conditions.push('o.is_current=TRUE');
    }
    if (query.holderId) {
      conditions.push(`u.user_id = ${add(query.holderId)}`);
    }
    if (query.plotId) {
      conditions.push(`p.plot_id = ${add(query.plotId)}`);
    }
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR p.plot_code ILIKE ${p})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM ownership_records o
       JOIN plots p ON p.plot_id=o.plot_id
       JOIN contracts c ON c.contract_id=o.contract_id
       JOIN users u ON u.user_id=o.user_id ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT o.ownership_id AS id, o.user_id AS "userId", o.plot_id AS "plotId",
              o.contract_id AS "contractId", o.ownership_start AS "ownershipStart",
              o.ownership_end AS "ownershipEnd", o.is_current AS "isCurrent",
              o.transfer_note AS "transferNote", p.plot_code AS "plotCode",
              p.status AS "plotStatus", u.full_name AS "holderName",
              u.email AS "holderEmail", u.phone_number AS "holderPhone"
       FROM ownership_records o
       JOIN plots p ON p.plot_id=o.plot_id
       JOIN contracts c ON c.contract_id=o.contract_id
       JOIN users u ON u.user_id=o.user_id
       ${where} ORDER BY o.ownership_start DESC, o.ownership_id DESC
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

  async getAvailablePlots(customerQuery?: AdminOwnershipQueryDto) {
    const values: unknown[] = [];
    const conditions: string[] = [
      'o.is_current = TRUE',
      'p.is_deleted = FALSE',
      "p.status = 'sold'",
      "c.status = 'active'",
      'u.is_deleted = FALSE',
    ];
    if (customerQuery?.holderId) {
      values.push(customerQuery.holderId);
      conditions.push(`u.user_id = $${values.length}`);
    }
    if (customerQuery?.search) {
      values.push(`%${customerQuery.search}%`);
      const p = `$${values.length}`;
      conditions.push(
        `(u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR u.phone_number ILIKE ${p} OR p.plot_code ILIKE ${p})`,
      );
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.database.query(
      `SELECT p.plot_id AS "plotId", p.plot_code AS "plotCode", p.status AS "plotStatus",
              p.area_sqm::float AS "areaSqm", z.zone_name AS "zoneName",
              c.contract_id AS "contractId", c.contract_code AS "contractCode",
              o.ownership_id AS "ownershipId", u.user_id AS "holderId",
              u.full_name AS "holderName", u.email AS "holderEmail",
              u.phone_number AS "holderPhone", u.id_card_number AS "holderIdCard",
              u.address AS "holderAddress"
       FROM ownership_records o
       JOIN plots p ON p.plot_id = o.plot_id
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       JOIN contracts c ON c.contract_id = o.contract_id
       JOIN users u ON u.user_id = o.user_id
       ${where}
       ORDER BY u.full_name, p.plot_code LIMIT 200`,
      values,
    );
  }

  async executeBatch(
    adminId: number,
    rawInput: unknown,
    files: Express.Multer.File[],
    context?: AdminRequestContext,
  ) {
    const input = this.validateInput(rawInput);
    if (!files.length) {
      throw new BadRequestException('Cần ít nhất một văn bản ảnh hoặc PDF');
    }
    try {
      return await this.database.transaction(async (client) => {
        const ownerships = await client.query<any>(
          `SELECT o.ownership_id, o.plot_id, o.user_id, o.contract_id,
                  p.plot_code, z.zone_name, p.area_sqm::float AS area_sqm,
                  u.full_name, u.email, u.phone_number, u.id_card_number, u.address
           FROM ownership_records o
           JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
           JOIN cemetery_zones z ON z.zone_id = p.zone_id
           JOIN contracts c ON c.contract_id = o.contract_id AND c.status = 'active'
           JOIN users u ON u.user_id = o.user_id AND u.is_deleted = FALSE
           WHERE o.plot_id = ANY($1::int[]) AND o.is_current = TRUE
           FOR UPDATE OF o, p, c`,
          [input.plotIds],
        );
        if (ownerships.rows.length !== input.plotIds.length) {
          throw new BadRequestException(
            'Một hoặc nhiều phần mộ không hợp lệ hoặc không có quyền sở hữu hiện hành',
          );
        }
        const previousHolderId = ownerships.rows[0].user_id;
        const differentHolder = ownerships.rows.some(
          (row: any) => row.user_id !== previousHolderId,
        );
        if (differentHolder) {
          throw new BadRequestException(
            'Tất cả các phần mộ được chọn phải thuộc cùng một chủ sở hữu',
          );
        }
        const recipient = await this.resolveRecipient(client, input.recipient);
        if (recipient.userId === previousHolderId) {
          throw new BadRequestException(
            'Người nhận không được trùng với người chuyển nhượng',
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
          const baseContent = this.renderTransferContractBase(
            contractCode,
            {
              full_name: old.full_name,
              id_card_number: old.id_card_number,
              phone_number: old.phone_number,
              address: old.address,
            },
            {
              full_name: input.recipient.fullName,
              id_card_number: input.recipient.idCard,
              phone_number: input.recipient.phone,
              address: input.recipient.address,
            },
            [
              {
                plot_code: old.plot_code,
                zone_name: old.zone_name,
                area_sqm: old.area_sqm,
              },
            ],
            0,
          );
          const contractContent = composeContractContent(baseContent);
          const newContract = await client.query<{ contract_id: number }>(
            `INSERT INTO contracts
               (contract_code,user_id,plot_id,contract_date,effective_date,total_amount,paid_amount,
                payment_status,status,created_by,notes,group_contract_code,ownership_source,
                contract_base_content,contract_content,inheritance_content)
             VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_DATE,0,0,'paid','active',$4,$5,$6,'transfer',$7,$8,NULL)
             RETURNING contract_id`,
            [
              contractCode,
              recipient.userId,
              old.plot_id,
              adminId,
              `Created from admin transfer ${batchCode}`,
              groupCode,
              baseContent,
              contractContent,
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

  async transferDetail(id: string) {
    return this.getDetail(id);
  }

  async transfer(
    adminId: number,
    rawInput: unknown,
    files: Express.Multer.File[],
    context?: AdminRequestContext,
  ) {
    return this.executeBatch(adminId, rawInput, files, context);
  }

  async getTransferRequestDocument(userId: number, documentId: number, isAdmin = false) {
    const doc = await this.database.queryOne<{
      storedFilename: string;
      originalFilename: string;
      mimeType: string;
      userId: number;
    }>(
      `SELECT d.stored_filename AS "storedFilename", d.original_filename AS "originalFilename",
              d.mime_type AS "mimeType", rr.user_id AS "userId"
       FROM transfer_request_documents d
       JOIN reservation_requests rr ON rr.request_id = d.request_id
       WHERE d.document_id = $1`,
      [documentId],
    );
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    if (!isAdmin && doc.userId !== userId) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }
    return doc;
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

  /**
   * Tạo nội dung cơ sở cho hợp đồng chuyển nhượng / thừa kế / tặng cho.
   * Bên A = Chủ sở hữu cũ (bên chuyển nhượng) lấy từ hệ thống.
   * Bên B = Người nhận quyền sử dụng lấy từ yêu cầu chuyển nhượng.
   */
  private renderTransferContractBase(
    code: string,
    seller: {
      full_name: string;
      id_card_number: string | null;
      phone_number: string | null;
      address: string | null;
    },
    buyer: {
      full_name: string;
      id_card_number: string | null;
      phone_number: string | null;
      address: string | null;
    },
    plots: Array<{
      plot_code: string;
      zone_name?: string | null;
      area_sqm?: number | null;
    }>,
    totalAmount: number,
  ) {
    const plotDetails = plots
      .map(
        (plot, index) =>
          `${index + 1}. Lô ${plot.plot_code}${plot.zone_name ? `, ${plot.zone_name}` : ''}, diện tích ${plot.area_sqm ?? '...'} m².`,
      )
      .join('\n');
    const plotPrices = plots
      .map(
        (plot, index) =>
          `${index + 1}. Lô ${plot.plot_code}: ${Number(totalAmount / (plots.length || 1)).toLocaleString('vi-VN')} đồng.`,
      )
      .join('\n');
    const total = totalAmount.toLocaleString('vi-VN');
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

HỢP ĐỒNG CUNG CẤP QUYỀN SỬ DỤNG VỊ TRÍ PHẦN MỘ VÀ DỊCH VỤ NGHĨA TRANG
Số: ${code}

Căn cứ Bộ luật Dân sự số 91/2015/QH13 và pháp luật Việt Nam có liên quan;
Căn cứ nhu cầu của Bên B và khả năng cung cấp dịch vụ của Bên A;

BÊN A - BÊN CHUYỂN NHƯỢNG
Họ tên: ${seller.full_name}
CCCD/CMND: ${seller.id_card_number || '................................'}
Địa chỉ: ${seller.address || '................................'}
Điện thoại: ${seller.phone_number || '................................'}

BÊN B - BÊN NHẬN
Họ tên: ${buyer.full_name}
CCCD/CMND: ${buyer.id_card_number || '................................'}
Địa chỉ: ${buyer.address || '................................'}
Điện thoại: ${buyer.phone_number || '................................'}

ĐIỀU 1. ĐỐI TƯỢNG HỢP ĐỒNG
Bên A cung cấp cho Bên B quyền sử dụng các vị trí phần mộ sau:
${plotDetails}
Các vị trí trên được sử dụng theo quy hoạch và quy chế quản lý nghĩa trang. Hợp đồng này không mặc nhiên là hợp đồng chuyển nhượng quyền sử dụng đất.

ĐIỀU 2. GIÁ TRỊ VÀ THANH TOÁN
${plotPrices}
Tổng giá trị hợp đồng: ${total} đồng. Thời hạn, phương thức và chứng từ thanh toán thực hiện theo thỏa thuận/phiếu thu hợp lệ của hai bên.

ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A
Bàn giao đúng vị trí, cung cấp thông tin quy chế; quản lý, bảo vệ hạ tầng chung; tôn trọng quyền hợp pháp của Bên B; thông báo các khoản phí và thay đổi có liên quan theo hợp đồng và pháp luật.

ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B
Thanh toán đầy đủ; sử dụng đúng mục đích mai táng, đúng quy hoạch, nội quy, vệ sinh và môi trường; không tự ý chuyển giao, thay đổi hiện trạng hoặc sử dụng vị trí vào mục đích khác khi chưa được chấp thuận hợp lệ.

ĐIỀU 5. THỜI HẠN, CHẤM DỨT VÀ GIẢI QUYẾT TRANH CHẤP
Thời hạn và thời điểm có hiệu lực được ghi tại phần ký kết. Hai bên ưu tiên thương lượng; nếu không thành, tranh chấp được giải quyết tại cơ quan có thẩm quyền theo pháp luật Việt Nam.`;
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
        `SELECT o.plot_id, o.ownership_id, p.plot_code, p.price AS plot_price,
                p.status AS plot_status
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

      // 2. Check no active transfer request exists for these plots
      const existingActive = await client.query<{ plot_id: number }>(
        `SELECT rp.plot_id
         FROM request_plots rp
         JOIN reservation_requests rr ON rr.request_id = rp.request_id
         WHERE rp.plot_id = ANY($1::int[])
           AND rr.request_type = 'transfer'
           AND rr.status IN ('pending', 'approved')
         LIMIT 1`,
        [dto.plotIds],
      );
      if (existingActive.rows.length) {
        throw new ConflictException(
          'Một hoặc nhiều lô đã có yêu cầu chuyển nhượng đang xử lý',
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
           (user_id, request_type, transfer_type, status, total_price, requester_name, note)
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
          `INSERT INTO request_plots (request_id, plot_id, plot_price)
           VALUES ($1, $2, $3)`,
          [
            requestId,
            plotId,
            ownerships.rows.find((ownership: any) => ownership.plot_id === plotId)
              ?.plot_price,
          ],
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
      `SELECT appointment_id AS id, scheduled_at AS "rangeStart",
              scheduled_end_at AS "rangeEnd", location, status,
              customer_selected_at::date AS "customerSelectedDate",
              customer_selected_at::time AS "customerSelectedTime",
              customer_status AS "customerStatus",
              note
       FROM offline_appointments
       WHERE request_id = $1 AND is_deleted = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [requestId],
    );
    // Find contract linked to this request
    const contract = await this.database.queryOne<any>(
      `SELECT contract_id AS "contractId", contract_code AS "contractCode",
              status, payment_status AS "paymentStatus",
              total_amount::float AS "totalAmount", paid_amount::float AS "paidAmount",
              generated_pdf_at AS "generatedPdfAt",
              contract_base_content AS "contractBaseContent",
              contract_content AS "contractContent",
              inheritance_content AS "inheritanceContent",
              contract_date AS "contractDate"
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
        `SELECT appointment_id AS id, scheduled_at AS "rangeStart",
                scheduled_end_at AS "rangeEnd", location, status,
                customer_selected_at::date AS "customerSelectedDate",
                customer_selected_at::time AS "customerSelectedTime",
                customer_status AS "customerStatus",
                note
         FROM offline_appointments
         WHERE request_id = $1 AND is_deleted = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [requestId],
      ),
      this.database.queryOne<any>(
        `SELECT contract_id AS "contractId", contract_code AS "contractCode",
                status, payment_status AS "paymentStatus",
                total_amount::float AS "totalAmount", paid_amount::float AS "paidAmount",
                generated_pdf_at AS "generatedPdfAt",
                contract_base_content AS "contractBaseContent",
                contract_content AS "contractContent",
                inheritance_content AS "inheritanceContent",
                contract_date AS "contractDate"
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

      // 1. Get seller (Bên A - Chủ sở hữu cũ lấy từ hệ thống theo transferReq.user_id)
      const sellerResult = await client.query<{
        full_name: string;
        id_card_number: string | null;
        phone_number: string | null;
        address: string | null;
      }>(
        `SELECT full_name, id_card_number, phone_number, address
         FROM users WHERE user_id = $1`,
        [transferReq.user_id],
      );
      const seller = sellerResult.rows[0] ?? {
        full_name: '',
        id_card_number: null,
        phone_number: null,
        address: null,
      };

      // 2. Buyer (Bên B - Bên nhận lấy từ yêu cầu chuyển nhượng transferReq)
      const buyer = {
        full_name: transferReq.recipient_full_name,
        id_card_number: transferReq.recipient_id_card ?? null,
        phone_number: transferReq.recipient_phone ?? null,
        address: transferReq.recipient_address ?? null,
      };

      // 3. Get plots from request_plots with zone and area
      const plots = await client.query<{
        plot_id: number;
        plot_code: string;
        zone_name?: string | null;
        area_sqm?: number | null;
      }>(
        `SELECT p.plot_id, p.plot_code, z.zone_name, p.area_sqm::float AS area_sqm
         FROM request_plots rp
         JOIN plots p ON p.plot_id = rp.plot_id
         LEFT JOIN cemetery_zones z ON z.zone_id = p.zone_id
         WHERE rp.request_id = $1 ORDER BY p.plot_code`,
        [requestId],
      );
      if (plots.rows.length === 0) {
        throw new BadRequestException('Yêu cầu chưa có lô chuyển nhượng');
      }

      // 4. Resolve or create recipient user account
      const recipient = await this.resolveRecipient(client, {
        fullName: transferReq.recipient_full_name,
        email: transferReq.recipient_email ?? `transfer_${requestId}@placeholder.local`,
        phone: transferReq.recipient_phone,
        idCard: transferReq.recipient_id_card,
        address: transferReq.recipient_address ?? '',
        dateOfBirth: transferReq.recipient_date_of_birth,
      });

      // 5. Create transfer contract (draft) — reuses the contracts table
      const isSale = transferReq.transfer_type === 'sale';
      const totalAmount = isSale ? Number(transferReq.transaction_amount ?? 0) : 0;
      const year = new Date().getUTCFullYear();
      const contractCode = `HD-CN-${year}-${String(requestId).padStart(6, '0')}`;
      const groupCode = plots.rows.length > 1 ? `GRP-CN-${requestId}` : null;
      const ownershipSource =
        transferReq.transfer_type === 'inheritance' ? 'inheritance' : 'transfer';

      const baseContent = this.renderTransferContractBase(
        contractCode,
        seller,
        buyer,
        plots.rows,
        totalAmount,
      );
      const contractContent = composeContractContent(baseContent);

      const contractInsert = await client.query<{ contract_id: number }>(
        `INSERT INTO contracts
           (contract_code, user_id, plot_id, request_id,
            contract_date, effective_date,
            total_amount, paid_amount,
            payment_status, status,
            created_by, notes, group_contract_code, ownership_source,
            contract_base_content, contract_content, inheritance_content)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,CURRENT_DATE,$5::numeric,0,
                 CASE WHEN $5::numeric = 0::numeric THEN 'paid' ELSE 'unpaid' END,
                 'draft',$6,$7,$8,$9,$10,$11,NULL)
         RETURNING contract_id`,
        [
          contractCode,
          recipient.userId,
          plots.rows[0].plot_id,
          requestId,
          totalAmount,
          adminId,
          `Created from transfer request #${requestId}`,
          groupCode,
          ownershipSource,
          baseContent,
          contractContent,
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
          adminNote ? `Lý do: ${adminNote}` : 'Yêu cầu chuyển nhượng của bạn đã bị từ chối.',
          requestId,
        ],
      );
      return { id: requestId, status: 'rejected' };
    });
    this.publishRealtime(['transfers', 'notifications']);
    return result;
  }

  /** Admin tạo khoảng ngày lịch hẹn ký hợp đồng — reuses offline_appointments */
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
           (request_id, user_id, scheduled_at, scheduled_end_at, location, note, created_by, status)
         VALUES ($1, (SELECT user_id FROM reservation_requests WHERE request_id = $1), $2, $3, $4, $5, $6, 'scheduled')
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
  async confirmTransferAppointment(
    userId: number,
    requestId: number,
    selectedAt?: string,
  ) {
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
         SET customer_status = 'confirmed',
             customer_responded_at = NOW(),
             customer_selected_at = COALESCE($2::timestamptz, NOW()),
             updated_at = NOW()
         WHERE request_id = $1 AND is_deleted = FALSE AND status = 'scheduled'`,
        [requestId, selectedAt ?? null],
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         SELECT user_id, 'transfer_appointment_confirmed', 'Khách hàng đã xác nhận lịch hẹn chuyển nhượng',
                'Khách hàng đã xác nhận lịch hẹn ký hợp đồng chuyển nhượng.',
                'transfer_request', $1
         FROM users
         WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
        [requestId],
      );
      return { id: requestId, appointmentConfirmed: true };
    });
    this.publishRealtime(['transfers', 'notifications']);
    return result;
  }

  /** Admin kích hoạt quyền sở hữu sau khi ký hợp đồng và thanh toán đủ */
  async activateTransferOwnership(
    adminId: number,
    requestId: number,
    context?: AdminRequestContext,
  ) {
    const result = await this.database.transaction(async (client) => {
      // 1. Get contract and transfer details
      const contract = await client.query<any>(
        `SELECT c.contract_id, c.contract_code, c.user_id AS recipient_user_id,
                c.status, c.payment_status, c.total_amount, c.paid_amount,
                rr.user_id AS seller_user_id, rr.transfer_type,
                EXISTS (
                  SELECT 1 FROM contract_signed_evidence evidence
                  WHERE evidence.contract_id = c.contract_id
                ) AS has_signed_evidence
         FROM contracts c
         JOIN reservation_requests rr ON rr.request_id = c.request_id
         WHERE c.request_id = $1 AND c.is_deleted = FALSE FOR UPDATE OF c`,
        [requestId],
      );
      if (!contract.rows[0]) {
        throw new NotFoundException('Không tìm thấy hợp đồng cho yêu cầu này');
      }
      const c = contract.rows[0];
      if (c.status !== 'draft') {
        throw new BadRequestException('Hợp đồng không ở trạng thái nháp');
      }

      // Check signed evidence uploaded
      if (!c.has_signed_evidence) {
        throw new BadRequestException(
          'Cần tải lên tài liệu minh chứng hợp đồng đã ký trước khi kích hoạt quyền sở hữu',
        );
      }

      // For sale transfer: check payment is complete
      if (c.transfer_type === 'sale' && Number(c.total_amount) > 0) {
        if (c.payment_status !== 'paid' && Number(c.paid_amount) < Number(c.total_amount)) {
          throw new BadRequestException(
            'Chưa hoàn tất thanh toán hợp đồng chuyển nhượng',
          );
        }
      }

      // 2. Get plots
      const plots = await client.query<{ plot_id: number; plot_code: string }>(
        `SELECT cp.plot_id, p.plot_code
         FROM contract_plots cp
         JOIN plots p ON p.plot_id = cp.plot_id
         WHERE cp.contract_id = $1`,
        [c.contract_id],
      );

      // 3. Close old ownership records for these plots
      for (const plot of plots.rows) {
        await client.query(
          `UPDATE ownership_records
           SET is_current = FALSE, ownership_end = CURRENT_DATE,
               transfer_note = COALESCE(transfer_note || E'\n', '') || $2
           WHERE plot_id = $1 AND is_current = TRUE`,
          [plot.plot_id, `Transferred via request #${requestId} / contract ${c.contract_code}`],
        );
        // Also close the old contract for this plot
        await client.query(
          `UPDATE contracts SET status = 'transferred', updated_at = NOW()
           WHERE plot_id = $1 AND status = 'active' AND contract_id <> $2`,
          [plot.plot_id, c.contract_id],
        );
      }

      // 4. Activate new contract
      // Trigger fn_auto_create_ownership will create ownership_records for the recipient!
      await client.query(
        `UPDATE contracts
         SET status = 'active', effective_date = CURRENT_DATE, updated_at = NOW()
         WHERE contract_id = $1`,
        [c.contract_id],
      );

      // 5. Complete reservation_request
      await client.query(
        `UPDATE reservation_requests
         SET status = 'completed', updated_at = NOW()
         WHERE request_id = $1`,
        [requestId],
      );

      // 6. Complete appointment if any
      await client.query(
        `UPDATE offline_appointments
         SET status = 'completed', updated_at = NOW()
         WHERE request_id = $1 AND is_deleted = FALSE`,
        [requestId],
      );

      // 7. Audit log
      await client.query(
        `INSERT INTO audit_logs
           (user_id, action, entity_type, entity_id, entity_key, old_value, new_value, ip_address, user_agent)
         VALUES ($1, 'transfer_request_ownership_activated', 'transfer_request', NULL, $2,
                 $3::jsonb, $4::jsonb, $5, $6)`,
        [
          adminId,
          String(requestId),
          JSON.stringify({ sellerUserId: c.seller_user_id, status: 'approved' }),
          JSON.stringify({ recipientUserId: c.recipient_user_id, status: 'completed', contractId: c.contract_id }),
          context?.ipAddress ?? null,
          context?.userAgent ?? null,
        ],
      );

      // 8. Notify both parties
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES
           ($1, 'ownership_activated', 'Quyền sở hữu đã được chuyển giao',
            'Quy trình chuyển nhượng lô đất đã hoàn tất. Quyền sở hữu đã được chuyển sang người nhận.',
            'transfer_request', $3),
           ($2, 'ownership_activated', 'Quyền sở hữu đã được kích hoạt',
            'Bạn đã chính thức trở thành chủ sở hữu mới của lô đất.',
            'contract', $4)`,
        [c.seller_user_id, c.recipient_user_id, requestId, c.contract_id],
      );

      return {
        id: requestId,
        status: 'completed',
        contractId: c.contract_id,
        contractCode: c.contract_code,
        plotsTransferred: plots.rows.map((p) => p.plot_code),
      };
    });

    this.publishRealtime(['transfers', 'contracts', 'ownership', 'plots', 'notifications']);
    return result;
  }

  private publishRealtime(topics: RealtimeTopic[]) {
    this.realtime?.publish(topics, ['admin', 'authenticated']);
  }
}
