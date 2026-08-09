import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import {
  PlotAdjacencyResult,
  PlotAdjacencyService,
} from '../plots/plot-adjacency.service';
import { CreateMultipleReservationDto } from './dto/create-multiple-reservation.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { AdminReservationQueryDto } from './dto/admin-reservation-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { composeContractContent } from '../contracts/contract-content';

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
  customerIdCard?: string | null;
  customerDateOfBirth?: Date | string | null;
  customerGender?: string | null;
  customerNationality?: string | null;
  customerAddress?: string | null;
  customerWard?: string | null;
  customerCity?: string | null;
  customerNotes?: string | null;
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
  areaSqm?: number | string | null;
  zoneCode?: string | null;
  zoneName?: string | null;
  direction?: string | null;
  plotType?: string | null;
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
export class ReservationsService implements OnModuleInit {
  private readonly activeStatuses: ReservationStatus[] = [
    'pending',
    'submitted',
    'approved',
  ];

  constructor(
    private readonly database: DatabaseService,
    private readonly plotAdjacency?: PlotAdjacencyService,
    private readonly config?: ConfigService,
    private readonly audit?: AdminAuditService,
  ) {}

  async onModuleInit() {
    await this.releaseExpiredReservations();
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'release-expired-plot-reservations',
  })
  async releaseExpiredReservations() {
    return this.database.transaction(async (client) => {
      const cancelled = await client.query<{ id: number }>(
        `UPDATE reservation_requests rr
         SET status = 'cancelled',
             admin_note = COALESCE(NULLIF(rr.admin_note, '') || ' | ', '') ||
               'Tự động hủy do hết thời gian giữ chỗ',
             updated_at = NOW()
         WHERE rr.is_deleted = FALSE
           AND rr.status IN ('pending', 'submitted')
           AND EXISTS (
             SELECT 1
             FROM request_plots rp
             JOIN plots p ON p.plot_id = rp.plot_id
             WHERE rp.request_id = rr.request_id
               AND p.status = 'pending'
               AND p.reserved_until < NOW()
           )
         RETURNING rr.request_id AS id`,
      );
      const released = await client.query<{ id: number }>(
        `UPDATE plots p
         SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE p.is_deleted = FALSE
           AND p.status = 'pending'
           AND p.reserved_until < NOW()
           AND NOT EXISTS (
             SELECT 1
             FROM request_plots rp
             JOIN reservation_requests rr ON rr.request_id = rp.request_id
             WHERE rp.plot_id = p.plot_id
               AND rr.is_deleted = FALSE
               AND rr.status = ANY($1::text[])
           )
         RETURNING p.plot_id AS id`,
        [this.activeStatuses],
      );
      return {
        requestsCancelled: cancelled.rowCount ?? cancelled.rows.length,
        plotsReleased: released.rowCount ?? released.rows.length,
      };
    });
  }

  async create(
    userId: number,
    dto: CreateReservationDto,
    isAiDraft = false,
    expectedTotal?: number,
  ) {
    return this.createReservation(userId, dto, isAiDraft, false, expectedTotal);
  }

  async createMultiple(userId: number, dto: CreateMultipleReservationDto) {
    if (dto.plotIds.length < 2) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất hai lô cho yêu cầu nhiều lô',
      );
    }
    return this.createReservation(userId, dto, false, true);
  }

  private async createReservation(
    userId: number,
    dto: CreateReservationDto,
    isAiDraft = false,
    requireAdjacency = false,
    expectedTotal?: number,
  ) {
    this.assertUniquePlotIds(dto.plotIds);

    return this.database.transaction(async (client) => {
      const plots = await this.lockPlots(client, dto.plotIds);
      if (
        plots.length !== dto.plotIds.length ||
        plots.some((plot) => plot.status !== 'available')
      ) {
        throw new BadRequestException('Tất cả các lô đã chọn phải còn trống');
      }
      const adjacency = requireAdjacency
        ? this.validateAdjacency(plots)
        : undefined;

      const total = plots.reduce((sum, plot) => sum + Number(plot.price), 0);
      if (
        expectedTotal !== undefined &&
        Math.abs(total - expectedTotal) >= 0.01
      ) {
        throw new ConflictException(
          'Giá lô đã thay đổi sau khi bạn xác nhận. Vui lòng kiểm tra và xác nhận lại tổng giá mới.',
        );
      }
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
        throw new BadRequestException(
          'Một hoặc nhiều lô đã chọn không còn trống',
        );
      }

      await this.notifyAdmins(
        client,
        dto.type === 'purchase' ? 'Yêu cầu mua lô mới' : 'Yêu cầu giữ chỗ mới',
        `Khách hàng vừa gửi yêu cầu ${dto.type === 'purchase' ? 'mua' : 'giữ chỗ'} ${plots.length} lô, đang chờ duyệt.`,
        requestId,
      );

      const detail = await this.getDetailForClient(client, requestId, userId);
      return adjacency ? { ...detail, adjacency } : detail;
    });
  }

  /** Báo cho toàn bộ admin đang hoạt động biết có yêu cầu mới cần xử lý. */
  private async notifyAdmins(
    client: PoolClient,
    title: string,
    message: string,
    requestId: number,
  ) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       SELECT user_id, 'request_submitted', $1, $2, 'reservation_request', $3
       FROM users
       WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
      [title, message, requestId],
    );
  }

  async submit(userId: number, id: number) {
    return this.database.transaction(async (client) => {
      const request = await this.getOwnedRequest(client, userId, id);
      if (!['draft', 'cancelled'].includes(request.status)) {
        throw new BadRequestException(
          'Chỉ có thể gửi yêu cầu đang ở trạng thái nháp',
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
        throw new BadRequestException(
          'Một hoặc nhiều lô đã chọn không còn trống',
        );
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
      const request = await this.getOwnedRequest(client, userId, id);
      if (!['draft', 'pending', 'submitted'].includes(request.status)) {
        throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ xử lý');
      }
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
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    const plots = await this.database.query<PlotRow>(this.plotsSql(), [id]);
    return this.mapDetail(request, plots);
  }

  async adminList(
    query: AdminReservationQueryDto = new AdminReservationQueryDto(),
  ) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const value = add(`%${query.search}%`);
      conditions.push(
        `(customer_name ILIKE ${value} OR customer_email ILIKE ${value} OR EXISTS (
          SELECT 1 FROM unnest(plot_codes) code WHERE code ILIKE ${value}
        ))`,
      );
    }
    if (query.status) conditions.push(`status = ${add(query.status)}`);
    if (query.type) conditions.push(`request_type = ${add(query.type)}`);
    if (query.source)
      conditions.push(`is_ai_draft = ${add(query.source === 'ai')}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vw_reservation_requests_full ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT request_id AS id, request_type AS type, status,
              customer_name AS "customerName", customer_email AS "customerEmail",
              total_price::float AS "totalPrice", plot_codes AS "plotCodes",
              plot_count::int AS "plotCount", created_at AS "createdAt",
              reviewed_at AS "reviewedAt",
              CASE WHEN is_ai_draft THEN 'ai' ELSE 'customer' END AS source
       FROM vw_reservation_requests_full
       ${where}
       ORDER BY created_at DESC
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

  async adminOne(id: number) {
    const request = await this.database.queryOne<ReservationRow>(
      this.detailSql('WHERE rr.request_id = $1'),
      [id],
    );
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    const plots = await this.database.query<PlotRow>(this.plotsSql(), [id]);
    return this.mapDetail(request, plots);
  }

  async approve(
    adminId: number,
    id: number,
    adminNote?: string,
    context?: AdminRequestContext,
  ) {
    return this.database.transaction(async (client) => {
      const request = await this.lockRequest(client, id);
      this.assertPendingDecision(request.status, 'approved');
      const plots = await this.lockRequestPlots(client, id);
      this.assertPlotsPending(plots);

      // Approval only reserves the plots. Ownership is activated separately
      // after an administrator uploads the signed-contract evidence.
      const finalPlotStatus = 'reserved';
      const plotIds = plots.map((plot) => plot.id);
      const plotUpdate = await client.query(
        `UPDATE plots
         SET status = $2, reserved_until = NULL, updated_at = NOW()
         WHERE plot_id = ANY($1::int[]) AND status = 'pending'`,
        [plotIds, finalPlotStatus],
      );
      if (plotUpdate.rowCount !== plotIds.length) {
        throw new BadRequestException(
          'Các lô trong yêu cầu không còn ở trạng thái chờ duyệt',
        );
      }

      await client.query(
        `UPDATE reservation_requests
         SET status = 'approved', admin_id = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, adminNote || null],
      );
      const contracts =
        request.request_type === 'purchase'
          ? await this.createPurchaseContracts(client, request, plots, adminId)
          : [];
      await this.notify(
        client,
        request.user_id,
        'request_approved',
        'Yêu cầu đã được duyệt',
        'Yêu cầu giữ chỗ hoặc mua lô của bạn đã được duyệt.',
        id,
      );
      await this.audit?.record(client, {
        action: 'reservation.approve',
        entityType: 'reservation_request',
        entityId: id,
        before: { status: request.status },
        after: { status: 'approved', plotStatus: finalPlotStatus, adminNote },
        context: context ?? {
          adminId,
          ipAddress: null,
          userAgent: null,
        },
      });

      return {
        id,
        status: 'approved',
        plotStatus: finalPlotStatus,
        notificationCreated: true,
        ...(request.request_type === 'purchase' ? { contracts } : {}),
      };
    });
  }

  private async createPurchaseContracts(
    client: PoolClient,
    request: LockedReservationRow,
    plots: PlotRow[],
    adminId: number,
  ) {
    const buyerResult = await client.query<{
      full_name: string;
      id_card_number: string | null;
      phone_number: string | null;
      address: string | null;
    }>(
      `SELECT full_name, id_card_number, phone_number, address
       FROM users WHERE user_id = $1`,
      [request.user_id],
    );
    const buyer = buyerResult.rows[0] ?? {
      full_name: '',
      id_card_number: null,
      phone_number: null,
      address: null,
    };
    const seller = {
      name:
        this.config?.get<string>('contractSellerName') ??
        'ĐƠN VỊ QUẢN LÝ NGHĨA TRANG',
      taxCode: this.config?.get<string>('contractSellerTaxCode') ?? '',
      address: this.config?.get<string>('contractSellerAddress') ?? '',
      representative:
        this.config?.get<string>('contractSellerRepresentative') ?? '',
      title: this.config?.get<string>('contractSellerTitle') ?? '',
    };
    const code = `HD-${new Date().getFullYear()}-${request.request_id}`;
    const groupCode = `GRP-${request.request_id}`;
    const baseContent = this.renderPurchaseContractBase(
      code,
      seller,
      buyer,
      plots,
    );
    const content = composeContractContent(baseContent);
    const totalAmount = plots.reduce(
      (total, plot) => total + Number(plot.price),
      0,
    );
    const inserted = await client.query<{
      id: number;
      contractCode: string;
    }>(
      `INSERT INTO contracts
         (contract_code, request_id, user_id, plot_id, total_amount,
          created_by, group_contract_code, ownership_source, contract_base_content,
          contract_content, inheritance_content, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'purchase', $8, $9, NULL, 'draft')
       RETURNING contract_id AS id, contract_code AS "contractCode"`,
      [
        code,
        request.request_id,
        request.user_id,
        plots[0].id,
        totalAmount,
        adminId,
        groupCode,
        baseContent,
        content,
      ],
    );
    const contract = inserted.rows[0];

    for (const plot of plots) {
      await client.query(
        `INSERT INTO contract_plots (contract_id, plot_id, agreed_price)
         VALUES ($1, $2, $3)`,
        [contract.id, plot.id, Number(plot.price)],
      );
    }

    return [contract];
  }

  private renderPurchaseContractBase(
    code: string,
    seller: {
      name: string;
      taxCode: string;
      address: string;
      representative: string;
      title: string;
    },
    buyer: {
      full_name: string;
      id_card_number: string | null;
      phone_number: string | null;
      address: string | null;
    },
    plots: PlotRow[],
  ) {
    const plotDetails = plots
      .map(
        (plot, index) =>
          `${index + 1}. Lô ${plot.code}${plot.zoneName ? `, ${plot.zoneName}` : ''}, diện tích ${plot.areaSqm ?? '...'} m².`,
      )
      .join('\n');
    const plotPrices = plots
      .map(
        (plot, index) =>
          `${index + 1}. Lô ${plot.code}: ${Number(plot.price).toLocaleString('vi-VN')} đồng.`,
      )
      .join('\n');
    const total = plots
      .reduce((sum, plot) => sum + Number(plot.price), 0)
      .toLocaleString('vi-VN');
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

HỢP ĐỒNG CUNG CẤP QUYỀN SỬ DỤNG VỊ TRÍ PHẦN MỘ VÀ DỊCH VỤ NGHĨA TRANG
Số: ${code}

Căn cứ Bộ luật Dân sự số 91/2015/QH13 và pháp luật Việt Nam có liên quan;
Căn cứ nhu cầu của Bên B và khả năng cung cấp dịch vụ của Bên A;

BÊN A - ĐƠN VỊ QUẢN LÝ/CUNG CẤP DỊCH VỤ
Tên: ${seller.name}
Mã số thuế: ${seller.taxCode || '................................'}
Địa chỉ: ${seller.address || '................................'}
Đại diện: ${seller.representative || '................................'}
Chức vụ: ${seller.title || '................................'}

BÊN B - NGƯỜI SỬ DỤNG DỊCH VỤ
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

  async reject(
    adminId: number,
    id: number,
    adminNote?: string,
    context?: AdminRequestContext,
  ) {
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
        'Yêu cầu đã bị từ chối',
        'Yêu cầu giữ chỗ hoặc mua lô của bạn đã bị từ chối.',
        id,
      );
      await this.audit?.record(client, {
        action: 'reservation.reject',
        entityType: 'reservation_request',
        entityId: id,
        before: { status: request.status },
        after: { status: 'rejected', plotStatus: 'available', adminNote },
        context: context ?? {
          adminId,
          ipAddress: null,
          userAgent: null,
        },
      });

      return {
        id,
        status: 'rejected',
        plotStatus: 'available',
        notificationCreated: true,
      };
    });
  }

  async cancelApprovedReserve(
    adminId: number,
    id: number,
    adminNote?: string,
    context?: AdminRequestContext,
  ) {
    const reason = adminNote?.trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng nhập lý do hủy giữ chỗ');
    }
    return this.database.transaction(async (client) => {
      const request = await this.lockRequest(client, id);
      if (request.request_type !== 'reserve') {
        throw new BadRequestException(
          'Yêu cầu mua lô phải được xử lý qua quy trình hủy hợp đồng',
        );
      }
      if (request.status !== 'approved') {
        throw new BadRequestException(
          'Chỉ có thể hủy giữ chỗ đối với yêu cầu đã được duyệt',
        );
      }

      const plots = await this.lockRequestPlots(client, id);
      if (plots.some((plot) => plot.status !== 'reserved')) {
        throw new BadRequestException(
          'Các lô trong yêu cầu không còn ở trạng thái đã giữ chỗ',
        );
      }
      const plotIds = plots.map((plot) => plot.id);
      const released = await client.query(
        `UPDATE plots
         SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE plot_id = ANY($1::int[]) AND status = 'reserved'`,
        [plotIds],
      );
      if (released.rowCount !== plotIds.length) {
        throw new BadRequestException('Không thể trả toàn bộ lô về trạng thái còn trống');
      }

      await client.query(
        `UPDATE reservation_requests
         SET status = 'cancelled', admin_id = $2,
             admin_note = COALESCE(NULLIF(admin_note, '') || E'\n', '') || $3,
             reviewed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1`,
        [id, adminId, `Hủy giữ chỗ: ${reason}`],
      );
      await client.query(
        `UPDATE offline_appointments
         SET status = 'cancelled', status_note = $2, cancelled_at = NOW(),
             updated_by = $3, updated_at = NOW()
         WHERE request_id = $1 AND status = 'scheduled' AND is_deleted = FALSE`,
        [id, `Hủy giữ chỗ: ${reason}`, adminId],
      );
      await this.notify(
        client,
        request.user_id,
        'reservation_cancelled_by_admin',
        'Yêu cầu giữ chỗ đã được hủy',
        `Admin đã hủy giữ chỗ. Lý do: ${reason}`,
        id,
      );
      await this.audit?.record(client, {
        action: 'reservation.cancel_approved_reserve',
        entityType: 'reservation_request',
        entityId: id,
        before: { status: request.status, plotStatus: 'reserved' },
        after: { status: 'cancelled', plotStatus: 'available', reason },
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });

      return {
        id,
        status: 'cancelled',
        plotStatus: 'available',
        releasedPlotIds: plotIds,
        notificationCreated: true,
      };
    });
  }

  private assertUniquePlotIds(plotIds: number[]) {
    if (new Set(plotIds).size !== plotIds.length) {
      throw new BadRequestException(
        'Danh sách lô không được chứa mã trùng nhau',
      );
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
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    return request;
  }

  private async lockRequestPlots(client: PoolClient, requestId: number) {
    const result = await client.query<PlotRow>(
      `SELECT p.plot_id AS id, p.plot_code AS code, p.status,
              rp.plot_price::float AS price,
               p.zone_id AS "zoneId", p.row_number AS "rowNumber",
               p.column_number AS "columnNumber", p.map_x AS "mapX",
               p.map_y AS "mapY", p.map_width AS "mapWidth",
               p.map_height AS "mapHeight", p.area_sqm::float AS "areaSqm",
               z.zone_code AS "zoneCode", z.zone_name AS "zoneName"
       FROM request_plots rp
       JOIN plots p ON p.plot_id = rp.plot_id
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE rp.request_id = $1
       ORDER BY p.plot_id
       FOR UPDATE`,
      [requestId],
    );
    if (!result.rows.length) {
      throw new BadRequestException('Yêu cầu không có lô nào');
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
      throw new BadRequestException(
        'Các lô trong yêu cầu không còn ở trạng thái chờ duyệt',
      );
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
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu');
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
    if (!request.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu');
    const plots = await client.query<PlotRow>(this.plotsSql(), [requestId]);
    return this.mapDetail(request.rows[0], plots.rows);
  }

  private detailSql(whereClause: string) {
    return `SELECT rr.request_id AS id, rr.request_type AS type, rr.status,
                   rr.total_price::float AS "totalPrice", rr.note,
                   rr.admin_note AS "adminNote", rr.reviewed_at AS "reviewedAt",
                   rr.created_at AS "createdAt",
                   u.full_name AS "customerName", u.email AS "customerEmail",
                   u.phone_number AS "customerPhone", u.notes AS "customerNotes",
                   u.id_card_number AS "customerIdCard",
                   u.date_of_birth AS "customerDateOfBirth",
                   u.gender AS "customerGender", u.nationality AS "customerNationality",
                   u.address AS "customerAddress", u.ward AS "customerWard",
                   u.city AS "customerCity",
                   adm.full_name AS "adminName"
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
                   p.map_height AS "mapHeight", p.area_sqm::float AS "areaSqm",
                   p.direction, p.plot_type AS "plotType",
                   z.zone_code AS "zoneCode", z.zone_name AS "zoneName"
            FROM request_plots rp
            JOIN plots p ON p.plot_id = rp.plot_id
            JOIN cemetery_zones z ON z.zone_id = p.zone_id
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
        'Các lô đã chọn thiếu dữ liệu vị trí để kiểm tra tính liền kề',
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
