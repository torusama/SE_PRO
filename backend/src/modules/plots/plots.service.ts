import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreatePlotDto } from './dto/create-plot.dto';
import { UpdatePlotDto } from './dto/update-plot.dto';
import { AdminPlotQueryDto } from './dto/admin-plot-query.dto';
import { CreateAdminZoneDto, UpdateAdminZoneDto } from './dto/admin-zone.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import type { PoolClient } from 'pg';

interface PlotStatusRow {
  id: number;
  status: string;
}

@Injectable()
export class PlotsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit?: AdminAuditService,
  ) {}

  private async auditedMutation<T>(
    id: number | null,
    action: string,
    context: AdminRequestContext,
    mutation: (
      client: PoolClient,
      before: Record<string, unknown> | null,
    ) => Promise<T>,
  ) {
    return this.database.transaction(async (client) => {
      let before: Record<string, unknown> | null = null;
      if (id !== null) {
        const locked = await client.query(
          `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
                  status, price::float, is_deleted AS "isDeleted",
                  previous_status AS "previousStatus", lock_reason AS "lockReason"
           FROM plots WHERE plot_id=$1 FOR UPDATE`,
          [id],
        );
        before = locked.rows[0] ?? null;
        if (!before) throw new NotFoundException('Plot not found');
      }
      const after = await mutation(client, before);
      const entityId =
        id ?? Number((after as Record<string, unknown> | null)?.id ?? 0);
      await this.audit?.record(client, {
        action,
        entityType: 'plot',
        entityId: entityId || null,
        before,
        after,
        context,
      });
      return after;
    });
  }

  async findAll(status?: string) {
    const params = status ? [status] : [];
    return this.database.query(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_name AS "zoneName",
              row_number AS "rowCode", column_number AS "plotNumber",
              status, price::float, area_sqm::float AS area, direction, plot_type AS "plotType"
       FROM vw_plots_map
       ${status ? 'WHERE status = $1' : ''}
       ORDER BY zone_code, row_number, column_number`,
      params,
    );
  }

  async map() {
    return this.database.query(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
              zone_code AS "zoneCode", zone_name AS "zoneName",
              row_number AS "rowCode", column_number AS "plotNumber",
              status, price::float, area_sqm::float AS area,
              map_x AS "mapX", map_y AS "mapY", map_width AS "mapWidth",
              map_height AS "mapHeight", zone_color AS "zoneColor", direction,
              plot_type AS "plotType", description
       FROM vw_plots_map
       ORDER BY zone_code, row_number, column_number`,
    );
  }

  async zones() {
    return this.database.query(
      `SELECT zone_id AS id, zone_code AS code, zone_name AS name,
              color_hex AS color, sort_order AS "sortOrder"
       FROM cemetery_zones
       WHERE is_active = TRUE
       ORDER BY sort_order, zone_code`,
    );
  }

  async adminZones() {
    return this.database.query(
      `SELECT zone_id AS id, zone_code AS code, zone_name AS name,
              description, map_x AS "mapX", map_y AS "mapY",
              map_width AS "mapWidth", map_height AS "mapHeight",
              color_hex AS color, sort_order AS "sortOrder",
              is_active AS "isActive", created_at AS "createdAt"
       FROM cemetery_zones ORDER BY sort_order, zone_code`,
    );
  }

  async createZone(dto: CreateAdminZoneDto) {
    try {
      return await this.database.queryOne(
        `INSERT INTO cemetery_zones
           (zone_code, zone_name, description, map_x, map_y, map_width,
            map_height, color_hex, sort_order)
         VALUES (UPPER($1),$2,$3,COALESCE($4,0),COALESCE($5,0),
                 COALESCE($6,100),COALESCE($7,100),COALESCE($8,'#008573'),
                 COALESCE($9,0))
         RETURNING zone_id AS id, zone_code AS code, zone_name AS name,
                   is_active AS "isActive"`,
        [
          dto.code,
          dto.name,
          dto.description ?? null,
          dto.mapX ?? null,
          dto.mapY ?? null,
          dto.mapWidth ?? null,
          dto.mapHeight ?? null,
          dto.colorHex ?? null,
          dto.sortOrder ?? null,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new BadRequestException('Mã khu đã tồn tại');
      throw error;
    }
  }

  async updateZone(id: number, dto: UpdateAdminZoneDto) {
    const row = await this.database.queryOne(
      `UPDATE cemetery_zones SET
         zone_name = COALESCE($2, zone_name),
         description = COALESCE($3, description),
         map_x = COALESCE($4, map_x), map_y = COALESCE($5, map_y),
         map_width = COALESCE($6, map_width),
         map_height = COALESCE($7, map_height),
         color_hex = COALESCE($8, color_hex),
         sort_order = COALESCE($9, sort_order),
         is_active = COALESCE($10, is_active)
       WHERE zone_id = $1
       RETURNING zone_id AS id, zone_code AS code, zone_name AS name,
                 is_active AS "isActive"`,
      [
        id,
        dto.name ?? null,
        dto.description ?? null,
        dto.mapX ?? null,
        dto.mapY ?? null,
        dto.mapWidth ?? null,
        dto.mapHeight ?? null,
        dto.colorHex ?? null,
        dto.sortOrder ?? null,
        dto.isActive ?? null,
      ],
    );
    if (!row) throw new NotFoundException('Không tìm thấy khu nghĩa trang');
    return row;
  }

  deactivateZone(id: number) {
    return this.updateZone(id, { isActive: false });
  }

  restoreZone(id: number) {
    return this.updateZone(id, { isActive: true });
  }

  async adminFindAll(query: AdminPlotQueryDto) {
    const values: unknown[] = [];
    const conditions = [query.includeDeleted ? 'TRUE' : 'p.is_deleted = FALSE'];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(p.plot_code ILIKE ${p} OR z.zone_name ILIKE ${p} OR p.description ILIKE ${p})`,
      );
    }
    if (query.zoneId) conditions.push(`p.zone_id = ${add(query.zoneId)}`);
    if (query.status) conditions.push(`p.status = ${add(query.status)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.database.query(
      `SELECT p.plot_id AS id, p.plot_code AS "plotCode",
              p.zone_id AS "zoneId", z.zone_code AS "zoneCode",
              z.zone_name AS "zoneName", p.row_number AS "rowCode",
              p.column_number AS "plotNumber", p.status, p.price::float,
              p.area_sqm::float AS area, p.direction,
              p.plot_type AS "plotType", p.map_x AS "mapX", p.map_y AS "mapY",
              p.map_width AS "mapWidth", p.map_height AS "mapHeight",
              p.description, p.is_deleted AS "isDeleted",
              p.lock_reason AS "lockReason"
       FROM plots p JOIN cemetery_zones z ON z.zone_id = p.zone_id
       ${where}
       ORDER BY z.sort_order, p.row_number, p.column_number
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

  async restore(id: number) {
    const plot = await this.database.queryOne(
      `UPDATE plots SET is_deleted = FALSE, updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = TRUE
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [id],
    );
    if (!plot) throw new NotFoundException('Không tìm thấy lô đã xóa');
    return plot;
  }

  async findOne(id: number) {
    const plot = await this.database.queryOne(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
              zone_name AS "zoneName", row_number AS "rowCode",
              column_number AS "plotNumber", status, price::float,
              area_sqm::float AS area, direction, plot_type AS "plotType",
              description, image_url AS "imageUrl"
       FROM vw_plots_map
       WHERE plot_id = $1`,
      [id],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async create(dto: CreatePlotDto) {
    return this.database.queryOne(
      `INSERT INTO plots (
         plot_code, zone_id, row_number, column_number, price, area_sqm,
         direction, plot_type, description, map_x, map_y, map_width, map_height
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'single'), $9,
         COALESCE($10::double precision, 0),
         COALESCE($11::double precision, 0),
         COALESCE($12::double precision, 40),
         COALESCE($13::double precision, 40)
       )
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [
        dto.plotCode,
        dto.zoneId,
        dto.rowNumber ?? null,
        dto.columnNumber ?? null,
        dto.price,
        dto.area ?? null,
        dto.direction ?? null,
        dto.plotType ?? null,
        dto.description ?? null,
        dto.mapX ?? null,
        dto.mapY ?? null,
        dto.mapWidth ?? null,
        dto.mapHeight ?? null,
      ],
    );
  }

  async update(id: number, dto: UpdatePlotDto) {
    const plot = await this.database.queryOne(
      `UPDATE plots SET
          plot_code = COALESCE($2, plot_code),
          zone_id = COALESCE($3, zone_id),
          row_number = COALESCE($4, row_number),
          column_number = COALESCE($5, column_number),
          price = COALESCE($6, price),
          area_sqm = COALESCE($7, area_sqm),
          direction = COALESCE($8, direction),
          plot_type = COALESCE($9, plot_type),
          description = COALESCE($10, description),
          map_x = COALESCE($11, map_x),
          map_y = COALESCE($12, map_y),
          map_width = COALESCE($13, map_width),
          map_height = COALESCE($14, map_height),
          updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [
        id,
        dto.plotCode ?? null,
        dto.zoneId ?? null,
        dto.rowNumber ?? null,
        dto.columnNumber ?? null,
        dto.price ?? null,
        dto.area ?? null,
        dto.direction ?? null,
        dto.plotType ?? null,
        dto.description ?? null,
        dto.mapX ?? null,
        dto.mapY ?? null,
        dto.mapWidth ?? null,
        dto.mapHeight ?? null,
      ],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async updateStatus(id: number, status: string) {
    const current = await this.database.queryOne<PlotStatusRow>(
      `SELECT plot_id AS id, status FROM plots WHERE plot_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!current) throw new NotFoundException('Plot not found');
    if (current.status === 'locked' && status !== 'locked') {
      throw new BadRequestException(
        'Plot is locked. Unlock it first via /admin/plots/:id/unlock before changing status.',
      );
    }

    const plot = await this.database.queryOne(
      `UPDATE plots SET status = $2, updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [id, status],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async updatePrice(id: number, price: number) {
    const plot = await this.database.queryOne(
      `UPDATE plots SET price = $2, updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", price::float, status`,
      [id, price],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  /**
   * Locks a plot so it's excluded from availability/reservation flows.
   * Remembers the plot's current status in previous_status so unlock()
   * can restore it precisely (e.g. a 'reserved' plot stays 'reserved'
   * after unlock, instead of resetting to 'available'). Map geometry
   * columns are never touched here - only status/audit fields, so the
   * 2D map picks up the new status automatically on its next read of
   * vw_plots_map without any change to the view or map coordinates.
   */
  async lock(id: number, adminId: number, reason?: string) {
    const current = await this.database.queryOne<PlotStatusRow>(
      `SELECT plot_id AS id, status FROM plots WHERE plot_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!current) throw new NotFoundException('Plot not found');
    if (current.status === 'locked') {
      throw new BadRequestException('Plot is already locked');
    }

    const plot = await this.database.queryOne(
      `UPDATE plots
       SET previous_status = status,
           status = 'locked',
           locked_at = NOW(),
           locked_by = $2,
           lock_reason = $3,
           updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", status,
                 previous_status AS "previousStatus", locked_at AS "lockedAt",
                 lock_reason AS "lockReason"`,
      [id, adminId, reason ?? null],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async unlock(id: number) {
    const current = await this.database.queryOne<
      PlotStatusRow & { previous_status: string | null }
    >(
      `SELECT plot_id AS id, status, previous_status FROM plots WHERE plot_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!current) throw new NotFoundException('Plot not found');
    if (current.status !== 'locked') {
      throw new BadRequestException('Plot is not locked');
    }

    const plot = await this.database.queryOne(
      `UPDATE plots
       SET status = COALESCE(previous_status, 'available'),
           previous_status = NULL,
           locked_at = NULL,
           locked_by = NULL,
           lock_reason = NULL,
           updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [id],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async remove(id: number) {
    const plot = await this.database.queryOne(
      `UPDATE plots SET is_deleted = TRUE, updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id`,
      [id],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async adminCreate(dto: CreatePlotDto, context: AdminRequestContext) {
    return this.auditedMutation(
      null,
      'plot.create',
      context,
      async (client) => {
        const result = await client.query(
          `INSERT INTO plots
           (plot_code,zone_id,row_number,column_number,price,area_sqm,direction,
            plot_type,description,map_x,map_y,map_width,map_height)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'single'),$9,
                 COALESCE($10::double precision,0),
                 COALESCE($11::double precision,0),
                 COALESCE($12::double precision,40),
                 COALESCE($13::double precision,40))
         RETURNING plot_id AS id, plot_code AS "plotCode", status, price::float`,
          [
            dto.plotCode,
            dto.zoneId,
            dto.rowNumber ?? null,
            dto.columnNumber ?? null,
            dto.price,
            dto.area ?? null,
            dto.direction ?? null,
            dto.plotType ?? null,
            dto.description ?? null,
            dto.mapX ?? null,
            dto.mapY ?? null,
            dto.mapWidth ?? null,
            dto.mapHeight ?? null,
          ],
        );
        return result.rows[0];
      },
    );
  }

  async adminUpdate(
    id: number,
    dto: UpdatePlotDto,
    context: AdminRequestContext,
  ) {
    return this.auditedMutation(
      id,
      'plot.update',
      context,
      async (client, before) => {
        if (before?.isDeleted) throw new NotFoundException('Plot not found');
        const result = await client.query(
          `UPDATE plots SET plot_code=COALESCE($2,plot_code),
           zone_id=COALESCE($3,zone_id),row_number=COALESCE($4,row_number),
           column_number=COALESCE($5,column_number),price=COALESCE($6,price),
           area_sqm=COALESCE($7,area_sqm),direction=COALESCE($8,direction),
           plot_type=COALESCE($9,plot_type),description=COALESCE($10,description),
           map_x=COALESCE($11,map_x),map_y=COALESCE($12,map_y),
           map_width=COALESCE($13,map_width),map_height=COALESCE($14,map_height),
           updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=FALSE
         RETURNING plot_id AS id,plot_code AS "plotCode",status,price::float`,
          [
            id,
            dto.plotCode ?? null,
            dto.zoneId ?? null,
            dto.rowNumber ?? null,
            dto.columnNumber ?? null,
            dto.price ?? null,
            dto.area ?? null,
            dto.direction ?? null,
            dto.plotType ?? null,
            dto.description ?? null,
            dto.mapX ?? null,
            dto.mapY ?? null,
            dto.mapWidth ?? null,
            dto.mapHeight ?? null,
          ],
        );
        return result.rows[0];
      },
    );
  }

  async adminStatus(id: number, status: string, context: AdminRequestContext) {
    return this.auditedMutation(
      id,
      'plot.status.update',
      context,
      async (client, before) => {
        if (before?.isDeleted) throw new NotFoundException('Plot not found');
        void status;
        throw new BadRequestException(
          'Không thể đổi trạng thái lô trực tiếp. Hãy dùng duyệt/từ chối yêu cầu, kích hoạt quyền sở hữu, hoặc khóa/mở khóa lô.',
        );
      },
    );
  }

  async adminPrice(id: number, price: number, context: AdminRequestContext) {
    return this.auditedMutation(
      id,
      'plot.price.update',
      context,
      async (client, before) => {
        if (before?.isDeleted) throw new NotFoundException('Plot not found');
        const result = await client.query(
          `UPDATE plots SET price=$2,updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=FALSE
         RETURNING plot_id AS id,plot_code AS "plotCode",price::float,status`,
          [id, price],
        );
        return result.rows[0];
      },
    );
  }

  async adminLock(
    id: number,
    adminId: number,
    reason: string | undefined,
    context: AdminRequestContext,
  ) {
    return this.auditedMutation(
      id,
      'plot.lock',
      context,
      async (client, before) => {
        if (before?.isDeleted) throw new NotFoundException('Plot not found');
        if (before?.status === 'locked')
          throw new BadRequestException('Plot is already locked');
        const result = await client.query(
          `UPDATE plots SET previous_status=status,status='locked',locked_at=NOW(),
           locked_by=$2,lock_reason=$3,updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=FALSE
         RETURNING plot_id AS id,plot_code AS "plotCode",status,
                   previous_status AS "previousStatus",lock_reason AS "lockReason"`,
          [id, adminId, reason ?? null],
        );
        return result.rows[0];
      },
    );
  }

  async adminUnlock(id: number, context: AdminRequestContext) {
    return this.auditedMutation(
      id,
      'plot.unlock',
      context,
      async (client, before) => {
        if (before?.status !== 'locked')
          throw new BadRequestException('Plot is not locked');
        const result = await client.query(
          `UPDATE plots SET status=COALESCE(previous_status,'available'),
           previous_status=NULL,locked_at=NULL,locked_by=NULL,lock_reason=NULL,
           updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=FALSE
         RETURNING plot_id AS id,plot_code AS "plotCode",status`,
          [id],
        );
        return result.rows[0];
      },
    );
  }

  async adminRemove(id: number, context: AdminRequestContext) {
    return this.auditedMutation(
      id,
      'plot.delete',
      context,
      async (client, before) => {
        if (before?.isDeleted) throw new NotFoundException('Plot not found');
        if (['pending', 'reserved', 'sold'].includes(String(before?.status))) {
          throw new BadRequestException(
            'Plot with active business records cannot be deleted',
          );
        }
        const result = await client.query(
          `UPDATE plots SET is_deleted=TRUE,updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=FALSE RETURNING plot_id AS id`,
          [id],
        );
        return result.rows[0];
      },
    );
  }

  async adminRestore(id: number, context: AdminRequestContext) {
    return this.auditedMutation(
      id,
      'plot.restore',
      context,
      async (client, before) => {
        if (!before?.isDeleted)
          throw new NotFoundException('Không tìm thấy lô đã xóa');
        const result = await client.query(
          `UPDATE plots SET is_deleted=FALSE,updated_at=NOW()
         WHERE plot_id=$1 AND is_deleted=TRUE
         RETURNING plot_id AS id,plot_code AS "plotCode",status`,
          [id],
        );
        return result.rows[0];
      },
    );
  }
}
