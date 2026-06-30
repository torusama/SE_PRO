import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';

@Injectable()
export class CemeteryServicesService {
  constructor(private readonly database: DatabaseService) {}

  serviceTypes() {
    return this.database.query(
      `SELECT service_type_id AS id, name, description, base_price::float AS "basePrice", unit, category
       FROM service_types WHERE is_active = TRUE AND is_deleted = FALSE ORDER BY sort_order, name`,
    );
  }

  async createOrder(userId: number, dto: CreateServiceOrderDto) {
    const type = await this.database.queryOne('SELECT * FROM service_types WHERE service_type_id = $1 AND is_deleted = FALSE', [dto.serviceTypeId]);
    if (!type) throw new NotFoundException('Service type not found');
    return this.database.queryOne(
      `INSERT INTO service_orders (user_id, plot_id, service_type_id, unit_price, amount, requested_date, note)
       VALUES ($1, $2, $3, $4, $4, $5, $6)
       RETURNING order_id AS id, status, amount::float`,
      [userId, dto.plotId ?? null, dto.serviceTypeId, type.base_price, dto.requestedDate ?? null, dto.note ?? null],
    );
  }

  myOrders(userId: number) { return this.orders('WHERE so.user_id = $1', [userId]); }
  adminOrders() { return this.orders('ORDER BY so.created_at DESC'); }
  async one(id: number, userId?: number) {
    const order = await this.database.queryOne(this.ordersSql(`WHERE so.order_id = $1 ${userId ? 'AND so.user_id = $2' : ''}`), userId ? [id, userId] : [id]);
    if (!order) throw new NotFoundException('Service order not found');
    return order;
  }

  async updateStatus(id: number, status: string, adminId: number) {
    return this.database.transaction(async (client) => {
      const order = await client.query(
        `UPDATE service_orders SET status = $2, admin_id = $3, updated_at = NOW()
         WHERE order_id = $1 AND is_deleted = FALSE
         RETURNING order_id AS id, user_id, status`,
        [id, status, adminId],
      );
      if (!order.rows[0]) throw new NotFoundException('Service order not found');
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, 'service_order', $5)`,
        [order.rows[0].user_id, `service_${status}`, 'Service order updated', `Your service order is ${status}.`, id],
      );
      return order.rows[0];
    });
  }

  async complete(id: number, body: any, adminId: number) {
    await this.updateStatus(id, 'completed', adminId);
    return this.database.queryOne(
      `UPDATE service_orders SET completion_note = $2, completion_image_urls = $3, completed_at = NOW()
       WHERE order_id = $1
       RETURNING order_id AS id, status, completion_note AS "completionNote"`,
      [id, body.completionNote ?? null, body.imageUrls ?? []],
    );
  }

  private orders(where: string, params: unknown[] = []) {
    return this.database.query(this.ordersSql(where), params);
  }

  private ordersSql(suffix: string) {
    return `SELECT so.order_id AS id, so.status, so.amount::float, so.requested_date AS "requestedDate",
                   so.created_at AS "createdAt", st.name AS "serviceName", p.plot_code AS "plotCode",
                   u.full_name AS "customerName"
            FROM service_orders so
            JOIN service_types st ON st.service_type_id = so.service_type_id
            JOIN users u ON u.user_id = so.user_id
            LEFT JOIN plots p ON p.plot_id = so.plot_id
            ${suffix}`;
  }
}
