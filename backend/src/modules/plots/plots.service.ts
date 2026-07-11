import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreatePlotDto } from './dto/create-plot.dto';
import { UpdatePlotDto } from './dto/update-plot.dto';

interface PlotStatusRow {
  id: number;
  status: string;
}

@Injectable()
export class PlotsService {
  constructor(private readonly database: DatabaseService) {}

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
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_name AS "zoneName",
              row_number AS "rowCode", column_number AS "plotNumber",
              status, price::float, area_sqm::float AS area,
              map_x AS "mapX", map_y AS "mapY", map_width AS "mapWidth",
              map_height AS "mapHeight", zone_color AS "zoneColor", direction,
              plot_type AS "plotType", description
       FROM vw_plots_map
       ORDER BY zone_code, row_number, column_number`,
    );
  }

  async findOne(id: number) {
    const plot = await this.database.queryOne(
      `SELECT plot_id AS id, plot_code AS "plotCode", zone_id AS "zoneId",
              zone_name AS "zoneName", row_number AS "rowCode",
              column_number AS "plotNumber", status, price::float,
              area_sqm::float AS area, direction, plot_type AS "plotType",
              description, image_url AS "imageUrl", owner_id AS "ownerId",
              owner_name AS "ownerName", deceased_name AS "deceasedName"
       FROM vw_plots_map
       WHERE plot_id = $1`,
      [id],
    );
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  async create(dto: CreatePlotDto) {
    return this.database.queryOne(
      `INSERT INTO plots (plot_code, zone_id, row_number, column_number, price, area_sqm, direction, plot_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'single'))
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
}
