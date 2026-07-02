import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreatePlotDto } from './dto/create-plot.dto';
import { UpdatePlotDto } from './dto/update-plot.dto';

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
    const plot = await this.database.queryOne(
      `UPDATE plots SET status = $2, updated_at = NOW()
       WHERE plot_id = $1 AND is_deleted = FALSE
       RETURNING plot_id AS id, plot_code AS "plotCode", status`,
      [id, status],
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
