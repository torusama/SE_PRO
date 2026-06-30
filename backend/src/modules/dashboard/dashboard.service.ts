import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async summary() {
    const row = await this.database.queryOne(
      `SELECT total_plots AS "totalPlots", available_plots AS "availablePlots",
              reserved_plots AS "reservedPlots", sold_plots AS "soldPlots",
              locked_plots AS "lockedPlots", pending_requests AS "pendingRequests",
              active_services AS "activeServices", total_customers AS "totalCustomers",
              total_collected::float AS "estimatedRevenue"
       FROM vw_dashboard_summary`,
    );
    return row ?? {};
  }

  plots() { return this.database.query('SELECT * FROM vw_plot_statistics'); }
  revenue() { return this.database.query('SELECT * FROM vw_revenue_by_month'); }
  services() { return this.database.query('SELECT * FROM vw_service_statistics'); }
}
