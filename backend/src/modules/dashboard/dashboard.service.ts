import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export type RevenuePeriod = 'day' | 'month' | 'quarter' | 'year';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async summary() {
    const row = await this.database.queryOne<Record<string, unknown>>(
      `SELECT
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE) AS "totalPlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = TRUE) AS "deletedPlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE AND status = 'available') AS "availablePlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE AND status = 'pending') AS "pendingPlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE AND status = 'reserved') AS "reservedPlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE AND status = 'sold') AS "soldPlots",
        (SELECT COUNT(*)::int FROM plots WHERE is_deleted = FALSE AND status = 'locked') AS "lockedPlots",
        (SELECT COUNT(*)::int FROM users WHERE is_deleted = FALSE AND LOWER(role) = 'customer') AS "totalCustomers",
        (SELECT COUNT(*)::int FROM reservation_requests WHERE is_deleted = FALSE AND is_ai_draft = FALSE) AS "regularRequests",
        (SELECT COUNT(*)::int FROM reservation_requests WHERE is_deleted = FALSE AND is_ai_draft = TRUE) AS "aiDraftRequests",
        (SELECT COUNT(*)::int FROM reservation_requests WHERE is_deleted = FALSE AND status IN ('pending','submitted')) AS "pendingRequests",
        (SELECT COUNT(*)::int FROM contracts WHERE is_deleted = FALSE) AS "totalContracts",
        (SELECT COUNT(*)::int FROM contracts WHERE is_deleted = FALSE AND status = 'active') AS "activeContracts",
        (SELECT COUNT(*)::int FROM admin_transfer_batches) AS "totalTransfers",
        (SELECT COUNT(*)::int FROM service_orders WHERE is_deleted = FALSE) AS "totalServiceOrders",
        (SELECT COUNT(*)::int FROM service_orders WHERE is_deleted = FALSE AND status NOT IN ('completed','cancelled')) AS "activeServices",
        (SELECT COUNT(*)::int FROM offline_appointments WHERE is_deleted = FALSE) AS "totalAppointments",
        COALESCE((SELECT SUM(total_amount)::float FROM contracts WHERE is_deleted = FALSE AND status <> 'cancelled'), 0) AS "plotSaleRevenue",
        COALESCE((SELECT SUM(amount)::float FROM service_orders WHERE is_deleted = FALSE AND status = 'completed'), 0) AS "serviceRevenue",
        COALESCE((SELECT SUM(amount)::float FROM payment_transactions), 0) AS "totalPaid"`,
    );
    return (
      row ?? {
        totalPlots: 0,
        totalCustomers: 0,
        pendingRequests: 0,
        totalContracts: 0,
        totalPaid: 0,
      }
    );
  }

  plots() {
    return this.database.query(
      `SELECT zone_code AS "zoneCode", zone_name AS "zoneName", status,
              total_plots::int AS "totalPlots",
              COALESCE(total_value, 0)::float AS "totalValue",
              COALESCE(total_area, 0)::float AS "totalArea"
       FROM vw_plot_statistics
       ORDER BY zone_code, status`,
    );
  }

  revenue(period: RevenuePeriod = 'month') {
    const unit = {
      day: 'day',
      month: 'month',
      quarter: 'quarter',
      year: 'year',
    }[period];
    return this.database.query(
      `WITH periods AS (
         SELECT date_trunc('${unit}', c.contract_date::timestamp) AS period,
                COUNT(*)::int AS "totalContracts",
                COALESCE(SUM(c.total_amount), 0)::float AS "expectedRevenue",
                0::float AS "serviceRevenue"
         FROM contracts c
         WHERE c.is_deleted = FALSE AND c.status <> 'cancelled'
         GROUP BY 1
         UNION ALL
         SELECT date_trunc('${unit}', COALESCE(s.completed_at, s.created_at)) AS period,
                0::int, 0::float,
                COALESCE(SUM(s.amount), 0)::float
         FROM service_orders s
         WHERE s.is_deleted = FALSE AND s.status = 'completed'
         GROUP BY 1
       ),
       paid AS (
         SELECT date_trunc('${unit}', payment_date::timestamp) AS period,
                COALESCE(SUM(amount), 0)::float AS "collectedRevenue"
         FROM payment_transactions GROUP BY 1
       )
       SELECT p.period,
              SUM(p."totalContracts")::int AS "totalContracts",
              SUM(p."expectedRevenue")::float AS "expectedRevenue",
              SUM(p."serviceRevenue")::float AS "serviceRevenue",
              COALESCE(MAX(pay."collectedRevenue"), 0)::float AS "collectedRevenue"
       FROM periods p LEFT JOIN paid pay ON pay.period = p.period
       GROUP BY p.period ORDER BY p.period`,
    );
  }

  services() {
    return this.database.query(
      `SELECT service_type_id AS "serviceTypeId", service_name AS "serviceName",
              category, total_orders::int AS "totalOrders",
              COALESCE(total_revenue, 0)::float AS "totalRevenue",
              completed::int, active::int, cancelled::int
       FROM vw_service_statistics ORDER BY service_name`,
    );
  }
}
